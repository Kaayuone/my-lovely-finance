import type { Operation } from '@/entities/operation/operation.types';

// What a row of the feed shows. Every amount is formatted in the currency of the account it belongs
// to (D12): a transfer debits in the source account's currency and credits in the target's
export type OperationRowView = {
  operation: Operation;
  // The category («Продукты»), «Без категории», «Перевод» or «Корректировка»
  title: string;
  // «{payee} · {account}», the account alone, or «{source} → {target}» for a transfer
  subtitle: string;
  // Empty while the account, and with it the currency, is not known
  amount: string;
  // A transfer between currencies: «+…» in the currency of the target account
  creditAmount: string | null;
  // «комиссия 1,50 BYN», in the currency of the source account
  feeNote: string | null;
};

// One item of the feed. `DynamicScroller` keys and caches item sizes by `id`, and an item that moves
// into a view of the same height is not measured again, so no item may change its height with its
// neighbours: a day heading and the line between two rows are items of their own
export type OperationEntry =
  | { id: string; kind: 'heading'; label: string }
  | { id: string; kind: 'row'; row: OperationRowView }
  | { id: string; kind: 'separator' };

export type OperationAction = 'edit' | 'delete';
