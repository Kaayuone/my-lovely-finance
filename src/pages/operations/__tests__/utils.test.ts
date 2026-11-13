import { describe, expect, it } from 'vitest';
import { formatMoney } from '@/utils/money';
import { dayLabel, isMoneyIn, toOperationRowView, withDayHeadings } from '../utils';

import type { Account } from '@/entities/account/account.types';
import type { Category } from '@/entities/category/category.types';
import type { Operation } from '@/entities/operation/operation.types';

const MINSK_OFFSET_MIN = 180;

const CARD = account(1, 'Карта', 'BYN');
const WALLET = account(2, 'Кошелёк', 'USD');
const CASH = account(3, 'Наличные', 'BYN');
const ACCOUNTS_BY_ID = new Map([CARD, WALLET, CASH].map(item => [item.id, item]));

const FOOD = category(10, null, 'expense', 'Еда и напитки');
const GROCERIES = category(11, FOOD.id, 'expense', 'Продукты');
const SALARY = category(20, null, 'income', 'Зарплата');
const FEES = category(30, null, 'expense', 'Комиссии');
const CATEGORIES_BY_ID = new Map([FOOD, GROCERIES, SALARY, FEES].map(item => [item.id, item]));

// 13 November 2026, 10:00 in Minsk
const MOMENT = Date.UTC(2026, 10, 13, 7, 0);

function account(id: number, name: string, currency: string): Account {
  return {
    id,
    name,
    type: 'cash',
    currency,
    openingBalanceMinor: 0,
    bankPackage: null,
    isArchived: false,
    sortOrder: id,
  };
}

function category(
  id: number,
  parentId: number | null,
  kind: Category['kind'],
  name: string,
): Category {
  return { id, parentId, kind, code: null, name, isHidden: false, sortOrder: id };
}

function operation(changes: Partial<Operation> = {}): Operation {
  return {
    id: 1,
    kind: 'expense',
    accountId: CARD.id,
    amountMinor: -1234,
    toAccountId: null,
    toAmountMinor: null,
    feeMinor: null,
    feeCategoryId: null,
    categoryId: GROCERIES.id,
    payee: null,
    note: null,
    originalAmountMinor: null,
    originalCurrency: null,
    occurredAt: MOMENT,
    utcOffsetMin: MINSK_OFFSET_MIN,
    source: 'manual',
    ...changes,
  };
}

function rowOf(item: Operation, accountsById: ReadonlyMap<number, Account> = ACCOUNTS_BY_ID) {
  return toOperationRowView(item, accountsById, CATEGORIES_BY_ID);
}

// ICU output differs between versions in spaces and the minus sign: compare only the sign, the
// digits and the decimal comma
function amountText(formatted: string): string {
  return formatted.replace(/[^\d,+\-−]/g, '').replace(/−/g, '-');
}

describe('dayLabel', () => {
  const TODAY = '2026-11-13';

  it('names today and yesterday', () => {
    expect(dayLabel(TODAY, TODAY)).toBe('Сегодня');
    expect(dayLabel('2026-11-12', TODAY)).toBe('Вчера');
  });

  it('names another day of this year by its date and month', () => {
    expect(dayLabel('2026-11-11', TODAY)).toBe('11 ноября');
    expect(dayLabel('2026-03-08', TODAY)).toBe('8 марта');
    expect(dayLabel('2026-01-01', TODAY)).toBe('1 января');
  });

  it('adds the year to a day of another year', () => {
    expect(dayLabel('2025-11-12', TODAY)).toBe('12 ноября 2025');
    expect(dayLabel('2025-12-31', TODAY)).toBe('31 декабря 2025');
  });

  it('counts yesterday across the new year and a leap day', () => {
    expect(dayLabel('2026-12-31', '2027-01-01')).toBe('Вчера');
    expect(dayLabel('2026-12-30', '2027-01-01')).toBe('30 декабря 2026');
    expect(dayLabel('2028-02-29', '2028-03-01')).toBe('Вчера');
  });
});

