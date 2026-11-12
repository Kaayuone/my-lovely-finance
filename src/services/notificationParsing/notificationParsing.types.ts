import type { CapturedNotification } from '@/services/capture';

// What the parser reads of a captured notification
export type NotificationTexts = Pick<
  CapturedNotification,
  'packageName' | 'postedAt' | 'title' | 'text' | 'bigText' | 'lines'
>;

// Money left the account or came to it, as the bank tells it. Whether that is an expense, a refund
// or a side of a transfer is decided later, not by the parser
export type MoneyDirection = 'debit' | 'credit';

// A declined operation moved no money
export type OperationStatus = 'ok' | 'declined';

export type TemplateSlot =
  | 'amount'
  | 'currency'
  | 'balance'
  | 'card'
  | 'payee'
  | 'status'
  | 'date'
  | 'time'
  | '*';

/**
 * A format of bank notifications as data (ADR-0007): the title and the text of the notification a
 * line apart, with `{slot}` where they vary from one notification to the next.
 */
export type NotificationTemplate = {
  id: string;
  // The app whose notifications it reads; null — any app, for SMS that every SMS app shows alike
  // with the sender as the title
  packageName: string | null;
  pattern: string;
  // For a format whose amount carries no sign
  direction: MoneyDirection | null;
};

export type CompiledTemplate = {
  template: NotificationTemplate;
  regex: RegExp;
  // The slot of each capturing group, in order
  slots: TemplateSlot[];
};

// An amount next to its currency somewhere in the notification
export type MoneyMention = {
  // Signed minor units; a number without a sign counts as positive
  amountMinor: number;
  currency: string;
  hasSign: boolean;
  isBalance: boolean;
};

export type ParsedNotification = {
  // The template that read the notification; null — the general parser
  templateId: string | null;
  // Positive minor units of `currency`: the sign is `direction`
  amountMinor: number;
  currency: string;
  direction: MoneyDirection | null;
  status: OperationStatus | null;
  payee: string | null;
  // The last four digits of the card
  cardDigits: string | null;
  // What the bank says is left on the account after the operation, signed, in `currency`
  balanceMinor: number | null;
  // When the bank says the operation happened, or the post time when it says nothing plausible
  occurredAt: number;
};
