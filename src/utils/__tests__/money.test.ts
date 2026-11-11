import { describe, expect, it } from 'vitest';
import { currencyExponent, formatMoney, parseAmount, toDecimalString } from '@/utils/money';

// ICU output differs between versions in spaces and the minus sign: compare only the sign, the
// digits and the decimal comma
function amountText(formatted: string): string {
  return formatted.replace(/[^\d,+\-−]/g, '').replace(/−/g, '-');
}

describe('currencyExponent', () => {
  it('takes the number of minor digits from ISO 4217 and two for the rest', () => {
    expect(currencyExponent('CLF')).toBe(4);
    expect(currencyExponent('KWD')).toBe(3);
    expect(currencyExponent('JPY')).toBe(0);
    expect(currencyExponent('BYN')).toBe(2);
    expect(currencyExponent('XYZ')).toBe(2);
  });
});

describe('parseAmount', () => {
  it.each([
    ['12,50', 'BYN', 1250],
    ['12.5', 'BYN', 1250],
    ['-1 234,56', 'BYN', -123456],
    ['1 000', 'BYN', 100000],
    ['1 000 000', 'BYN', 100000000],
    ['0,05', 'BYN', 5],
    ['-0,05', 'BYN', -5],
    ['+7', 'BYN', 700],
    [' 12,50 ', 'BYN', 1250],
    ['100', 'JPY', 100],
    ['1,234', 'KWD', 1234],
    ['1,2345', 'CLF', 12345],
  ])('parses %j in %s as %d minor units', (input, currency, expected) => {
    expect(parseAmount(input, currency)).toBe(expected);
  });

  it.each([
    ['12,505', 'BYN'],
    ['1,5', 'JPY'],
    ['', 'BYN'],
    ['   ', 'BYN'],
    ['abc', 'BYN'],
    ['1,2,3', 'BYN'],
    ['--1', 'BYN'],
    ['12,', 'BYN'],
    [',5', 'BYN'],
    ['1 2', 'BYN'],
    ['12 34', 'BYN'],
    ['1  000', 'BYN'],
    ['1e3', 'BYN'],
  ])('rejects %j in %s', (input, currency) => {
    expect(parseAmount(input, currency)).toBeNull();
  });

  it('gives a plain zero for a signed zero', () => {
    expect(Object.is(parseAmount('-0', 'BYN'), 0)).toBe(true);
    expect(Object.is(parseAmount('-0,00', 'BYN'), 0)).toBe(true);
  });

  it('accepts the largest safe amount and rejects anything above it', () => {
    expect(parseAmount('90071992547409,91', 'BYN')).toBe(Number.MAX_SAFE_INTEGER);
    expect(parseAmount('-90071992547409,91', 'BYN')).toBe(-Number.MAX_SAFE_INTEGER);
    expect(parseAmount('90071992547409,92', 'BYN')).toBeNull();
    expect(parseAmount('9007199254740992', 'JPY')).toBeNull();
    expect(parseAmount('9'.repeat(400), 'BYN')).toBeNull();
  });
});

describe('toDecimalString', () => {
  it.each([
    [-5, 'BYN', '-0.05'],
    [5, 'BYN', '0.05'],
    [0, 'BYN', '0.00'],
    [-123450, 'BYN', '-1234.50'],
    [1000, 'JPY', '1000'],
    [12345, 'CLF', '1.2345'],
    [1234, 'KWD', '1.234'],
  ])('writes %d minor units of %s as %s', (amountMinor, currency, expected) => {
    expect(toDecimalString({ amountMinor, currency })).toBe(expected);
  });
});

describe('formatMoney', () => {
  it('stays exact up to the largest safe amount', () => {
    const formatted = formatMoney({ amountMinor: Number.MAX_SAFE_INTEGER, currency: 'BYN' });

    expect(amountText(formatted)).toBe('90071992547409,91');
  });

  it('shows the minus of an expense', () => {
    expect(amountText(formatMoney({ amountMinor: -123450, currency: 'BYN' }))).toBe('-1234,50');
    expect(amountText(formatMoney({ amountMinor: -5, currency: 'BYN' }))).toBe('-0,05');
  });

  it('shows the plus of an income only when asked to', () => {
    const income = { amountMinor: 1250, currency: 'BYN' };

    expect(amountText(formatMoney(income))).toBe('12,50');
    expect(amountText(formatMoney(income, { signDisplay: 'always' }))).toBe('+12,50');
    expect(amountText(formatMoney(income))).toBe('12,50');
  });

  it('keeps zero unsigned with exceptZero', () => {
    expect(
      amountText(formatMoney({ amountMinor: 0, currency: 'BYN' }, { signDisplay: 'exceptZero' })),
    ).toBe('0,00');
  });

  it('shows as many fraction digits as the currency has', () => {
    expect(amountText(formatMoney({ amountMinor: 1000, currency: 'JPY' }))).toBe('1000');
    expect(amountText(formatMoney({ amountMinor: 1234, currency: 'KWD' }))).toBe('1,234');
  });

  it('refuses an amount that is not a safe integer', () => {
    for (const amountMinor of [Number.MAX_SAFE_INTEGER + 1, 12.5, Number.NaN, Infinity]) {
      expect(() => formatMoney({ amountMinor, currency: 'BYN' })).toThrow(
        'Amount must be a safe integer',
      );
    }
  });
});
