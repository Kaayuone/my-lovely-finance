import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  closeTestDatabase,
  executeSql,
  initializeTestDatabase,
  querySql,
} from '@/database/__tests__/sqliteTestDatabase';
import { MIGRATIONS } from '@/database/migrations';

type AccountRow = {
  name: string;
  type: string;
  currency: string;
  opening_balance_minor?: number;
};

type CategoryRow = {
  parent_id: number | null;
  kind: string;
  code: string | null;
  name: string;
};

type OperationRow = {
  kind: string;
  account_id: number;
  amount_minor: number;
  to_account_id: number | null;
  to_amount_minor: number | null;
  fee_minor: number | null;
  fee_category_id: number | null;
  category_id: number | null;
  payee: string | null;
  original_amount_minor: number | null;
  original_currency: string | null;
  occurred_at: number;
  utc_offset_min: number;
};

// 11 November 2026, 12:00 in Minsk
const OCCURRED_AT = 1_794_387_600_000;
const MINSK_OFFSET_MIN = 180;
const OLD_UPDATED_AT = '2000-01-01T00:00:00.000Z';
const ISO_UTC_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

let cardId: number;
let cashId: number;
let groceriesId: number;
let foodId: number;
let salaryId: number;
let feesId: number;

async function insertRow(table: string, row: Record<string, unknown>): Promise<number> {
  const columns = Object.keys(row);
  const result = await executeSql(
    `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
    Object.values(row),
  );
  const id = result.changes.lastId;
  if (id === undefined) throw new Error('Failed to get the ID of the new record');
  return id;
}

function insertAccount(row: AccountRow): Promise<number> {
  return insertRow('accounts', row);
}

function insertCategory(row: Partial<CategoryRow>): Promise<number> {
  return insertRow('categories', row);
}

function insertOperation(row: Partial<OperationRow>): Promise<number> {
  return insertRow('operations', {
    occurred_at: OCCURRED_AT,
    utc_offset_min: MINSK_OFFSET_MIN,
    ...row,
  });
}

function expense(row: Partial<OperationRow> = {}): Promise<number> {
  return insertOperation({
    kind: 'expense',
    account_id: cardId,
    amount_minor: -1250,
    category_id: groceriesId,
    ...row,
  });
}

function transfer(row: Partial<OperationRow> = {}): Promise<number> {
  return insertOperation({
    kind: 'transfer',
    account_id: cardId,
    amount_minor: -10000,
    to_account_id: cashId,
    to_amount_minor: 10000,
    ...row,
  });
}

async function categoryId(code: string): Promise<number> {
  const rows = await querySql<{ id: number }>('SELECT id FROM categories WHERE code = ?', [code]);
  const id = rows[0]?.id;
  if (id === undefined) throw new Error(`No category with code ${code}`);
  return id;
}

async function count(sql: string, values?: unknown[]): Promise<number> {
  const rows = await querySql<{ count: number }>(sql, values);
  return rows[0]?.count ?? 0;
}

beforeEach(async () => {
  await initializeTestDatabase();
  cardId = await insertAccount({ name: 'Карта', type: 'card', currency: 'BYN' });
  cashId = await insertAccount({ name: 'Наличные', type: 'cash', currency: 'BYN' });
  groceriesId = await categoryId('food.groceries');
  foodId = await categoryId('food');
  salaryId = await categoryId('salary');
  feesId = await categoryId('finance.fees');
});

afterEach(() => {
  closeTestDatabase();
});

describe('schema version 1', () => {
  it('creates the accounts, cards, categories and operations tables', async () => {
    await initializeTestDatabase(MIGRATIONS.slice(0, 1));

    const rows = await querySql<{ name: string }>(
      `SELECT name FROM sqlite_master
       WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> 'schema_version'
       ORDER BY name`,
    );

    expect(rows.map(row => row.name)).toEqual([
      'account_cards',
      'accounts',
      'categories',
      'operations',
    ]);
  });

  it('accepts the expense, income and transfer with a fee the rejections below start from', async () => {
    await expense();
    await insertOperation({
      kind: 'income',
      account_id: cardId,
      amount_minor: 250000,
      category_id: salaryId,
    });
    await transfer({ fee_minor: -150, fee_category_id: feesId });

    expect(await count('SELECT COUNT(*) AS count FROM operations')).toBe(3);
  });
});

describe('built-in categories', () => {
  it('seeds 19 main expense categories, 69 subcategories and 8 main income categories', async () => {
    expect(await count('SELECT COUNT(*) AS count FROM categories')).toBe(96);
    expect(
      await count(
        "SELECT COUNT(*) AS count FROM categories WHERE parent_id IS NULL AND kind = 'expense'",
      ),
    ).toBe(19);
    expect(
      await count('SELECT COUNT(*) AS count FROM categories WHERE parent_id IS NOT NULL'),
    ).toBe(69);
    expect(
      await count(
        "SELECT COUNT(*) AS count FROM categories WHERE parent_id IS NULL AND kind = 'income'",
      ),
    ).toBe(8);
  });

  it('puts every subcategory under a main category of the same kind, coded after it', async () => {
    const strays = await querySql<{ code: string }>(
      `SELECT child.code FROM categories AS child
       JOIN categories AS parent ON parent.id = child.parent_id
       WHERE parent.parent_id IS NOT NULL
         OR parent.kind <> child.kind
         OR child.code NOT LIKE parent.code || '.%'`,
    );

    expect(strays).toEqual([]);
  });

  it('gives every built-in category a code of its own', async () => {
    expect(
      await count('SELECT COUNT(DISTINCT code) AS count FROM categories WHERE code IS NOT NULL'),
    ).toBe(96);
  });

  it('makes «Комиссии» an expense subcategory of «Финансы»', async () => {
    const rows = await querySql<{ kind: string; name: string; parentCode: string }>(
      `SELECT child.kind, child.name, parent.code AS parentCode FROM categories AS child
       JOIN categories AS parent ON parent.id = child.parent_id
       WHERE child.code = 'finance.fees'`,
    );

    expect(rows).toEqual([{ kind: 'expense', name: 'Комиссии', parentCode: 'finance' }]);
  });
});

describe('operations reject', () => {
  it('a fractional amount', async () => {
    await expect(expense({ amount_minor: 12.5 })).rejects.toThrow();
  });

  it('a fractional time zone offset', async () => {
    await expect(expense({ utc_offset_min: 12.5 })).rejects.toThrow();
  });

  it('a zero amount', async () => {
    await expect(expense({ amount_minor: 0 })).rejects.toThrow();
  });

  it('a negative income', async () => {
    await expect(
      insertOperation({
        kind: 'income',
        account_id: cardId,
        amount_minor: -250000,
        category_id: salaryId,
      }),
    ).rejects.toThrow();
  });

  it.each([
    ['account', { to_account_id: null }],
    ['amount', { to_amount_minor: null }],
  ])('a transfer without the receiving %s', async (_, row) => {
    await expect(transfer(row)).rejects.toThrow();
  });

  it('a transfer with a positive debit', async () => {
    await expect(transfer({ amount_minor: 10000 })).rejects.toThrow();
  });

  it('a transfer to the same account', async () => {
    await expect(transfer({ to_account_id: cardId })).rejects.toThrow();
  });

  it('a fee on anything but a transfer', async () => {
    await expect(expense({ fee_minor: -150, fee_category_id: feesId })).rejects.toThrow();
  });

  it('a fee without a category', async () => {
    await expect(transfer({ fee_minor: -150 })).rejects.toThrow();
  });

  // The category kind trigger runs before the table CHECKs and answers first, so only the refusal
  // itself is asserted
  it('a category on a transfer', async () => {
    await expect(transfer({ category_id: feesId })).rejects.toThrow();
  });

  it('a payee on an adjustment', async () => {
    await expect(
      insertOperation({
        kind: 'adjustment',
        account_id: cardId,
        amount_minor: 500,
        payee: 'Магазин',
      }),
    ).rejects.toThrow();
  });

  it('an original amount without its currency', async () => {
    await expect(expense({ original_amount_minor: -399 })).rejects.toThrow();
  });

  it('an income category on an expense', async () => {
    await expect(expense({ category_id: salaryId })).rejects.toThrow(
      'operation category kind mismatch',
    );
  });

  it('a change that leaves an operation with a category of another kind', async () => {
    const id = await expense();

    await expect(
      executeSql('UPDATE operations SET category_id = ? WHERE id = ?', [salaryId, id]),
    ).rejects.toThrow('operation category kind mismatch');
    await expect(
      executeSql("UPDATE operations SET kind = 'income', amount_minor = 1250 WHERE id = ?", [id]),
    ).rejects.toThrow('operation category kind mismatch');
  });

  it('an income category for a fee', async () => {
    await expect(transfer({ fee_minor: -150, fee_category_id: salaryId })).rejects.toThrow(
      'fee category must be an expense category',
    );
  });

  it('a change of the fee category to an income one', async () => {
    const id = await transfer({ fee_minor: -150, fee_category_id: feesId });

    await expect(
      executeSql('UPDATE operations SET fee_category_id = ? WHERE id = ?', [salaryId, id]),
    ).rejects.toThrow('fee category must be an expense category');
  });
});

describe('money columns reject', () => {
  it.each([
    ['a positive transfer fee', () => transfer({ fee_minor: 150, fee_category_id: feesId })],
    ['a fractional transfer fee', () => transfer({ fee_minor: -1.5, fee_category_id: feesId })],
    ['a negative transfer credit', () => transfer({ to_amount_minor: -10000 })],
    ['a fractional transfer credit', () => transfer({ to_amount_minor: 100.5 })],
    [
      'a fractional original amount',
      () => expense({ original_amount_minor: -3.99, original_currency: 'USD' }),
    ],
    [
      'a fractional opening balance',
      () =>
        insertAccount({
          name: 'Вклад',
          type: 'cash',
          currency: 'BYN',
          opening_balance_minor: 12.5,
        }),
    ],
  ])('%s', async (_, insert) => {
    await expect(insert()).rejects.toThrow();
  });
});

describe('operations accept', () => {
  it('a refund — an expense with a plus', async () => {
    await expense({ amount_minor: 1250 });

    expect(await count('SELECT COUNT(*) AS count FROM operations WHERE amount_minor > 0')).toBe(1);
  });

  it('an adjustment without a category, either way', async () => {
    await insertOperation({ kind: 'adjustment', account_id: cardId, amount_minor: 500 });
    await insertOperation({ kind: 'adjustment', account_id: cardId, amount_minor: -500 });

    expect(await count("SELECT COUNT(*) AS count FROM operations WHERE kind = 'adjustment'")).toBe(
      2,
    );
  });
});

describe('categories reject', () => {
  it('a subcategory of a subcategory', async () => {
    await expect(
      insertCategory({ parent_id: groceriesId, kind: 'expense', name: 'Овощи' }),
    ).rejects.toThrow('category parent must be a main category of the same kind');
  });

  it('a subcategory of another kind than its parent', async () => {
    await expect(
      insertCategory({ parent_id: salaryId, kind: 'expense', name: 'Премия' }),
    ).rejects.toThrow('category parent must be a main category of the same kind');
  });

  it('an own main category, with neither a code nor a parent', async () => {
    await expect(insertCategory({ kind: 'expense', name: 'Своя' })).rejects.toThrow();
  });

  it.each([
    ['a move under another parent', "parent_id = (SELECT id FROM categories WHERE code = 'auto')"],
    ['a promotion to a main category', 'parent_id = NULL'],
    ['a change of kind', "kind = 'income'"],
  ])('%s', async (_, assignment) => {
    await expect(
      executeSql(`UPDATE categories SET ${assignment} WHERE id = ?`, [groceriesId]),
    ).rejects.toThrow('category parent and kind cannot change');
  });

  it('a second subcategory of the same name under one parent', async () => {
    await expect(
      insertCategory({ parent_id: foodId, kind: 'expense', name: 'Продукты' }),
    ).rejects.toThrow();
  });
});

describe('categories accept', () => {
  it('one subcategory name under different parents', async () => {
    await insertCategory({ parent_id: foodId, kind: 'expense', name: 'Разное' });
    await insertCategory({
      parent_id: await categoryId('auto'),
      kind: 'expense',
      name: 'Разное',
    });

    expect(await count("SELECT COUNT(*) AS count FROM categories WHERE name = 'Разное'")).toBe(2);
  });

  it('an update that writes the same parent and kind back', async () => {
    await executeSql(
      "UPDATE categories SET parent_id = parent_id, kind = kind, name = 'Супермаркеты' WHERE id = ?",
      [groceriesId],
    );

    expect(
      await count("SELECT COUNT(*) AS count FROM categories WHERE name = 'Супермаркеты'"),
    ).toBe(1);
  });
});

describe('cards', () => {
  it.each(['123', '12345', '12a4'])('reject the last digits %s', async lastDigits => {
    await expect(
      insertRow('account_cards', { account_id: cardId, last_digits: lastDigits }),
    ).rejects.toThrow();
  });

  it('accept one card on two accounts', async () => {
    const usdId = await insertAccount({ name: 'Карта USD', type: 'card', currency: 'USD' });

    await insertRow('account_cards', { account_id: cardId, last_digits: '1234' });
    await insertRow('account_cards', { account_id: usdId, last_digits: '1234' });

    expect(
      await count("SELECT COUNT(*) AS count FROM account_cards WHERE last_digits = '1234'"),
    ).toBe(2);
  });
});

describe('deleting', () => {
  it('an account without operations takes its cards with it', async () => {
    await insertRow('account_cards', { account_id: cardId, last_digits: '1234' });

    await executeSql('DELETE FROM accounts WHERE id = ?', [cardId]);

    expect(await count('SELECT COUNT(*) AS count FROM account_cards')).toBe(0);
  });

  it('an account with operations is rejected', async () => {
    await expense();

    await expect(executeSql('DELETE FROM accounts WHERE id = ?', [cardId])).rejects.toThrow();
  });

  it('a category with operations is rejected', async () => {
    const ownId = await insertCategory({ parent_id: foodId, kind: 'expense', name: 'Кофе' });
    await expense({ category_id: ownId });

    await expect(executeSql('DELETE FROM categories WHERE id = ?', [ownId])).rejects.toThrow();
  });
});

describe('updated_at', () => {
  /** Stamps the row with an old time, then changes another column and reads the stamp back. */
  async function updatedAtAfterChange(table: string, id: number, assignment: string) {
    await executeSql(`UPDATE ${table} SET updated_at = ? WHERE id = ?`, [OLD_UPDATED_AT, id]);
    await executeSql(`UPDATE ${table} SET ${assignment} WHERE id = ?`, [id]);

    const rows = await querySql<{ updatedAt: string }>(
      `SELECT updated_at AS updatedAt FROM ${table} WHERE id = ?`,
      [id],
    );
    return rows[0]?.updatedAt;
  }

  it('moves on when an account changes', async () => {
    const updatedAt = await updatedAtAfterChange('accounts', cardId, "name = 'Карта BYN'");

    expect(updatedAt).not.toBe(OLD_UPDATED_AT);
    expect(updatedAt).toMatch(ISO_UTC_TIME);
  });

  it('moves on when a category changes', async () => {
    const updatedAt = await updatedAtAfterChange('categories', groceriesId, 'is_hidden = 1');

    expect(updatedAt).not.toBe(OLD_UPDATED_AT);
    expect(updatedAt).toMatch(ISO_UTC_TIME);
  });

  it('moves on when an operation changes', async () => {
    const updatedAt = await updatedAtAfterChange('operations', await expense(), "note = 'Обед'");

    expect(updatedAt).not.toBe(OLD_UPDATED_AT);
    expect(updatedAt).toMatch(ISO_UTC_TIME);
  });
});
