import { formatMoney } from '@/utils/money';
import { operationLocalDay } from '@/utils/operationTime';
import { itemVersion } from '@/utils/scroller';

import type { Account } from '@/entities/account/account.types';
import type { Category } from '@/entities/category/category.types';
import type { Operation } from '@/entities/operation/operation.types';
import type { OperationEntry, OperationRowView } from './types';

import { DAY_MS, MONTH_NAMES_GENITIVE } from './constants';

/**
 * The heading of a day of the feed: «Сегодня», «Вчера», «12 ноября», and «12 ноября 2025» for a day
 * of another year. Both days are `YYYY-MM-DD` already, so the phone's zone takes no part here.
 */
export function dayLabel(day: string, today: string): string {
  if (day === today) return 'Сегодня';
  if (day === previousDay(today)) return 'Вчера';

  const [year = '', month = '', date = ''] = day.split('-');
  const label = `${Number(date)} ${MONTH_NAMES_GENITIVE[Number(month) - 1] ?? ''}`;
  return year === today.slice(0, 4) ? label : `${label} ${year}`;
}

/**
 * What a row of the feed shows (D12). Every amount is formatted in the currency of the account it
 * belongs to, and an account not loaded yet has no currency to format in: its amount stays empty
 * rather than shown in a guessed one.
 */
export function toOperationRowView(
  operation: Operation,
  accountsById: ReadonlyMap<number, Account>,
  categoriesById: ReadonlyMap<number, Category>,
): OperationRowView {
  const account = accountsById.get(operation.accountId);
  const accountName = getAccountName(account);

  switch (operation.kind) {
    case 'expense':
    case 'income': {
      const category =
        operation.categoryId === null ? undefined : categoriesById.get(operation.categoryId);
      return {
        operation,
        title: category?.name ?? 'Без категории',
        subtitle: operation.payee ? `${operation.payee} · ${accountName}` : accountName,
        amount: formatAccountAmount(operation.amountMinor, account, 'exceptZero'),
        creditAmount: null,
        feeNote: null,
      };
    }

    case 'transfer':
      return toTransferRowView(operation, account, accountsById);

    case 'adjustment':
      return {
        operation,
        title: 'Корректировка',
        subtitle: accountName,
        amount: formatAccountAmount(operation.amountMinor, account, 'exceptZero'),
        creditAmount: null,
        feeNote: null,
      };
  }
}

/** An income or a refund: money that came to the account rather than left it. */
export function isMoneyIn(operation: Operation): boolean {
  return operation.kind === 'income' || (operation.kind === 'expense' && operation.amountMinor > 0);
}

// Rows arrive newest first, so a day heading goes above the first row of each day, the day being
// the operation's own by its offset rather than the phone's. A heading is keyed by the row it heads.
// A separator follows every row but the last one, the one above the next day's heading too, and is
// keyed by the row above it. A row's key carries the version of all it shows, the names of its
// accounts and category included, so a row that changed is measured anew.
export function withDayHeadings(
  rows: readonly OperationRowView[],
  today: string,
): OperationEntry[] {
  const entries: OperationEntry[] = [];
  let previousRowDay: string | undefined;

  rows.forEach((row, index) => {
    const { id } = row.operation;
    const day = operationLocalDay(row.operation);
    if (day !== previousRowDay) {
      previousRowDay = day;
      entries.push({ id: `h:${id}`, kind: 'heading', label: dayLabel(day, today) });
    }

    entries.push({ id: `r:${id}:${itemVersion(row)}`, kind: 'row', row });
    if (index < rows.length - 1) entries.push({ id: `s:${id}`, kind: 'separator' });
  });

  return entries;
}

// The debit is in the source account's currency and the fee too; the credit is shown only between
// currencies, in the target account's: in one currency it is the debit without its minus
function toTransferRowView(
  operation: Operation,
  account: Account | undefined,
  accountsById: ReadonlyMap<number, Account>,
): OperationRowView {
  const toAccount =
    operation.toAccountId === null ? undefined : accountsById.get(operation.toAccountId);
  const isBetweenCurrencies =
    account !== undefined && toAccount !== undefined && account.currency !== toAccount.currency;

  return {
    operation,
    title: 'Перевод',
    subtitle: `${getAccountName(account)} → ${getAccountName(toAccount)}`,
    amount: formatAccountAmount(operation.amountMinor, account),
    creditAmount:
      isBetweenCurrencies && operation.toAmountMinor !== null
        ? formatAccountAmount(operation.toAmountMinor, toAccount, 'always')
        : null,
    feeNote:
      account && operation.feeMinor
        ? `комиссия ${formatAccountAmount(-operation.feeMinor, account)}`
        : null,
  };
}

function formatAccountAmount(
  amountMinor: number,
  account: Account | undefined,
  signDisplay?: 'always' | 'exceptZero',
): string {
  if (!account) return '';

  return formatMoney({ amountMinor, currency: account.currency }, { signDisplay });
}

function getAccountName(account: Account | undefined): string {
  return account?.name ?? 'Счёт';
}

// Counted in UTC, where every day is 24 hours long
function previousDay(day: string): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) - DAY_MS).toISOString().slice(0, 10);
}