describe('toOperationRowView', () => {
  it('shows an expense under its subcategory with the payee and its account', () => {
    const item = operation({ payee: 'Евроопт' });

    expect(rowOf(item)).toEqual({
      operation: item,
      title: 'Продукты',
      subtitle: 'Евроопт · Карта',
      amount: formatMoney({ amountMinor: -1234, currency: 'BYN' }),
      creditAmount: null,
      feeNote: null,
    });
    expect(amountText(rowOf(item).amount)).toBe('-12,34');
  });

  it('shows an expense without a category or a payee', () => {
    const row = rowOf(operation({ categoryId: null }));

    expect(row.title).toBe('Без категории');
    expect(row.subtitle).toBe('Карта');
  });

  it('shows a refund and an income with a plus', () => {
    const refund = rowOf(operation({ amountMinor: 500 }));
    const income = rowOf(
      operation({ kind: 'income', amountMinor: 150_000, categoryId: SALARY.id, payee: 'Работа' }),
    );

    expect(amountText(refund.amount)).toBe('+5,00');
    expect(income.title).toBe('Зарплата');
    expect(income.subtitle).toBe('Работа · Карта');
    expect(amountText(income.amount)).toBe('+1500,00');
  });

  it('shows a transfer in one currency with its debit alone', () => {
    const row = rowOf(
      operation({
        kind: 'transfer',
        categoryId: null,
        amountMinor: -1000,
        toAccountId: CASH.id,
        toAmountMinor: 1000,
      }),
    );

    expect(row).toMatchObject({
      title: 'Перевод',
      subtitle: 'Карта → Наличные',
      amount: formatMoney({ amountMinor: -1000, currency: 'BYN' }),
      creditAmount: null,
      feeNote: null,
    });
    expect(amountText(row.amount)).toBe('-10,00');
  });

  it('shows a transfer between currencies with the credit in the target currency and the fee', () => {
    const row = rowOf(
      operation({
        kind: 'transfer',
        categoryId: null,
        amountMinor: -3400,
        toAccountId: WALLET.id,
        toAmountMinor: 1000,
        feeMinor: -150,
        feeCategoryId: FEES.id,
      }),
    );

    expect(row.subtitle).toBe('Карта → Кошелёк');
    expect(row.amount).toBe(formatMoney({ amountMinor: -3400, currency: 'BYN' }));
    // The credit is USD, not the BYN of the debit
    expect(row.creditAmount).toBe(
      formatMoney({ amountMinor: 1000, currency: 'USD' }, { signDisplay: 'always' }),
    );
    expect(row.creditAmount).not.toBe(
      formatMoney({ amountMinor: 1000, currency: 'BYN' }, { signDisplay: 'always' }),
    );
    expect(amountText(row.creditAmount!)).toBe('+10,00');
    expect(row.feeNote).toBe(`комиссия ${formatMoney({ amountMinor: 150, currency: 'BYN' })}`);
  });

  it('shows a balance adjustment with its sign', () => {
    const row = rowOf(operation({ kind: 'adjustment', categoryId: null, amountMinor: 250 }));

    expect(row).toMatchObject({
      title: 'Корректировка',
      subtitle: 'Карта',
      creditAmount: null,
      feeNote: null,
    });
    expect(amountText(row.amount)).toBe('+2,50');
  });

  it('shows a row whose account or category is not loaded without an amount in a guessed currency', () => {
    const expense = rowOf(operation({ accountId: 99, categoryId: 999 }));
    const transfer = rowOf(
      operation({
        kind: 'transfer',
        categoryId: null,
        amountMinor: -1000,
        toAccountId: 99,
        toAmountMinor: 300,
        feeMinor: -50,
      }),
    );
    const fromUnknown = rowOf(
      operation({
        kind: 'transfer',
        categoryId: null,
        accountId: 99,
        amountMinor: -1000,
        toAccountId: WALLET.id,
        toAmountMinor: 300,
        feeMinor: -50,
      }),
    );

    expect(expense).toMatchObject({ title: 'Без категории', subtitle: 'Счёт', amount: '' });
    expect(transfer).toMatchObject({ subtitle: 'Карта → Счёт', creditAmount: null });
    expect(amountText(transfer.amount)).toBe('-10,00');
    expect(fromUnknown).toMatchObject({
      subtitle: 'Счёт → Кошелёк',
      amount: '',
      creditAmount: null,
      feeNote: null,
    });
  });
});

