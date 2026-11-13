import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  changeOperationFormKind,
  needsCreditAmount,
  newOperationForm,
  operationToForm,
  toNewOperation,
} from '../utils';

import type { Account } from '@/entities/account/account.types';
import type { Category } from '@/entities/category/category.types';
import type { NewOperation, Operation } from '@/entities/operation/operation.types';
import type { OperationForm, OperationFormContext } from '../types';

const MACHINE_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;
// The process runs in Minsk (+180, no summer time); an operation entered in Kathmandu keeps +345
const PHONE_TIME_ZONE = 'Europe/Minsk';
const PHONE_OFFSET_MIN = 180;
const TRIP_OFFSET_MIN = 345;

const FEE_CATEGORY_ID = 90;
const OTHER_FEE_CATEGORY_ID = 91;
const EXPENSE_CATEGORY_ID = 10;
const INCOME_CATEGORY_ID = 20;

const CATEGORIES_BY_ID = new Map<number, Category>(
  [
    category(EXPENSE_CATEGORY_ID, 'expense'),
    category(INCOME_CATEGORY_ID, 'income'),
    category(FEE_CATEGORY_ID, 'expense'),
  ].map(item => [item.id, item]),
);

const BYN_WALLET = account(1, 'BYN');
const BYN_CARD = account(2, 'BYN');
const USD_CARD = account(3, 'USD');
const JPY_WALLET = account(4, 'JPY');
const KWD_WALLET = account(5, 'KWD');
const ACCOUNTS_BY_ID = new Map(
  [BYN_WALLET, BYN_CARD, USD_CARD, JPY_WALLET, KWD_WALLET].map(item => [item.id, item]),
);

// 12 November 2026, 09:15:42.123 in Minsk
const STORED_MOMENT = Date.UTC(2026, 10, 12, 6, 15, 42, 123);

function account(id: number, currency: string, changes: Partial<Account> = {}): Account {
  return {
    id,
    name: `Счёт ${id}`,
    type: 'cash',
    currency,
    openingBalanceMinor: 0,
    bankPackage: null,
    isArchived: false,
    sortOrder: id,
    ...changes,
  };
}

function category(id: number, kind: Category['kind']): Category {
  return {
    id,
    parentId: null,
    kind,
    code: null,
    name: `Категория ${id}`,
    isHidden: false,
    sortOrder: id,
  };
}

function context(original: Operation | null = null): OperationFormContext {
  return { accountsById: ACCOUNTS_BY_ID, feeCategoryId: FEE_CATEGORY_ID, original };
}

function buildForm(changes: Partial<OperationForm> = {}): OperationForm {
  return {
    kind: 'expense',
    accountId: BYN_WALLET.id,
    amountText: '12,34',
    isRefund: false,
    categoryId: EXPENSE_CATEGORY_ID,
    payee: '',
    toAccountId: null,
    toAmountText: '',
    feeText: '',
    note: '',
    dateTime: new Date(2026, 10, 12, 9, 15),
    ...changes,
  };
}

function transferForm(changes: Partial<OperationForm> = {}): OperationForm {
  return buildForm({
    kind: 'transfer',
    categoryId: null,
    toAccountId: BYN_CARD.id,
    ...changes,
  });
}

// A stored row is flat: the fields its kind does not carry are null
function stored(operation: NewOperation, id = 7): Operation {
  return {
    id,
    toAccountId: null,
    toAmountMinor: null,
    feeMinor: null,
    feeCategoryId: null,
    categoryId: null,
    payee: null,
    originalAmountMinor: null,
    originalCurrency: null,
    ...operation,
  };
}

function expense(changes: Partial<NewOperation> = {}): NewOperation {
  return {
    kind: 'expense',
    accountId: BYN_WALLET.id,
    amountMinor: -1234,
    categoryId: EXPENSE_CATEGORY_ID,
    payee: null,
    originalAmountMinor: null,
    originalCurrency: null,
    note: null,
    source: 'manual',
    occurredAt: STORED_MOMENT,
    utcOffsetMin: PHONE_OFFSET_MIN,
    ...changes,
  } as NewOperation;
}

