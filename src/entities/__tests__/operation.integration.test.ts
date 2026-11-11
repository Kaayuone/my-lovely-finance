import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  closeTestDatabase,
  executeSql,
  initializeTestDatabase,
  querySql,
  updateOnWeb,
} from '@/database/__tests__/sqliteTestDatabase';
import * as operationRepository from '@/entities/operation/operation.repository';
import type {
  NewAdjustmentOperation,
  NewCategorizedOperation,
  NewTransferOperation,
  Operation,
  OperationCursor,
} from '@/entities/operation/operation.types';

vi.mock('@/database', async () => import('@/database/__tests__/sqliteTestDatabase'));

let cardId: number;
let cashId: number;
let usdId: number;
let groceriesId: number;
let salaryId: number;
let feesId: number;

async function insertAccount(name: string, currency: string): Promise<number> {
  const result = await executeSql('INSERT INTO accounts (name, type, currency) VALUES (?, ?, ?)', [
    name,
    'card',
    currency,
  ]);
  const id = result.changes.lastId;
  if (id === undefined) throw new Error(`Account ${name} was not inserted`);
  return id;
}

async function categoryId(code: string): Promise<number> {
  const rows = await querySql<{ id: number }>('SELECT id FROM categories WHERE code = ?', [code]);
  const id = rows[0]?.id;
  if (id === undefined) throw new Error(`No category with code ${code}`);
  return id;
}

async function readAll(): Promise<Operation[]> {
  return operationRepository.getOperationsPage({ limit: 100 });
}

function groceries(occurredAt: number): NewCategorizedOperation {
  return {
    kind: 'expense',
    accountId: cardId,
    amountMinor: -1250,
    categoryId: groceriesId,
    payee: 'Евроопт',
    originalAmountMinor: -399,
    originalCurrency: 'EUR',
    note: 'Молоко',
    occurredAt,
    utcOffsetMin: 180,
    source: 'notification',
  };
}

function transferToUsd(occurredAt: number): NewTransferOperation {
  return {
    kind: 'transfer',
    accountId: cardId,
    amountMinor: -10000,
    toAccountId: usdId,
    toAmountMinor: 3000,
    feeMinor: -150,
    feeCategoryId: feesId,
    note: null,
    occurredAt,
    utcOffsetMin: -300,
    source: 'manual',
  };
}

function adjustment(accountId: number, occurredAt: number): NewAdjustmentOperation {
  return {
    kind: 'adjustment',
    accountId,
    amountMinor: 500,
    note: 'Сверка',
    occurredAt,
    utcOffsetMin: 180,
    source: 'manual',
  };
}

beforeEach(async () => {
  await initializeTestDatabase();
  cardId = await insertAccount('Карта', 'BYN');
  cashId = await insertAccount('Наличные', 'BYN');
  usdId = await insertAccount('Валютная', 'USD');
  groceriesId = await categoryId('food.groceries');
  salaryId = await categoryId('salary');
  feesId = await categoryId('finance.fees');
});

afterEach(() => {
  closeTestDatabase();
});

