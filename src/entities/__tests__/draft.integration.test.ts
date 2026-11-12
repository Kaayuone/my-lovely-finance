import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  closeTestDatabase,
  initializeTestDatabase,
  querySql,
  updateOnWeb,
} from '@/database/__tests__/sqliteTestDatabase';
import * as draftRepository from '@/entities/draft/draft.repository';
import type { DraftRow, NewDraft } from '@/entities/draft/draft.types';

vi.mock('@/database', async () => import('@/database/__tests__/sqliteTestDatabase'));

// 11 November 2026, 12:00 in Minsk
const OCCURRED_AT = 1_794_387_600_000;

function draft(fingerprint: string, changes: Partial<NewDraft> = {}): NewDraft {
  return {
    captureFingerprint: fingerprint,
    packageName: 'com.iskra.mobile',
    postedAt: OCCURRED_AT + 4000,
    title: 'Безналичная оплата',
    text: 'Успешно, *3333, -11.90 BYN, Остаток: 61.10 BYN, BOOSTY.TO',
    bigText: 'Успешно, *3333, -11.90 BYN, Остаток: 61.10 BYN, BOOSTY.TO',
    lines: null,
    templateId: 'bnb.push',
    amount: { amountMinor: 1190, currency: 'BYN' },
    direction: 'debit',
    bankStatus: 'ok',
    payee: 'BOOSTY.TO',
    cardDigits: '3333',
    balanceMinor: 6110,
    occurredAt: OCCURRED_AT,
    utcOffsetMin: 180,
    state: 'pending',
    ...changes,
  };
}

async function readAll(): Promise<DraftRow[]> {
  return querySql<DraftRow>('SELECT * FROM drafts ORDER BY id');
}

beforeEach(async () => {
  await initializeTestDatabase();
});

afterEach(() => {
  closeTestDatabase();
});

describe('insertDrafts', () => {
  it('writes every field of a batch and answers how many drafts are new', async () => {
    const unparsed = draft('b', {
      lines: 'OPLATA 19.84 BYR',
      templateId: null,
      amount: null,
      direction: null,
      bankStatus: null,
      payee: null,
      cardDigits: null,
      balanceMinor: null,
    });

    expect(await draftRepository.insertDrafts([draft('a'), unparsed])).toBe(2);

    const [parsedRow, unparsedRow] = await readAll();
    expect(parsedRow).toMatchObject({
      capture_fingerprint: 'a',
      package_name: 'com.iskra.mobile',
      posted_at: OCCURRED_AT + 4000,
      title: 'Безналичная оплата',
      big_text: 'Успешно, *3333, -11.90 BYN, Остаток: 61.10 BYN, BOOSTY.TO',
      lines: null,
      template_id: 'bnb.push',
      amount_minor: 1190,
      currency: 'BYN',
      direction: 'debit',
      bank_status: 'ok',
      payee: 'BOOSTY.TO',
      card_digits: '3333',
      balance_minor: 6110,
      occurred_at: OCCURRED_AT,
      utc_offset_min: 180,
      state: 'pending',
    });
    expect(unparsedRow).toMatchObject({
      capture_fingerprint: 'b',
      lines: 'OPLATA 19.84 BYR',
      template_id: null,
      amount_minor: null,
      currency: null,
      direction: null,
      bank_status: null,
    });
    expect(updateOnWeb).toHaveBeenCalledTimes(1);
  });

  it('drops a draft of a queue row taken before and does not count it', async () => {
    await draftRepository.insertDrafts([draft('a'), draft('b')]);

    expect(await draftRepository.insertDrafts([draft('b', { payee: 'Другой' }), draft('c')])).toBe(
      1,
    );

    const rows = await readAll();
    expect(rows.map(row => row.capture_fingerprint)).toEqual(['a', 'b', 'c']);
    expect(rows[1]?.payee).toBe('BOOSTY.TO');
  });

  it('rolls the whole batch back when one draft breaks a CHECK', async () => {
    const zeroAmount = draft('b', { amount: { amountMinor: 0, currency: 'BYN' } });

    await expect(
      draftRepository.insertDrafts([draft('a'), zeroAmount, draft('c')]),
    ).rejects.toThrow();

    expect(await readAll()).toEqual([]);
    // The transaction queue goes on after the rollback
    expect(await draftRepository.insertDrafts([draft('a')])).toBe(1);
  });
});