function transfer(changes: Partial<NewOperation> = {}): NewOperation {
  return {
    kind: 'transfer',
    accountId: BYN_WALLET.id,
    amountMinor: -5000,
    toAccountId: BYN_CARD.id,
    toAmountMinor: 5000,
    feeMinor: null,
    feeCategoryId: null,
    note: null,
    source: 'manual',
    occurredAt: STORED_MOMENT,
    utcOffsetMin: PHONE_OFFSET_MIN,
    ...changes,
  } as NewOperation;
}

beforeEach(() => {
  vi.stubEnv('TZ', PHONE_TIME_ZONE);
  // Guards the test itself: the zone must really have switched for the times to mean anything
  expect(new Date(STORED_MOMENT).getTimezoneOffset()).toBe(-PHONE_OFFSET_MIN);
});

afterEach(() => {
  // Node resets the zone when TZ is set but not when it is deleted: set the machine zone back
  // before restoring the variable itself
  vi.stubEnv('TZ', MACHINE_TIME_ZONE);
  vi.unstubAllEnvs();
});

describe('newOperationForm', () => {
  it('starts an expense from the first active account at the current minute', () => {
    const accounts = [account(3, 'USD', { isArchived: true }), BYN_CARD, BYN_WALLET];

    expect(newOperationForm(accounts, new Date(2026, 10, 12, 9, 15, 42, 123))).toEqual({
      kind: 'expense',
      accountId: BYN_CARD.id,
      amountText: '',
      isRefund: false,
      categoryId: null,
      payee: '',
      toAccountId: null,
      toAmountText: '',
      feeText: '',
      note: '',
      dateTime: new Date(2026, 10, 12, 9, 15),
    });
  });

  it('leaves the account empty without an active one', () => {
    expect(newOperationForm([account(1, 'BYN', { isArchived: true })]).accountId).toBeNull();
  });
});

