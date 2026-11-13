import { describe, expect, it } from 'vitest';
import { collectErrors } from '@/services/validation';
import { getAccountFormSchema, getNewCardDigitsError } from '../validation';
import type { AccountForm } from '../types';
import { GET_INITIAL_VALUE } from '../constants';

function buildForm(overrides: Partial<AccountForm> = {}): AccountForm {
  return { ...GET_INITIAL_VALUE(), name: 'Зарплатная', ...overrides };
}

function errorsOf(form: AccountForm) {
  return collectErrors(getAccountFormSchema(form), form);
}

describe('account form schema', () => {
  it('accepts a filled card and a filled cash account', () => {
    expect(
      errorsOf(buildForm({ openingBalanceText: '-1 000,50', cardDigits: ['1234', '5678'] })),
    ).toEqual({});
    expect(errorsOf(buildForm({ type: 'cash', openingBalanceText: '' }))).toEqual({});
  });

  it('requires a name that is more than spaces and a currency', () => {
    expect(errorsOf(buildForm({ name: '   ' }))).toEqual({ name: 'Введите название счёта' });
    expect(errorsOf(buildForm({ currency: null }))).toEqual({ currency: 'Выберите валюту' });
  });

  it('checks the opening balance in the currency of the form', () => {
    expect(errorsOf(buildForm({ openingBalanceText: '1,234' }))).toEqual({
      openingBalanceText: 'Проверьте сумму остатка',
    });
    expect(errorsOf(buildForm({ openingBalanceText: 'сто' }))).toEqual({
      openingBalanceText: 'Проверьте сумму остатка',
    });
    expect(errorsOf(buildForm({ currency: 'JPY', openingBalanceText: '1000,5' }))).toEqual({
      openingBalanceText: 'Проверьте сумму остатка',
    });
    expect(errorsOf(buildForm({ openingBalanceText: '-0' }))).toEqual({});
  });

  it('wants exactly four digits per card and no card twice', () => {
    expect(errorsOf(buildForm({ cardDigits: ['1234', '123'] }))).toEqual({
      'cardDigits.1': 'Нужны четыре последние цифры',
    });
    expect(errorsOf(buildForm({ cardDigits: ['12a4'] }))).toEqual({
      'cardDigits.0': 'Нужны четыре последние цифры',
    });
    expect(errorsOf(buildForm({ cardDigits: ['1234', '5678', '1234'] }))).toEqual({
      'cardDigits.2': 'Эта карта уже добавлена',
    });
  });

  it('lets an empty add field through and checks the digits typed into it', () => {
    expect(errorsOf(buildForm({ cardDigits: ['1234'], newCardDigits: '' }))).toEqual({});
    expect(errorsOf(buildForm({ cardDigits: ['1234'], newCardDigits: '56' }))).toEqual({
      newCardDigits: 'Нужны четыре последние цифры',
    });
    expect(errorsOf(buildForm({ cardDigits: ['1234'], newCardDigits: '1234' }))).toEqual({
      newCardDigits: 'Эта карта уже добавлена',
    });
  });

  // The card fields of a form switched to cash are not saved, so they cannot stop the save
  it('ignores the card fields of a cash account', () => {
    expect(
      errorsOf(buildForm({ type: 'cash', cardDigits: ['1234', '1234'], newCardDigits: '12' })),
    ).toEqual({});
  });
});

describe('getNewCardDigitsError', () => {
  it('lets four new digits into the list', () => {
    expect(getNewCardDigitsError('5678', ['1234'])).toBeUndefined();
  });

  it('keeps out fewer digits, other characters and a card already in the list', () => {
    expect(getNewCardDigitsError('567', [])).toBe('Нужны четыре последние цифры');
    expect(getNewCardDigitsError('56 7', [])).toBe('Нужны четыре последние цифры');
    expect(getNewCardDigitsError('1234', ['1234'])).toBe('Эта карта уже добавлена');
  });
});