describe('operation repository', () => {
  it('stores every kind and reads it back with the fields of other kinds null', async () => {
    const expenseId = await operationRepository.insertOperation(groceries(1));
    const incomeId = await operationRepository.insertOperation({
      kind: 'income',
      accountId: cardId,
      amountMinor: 250000,
      categoryId: salaryId,
      payee: null,
      originalAmountMinor: null,
      originalCurrency: null,
      note: null,
      occurredAt: 2,
      utcOffsetMin: 180,
      source: 'manual',
    });
    // A refund is an expense with a plus (ADR-0005)
    const refundId = await operationRepository.insertOperation({
      kind: 'expense',
      accountId: cardId,
      amountMinor: 1250,
      categoryId: groceriesId,
      payee: 'Евроопт',
      originalAmountMinor: null,
      originalCurrency: null,
      note: null,
      occurredAt: 3,
      utcOffsetMin: 180,
      source: 'manual',
    });
    const transferId = await operationRepository.insertOperation(transferToUsd(4));
    const adjustmentId = await operationRepository.insertOperation(adjustment(cashId, 5));

    expect(await readAll()).toEqual([
      {
        id: adjustmentId,
        kind: 'adjustment',
        accountId: cashId,
        amountMinor: 500,
        toAccountId: null,
        toAmountMinor: null,
        feeMinor: null,
        feeCategoryId: null,
        categoryId: null,
        payee: null,
        note: 'Сверка',
        originalAmountMinor: null,
        originalCurrency: null,
        occurredAt: 5,
        utcOffsetMin: 180,
        source: 'manual',
      },
      {
        id: transferId,
        kind: 'transfer',
        accountId: cardId,
        amountMinor: -10000,
        toAccountId: usdId,
        toAmountMinor: 3000,
        feeMinor: -150,
        feeCategoryId: feesId,
        categoryId: null,
        payee: null,
        note: null,
        originalAmountMinor: null,
        originalCurrency: null,
        occurredAt: 4,
        utcOffsetMin: -300,
        source: 'manual',
      },
      {
        id: refundId,
        kind: 'expense',
        accountId: cardId,
        amountMinor: 1250,
        toAccountId: null,
        toAmountMinor: null,
        feeMinor: null,
        feeCategoryId: null,
        categoryId: groceriesId,
        payee: 'Евроопт',
        note: null,
        originalAmountMinor: null,
        originalCurrency: null,
        occurredAt: 3,
        utcOffsetMin: 180,
        source: 'manual',
      },
      {
        id: incomeId,
        kind: 'income',
        accountId: cardId,
        amountMinor: 250000,
        toAccountId: null,
        toAmountMinor: null,
        feeMinor: null,
        feeCategoryId: null,
        categoryId: salaryId,
        payee: null,
        note: null,
        originalAmountMinor: null,
        originalCurrency: null,
        occurredAt: 2,
        utcOffsetMin: 180,
        source: 'manual',
      },
      {
        id: expenseId,
        kind: 'expense',
        accountId: cardId,
        amountMinor: -1250,
        toAccountId: null,
        toAmountMinor: null,
        feeMinor: null,
        feeCategoryId: null,
        categoryId: groceriesId,
        payee: 'Евроопт',
        note: 'Молоко',
        originalAmountMinor: -399,
        originalCurrency: 'EUR',
        occurredAt: 1,
        utcOffsetMin: 180,
        source: 'notification',
      },
    ]);
    // Every write went through the transaction queue, which saves the web store after a commit
    expect(updateOnWeb).toHaveBeenCalledTimes(5);
  });

  it('rewrites an expense into a transfer and back, clearing the fields of the former kind', async () => {
    const id = await operationRepository.insertOperation(groceries(1));
    const otherId = await operationRepository.insertOperation(adjustment(cashId, 2));

    await operationRepository.updateOperation(id, transferToUsd(3));

    expect(updateOnWeb).toHaveBeenCalledTimes(3);
    expect((await readAll()).find(operation => operation.id === id)).toMatchObject({
      kind: 'transfer',
      toAccountId: usdId,
      toAmountMinor: 3000,
      feeMinor: -150,
      feeCategoryId: feesId,
      categoryId: null,
      payee: null,
      originalAmountMinor: null,
      originalCurrency: null,
      note: null,
      occurredAt: 3,
      utcOffsetMin: -300,
      source: 'manual',
    });

    await operationRepository.updateOperation(id, groceries(4));

    expect(updateOnWeb).toHaveBeenCalledTimes(4);
    expect((await readAll()).find(operation => operation.id === id)).toMatchObject({
      kind: 'expense',
      amountMinor: -1250,
      toAccountId: null,
      toAmountMinor: null,
      feeMinor: null,
      feeCategoryId: null,
      categoryId: groceriesId,
      payee: 'Евроопт',
      originalAmountMinor: -399,
      originalCurrency: 'EUR',
      note: 'Молоко',
      occurredAt: 4,
      source: 'notification',
    });
    expect((await readAll()).find(operation => operation.id === otherId)).toMatchObject({
      kind: 'adjustment',
      occurredAt: 2,
    });
  });

  it('deletes only the given operation', async () => {
    const id = await operationRepository.insertOperation(groceries(1));
    const otherId = await operationRepository.insertOperation(adjustment(cashId, 2));

    await operationRepository.deleteOperation(id);

    expect(updateOnWeb).toHaveBeenCalledTimes(3);
    expect((await readAll()).map(operation => operation.id)).toEqual([otherId]);
  });

  it('passes the rejections of the database through and stores nothing', async () => {
    await expect(
      operationRepository.insertOperation({ ...groceries(1), categoryId: salaryId }),
    ).rejects.toThrow('operation category kind mismatch');
    await expect(
      operationRepository.insertOperation({ ...transferToUsd(2), toAccountId: cardId }),
    ).rejects.toThrow('CHECK constraint failed');
    expect(await readAll()).toEqual([]);

    const id = await operationRepository.insertOperation(groceries(3));
    await expect(
      operationRepository.updateOperation(id, { ...groceries(4), categoryId: salaryId }),
    ).rejects.toThrow('operation category kind mismatch');
    expect(await readAll()).toEqual([
      expect.objectContaining({ id, categoryId: groceriesId, occurredAt: 3 }),
    ]);
  });
});

