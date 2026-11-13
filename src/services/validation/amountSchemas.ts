import { check, pipe, string } from 'valibot';
import { parseAmount } from '@/utils/money';
import type { GenericSchema } from 'valibot';

// An amount field holds the text as typed, and the rules read it with `parseAmount` in the currency
// of its account (ADR-0005). An empty text is left to the emptiness rule, so a field gets one
// message at a time. `currency: null` means the currency is not chosen yet: only the emptiness rule
// applies, the currency or account field reports itself

export function requiredPositiveAmount(
  currency: string | null,
  messages: { empty: string; invalid: string },
): GenericSchema<string> {
  return pipe(
    string(messages.empty),
    check(text => !isBlank(text), messages.empty),
    check(text => isBlank(text) || isAmount(text, currency, true), messages.invalid),
  );
}

export function optionalPositiveAmount(
  currency: string | null,
  invalidMessage: string,
): GenericSchema<string> {
  return pipe(
    string(invalidMessage),
    check(text => isBlank(text) || isAmount(text, currency, true), invalidMessage),
  );
}

// Zero and a minus pass: an opening balance can be either
export function optionalSignedAmount(
  currency: string | null,
  invalidMessage: string,
): GenericSchema<string> {
  return pipe(
    string(invalidMessage),
    check(text => isBlank(text) || isAmount(text, currency, false), invalidMessage),
  );
}

function isBlank(text: string): boolean {
  return text.trim() === '';
}

function isAmount(text: string, currency: string | null, positive: boolean): boolean {
  if (currency === null) return true;

  const amountMinor = parseAmount(text, currency);
  if (amountMinor === null) return false;
  return !positive || amountMinor > 0;
}
