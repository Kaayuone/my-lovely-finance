import type {
  AccountCard,
  AccountCardRow,
  NewAccountCard,
  NewAccountCardRow,
} from './accountCard.types';

export function newAccountCardToRow(card: NewAccountCard): NewAccountCardRow {
  return {
    account_id: card.accountId,
    last_digits: card.lastDigits,
  };
}

export function rowToAccountCard(row: AccountCardRow): AccountCard {
  return {
    id: row.id,
    accountId: row.account_id,
    lastDigits: row.last_digits,
  };
}
