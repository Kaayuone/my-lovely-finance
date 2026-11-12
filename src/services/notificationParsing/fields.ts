import { parseAmount } from '@/utils/money';
import {
  BALANCE_LABEL,
  BANK_TIME_MAX_AHEAD_MS,
  BANK_TIME_MAX_BEHIND_MS,
  BELARUSIAN_ROUBLE_WORD,
  CREDIT_WORDS,
  CURRENCY_ALIASES,
  CURRENCY_CODES,
  DEBIT_WORDS,
  DECLINED_WORDS,
  MONEY_MENTION,
  OK_WORDS,
} from './constants';
import type {
  MoneyDirection,
  MoneyMention,
  NotificationTexts,
  OperationStatus,
} from './notificationParsing.types';

/** The title and the fullest text of the notification a line apart: what templates are matched to. */
export function notificationMessage({ title, text, bigText, lines }: NotificationTexts): string {
  const body = bigText ?? text ?? lines;
  return [title, body]
    .filter(part => part !== null && part.trim() !== '')
    .join('\n')
    .replace(/\r\n?/g, '\n')
    .trim();
}

export function currencyCode(token: string): string | null {
  if (CURRENCY_CODES.has(token)) return token;
  if (BELARUSIAN_ROUBLE_WORD.test(token)) return 'BYN';

  const key = token.toLowerCase();
  if (!Object.hasOwn(CURRENCY_ALIASES, key)) return null;
  return CURRENCY_ALIASES[key] ?? null;
}

/** Signed minor units of a number as the bank wrote it, `null` when it is not an amount in `currency`. */
export function readAmount(numberText: string, currency: string): number | null {
  return parseAmount(numberText.replace(/\u2212/g, '-'), currency);
}

export function hasSign(numberText: string): boolean {
  return /^[+\-\u2212]/.test(numberText);
}

export function findMoneyMentions(message: string): MoneyMention[] {
  const mentions: MoneyMention[] = [];
  for (const match of message.matchAll(MONEY_MENTION)) {
    const numberText = match[1] ?? match[4] ?? '';
    const currency = currencyCode(match[2] ?? match[3] ?? '');
    if (!currency) continue;

    const amountMinor = readAmount(numberText, currency);
    if (amountMinor === null) continue;

    const lineStart = message.lastIndexOf('\n', match.index) + 1;
    mentions.push({
      amountMinor,
      currency,
      hasSign: hasSign(numberText),
      isBalance: BALANCE_LABEL.test(message.slice(lineStart, match.index)),
    });
  }
  return mentions;
}

export function directionOfSign(signedAmount: number): MoneyDirection {
  return signedAmount < 0 ? 'debit' : 'credit';
}

export function directionFromWords(text: string): MoneyDirection | null {
  const debit = DEBIT_WORDS.test(text);
  const credit = CREDIT_WORDS.test(text);
  if (debit === credit) return null;
  return debit ? 'debit' : 'credit';
}

export function statusFromWords(text: string): OperationStatus | null {
  if (DECLINED_WORDS.test(text)) return 'declined';
  return OK_WORDS.test(text) ? 'ok' : null;
}

/**
 * The moment of a bank's `dd.mm.yyyy` (or `dd.mm.yy`) and `hh:mm[:ss]` in the zone of the phone, or
 * `null` when there is no such date or it is implausible for the post time.
 */
export function bankTime(dateText: string, timeText: string, postedAt: number): number | null {
  const [day = NaN, month = NaN, yearText = NaN] = dateText.split('.').map(Number);
  const [hours = NaN, minutes = NaN, seconds = 0] = timeText.split(':').map(Number);
  const year = yearText < 100 ? 2000 + yearText : yearText;
  if (hours > 23 || minutes > 59 || seconds > 59) return null;

  const date = new Date(year, month - 1, day, hours, minutes, seconds);
  // 31.02 would roll over into March
  if (date.getDate() !== day || date.getMonth() !== month - 1) return null;

  const moment = date.getTime();
  if (moment > postedAt + BANK_TIME_MAX_AHEAD_MS) return null;
  if (moment < postedAt - BANK_TIME_MAX_BEHIND_MS) return null;
  return moment;
}

export function collapseSpaces(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