describe('toNewOperation: amounts', () => {
  it('gives an expense a minus, a refund and an income a plus', () => {
    expect(toNewOperation(buildForm(), context()).amountMinor).toBe(-1234);
    expect(toNewOperation(buildForm({ isRefund: true }), context()).amountMinor).toBe(1234);
    expect(
      toNewOperation(buildForm({ kind: 'income', categoryId: INCOME_CATEGORY_ID }), context())
        .amountMinor,
    ).toBe(1234);
  });

  it('reads the amount by the exponent of the account currency', () => {
    expect(
      toNewOperation(buildForm({ accountId: JPY_WALLET.id, amountText: '1000' }), context())
        .amountMinor,
    ).toBe(-1000);
    expect(
      toNewOperation(buildForm({ accountId: KWD_WALLET.id, amountText: '1,234' }), context())
        .amountMinor,
    ).toBe(-1234);
  });

  it('debits a transfer in one currency and credits the same amount, ignoring the hidden field', () => {
    expect(
      toNewOperation(transferForm({ amountText: '50', toAmountText: '123' }), context()),
    ).toMatchObject({
      kind: 'transfer',
      accountId: BYN_WALLET.id,
      amountMinor: -5000,
      toAccountId: BYN_CARD.id,
      toAmountMinor: 5000,
      feeMinor: null,
      feeCategoryId: null,
    });
  });

  it('credits a transfer between currencies with its own amount in the target currency', () => {
    expect(
      toNewOperation(
        transferForm({ amountText: '100', toAccountId: USD_CARD.id, toAmountText: '29,5' }),
        context(),
      ),
    ).toMatchObject({ amountMinor: -10000, toAccountId: USD_CARD.id, toAmountMinor: 2950 });
  });

  it('books a fee in the source currency to the fee category', () => {
    expect(
      toNewOperation(transferForm({ amountText: '50', feeText: '1,5' }), context()),
    ).toMatchObject({ feeMinor: -150, feeCategoryId: FEE_CATEGORY_ID });
    // The exponents differ, so a fee read in the target currency would come out ten times off
    expect(
      toNewOperation(
        transferForm({
          amountText: '50',
          toAccountId: KWD_WALLET.id,
          toAmountText: '1,234',
          feeText: '1,5',
        }),
        context(),
      ),
    ).toMatchObject({ amountMinor: -5000, toAmountMinor: 1234, feeMinor: -150 });
    expect(
      toNewOperation(
        transferForm({
          accountId: KWD_WALLET.id,
          amountText: '1,234',
          toAccountId: BYN_CARD.id,
          toAmountText: '12,34',
          feeText: '0,5',
        }),
        context(),
      ),
    ).toMatchObject({ amountMinor: -1234, toAmountMinor: 1234, feeMinor: -500 });
    expect(toNewOperation(transferForm({ feeText: '  ' }), context())).toMatchObject({
      feeMinor: null,
      feeCategoryId: null,
    });
  });

  it('keeps the fee category of an edited transfer', () => {
    const original = stored(transfer({ feeMinor: -100, feeCategoryId: OTHER_FEE_CATEGORY_ID }));

    expect(toNewOperation(transferForm({ feeText: '2' }), context(original))).toMatchObject({
      feeMinor: -200,
      feeCategoryId: OTHER_FEE_CATEGORY_ID,
    });
  });

  it('throws for a fee without a fee category', () => {
    expect(() =>
      toNewOperation(transferForm({ feeText: '1' }), { ...context(), feeCategoryId: null }),
    ).toThrow('Fee category not found');
  });

  it('carries no category, payee or original amount on a transfer', () => {
    const result = toNewOperation(transferForm({ payee: 'Евроопт' }), context());

    expect(result).not.toHaveProperty('categoryId');
    expect(result).not.toHaveProperty('payee');
    expect(result).not.toHaveProperty('originalAmountMinor');
  });

  it('trims the payee and the note and saves empty ones as null', () => {
    expect(
      toNewOperation(buildForm({ payee: '  Евроопт ', note: ' к ужину ' }), context()),
    ).toMatchObject({ payee: 'Евроопт', note: 'к ужину' });
    expect(toNewOperation(buildForm({ payee: '   ', note: '' }), context())).toMatchObject({
      payee: null,
      note: null,
    });
  });

  it('throws for an input the form rules would reject', () => {
    expect(() => toNewOperation(buildForm({ accountId: null }), context())).toThrow();
    expect(() => toNewOperation(buildForm({ amountText: '12,345' }), context())).toThrow();
    expect(() => toNewOperation(buildForm({ amountText: '0' }), context())).toThrow();
    expect(() => toNewOperation(buildForm({ dateTime: null }), context())).toThrow();
    expect(() => toNewOperation(transferForm({ toAccountId: null }), context())).toThrow();
    expect(() => toNewOperation(transferForm({ toAccountId: BYN_WALLET.id }), context())).toThrow();
    expect(() =>
      toNewOperation(transferForm({ toAccountId: USD_CARD.id, toAmountText: '' }), context()),
    ).toThrow();
  });
});

describe('toNewOperation: time', () => {
  it('places a new operation at the picked moment in the zone of the phone', () => {
    expect(toNewOperation(buildForm(), context())).toMatchObject({
      occurredAt: Date.UTC(2026, 10, 12, 6, 15),
      utcOffsetMin: PHONE_OFFSET_MIN,
    });
  });

  it('keeps the stored moment to the second while the minute is untouched', () => {
    const original = stored(expense({ utcOffsetMin: TRIP_OFFSET_MIN }));
    const form = operationToForm(original, ACCOUNTS_BY_ID);

    expect(toNewOperation(form, context(original))).toMatchObject({
      occurredAt: STORED_MOMENT,
      utcOffsetMin: TRIP_OFFSET_MIN,
    });
  });

  it('reads a changed minute in the offset of the operation, not of the phone', () => {
    const original = stored(expense({ utcOffsetMin: TRIP_OFFSET_MIN }));
    // 06:15:42 UTC is 12:00 in Kathmandu; the person moves it to 12:30 there
    const form = {
      ...operationToForm(original, ACCOUNTS_BY_ID),
      dateTime: new Date(2026, 10, 12, 12, 30),
    };

    expect(toNewOperation(form, context(original))).toMatchObject({
      occurredAt: Date.UTC(2026, 10, 12, 6, 45),
      utcOffsetMin: TRIP_OFFSET_MIN,
    });
  });
});

