import { parseAmount, toAmountInputText } from '@/utils/money';
import { currentOperationTime, operationTimeAt, operationWallClock } from '@/utils/operationTime';

import type { Account } from '@/entities/account/account.types';
import type { Category } from '@/entities/category/category.types';
import type {
  NewOperation,
  NewTransferOperation,
  Operation,
} from '@/entities/operation/operation.types';
import type { OperationTime } from '@/types/finance';
import type { OperationForm, OperationFormContext, OperationFormKind } from './types';

// A new operation is an expense from the first active account, now
export function newOperationForm(
  accounts: readonly Account[],
  now: Date = new Date(),
): OperationForm {
  const dateTime = new Date(now);
  dateTime.setSeconds(0, 0);

  return {
    kind: 'expense',
    accountId: accounts.find(account => !account.isArchived)?.id ?? null,
    amountText: '',
    isRefund: false,
    categoryId: null,
    payee: '',
    toAccountId: null,
    toAmountText: '',
    feeText: '',
    note: '',
    dateTime,
  };
}

/**
 * The form of a saved operation. Every amount is shown in the currency of its own account: the
 * exponent is never assumed, or a KWD amount read as BYN would grow tenfold. An adjustment has no
 * form, and an account missing from the map cannot give the currency, so both throw.
 */
export function operationToForm(
  operation: Operation,
  accountsById: ReadonlyMap<number, Account>,
): OperationForm {
  if (operation.kind === 'adjustment') throw new Error('An adjustment has no operation form');

  const { currency } = getAccount(operation.accountId, accountsById);
  const form: OperationForm = {
    kind: operation.kind,
    accountId: operation.accountId,
    amountText: toUnsignedAmountText(operation.amountMinor, currency),
    isRefund: operation.kind === 'expense' && operation.amountMinor > 0,
    categoryId: operation.categoryId,
    payee: operation.payee ?? '',
    toAccountId: null,
    toAmountText: '',
    feeText: '',
    note: operation.note ?? '',
    dateTime: operationWallClock(operation),
  };
  if (operation.kind !== 'transfer') return form;

  if (operation.toAmountMinor === null) throw new Error('A transfer has no credited amount');
  const toAccount = getAccount(operation.toAccountId, accountsById);
  return {
    ...form,
    toAccountId: toAccount.id,
    toAmountText: toAmountInputText({
      amountMinor: operation.toAmountMinor,
      currency: toAccount.currency,
    }),
    feeText: operation.feeMinor === null ? '' : toUnsignedAmountText(operation.feeMinor, currency),
  };
}

/**
 * The form after the kind switch. Leaving an expense drops the refund, and a category of another
 * set is dropped. A transfer does not read the category, so going back to the same kind keeps it,
 * while expense → transfer → income does not carry an expense category over to the income.
 */
export function changeOperationFormKind(
  form: OperationForm,
  kind: OperationFormKind,
  categoriesById: ReadonlyMap<number, Category>,
): OperationForm {
  const keepsCategory =
    kind === 'transfer' ||
    form.categoryId === null ||
    categoriesById.get(form.categoryId)?.kind === kind;

  return {
    ...form,
    kind,
    isRefund: kind === 'expense' && form.isRefund,
    categoryId: keepsCategory ? form.categoryId : null,
  };
}

/**
 * Whether the transfer needs its own credited amount: the currencies differ, or the edited
 * transfer was saved with sides that differ in module — the form must not silently make them
 * equal. An expense or income turned into a transfer has no credited amount to keep.
 */
export function needsCreditAmount(form: OperationForm, context: OperationFormContext): boolean {
  if (form.kind !== 'transfer') return false;

  const { original, accountsById } = context;
  if (original?.kind === 'transfer' && original.toAmountMinor !== -original.amountMinor)
    return true;

  const currency = accountCurrency(form.accountId, accountsById);
  const toCurrency = accountCurrency(form.toAccountId, accountsById);
  return currency !== null && toCurrency !== null && currency !== toCurrency;
}

