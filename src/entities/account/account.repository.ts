import { executeSql, querySql, runInTransaction } from '@/database';
import {
  deleteAccountCardInTransaction,
  insertAccountCardInTransaction,
} from '@/entities/accountCard/accountCard.repository';
import { buildUpdateAssignments } from '@/entities/update-builder';
import { newAccountToRow, rowToAccount, rowToAccountBalance } from './account.mapper';
import type {
  Account,
  AccountBalance,
  AccountBalanceRow,
  AccountChanges,
  AccountRow,
  NewAccount,
} from './account.types';

export async function getAccounts(): Promise<Account[]> {
  const res = await querySql<AccountRow>(
    'SELECT * FROM accounts ORDER BY is_archived, sort_order, id',
  );
  return (res ?? []).map(rowToAccount);
}

// A new account goes to the end of the list, past the archived ones too
async function insertAccountInTransaction(account: NewAccount): Promise<number> {
  const row = newAccountToRow(account);

  const result = await executeSql(
    `INSERT INTO accounts (name, type, currency, opening_balance_minor, bank_package, sort_order)
      VALUES (?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM accounts))`,
    [row.name, row.type, row.currency, row.opening_balance_minor, row.bank_package],
    false,
  );
  const id = result.changes?.lastId;
  if (!id) throw new Error('Failed to get the ID of the new record');
  return id;
}

export async function insertAccount(account: NewAccount): Promise<number> {
  return runInTransaction(() => insertAccountInTransaction(account));
}

// The account and its cards commit together or not at all. Saved one by one, a refused card would
// leave the account saved and the form open, and the next "Save" would create a second account.
export async function insertAccountWithCards(
  account: NewAccount,
  lastDigits: readonly string[],
): Promise<number> {
  return runInTransaction(async () => {
    const id = await insertAccountInTransaction(account);
    for (const digits of lastDigits) {
      await insertAccountCardInTransaction({ accountId: id, lastDigits: digits });
    }
    return id;
  });
}

// The type and the currency are fixed once the account exists: its operations are in that currency
function buildAccountAssignments(changes: AccountChanges) {
  return buildUpdateAssignments([
    { column: 'name', value: changes.name },
    { column: 'opening_balance_minor', value: changes.openingBalanceMinor },
    { column: 'bank_package', value: changes.bankPackage },
    { column: 'sort_order', value: changes.sortOrder },
  ]);
}

async function updateAccountInTransaction(id: number, changes: AccountChanges): Promise<void> {
  const assignments = buildAccountAssignments(changes);
  if (!assignments) return;

  await executeSql(
    `UPDATE accounts SET ${assignments.sets.join(', ')} WHERE id = ?`,
    [...assignments.values, id],
    false,
  );
}

// Nothing to change opens no transaction
export async function updateAccount(id: number, changes: AccountChanges): Promise<void> {
  if (!buildAccountAssignments(changes)) return;
  await runInTransaction(() => updateAccountInTransaction(id, changes));
}

// The fields and the cards of the account commit together, for the same reason as
// `insertAccountWithCards`: the next "Save" after a failure halfway would repeat what was written.
// The removals go before the additions, so removing a card and adding its digits back in one save
// does not break the UNIQUE of the account's cards.
export async function updateAccountWithCards(
  id: number,
  changes: AccountChanges,
  cards: { add: readonly string[]; removeIds: readonly number[] },
): Promise<void> {
  await runInTransaction(async () => {
    await updateAccountInTransaction(id, changes);
    for (const cardId of cards.removeIds) {
      await deleteAccountCardInTransaction(cardId, id);
    }
    for (const lastDigits of cards.add) {
      await insertAccountCardInTransaction({ accountId: id, lastDigits });
    }
  });
}

export async function setAccountArchived(id: number, archived: boolean): Promise<void> {
  await runInTransaction(() =>
    executeSql('UPDATE accounts SET is_archived = ? WHERE id = ?', [Number(archived), id], false),
  );
}

// The cards of the account go with it. An account with operations stays: their foreign keys
// restrict the delete, and the error reaches the caller.
export async function deleteAccount(id: number): Promise<void> {
  await runInTransaction(() => executeSql('DELETE FROM accounts WHERE id = ?', [id], false));
}

// Counts the transfers into the account as well as the operations on it
export async function countAccountOperations(id: number): Promise<number> {
  const res = await querySql<{ count: number }>(
    'SELECT COUNT(*) AS count FROM operations WHERE account_id = ? OR to_account_id = ?',
    [id, id],
  );
  return res[0]?.count ?? 0;
}

// The balance is never stored: the opening balance plus every operation, for all accounts in one
// query (ADR-0005). The source of a transfer loses the amount and the fee, both negative; the
// receiver gains the amount in its own currency.
export async function getAccountBalances(): Promise<AccountBalance[]> {
  const res = await querySql<AccountBalanceRow>(
    `SELECT a.id AS account_id, a.opening_balance_minor
      + COALESCE((SELECT SUM(o.amount_minor + COALESCE(o.fee_minor, 0)) FROM operations o WHERE o.account_id = a.id), 0)
      + COALESCE((SELECT SUM(o.to_amount_minor) FROM operations o WHERE o.to_account_id = a.id), 0) AS balance_minor
      FROM accounts a`,
  );
  return (res ?? []).map(rowToAccountBalance);
}
