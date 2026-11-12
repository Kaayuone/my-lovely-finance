import { BUILT_IN_TEMPLATES, CARD_DIGITS, DATE_TIME } from './constants';
import {
  bankTime,
  directionFromWords,
  directionOfSign,
  findMoneyMentions,
  notificationMessage,
  statusFromWords,
} from './fields';
import type {
  CompiledTemplate,
  NotificationTemplate,
  NotificationTexts,
  ParsedNotification,
} from './notificationParsing.types';
import { compileTemplate, readWithTemplate } from './template';

const compiledTemplates = new WeakMap<NotificationTemplate, CompiledTemplate>();

/**
 * Reads the operation a bank notification tells of (ADR-0007): the templates of its app first, then
 * the templates of any app, then the general parser. `null` — no amount the parser could trust.
 */
export function parseNotification(
  notification: NotificationTexts,
  templates: readonly NotificationTemplate[] = BUILT_IN_TEMPLATES,
): ParsedNotification | null {
  const message = notificationMessage(notification);
  if (!message) return null;

  const candidates = [
    ...templates.filter(template => template.packageName === notification.packageName),
    ...templates.filter(template => template.packageName === null),
  ];
  for (const template of candidates) {
    const parsed = readWithTemplate(compiled(template), message, notification.postedAt);
    if (parsed) return parsed;
  }
  return parseGeneral(message, notification.postedAt);
}

/**
 * Any bank, no template: the amount is the one next to a currency that is not labelled as the
 * balance. Two different amounts — a purchase in another currency, a fee — leave it unparsed rather
 * than guess which one the account lost. There is no payee: only a template knows where it is.
 */
function parseGeneral(message: string, postedAt: number): ParsedNotification | null {
  const mentions = findMoneyMentions(message);
  const amounts = mentions.filter(mention => !mention.isBalance);
  const [first] = amounts;
  if (!first || first.amountMinor === 0) return null;

  const amountMinor = Math.abs(first.amountMinor);
  const agree = amounts.every(
    mention => Math.abs(mention.amountMinor) === amountMinor && mention.currency === first.currency,
  );
  if (!agree) return null;

  const signs = new Set(
    amounts.filter(mention => mention.hasSign).map(mention => Math.sign(mention.amountMinor)),
  );
  if (signs.size > 1) return null;
  const [sign] = signs;

  const balance = mentions.find(
    mention => mention.isBalance && mention.currency === first.currency,
  );
  const dateTime = DATE_TIME.exec(message);
  const bankMoment = dateTime ? bankTime(dateTime[1] ?? '', dateTime[2] ?? '', postedAt) : null;

  return {
    templateId: null,
    amountMinor,
    currency: first.currency,
    direction: sign === undefined ? directionFromWords(message) : directionOfSign(sign),
    status: statusFromWords(message),
    payee: null,
    cardDigits: CARD_DIGITS.exec(message)?.[1] ?? null,
    balanceMinor: balance?.amountMinor ?? null,
    occurredAt: bankMoment ?? postedAt,
  };
}

function compiled(template: NotificationTemplate): CompiledTemplate {
  const cached = compiledTemplates.get(template);
  if (cached) return cached;

  const result = compileTemplate(template);
  compiledTemplates.set(template, result);
  return result;
}