describe('toNewOperation: what the form does not show', () => {
  it('keeps the source and the original amount of an edited expense', () => {
    const original = stored(
      expense({ source: 'notification', originalAmountMinor: -350, originalCurrency: 'USD' }),
    );

    expect(
      toNewOperation(operationToForm(original, ACCOUNTS_BY_ID), context(original)),
    ).toMatchObject({
      source: 'notification',
      originalAmountMinor: -350,
      originalCurrency: 'USD',
    });
  });

  it('drops the original amount once the expense becomes a transfer', () => {
    const original = stored(
      expense({ source: 'notification', originalAmountMinor: -350, originalCurrency: 'USD' }),
    );
    const form = {
      ...changeOperationFormKind(
        operationToForm(original, ACCOUNTS_BY_ID),
        'transfer',
        CATEGORIES_BY_ID,
      ),
      toAccountId: BYN_CARD.id,
    };
    const result = toNewOperation(form, context(original));

    expect(result).toMatchObject({ kind: 'transfer', source: 'notification', toAmountMinor: 1234 });
    expect(result).not.toHaveProperty('originalAmountMinor');
    expect(result).not.toHaveProperty('originalCurrency');
  });

  it('saves a new operation as manual', () => {
    expect(toNewOperation(buildForm(), context()).source).toBe('manual');
  });
});

describe('operationToForm', () => {
  it('shows the amounts unsigned, each in the currency of its own account', () => {
    const original = stored(
      transfer({
        accountId: KWD_WALLET.id,
        amountMinor: -1234,
        toAccountId: USD_CARD.id,
        toAmountMinor: 405,
        feeMinor: -5,
        feeCategoryId: FEE_CATEGORY_ID,
        note: 'обмен',
      }),
    );

    expect(operationToForm(original, ACCOUNTS_BY_ID)).toEqual({
      kind: 'transfer',
      accountId: KWD_WALLET.id,
      amountText: '1,234',
      isRefund: false,
      categoryId: null,
      payee: '',
      toAccountId: USD_CARD.id,
      toAmountText: '4,05',
      feeText: '0,005',
      note: 'обмен',
      dateTime: new Date(2026, 10, 12, 9, 15),
    });
  });

  it('opens an expense with a plus as a refund', () => {
    expect(operationToForm(stored(expense({ amountMinor: 1234 })), ACCOUNTS_BY_ID)).toMatchObject({
      amountText: '12,34',
      isRefund: true,
    });
    expect(operationToForm(stored(expense()), ACCOUNTS_BY_ID).isRefund).toBe(false);
  });

  it('throws for an adjustment and for an account missing from the map', () => {
    const adjustment = stored({
      kind: 'adjustment',
      accountId: BYN_WALLET.id,
      amountMinor: 100,
      note: null,
      source: 'manual',
      occurredAt: STORED_MOMENT,
      utcOffsetMin: PHONE_OFFSET_MIN,
    });

    expect(() => operationToForm(adjustment, ACCOUNTS_BY_ID)).toThrow();
    expect(() => operationToForm(stored(expense({ accountId: 99 })), ACCOUNTS_BY_ID)).toThrow();
    expect(() => operationToForm(stored(transfer({ toAccountId: 99 })), ACCOUNTS_BY_ID)).toThrow();
  });
});

