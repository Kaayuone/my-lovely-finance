import type { Account } from '@/entities/account/account.types';
import type { Operation } from '@/entities/operation/operation.types';

export type OperationFormKind = 'expense' | 'income' | 'transfer';

export type OperationForm = {
  kind: OperationFormKind;
  accountId: number | null;
  // Unsigned, in the currency of accountId: the kind gives the sign
  amountText: string;
  // Expense only: a refund is stored with a plus
  isRefund: boolean;
  // Expense and income
  categoryId: number | null;
  // Expense and income; '' is stored as null
  payee: string;
  // Transfer
  toAccountId: number | null;
  // A transfer between currencies, in the currency of toAccountId
  toAmountText: string;
  // Transfer, optional, in the currency of accountId
  feeText: string;
  // '' is stored as null
  note: string;
  // The wall clock the picker shows
  dateTime: Date | null;
};

export type OperationFormContext = {
  accountsById: ReadonlyMap<number, Account>;
  // The id of the built-in fee category, FEE_CATEGORY_CODE
  feeCategoryId: number | null;
  // The operation being edited
  original: Operation | null;
};
