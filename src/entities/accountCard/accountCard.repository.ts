import { executeSql, querySql, runInTransaction } from '@/database';
import { newAccountCardToRow, rowToAccountCard } from './accountCard.mapper';
import type { AccountCard, AccountCardRow, NewAccountCard } from './accountCard.types';

export async function getAccountCards(): Promise<AccountCard[]> {
  const res = await querySql<AccountCardRow>('SELECT * FROM account_cards ORDER BY account_id, id');
  return (res ?? []).map(rowToAccountCard);
}

// For a caller already inside `runInTransaction`: the insert joins its transaction
export async function insertAccountCardInTransaction(card: NewAccountCard): Promise<number> {
  const row = newAccountCardToRow(card);

  const result = await executeSql(
    'INSERT INTO account_cards (account_id, last_digits) VALUES (?, ?)',
    [row.account_id, row.last_digits],
    false,
  );
  const id = result.changes?.lastId;
  if (!id) throw new Error('Failed to get the ID of the new record');
  return id;
}

export async function insertAccountCard(card: NewAccountCard): Promise<number> {
  return runInTransaction(() => insertAccountCardInTransaction(card));
}

// For a caller already inside `runInTransaction`. Removes the card only when it belongs to that
// account: the id of a card of another account changes nothing.
export async function deleteAccountCardInTransaction(id: number, accountId: number): Promise<void> {
  await executeSql(
    'DELETE FROM account_cards WHERE id = ? AND account_id = ?',
    [id, accountId],
    false,
  );
}

export async function deleteAccountCard(id: number): Promise<void> {
  await runInTransaction(() => executeSql('DELETE FROM account_cards WHERE id = ?', [id], false));
}

// One card may serve several accounts, a multi-currency card having one account per currency
export async function findAccountIdsByLastDigits(lastDigits: string): Promise<number[]> {
  const res = await querySql<Pick<AccountCardRow, 'account_id'>>(
    'SELECT account_id FROM account_cards WHERE last_digits = ? ORDER BY account_id',
    [lastDigits],
  );
  return (res ?? []).map(row => row.account_id);
}