describe('operationToForm → toNewOperation', () => {
  it.each([
    ['an expense', expense({ payee: 'Евроопт', note: 'к ужину', source: 'notification' })],
    ['a refund', expense({ amountMinor: 1234 })],
    ['an income', expense({ kind: 'income', amountMinor: 250000, categoryId: INCOME_CATEGORY_ID })],
    ['a transfer in one currency', transfer()],
    [
      'a transfer between currencies with a fee',
      transfer({
        toAccountId: USD_CARD.id,
        toAmountMinor: 2950,
        feeMinor: -150,
        feeCategoryId: OTHER_FEE_CATEGORY_ID,
      }),
    ],
    ['a JPY expense', expense({ accountId: JPY_WALLET.id, amountMinor: -1000 })],
    ['a KWD expense', expense({ accountId: KWD_WALLET.id, amountMinor: -1234 })],
    ['a BYN → KWD transfer', transfer({ toAccountId: KWD_WALLET.id, toAmountMinor: 1234 })],
    [
      'a BYN → KWD transfer with a fee',
      transfer({
        toAccountId: KWD_WALLET.id,
        toAmountMinor: 1234,
        feeMinor: -150,
        feeCategoryId: FEE_CATEGORY_ID,
      }),
    ],
    [
      'a KWD → BYN transfer with a fee',
      transfer({
        accountId: KWD_WALLET.id,
        amountMinor: -1234,
        toAccountId: BYN_CARD.id,
        toAmountMinor: 1234,
        feeMinor: -5,
        feeCategoryId: FEE_CATEGORY_ID,
      }),
    ],
    ['a transfer saved with unequal sides', transfer({ toAmountMinor: 4900 })],
    ['an operation from a trip', expense({ utcOffsetMin: TRIP_OFFSET_MIN })],
  ])('gives back %s unchanged', (_, operation) => {
    const original = stored(operation);

    expect(toNewOperation(operationToForm(original, ACCOUNTS_BY_ID), context(original))).toEqual(
      operation,
    );
  });
});

describe('changeOperationFormKind', () => {
  it('drops an expense category on the way to an income, directly or through a transfer', () => {
    const form = buildForm();

    expect(changeOperationFormKind(form, 'income', CATEGORIES_BY_ID).categoryId).toBeNull();

    const throughTransfer = changeOperationFormKind(
      changeOperationFormKind(form, 'transfer', CATEGORIES_BY_ID),
      'income',
      CATEGORIES_BY_ID,
    );
    expect(throughTransfer.categoryId).toBeNull();
  });

  it('keeps the category through a transfer back to the same kind', () => {
    const backToExpense = changeOperationFormKind(
      changeOperationFormKind(buildForm(), 'transfer', CATEGORIES_BY_ID),
      'expense',
      CATEGORIES_BY_ID,
    );

    expect(backToExpense).toMatchObject({ kind: 'expense', categoryId: EXPENSE_CATEGORY_ID });
  });

  it('drops the refund when the form leaves an expense', () => {
    const refund = buildForm({ isRefund: true });

    expect(changeOperationFormKind(refund, 'income', CATEGORIES_BY_ID).isRefund).toBe(false);
    expect(
      changeOperationFormKind(
        changeOperationFormKind(refund, 'transfer', CATEGORIES_BY_ID),
        'expense',
        CATEGORIES_BY_ID,
      ).isRefund,
    ).toBe(false);
  });
});

describe('needsCreditAmount', () => {
  it('asks for the credited amount only between currencies for a new transfer', () => {
    expect(needsCreditAmount(transferForm(), context())).toBe(false);
    expect(needsCreditAmount(transferForm({ toAccountId: USD_CARD.id }), context())).toBe(true);
    expect(needsCreditAmount(transferForm({ toAccountId: null }), context())).toBe(false);
    expect(needsCreditAmount(buildForm({ toAccountId: USD_CARD.id }), context())).toBe(false);
  });

  it('keeps asking for an edited transfer saved with unequal sides in one currency', () => {
    const original = stored(transfer({ toAmountMinor: 4900 }));

    expect(needsCreditAmount(operationToForm(original, ACCOUNTS_BY_ID), context(original))).toBe(
      true,
    );
  });

  it('does not ask for an expense turned into a transfer in one currency', () => {
    const original = stored(expense());
    const form = changeOperationFormKind(
      operationToForm(original, ACCOUNTS_BY_ID),
      'transfer',
      CATEGORIES_BY_ID,
    );

    expect(needsCreditAmount({ ...form, toAccountId: BYN_CARD.id }, context(original))).toBe(false);
  });
});
