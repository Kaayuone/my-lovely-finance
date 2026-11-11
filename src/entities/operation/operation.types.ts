import type { Audit } from '@/entities/types';
import type { OperationKind, OperationSource } from '@/types/finance';

export interface NewOperationRow {
  kind: OperationKind;
  account_id: number;
  amount_minor: number;
  to_account_id: number | null;
  to_amount_minor: number | null;
  fee_minor: number | null;
  fee_category_id: number | null;
  category_id: number | null;
  payee: string | null;
  note: string | null;
  original_amount_minor: number | null;
  original_currency: string | null;
  occurred_at: number;
  utc_offset_min: number;
  source: OperationSource;
}

export interface OperationRow extends NewOperationRow, Audit {
  id: number;
}

// The amount is signed minor units of the account currency: an expense is negative, a refund is an
// expense with a plus, and a transfer debits its source account (ADR-0005)
type BaseNewOperation = {
  occurredAt: number;
  utcOffsetMin: number;
  note: string | null;
  source: OperationSource;
  accountId: number;
  amountMinor: number;
};

// The original amount and currency are for reference only and stay out of balances and totals
export type NewCategorizedOperation = BaseNewOperation & {
  kind: 'expense' | 'income';
  categoryId: number | null;
  payee: string | null;
  originalAmountMinor: number | null;
  originalCurrency: string | null;
};

// The credited amount is in the currency of the target account; the fee is negative, in the
// currency of the source account, and counts as an expense of its category
export type NewTransferOperation = BaseNewOperation & {
  kind: 'transfer';
  toAccountId: number;
  toAmountMinor: number;
  feeMinor: number | null;
  feeCategoryId: number | null;
};

export type NewAdjustmentOperation = BaseNewOperation & {
  kind: 'adjustment';
};

export type NewOperation = NewCategorizedOperation | NewTransferOperation | NewAdjustmentOperation;

// A stored operation stays flat: a row read back from SQLite cannot prove which variant it
// satisfies, so the fields a kind does not carry are null
export type Operation = {
  id: number;
  kind: OperationKind;
  accountId: number;
  amountMinor: number;
  toAccountId: number | null;
  toAmountMinor: number | null;
  feeMinor: number | null;
  feeCategoryId: number | null;
  categoryId: number | null;
  payee: string | null;
  note: string | null;
  originalAmountMinor: number | null;
  originalCurrency: string | null;
  occurredAt: number;
  utcOffsetMin: number;
  source: OperationSource;
};

// The last operation of the previous page: the next page starts right after it
export type OperationCursor = { occurredAt: number; id: number };

export type OperationsPageOptions = {
  limit: number;
  before?: OperationCursor;
  accountId?: number;
};
