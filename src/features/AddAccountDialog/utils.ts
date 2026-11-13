import { parseAmount, toAmountInputText } from '@/utils/money';

import type { Account, AccountChanges, NewAccount } from '@/entities/account/account.types';
import type { AccountCard } from '@/entities/accountCard/accountCard.types';
import type { AccountForm } from './types';

// `cards` may hold the cards of every account: only the ones of this account are taken
export function accountToForm(account: Account, cards: readonly AccountCard[]): AccountForm {
  return {
    name: account.name,
    type: account.type,
    currency: account.currency,
    openingBalanceText: toAmountInputText({
      amountMinor: account.openingBalanceMinor,
      currency: account.currency,
    }),
    bankPackage: account.bankPackage,
    cardDigits: cardsOf(account, cards).map(card => card.lastDigits),
    newCardDigits: '',
  };
}

export function toNewAccount(form: AccountForm): { account: NewAccount; lastDigits: string[] } {
  if (!form.currency) throw new Error('currency is required');

  const isCard = form.type === 'card';
  return {
    account: {
      name: form.name.trim(),
      type: form.type,
      currency: form.currency,
      openingBalanceMinor: toOpeningBalanceMinor(form.openingBalanceText, form.currency),
      bankPackage: isCard ? form.bankPackage : null,
    },
    lastDigits: isCard ? collectCardDigits(form) : [],
  };
}

// The type and the currency of a saved account never change, so the account's own are read and the
// form's are ignored. Only the fields that changed go to the update
export function toAccountUpdate(
  form: AccountForm,
  account: Account,
  cards: readonly AccountCard[],
): { changes: AccountChanges; cards: { add: string[]; removeIds: number[] } } {
  const { account: next, lastDigits } = toNewAccount({
    ...form,
    type: account.type,
    currency: account.currency,
  });

  const changes: AccountChanges = {};
  if (next.name !== account.name) changes.name = next.name;
  if (next.openingBalanceMinor !== account.openingBalanceMinor) {
    changes.openingBalanceMinor = next.openingBalanceMinor;
  }
  if (next.bankPackage !== account.bankPackage) changes.bankPackage = next.bankPackage;

  const accountCards = cardsOf(account, cards);
  const savedDigits = new Set(accountCards.map(card => card.lastDigits));
  const keptDigits = new Set(lastDigits);
  return {
    changes,
    cards: {
      add: lastDigits.filter(digits => !savedDigits.has(digits)),
      removeIds: accountCards.filter(card => !keptDigits.has(card.lastDigits)).map(card => card.id),
    },
  };
}

function cardsOf(account: Account, cards: readonly AccountCard[]): AccountCard[] {
  return cards.filter(card => card.accountId === account.id);
}

function toOpeningBalanceMinor(text: string, currency: string): number {
  if (text.trim() === '') return 0;

  const amountMinor = parseAmount(text, currency);
  if (amountMinor === null) throw new Error('opening balance is not an amount');
  return amountMinor;
}

// Digits typed into the add field but not added are saved too, rather than lost without a word
function collectCardDigits(form: AccountForm): string[] {
  return form.newCardDigits === ''
    ? [...form.cardDigits]
    : [...form.cardDigits, form.newCardDigits];
}
