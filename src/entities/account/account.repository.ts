import { executeSql, querySql, runInTransaction } from '@/database';
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
export async function insertAccount(account: NewAccount): Promise<number> {
  const row = newAccountToRow(account);

  return runInTransaction(async () => {
    const result = await executeSql(
      `INSERT INTO accounts (name, type, currency, opening_balance_minor, bank_package, sort_order)
        VALUES (?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM accounts))`,
      [row.name, row.type, row.currency, row.opening_balance_minor, row.bank_package],
      false,
    );
    const id = result.changes?.lastId;
    if (!id) throw new Error('Failed to get the ID of the new record');
    return id;
  });
}

// The type and the currency are fixed once the account exists: its operations are in that currency
export async function updateAccount(id: number, changes: AccountChanges): Promise<void> {
  const assignments = buildUpdateAssignments([
    { column: 'name', value: changes.name },
    { column: 'opening_balance_minor', value: changes.openingBalanceMinor },
    { column: 'bank_package', value: changes.bankPackage },
    { column: 'sort_order', value: changes.sortOrder },
  ]);

  if (!assignments) return;

  await runInTransaction(() =>
    executeSql(
      `UPDATE accounts SET ${assignments.sets.join(', ')} WHERE id = ?`,
      [...assignments.values, id],
      false,
    ),
  );
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
