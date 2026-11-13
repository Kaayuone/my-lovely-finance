import { describe, expect, it } from 'vitest';
import { safeParse } from 'valibot';
import {
  optionalPositiveAmount,
  optionalSignedAmount,
  requiredPositiveAmount,
} from '@/services/validation/amountSchemas';
import { parseAmount } from '@/utils/money';
import type { GenericSchema } from 'valibot';

const MESSAGES = { empty: 'Введите сумму', invalid: 'Неверная сумма' };

function messagesOf(schema: GenericSchema<string>, text: string): string[] {
  const result = safeParse(schema, text);
  return result.success ? [] : result.issues.map(issue => issue.message);
}

describe('requiredPositiveAmount', () => {
  it.each(['1 234,5', '1234.50'])('passes %j as it was typed', text => {
    const result = safeParse(requiredPositiveAmount('BYN', MESSAGES), text);

    expect(result.success).toBe(true);
    expect(result.output).toBe(text);
    expect(parseAmount(text, 'BYN')).toBe(123450);
  });

  it.each(['', '  '])('asks for an amount when the field is %j', text => {
    expect(messagesOf(requiredPositiveAmount('BYN', MESSAGES), text)).toEqual([MESSAGES.empty]);
  });

  it.each(['0', '-5', '12,345', 'abc'])('rejects %j in BYN', text => {
    expect(messagesOf(requiredPositiveAmount('BYN', MESSAGES), text)).toEqual([MESSAGES.invalid]);
  });

  it('allows as many fraction digits as the currency has', () => {
    expect(messagesOf(requiredPositiveAmount('JPY', MESSAGES), '10,5')).toEqual([MESSAGES.invalid]);
    expect(messagesOf(requiredPositiveAmount('KWD', MESSAGES), '1,234')).toEqual([]);
  });

  it('checks only the emptiness until the currency is chosen', () => {
    expect(messagesOf(requiredPositiveAmount(null, MESSAGES), 'abc')).toEqual([]);
    expect(messagesOf(requiredPositiveAmount(null, MESSAGES), '')).toEqual([MESSAGES.empty]);
  });
});

describe('optionalPositiveAmount', () => {
  it('passes an empty field and rejects zero', () => {
    expect(messagesOf(optionalPositiveAmount('BYN', MESSAGES.invalid), '')).toEqual([]);
    expect(messagesOf(optionalPositiveAmount('BYN', MESSAGES.invalid), '  ')).toEqual([]);
    expect(messagesOf(optionalPositiveAmount('BYN', MESSAGES.invalid), '0')).toEqual([
      MESSAGES.invalid,
    ]);
    expect(messagesOf(optionalPositiveAmount('BYN', MESSAGES.invalid), '-1')).toEqual([
      MESSAGES.invalid,
    ]);
    expect(messagesOf(optionalPositiveAmount('BYN', MESSAGES.invalid), '2,50')).toEqual([]);
  });

  it('lets anything through until the currency is chosen', () => {
    expect(messagesOf(optionalPositiveAmount(null, MESSAGES.invalid), 'abc')).toEqual([]);
  });
});

describe('optionalSignedAmount', () => {
  it.each(['', '0', '-1 000,50', '+5'])('passes %j', text => {
    expect(messagesOf(optionalSignedAmount('BYN', MESSAGES.invalid), text)).toEqual([]);
  });

  it.each(['1,234', '-', 'abc'])('rejects %j in BYN', text => {
    expect(messagesOf(optionalSignedAmount('BYN', MESSAGES.invalid), text)).toEqual([
      MESSAGES.invalid,
    ]);
  });

  it('lets anything through until the currency is chosen', () => {
    expect(messagesOf(optionalSignedAmount(null, MESSAGES.invalid), 'abc')).toEqual([]);
  });
});
