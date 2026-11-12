import type { Audit } from '@/entities/types';
import type { AccountType } from '@/types/finance';

export interface NewAccountRow {
  name: string;
  type: AccountType;
  currency: string;
  opening_balance_minor: number;
  bank_package: string | null;
}

export interface AccountRow extends NewAccountRow, Audit {
  id: number;
  is_archived: number;
  sort_order: number;
}

export type NewAccount = {
  name: string;
  type: AccountType;
  currency: string;
  openingBalanceMinor: number;
  /** The package of the bank app whose notifications belong to the account; null for cash. */
  bankPackage: string | null;
};

export type Account = NewAccount & {
  id: number;
  isArchived: boolean;
  sortOrder: number;
};

// Account type and currency cannot change after creation.
export type AccountChanges = Partial<
  Pick<Account, 'name' | 'openingBalanceMinor' | 'bankPackage' | 'sortOrder'>
>;

export interface AccountBalanceRow {
  account_id: number;
  balance_minor: number;
}

export type AccountBalance = {
  accountId: number;
  balanceMinor: number;
};
