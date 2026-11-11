import type { NewOperation, NewOperationRow, Operation, OperationRow } from './operation.types';

export function newOperationToRow(operation: NewOperation): NewOperationRow {
  // The columns a kind does not carry stay null, so a replaced row keeps nothing of its former kind
  const row: NewOperationRow = {
    kind: operation.kind,
    account_id: operation.accountId,
    amount_minor: operation.amountMinor,
    to_account_id: null,
    to_amount_minor: null,
    fee_minor: null,
    fee_category_id: null,
    category_id: null,
    payee: null,
    note: operation.note,
    original_amount_minor: null,
    original_currency: null,
    occurred_at: operation.occurredAt,
    utc_offset_min: operation.utcOffsetMin,
    source: operation.source,
  };

  switch (operation.kind) {
    case 'expense':
    case 'income':
      return {
        ...row,
        category_id: operation.categoryId,
        payee: operation.payee,
        original_amount_minor: operation.originalAmountMinor,
        original_currency: operation.originalCurrency,
      };
    case 'transfer':
      return {
        ...row,
        to_account_id: operation.toAccountId,
        to_amount_minor: operation.toAmountMinor,
        fee_minor: operation.feeMinor,
        fee_category_id: operation.feeCategoryId,
      };
    case 'adjustment':
      return row;
  }
}

export function rowToOperation(row: OperationRow): Operation {
  return {
    id: row.id,
    kind: row.kind,
    accountId: row.account_id,
    amountMinor: row.amount_minor,
    toAccountId: row.to_account_id,
    toAmountMinor: row.to_amount_minor,
    feeMinor: row.fee_minor,
    feeCategoryId: row.fee_category_id,
    categoryId: row.category_id,
    payee: row.payee,
    note: row.note,
    originalAmountMinor: row.original_amount_minor,
    originalCurrency: row.original_currency,
    occurredAt: row.occurred_at,
    utcOffsetMin: row.utc_offset_min,
    source: row.source,
  };
}
