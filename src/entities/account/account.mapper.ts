import type {
  Account,
  AccountBalance,
  AccountBalanceRow,
  AccountRow,
  NewAccount,
  NewAccountRow,
} from './account.types';

export function newAccountToRow(account: NewAccount): NewAccountRow {
  return {
    name: account.name,
    type: account.type,
    currency: account.currency,
    opening_balance_minor: account.openingBalanceMinor,
    bank_package: account.bankPackage,
  };
}

export function rowToAccount(row: AccountRow): Account {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    currency: row.currency,
    openingBalanceMinor: row.opening_balance_minor,
    bankPackage: row.bank_package,
    isArchived: Boolean(row.is_archived),
    sortOrder: row.sort_order,
  };
}

export function rowToAccountBalance(row: AccountBalanceRow): AccountBalance {
  return {
    accountId: row.account_id,
    balanceMinor: row.balance_minor,
  };
}
