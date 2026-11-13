import type { AccountForm, AccountTypeOption, BankAppOption } from './types';

import { DEFAULT_ACCOUNT_CURRENCY } from '@/constants/currency';

export const ACCOUNT_TYPE_OPTIONS: AccountTypeOption[] = [
  { label: 'Карта', value: 'card' },
  { label: 'Наличные', value: 'cash' },
];

// Picking it unlinks the account from the notifications of any bank app
export const NO_BANK_APP_OPTION: BankAppOption = { label: 'Без приложения', value: null };

// The last four digits of a card number, as a bank notification shows them
export const CARD_DIGITS_PATTERN = /^\d{4}$/;

export const GET_INITIAL_VALUE = (): AccountForm => ({
  name: '',
  type: 'card',
  currency: DEFAULT_ACCOUNT_CURRENCY,
  openingBalanceText: '',
  bankPackage: null,
  cardDigits: [],
  newCardDigits: '',
});
