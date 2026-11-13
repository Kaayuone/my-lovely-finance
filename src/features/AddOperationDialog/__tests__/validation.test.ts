import { describe, expect, it } from 'vitest';
import { collectErrors } from '@/services/validation';
import { getOperationFormSchema } from '../validation';

import type { Account } from '@/entities/account/account.types';
import type { Operation } from '@/entities/operation/operation.types';
import type { OperationForm, OperationFormContext } from '../types';

const BYN_WALLET = account(1, 'BYN');
const BYN_CARD = account(2, 'BYN');
const USD_CARD = account(3, 'USD');
const JPY_WALLET = account(4, 'JPY');
const KWD_WALLET = account(5, 'KWD');
const ACCOUNTS_BY_ID = new Map(
  [BYN_WALLET, BYN_CARD, USD_CARD, JPY_WALLET, KWD_WALLET].map(item => [item.id, item]),
);

function account(id: number, currency: string): Account {
  return {
    id,
    name: `Счёт ${id}`,
    type: 'cash',
    currency,
    openingBalanceMinor: 0,
    bankPackage: null,
    isArchived: false,
    sortOrder: id,
  };
}

function context(original: Operation | null = null): OperationFormContext {
  return { accountsById: ACCOUNTS_BY_ID, feeCategoryId: 90, original };
}

function buildForm(changes: Partial<OperationForm> = {}): OperationForm {
  return {
    kind: 'expense',
    accountId: BYN_WALLET.id,
    amountText: '12,34',
    isRefund: false,
    categoryId: 10,
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
  return buildForm({ kind: 'transfer', categoryId: null, toAccountId: BYN_CARD.id, ...changes });
}

function errorsOf(form: OperationForm, formContext = context()) {
  return collectErrors(getOperationFormSchema(form, formContext), form);
}

describe('operation form schema', () => {
  it('accepts a filled expense, income and transfer', () => {
    expect(errorsOf(buildForm())).toEqual({});
    expect(errorsOf(buildForm({ kind: 'income', categoryId: 20 }))).toEqual({});
    expect(errorsOf(transferForm({ feeText: '1,5' }))).toEqual({});
  });

  it('names every empty required field', () => {
    expect(
      errorsOf(buildForm({ accountId: null, amountText: ' ', categoryId: null, dateTime: null })),
    ).toEqual({
      accountId: 'Выберите счёт',
      amountText: 'Введите сумму',
      categoryId: 'Выберите категорию',
      dateTime: 'Укажите дату',
    });
  });

  it('reads the amount in the currency of the account and wants it above zero', () => {
    expect(errorsOf(buildForm({ amountText: 'сто' }))).toEqual({ amountText: 'Проверьте сумму' });
    expect(errorsOf(buildForm({ amountText: '0' }))).toEqual({ amountText: 'Проверьте сумму' });
    expect(errorsOf(buildForm({ amountText: '-5' }))).toEqual({ amountText: 'Проверьте сумму' });
    expect(errorsOf(buildForm({ accountId: JPY_WALLET.id, amountText: '10,5' }))).toEqual({
      amountText: 'Проверьте сумму',
    });
  });

  it('requires a category of an expense and an income but not of a transfer', () => {
    expect(errorsOf(buildForm({ kind: 'income', categoryId: null }))).toEqual({
      categoryId: 'Выберите категорию',
    });
    expect(errorsOf(transferForm({ categoryId: null }))).toEqual({});
  });

  it('requires a target account other than the source one', () => {
    expect(errorsOf(transferForm({ toAccountId: null }))).toEqual({
      toAccountId: 'Выберите счёт зачисления',
    });
    expect(errorsOf(transferForm({ toAccountId: BYN_WALLET.id }))).toEqual({
      toAccountId: 'Выберите другой счёт',
    });
  });

  it('requires the credited amount only between currencies, in the target currency', () => {
    expect(errorsOf(transferForm({ toAmountText: 'что угодно' }))).toEqual({});
    expect(errorsOf(transferForm({ toAccountId: USD_CARD.id }))).toEqual({
      toAmountText: 'Введите сумму зачисления',
    });
    expect(errorsOf(transferForm({ toAccountId: USD_CARD.id, toAmountText: '29,555' }))).toEqual({
      toAmountText: 'Проверьте сумму зачисления',
    });
    // The source is BYN: each text below gets the opposite verdict when read in the source currency
    expect(errorsOf(transferForm({ toAccountId: JPY_WALLET.id, toAmountText: '10,5' }))).toEqual({
      toAmountText: 'Проверьте сумму зачисления',
    });
    expect(errorsOf(transferForm({ toAccountId: KWD_WALLET.id, toAmountText: '1,234' }))).toEqual(
      {},
    );
  });

  it('requires the credited amount of an edited transfer saved with unequal sides', () => {
    const original: Operation = {
      id: 7,
      kind: 'transfer',
      accountId: BYN_WALLET.id,
      amountMinor: -5000,
      toAccountId: BYN_CARD.id,
      toAmountMinor: 4900,
      feeMinor: null,
      feeCategoryId: null,
      categoryId: null,
      payee: null,
      note: null,
      originalAmountMinor: null,
      originalCurrency: null,
      occurredAt: Date.UTC(2026, 10, 12, 6, 15),
      utcOffsetMin: 180,
      source: 'manual',
    };

    expect(errorsOf(transferForm({ amountText: '50' }), context(original))).toEqual({
      toAmountText: 'Введите сумму зачисления',
    });
    expect(errorsOf(transferForm({ amountText: '50' }))).toEqual({});
  });

  it('checks an optional fee in the source currency', () => {
    expect(errorsOf(transferForm({ feeText: '' }))).toEqual({});
    expect(errorsOf(transferForm({ feeText: '1,555' }))).toEqual({
      feeText: 'Проверьте комиссию',
    });
    expect(errorsOf(transferForm({ feeText: '0' }))).toEqual({ feeText: 'Проверьте комиссию' });
  });

  // The exponents of the two sides differ: each fee gets the opposite verdict in the target currency
  it('reads the fee in the source currency, not in the target one', () => {
    expect(
      errorsOf(
        transferForm({
          accountId: JPY_WALLET.id,
          amountText: '1000',
          toAccountId: USD_CARD.id,
          toAmountText: '6,5',
          feeText: '0,5',
        }),
      ),
    ).toEqual({ feeText: 'Проверьте комиссию' });
    expect(
      errorsOf(
        transferForm({
          accountId: KWD_WALLET.id,
          amountText: '1,234',
          toAccountId: BYN_CARD.id,
          toAmountText: '12,34',
          feeText: '0,005',
        }),
      ),
    ).toEqual({});
  });
});
