import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  closeTestDatabase,
  executeSql,
  initializeTestDatabase,
  migrationSql,
  querySql,
} from '@/database/__tests__/sqliteTestDatabase';
import { MIGRATIONS, runMigrations } from '@/database/migrations';

// 11 November 2026, 12:00 in Minsk
const OCCURRED_AT = 1_794_387_600_000;
const MINSK_OFFSET_MIN = 180;
const OLD_UPDATED_AT = '2000-01-01T00:00:00.000Z';

let fingerprintNumber = 0;

// A parsed purchase: every rejection below breaks one column of it
async function insertDraft(row: Record<string, unknown> = {}): Promise<number> {
  fingerprintNumber += 1;
  const values: Record<string, unknown> = {
    capture_fingerprint: `fingerprint-${fingerprintNumber}`,
    package_name: 'com.iskra.mobile',
    posted_at: OCCURRED_AT,
    title: 'Безналичная оплата',
    text: 'Успешно, *3333, -11.90 BYN, Остаток: 61.10 BYN, BOOSTY.TO',
    template_id: 'bnb.push',
    amount_minor: 1190,
    currency: 'BYN',
    direction: 'debit',
    bank_status: 'ok',
    payee: 'BOOSTY.TO',
    card_digits: '3333',
    balance_minor: 6110,
    occurred_at: OCCURRED_AT,
    utc_offset_min: MINSK_OFFSET_MIN,
    ...row,
  };
  const columns = Object.keys(values);
  const result = await executeSql(
    `INSERT INTO drafts (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
    Object.values(values),
  );
  const id = result.changes.lastId;
  if (id === undefined) throw new Error('Failed to get the ID of the new record');
  return id;
}

async function count(sql: string): Promise<number> {
  const rows = await querySql<{ count: number }>(sql);
  return rows[0]?.count ?? 0;
}

beforeEach(async () => {
  await initializeTestDatabase();
});

afterEach(() => {
  closeTestDatabase();
});

describe('schema version 2', () => {
  it('adds the drafts table to a version 1 database and keeps its rows', async () => {
    await initializeTestDatabase(MIGRATIONS.slice(0, 1));
    await executeSql("INSERT INTO accounts (name, type, currency) VALUES ('Карта', 'card', 'BYN')");

    await runMigrations(migrationSql);

    const versions = await querySql<{ version: number }>('SELECT version FROM schema_version');
    expect(versions[0]?.version).toBe(2);
    expect(await count('SELECT COUNT(*) AS count FROM drafts')).toBe(0);
    expect(await count('SELECT COUNT(*) AS count FROM accounts')).toBe(1);
  });

  it('keeps a draft without anything parsed, pending by default', async () => {
    const id = await insertDraft({
      template_id: null,
      amount_minor: null,
      currency: null,
      direction: null,
      bank_status: null,
      payee: null,
      card_digits: null,
      balance_minor: null,
    });

    const rows = await querySql<{ state: string }>('SELECT state FROM drafts WHERE id = ?', [id]);
    expect(rows[0]?.state).toBe('pending');
  });

  it('keeps a negative balance and every state', async () => {
    await insertDraft({ balance_minor: -6110 });
    await insertDraft({ bank_status: 'declined', state: 'dismissed' });
    await insertDraft({ direction: 'credit', state: 'confirmed' });

    expect(await count('SELECT COUNT(*) AS count FROM drafts')).toBe(3);
  });

  it('indexes the drafts by state and time', async () => {
    const rows = await querySql<{ name: string }>('PRAGMA index_info(drafts_state_occurred_at)');

    expect(rows.map(row => row.name)).toEqual(['state', 'occurred_at']);
  });
});

describe('drafts reject', () => {
  it.each([
    ['an amount without its currency', { currency: null }],
    ['a currency without an amount', { amount_minor: null }],
    ['a zero amount', { amount_minor: 0 }],
    ['a negative amount', { amount_minor: -1190 }],
    ['a fractional amount', { amount_minor: 11.9 }],
    ['a currency in lower case', { currency: 'byn' }],
    ['a currency of two letters', { currency: 'BY' }],
    ['an unknown direction', { direction: 'out' }],
    ['an unknown bank status', { bank_status: 'failed' }],
    ['an unknown state', { state: 'deleted' }],
    ['three card digits', { card_digits: '333' }],
    ['five card digits', { card_digits: '33333' }],
    ['a letter among the card digits', { card_digits: '33a3' }],
    ['a fractional balance', { balance_minor: 61.1 }],
    ['a fractional post time', { posted_at: OCCURRED_AT + 0.5 }],
    ['a fractional time', { occurred_at: OCCURRED_AT + 0.5 }],
    ['a fractional time zone offset', { utc_offset_min: 180.5 }],
    ['a time zone offset beyond 14 hours', { utc_offset_min: 900 }],
    ['a draft without a fingerprint', { capture_fingerprint: null }],
  ])('%s', async (_, row) => {
    await expect(insertDraft(row)).rejects.toThrow();
  });

  it('a second draft of the same queue row', async () => {
    await insertDraft({ capture_fingerprint: 'same' });

    await expect(insertDraft({ capture_fingerprint: 'same' })).rejects.toThrow();
  });
});

describe('drafts updated_at', () => {
  it('moves on when a draft changes', async () => {
    const id = await insertDraft();
    await executeSql('UPDATE drafts SET updated_at = ? WHERE id = ?', [OLD_UPDATED_AT, id]);
    await executeSql("UPDATE drafts SET state = 'dismissed' WHERE id = ?", [id]);

    const rows = await querySql<{ updatedAt: string }>(
      'SELECT updated_at AS updatedAt FROM drafts WHERE id = ?',
      [id],
    );
    expect(rows[0]?.updatedAt).not.toBe(OLD_UPDATED_AT);
  });
});
