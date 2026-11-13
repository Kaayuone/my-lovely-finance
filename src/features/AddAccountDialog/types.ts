import type { AccountType } from '@/types/finance';

export type AccountForm = {
  name: string;
  type: AccountType;
  currency: string | null;
  // Signed, '' means 0
  openingBalanceText: string;
  // Card only
  bankPackage: string | null;
  // Card only, four digits each
  cardDigits: string[];
  // Card only: typed in the add field but not added yet; saved with the form
  newCardDigits: string;
};

export type AccountTypeOption = { label: string; value: AccountType };

export type BankAppOption = { label: string; value: string | null };