/**
 * The operation to save. Called only after the form rules passed: an input they would reject (no
 * account, an amount that does not parse) throws instead of being saved as something else. Editing
 * keeps what the form does not show: the source, the original amount of an expense or income and
 * the fee category of a transfer.
 */
export function toNewOperation(form: OperationForm, context: OperationFormContext): NewOperation {
  const { accountsById, original } = context;
  const account = getAccount(form.accountId, accountsById);
  const amountMinor = toPositiveMinor(form.amountText, account.currency);
  const base = {
    ...toOperationTime(form.dateTime, original),
    note: toOptionalText(form.note),
    source: original?.source ?? 'manual',
    accountId: account.id,
  };

  if (form.kind === 'transfer') {
    const toAccount = getAccount(form.toAccountId, accountsById);
    if (toAccount.id === account.id) throw new Error('A transfer needs two different accounts');

    return {
      ...base,
      kind: 'transfer',
      amountMinor: -amountMinor,
      toAccountId: toAccount.id,
      // In one currency both sides are the same amount, and the hidden field is not read
      toAmountMinor: needsCreditAmount(form, context)
        ? toPositiveMinor(form.toAmountText, toAccount.currency)
        : amountMinor,
      ...toFee(form.feeText, account.currency, context),
    };
  }

  return {
    ...base,
    kind: form.kind,
    amountMinor: form.kind === 'expense' && !form.isRefund ? -amountMinor : amountMinor,
    categoryId: form.categoryId,
    payee: toOptionalText(form.payee),
    originalAmountMinor: original?.originalAmountMinor ?? null,
    originalCurrency: original?.originalCurrency ?? null,
  };
}

export function accountCurrency(
  accountId: number | null,
  accountsById: ReadonlyMap<number, Account>,
): string | null {
  if (accountId === null) return null;
  return accountsById.get(accountId)?.currency ?? null;
}

function getAccount(accountId: number | null, accountsById: ReadonlyMap<number, Account>) {
  const account = accountId === null ? undefined : accountsById.get(accountId);
  if (!account) throw new Error(`Account ${accountId} not found`);
  return account;
}

function toUnsignedAmountText(amountMinor: number, currency: string): string {
  return toAmountInputText({ amountMinor: amountMinor < 0 ? -amountMinor : amountMinor, currency });
}

function toPositiveMinor(text: string, currency: string): number {
  const amountMinor = parseAmount(text, currency);
  if (amountMinor === null || amountMinor <= 0) {
    throw new Error('The amount does not pass the form rules');
  }
  return amountMinor;
}

function toFee(
  feeText: string,
  currency: string,
  { feeCategoryId, original }: OperationFormContext,
): Pick<NewTransferOperation, 'feeMinor' | 'feeCategoryId'> {
  if (feeText.trim() === '') return { feeMinor: null, feeCategoryId: null };

  // An edited transfer keeps the category its fee was booked to
  const categoryId = original?.feeCategoryId ?? feeCategoryId;
  if (categoryId === null) throw new Error('Fee category not found');

  return { feeMinor: -toPositiveMinor(feeText, currency), feeCategoryId: categoryId };
}

/**
 * A new operation happens at the picked moment in the phone's zone at that moment. An edited one
 * whose minute did not change keeps its stored moment to the second; a changed minute is read in
 * the operation's own offset, so an operation entered on a trip keeps its zone and its day.
 */
function toOperationTime(dateTime: Date | null, original: Operation | null): OperationTime {
  if (!dateTime || Number.isNaN(dateTime.getTime())) throw new Error('The date is missing');
  if (!original) return currentOperationTime(dateTime);

  if (isSameMinute(dateTime, operationWallClock(original))) {
    return { occurredAt: original.occurredAt, utcOffsetMin: original.utcOffsetMin };
  }
  return operationTimeAt(dateTime, original.utcOffsetMin);
}

function isSameMinute(first: Date, second: Date): boolean {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate() &&
    first.getHours() === second.getHours() &&
    first.getMinutes() === second.getMinutes()
  );
}

function toOptionalText(text: string): string | null {
  return text.trim() || null;
}
