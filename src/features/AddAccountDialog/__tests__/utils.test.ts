import { describe, expect, it } from 'vitest';
import { accountToForm, toAccountUpdate, toNewAccount } from '../utils';
import type { Account } from '@/entities/account/account.types';
import type { AccountCard } from '@/entities/accountCard/accountCard.types';
import type { AccountForm } from '../types';
import { GET_INITIAL_VALUE } from '../constants';

function buildForm(overrides: Partial<AccountForm> = {}): AccountForm {
  return { ...GET_INITIAL_VALUE(), name: 'Зарплатная', currency: 'BYN', ...overrides };
}

function buildAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: 7,
    name: 'Зарплатная',
    type: 'card',
    currency: 'BYN',
    openingBalanceMinor: 0,
    bankPackage: 'by.bank.app',
    isArchived: false,
    sortOrder: 1,
    ...overrides,
  };
}

const CARDS: AccountCard[] = [
  { id: 1, accountId: 7, lastDigits: '1234' },
  { id: 2, accountId: 7, lastDigits: '5678' },
  // Another account's card: the store hands every card over
  { id: 3, accountId: 8, lastDigits: '9999' },
];

describe('toNewAccount', () => {
  it('reads the opening balance in the minor units of the form currency', () => {
    expect(
      toNewAccount(buildForm({ openingBalanceText: '-1 000,50' })).account.openingBalanceMinor,
    ).toBe(-100050);
    expect(toNewAccount(buildForm({ openingBalanceText: '' })).account.openingBalanceMinor).toBe(0);
    expect(
      toNewAccount(buildForm({ currency: 'JPY', openingBalanceText: '1000' })).account
        .openingBalanceMinor,
    ).toBe(1000);
  });

  it('trims the name', () => {
    expect(toNewAccount(buildForm({ name: '  Наличные дома  ' })).account.name).toBe(
      'Наличные дома',
    );
  });

  it('saves a card with its bank app, its digits and the digits left in the add field', () => {
    const { account, lastDigits } = toNewAccount(
      buildForm({ bankPackage: 'by.bank.app', cardDigits: ['1234'], newCardDigits: '5678' }),
    );

    expect(account).toEqual({
      name: 'Зарплатная',
      type: 'card',
      currency: 'BYN',
      openingBalanceMinor: 0,
      bankPackage: 'by.bank.app',
    });
    expect(lastDigits).toEqual(['1234', '5678']);
  });

  // Typed before the type was switched to cash, the card fields stay in the form but go nowhere
  it('saves cash without a bank app and without digits', () => {
    const { account, lastDigits } = toNewAccount(
      buildForm({
        type: 'cash',
        bankPackage: 'by.bank.app',
        cardDigits: ['1234'],
        newCardDigits: '5678',
      }),
    );

    expect(account.type).toBe('cash');
    expect(account.bankPackage).toBeNull();
    expect(lastDigits).toEqual([]);
  });
});

describe('accountToForm', () => {
  it('opens the balance as the text of the field, with an empty field for zero', () => {
    expect(accountToForm(buildAccount({ openingBalanceMinor: 0 }), []).openingBalanceText).toBe('');
    expect(
      accountToForm(buildAccount({ openingBalanceMinor: -100050 }), []).openingBalanceText,
    ).toBe('-1000,50');
  });

  it('takes the digits of this account only and leaves the add field empty', () => {
    expect(accountToForm(buildAccount(), CARDS)).toEqual({
      name: 'Зарплатная',
      type: 'card',
      currency: 'BYN',
      openingBalanceText: '',
      bankPackage: 'by.bank.app',
      cardDigits: ['1234', '5678'],
      newCardDigits: '',
    });
  });
});

describe('toAccountUpdate', () => {
  it('changes nothing for a form opened and saved as is', () => {
    const account = buildAccount({ openingBalanceMinor: -100050 });

    expect(toAccountUpdate(accountToForm(account, CARDS), account, CARDS)).toEqual({
      changes: {},
      cards: { add: [], removeIds: [] },
    });
  });

  it('carries only the fields that changed', () => {
    const account = buildAccount();
    const form = {
      ...accountToForm(account, CARDS),
      name: ' Основная ',
      openingBalanceText: '12,30',
      bankPackage: null,
    };

    expect(toAccountUpdate(form, account, CARDS).changes).toEqual({
      name: 'Основная',
      openingBalanceMinor: 1230,
      bankPackage: null,
    });
  });

  it('adds the new digits, the ones left in the add field too, and removes the dropped cards', () => {
    const account = buildAccount();
    const form = {
      ...accountToForm(account, CARDS),
      cardDigits: ['5678', '4321'],
      newCardDigits: '1111',
    };

    expect(toAccountUpdate(form, account, CARDS).cards).toEqual({
      add: ['4321', '1111'],
      removeIds: [1],
    });
  });

  // The type and the currency of a saved account are fixed, whatever the form holds
  it('reads the amount in the currency of the account and keeps cash without cards', () => {
    const account = buildAccount({
      type: 'cash',
      currency: 'JPY',
      bankPackage: null,
      openingBalanceMinor: 500,
    });
    const form = {
      ...accountToForm(account, []),
      type: 'card' as const,
      currency: 'BYN',
      openingBalanceText: '1000',
      bankPackage: 'by.bank.app',
      cardDigits: ['1234'],
    };

    expect(toAccountUpdate(form, account, [])).toEqual({
      changes: { openingBalanceMinor: 1000 },
      cards: { add: [], removeIds: [] },
    });
  });
});