describe('isMoneyIn', () => {
  it('holds for an income and a refund only', () => {
    expect(isMoneyIn(operation({ kind: 'income', amountMinor: 100 }))).toBe(true);
    expect(isMoneyIn(operation({ amountMinor: 100 }))).toBe(true);
    expect(isMoneyIn(operation({ amountMinor: -100 }))).toBe(false);
    expect(isMoneyIn(operation({ kind: 'transfer', amountMinor: -100 }))).toBe(false);
    expect(isMoneyIn(operation({ kind: 'adjustment', amountMinor: 100 }))).toBe(false);
  });
});

describe('withDayHeadings', () => {
  const TODAY = '2026-11-13';
  // Newest first, as the store lists them
  const OPERATIONS = [
    operation({ id: 4, occurredAt: MOMENT }),
    // 00:30 on 13 November in Minsk, still 12 November in UTC
    operation({ id: 3, occurredAt: Date.UTC(2026, 10, 12, 21, 30) }),
    // 23:00 on 12 November in Minsk
    operation({ id: 2, occurredAt: Date.UTC(2026, 10, 12, 20, 0) }),
    operation({ id: 1, occurredAt: Date.UTC(2026, 10, 5, 9, 0) }),
  ];

  function entriesOf(items: Operation[], accountsById = ACCOUNTS_BY_ID) {
    return withDayHeadings(
      items.map(item => rowOf(item, accountsById)),
      TODAY,
    );
  }

  it('heads every day by the offset of its operations, with a line under every row but the last', () => {
    const entries = entriesOf(OPERATIONS);

    expect(entries.map(entry => entry.kind)).toEqual([
      'heading',
      'row',
      'separator',
      'row',
      'separator',
      'heading',
      'row',
      'separator',
      'heading',
      'row',
    ]);
    expect(entries.filter(entry => entry.kind === 'heading')).toEqual([
      { id: 'h:4', kind: 'heading', label: 'Сегодня' },
      { id: 'h:2', kind: 'heading', label: 'Вчера' },
      { id: 'h:1', kind: 'heading', label: '5 ноября' },
    ]);
    expect(entries.filter(entry => entry.kind === 'separator').map(entry => entry.id)).toEqual([
      's:4',
      's:3',
      's:2',
    ]);
  });

  it('keys a row by its id and the version of what it shows', () => {
    const [heading, row] = entriesOf(OPERATIONS.slice(0, 1));

    expect(heading?.id).toBe('h:4');
    expect(row?.id).toMatch(/^r:4:[0-9a-z]+$/);
  });

  it('gives a row a new key when its account is renamed, and its heading and line keep theirs', () => {
    const renamed = new Map(ACCOUNTS_BY_ID).set(CARD.id, { ...CARD, name: 'Карта Альфа' });
    const before = entriesOf(OPERATIONS);
    const after = entriesOf(OPERATIONS, renamed);

    expect(after[1]?.id).not.toBe(before[1]?.id);
    expect(after[0]?.id).toBe(before[0]?.id);
    expect(after[2]?.id).toBe(before[2]?.id);
  });

  it('lists nothing for no operations', () => {
    expect(withDayHeadings([], TODAY)).toEqual([]);
  });
});
