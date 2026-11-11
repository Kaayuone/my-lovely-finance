import { CURRENCY_EXPONENTS, DEFAULT_CURRENCY_EXPONENT } from '@/constants/currency';
import type { Money } from '@/types/finance';

type SignDisplay = 'auto' | 'always' | 'exceptZero';

const formatterCache = new Map<string, Intl.NumberFormat>();

export function currencyExponent(currency: string): number {
  return CURRENCY_EXPONENTS[currency] ?? DEFAULT_CURRENCY_EXPONENT;
}

/**
 * Parses an amount typed by a person into an integer of minor units, or `null` when the text is not
 * an amount in this currency. The text is split into whole and fraction digits and joined as
 * integers, so no binary fraction is ever multiplied.
 */
export function parseAmount(input: string, currency: string): number | null {
  // Sign, whole part (plain or grouped by thousands with a space, U+00A0 or U+202F), then an
  // optional fraction after a comma or a dot
  const match = /^([+-]?)(\d{1,3}(?:[   ]\d{3})+|\d+)(?:[.,](\d+))?$/.exec(input.trim());
  if (!match) return null;

  const [, sign, wholeText = '', fraction = ''] = match;
  const exponent = currencyExponent(currency);
  if (fraction.length > exponent) return null;

  const whole = Number(wholeText.replace(/\D/g, ''));
  const fractionMinor = exponent === 0 ? 0 : Number(fraction.padEnd(exponent, '0'));
  const minor = whole * 10 ** exponent + fractionMinor;
  if (!Number.isSafeInteger(minor)) return null;

  // A negated zero would be -0
  return sign === '-' && minor !== 0 ? -minor : minor;
}

/** The amount as a plain decimal string, `-1234.50` for -123450 minor units of BYN. */
export function toDecimalString({ amountMinor, currency }: Money): `${number}` {
  if (!Number.isSafeInteger(amountMinor)) throw new Error('Amount must be a safe integer');

  const exponent = currencyExponent(currency);
  const sign = amountMinor < 0 ? '-' : '';
  const digits = String(Math.abs(amountMinor)).padStart(exponent + 1, '0');
  const decimal =
    exponent === 0
      ? `${sign}${digits}`
      : `${sign}${digits.slice(0, -exponent)}.${digits.slice(-exponent)}`;

  // Built from a sign and digits only, so it is a numeric literal that Intl.NumberFormat accepts
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return decimal as `${number}`;
}

export function formatMoney(
  money: Money,
  { signDisplay = 'auto' }: { signDisplay?: SignDisplay } = {},
): string {
  const decimal = toDecimalString(money);
  return getFormatter(money.currency, signDisplay).format(decimal);
}

function getFormatter(currency: string, signDisplay: SignDisplay): Intl.NumberFormat {
  const key = `${currency}|${signDisplay}`;
  const cached = formatterCache.get(key);
  if (cached) return cached;

  const exponent = currencyExponent(currency);
  const formatter = new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency,
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
    signDisplay,
  });
  formatterCache.set(key, formatter);
  return formatter;
}
