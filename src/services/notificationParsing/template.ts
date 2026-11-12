import { TEMPLATE_SLOT_SYNTAX, TEMPLATE_SLOTS } from './constants';
import {
  bankTime,
  collapseSpaces,
  currencyCode,
  directionFromWords,
  directionOfSign,
  hasSign,
  readAmount,
  statusFromWords,
} from './fields';
import type {
  CompiledTemplate,
  NotificationTemplate,
  ParsedNotification,
  TemplateSlot,
} from './notificationParsing.types';

/**
 * Turns the pattern of a template into an anchored regular expression (ADR-0007): a run of spaces
 * or line breaks matches any run of whitespace, a slot matches its kind of value, the rest matches
 * itself. Throws on a slot it does not know and on a pattern without an amount and its currency.
 */
export function compileTemplate(template: NotificationTemplate): CompiledTemplate {
  const slots: TemplateSlot[] = [];
  let source = '';
  let literalStart = 0;

  for (const match of template.pattern.matchAll(TEMPLATE_SLOT_SYNTAX)) {
    const name = match[1] ?? '';
    if (!isTemplateSlot(name)) {
      throw new Error(`Template ${template.id} has an unknown slot {${name}}`);
    }
    source += literalSource(template.pattern.slice(literalStart, match.index));
    source += `(${TEMPLATE_SLOTS[name]})`;
    slots.push(name);
    literalStart = match.index + match[0].length;
  }
  source += literalSource(template.pattern.slice(literalStart));

  if (!slots.includes('amount') || !slots.includes('currency')) {
    throw new Error(`Template ${template.id} has no {amount} or {currency}`);
  }
  return { template, regex: new RegExp(`^${source}$`, 'u'), slots };
}

/**
 * Reads the notification with the template, or `null` when it does not match. A slot that occurs
 * more than once must hold the same value everywhere: the amount of the title and of the text.
 */
export function readWithTemplate(
  { template, regex, slots }: CompiledTemplate,
  message: string,
  postedAt: number,
): ParsedNotification | null {
  const match = regex.exec(message);
  if (!match) return null;

  const values = new Map<TemplateSlot, string>();
  for (const [index, slot] of slots.entries()) {
    if (slot === '*') continue;
    const value = collapseSpaces(match[index + 1] ?? '');
    const seen = values.get(slot);
    if (seen !== undefined && seen !== value) return null;
    values.set(slot, value);
  }

  const currency = currencyCode(values.get('currency') ?? '');
  if (!currency) return null;

  const amountText = values.get('amount') ?? '';
  const signedAmount = readAmount(amountText, currency);
  if (signedAmount === null || signedAmount === 0) return null;

  const balanceText = values.get('balance');
  const cardText = values.get('card');
  const dateText = values.get('date');
  const timeText = values.get('time');
  const bankMoment = dateText && timeText ? bankTime(dateText, timeText, postedAt) : null;

  return {
    templateId: template.id,
    amountMinor: Math.abs(signedAmount),
    currency,
    direction: hasSign(amountText)
      ? directionOfSign(signedAmount)
      : (template.direction ?? directionFromWords(message)),
    // A template that marks where the status is reads only that place
    status: statusFromWords(values.get('status') ?? message),
    payee: values.get('payee') || null,
    cardDigits: cardText ? cardText.slice(-4) : null,
    balanceMinor: balanceText ? readAmount(balanceText, currency) : null,
    occurredAt: bankMoment ?? postedAt,
  };
}

function isTemplateSlot(name: string): name is TemplateSlot {
  return Object.hasOwn(TEMPLATE_SLOTS, name);
}

// A literal part of the pattern: whitespace runs match any whitespace, everything else itself
function literalSource(text: string): string {
  return text
    .split(/\s+/)
    .map(part => part.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`))
    .join(String.raw`\s+`);
}