describe('operation pages', () => {
  const hour = 3_600_000;
  const older = Date.UTC(2026, 10, 1, 9);
  const moment = older + hour;
  const newest = moment + hour;
  let ids: Record<
    'cardFirst' | 'cardSecond' | 'cashIncome' | 'transfer' | 'cardNewest' | 'usdOld' | 'cardOld',
    number
  >;

  // Pages through the whole history the way the list does: each page starts after the last row of
  // the previous one
  async function readPages(limit: number, accountId?: number): Promise<number[][]> {
    const pages: number[][] = [];
    let before: OperationCursor | undefined;

    while (pages.length < 10) {
      const page = await operationRepository.getOperationsPage({ limit, before, accountId });
      const last = page.at(-1);
      if (!last) return pages;
      pages.push(page.map(operation => operation.id));
      before = { occurredAt: last.occurredAt, id: last.id };
    }
    throw new Error('Paging does not reach the end of the history');
  }

  beforeEach(async () => {
    const cardFirst = await operationRepository.insertOperation(groceries(moment));
    const cardSecond = await operationRepository.insertOperation(groceries(moment));
    const cashIncome = await operationRepository.insertOperation({
      kind: 'income',
      accountId: cashId,
      amountMinor: 10000,
      categoryId: salaryId,
      payee: null,
      originalAmountMinor: null,
      originalCurrency: null,
      note: null,
      occurredAt: moment,
      utcOffsetMin: 180,
      source: 'manual',
    });
    const transfer = await operationRepository.insertOperation({
      kind: 'transfer',
      accountId: cardId,
      amountMinor: -5000,
      toAccountId: cashId,
      toAmountMinor: 5000,
      feeMinor: null,
      feeCategoryId: null,
      note: null,
      occurredAt: moment,
      utcOffsetMin: 180,
      source: 'manual',
    });
    const cardNewest = await operationRepository.insertOperation(groceries(newest));
    const usdOld = await operationRepository.insertOperation(adjustment(usdId, older));
    const cardOld = await operationRepository.insertOperation(adjustment(cardId, older));
    ids = { cardFirst, cardSecond, cashIncome, transfer, cardNewest, usdOld, cardOld };
  });

  it('goes newest first and crosses operations of the same moment without gaps or repeats', async () => {
    expect(await readPages(3)).toEqual([
      [ids.cardNewest, ids.transfer, ids.cashIncome],
      [ids.cardSecond, ids.cardFirst, ids.cardOld],
      [ids.usdOld],
    ]);
  });

  it('keeps the incoming transfer in the history of its target account', async () => {
    expect(await readPages(1, cashId)).toEqual([[ids.transfer], [ids.cashIncome]]);
  });

  it('leaves the older operations of other accounts out of a later page of an account', async () => {
    expect(await readPages(2, cardId)).toEqual([
      [ids.cardNewest, ids.transfer],
      [ids.cardSecond, ids.cardFirst],
      [ids.cardOld],
    ]);
  });
});
