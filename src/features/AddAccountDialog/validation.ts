import { array, check, checkItems, object, pipe, regex, safeParse, string } from 'valibot';
import { requiredOption, requiredText } from '@/services/validation';
import { optionalSignedAmount } from '@/services/validation/amountSchemas';

import type { AccountForm } from './types';

import { CARD_DIGITS_PATTERN } from './constants';

// The add field may stay empty: the form saves without it. Typed digits are saved with the form, so
// they follow the same rules as the digits already in the list
function newCardDigitsSchema(added: readonly string[]) {
  return pipe(
    string('Нужны четыре последние цифры'),
    check(
      digits => digits === '' || CARD_DIGITS_PATTERN.test(digits),
      'Нужны четыре последние цифры',
    ),
    check(digits => !added.includes(digits), 'Эта карта уже добавлена'),
  );
}

const ACCOUNT_ENTRIES = {
  name: requiredText('Введите название счёта'),
  currency: requiredOption<string>('Выберите валюту'),
};

// The rules follow the currency of the form, and the card fields are checked only for a card: a cash
// account saves neither its digits nor its bank app
export function getAccountFormSchema(form: AccountForm) {
  const openingBalanceText = optionalSignedAmount(form.currency, 'Проверьте сумму остатка');
  if (form.type !== 'card') return object({ ...ACCOUNT_ENTRIES, openingBalanceText });

  return object({
    ...ACCOUNT_ENTRIES,
    openingBalanceText,
    cardDigits: pipe(
      array(
        pipe(
          string('Нужны четыре последние цифры'),
          regex(CARD_DIGITS_PATTERN, 'Нужны четыре последние цифры'),
        ),
      ),
      checkItems(
        (digits, index, list) => list.indexOf(digits) === index,
        'Эта карта уже добавлена',
      ),
    ),
    newCardDigits: newCardDigitsSchema(form.cardDigits),
  });
}

/**
 * The message the add button of the card list shows instead of moving the typed digits into the
 * list, or `undefined` when they may go there. An empty field is the button's own business.
 */
export function getNewCardDigitsError(
  digits: string,
  added: readonly string[],
): string | undefined {
  return safeParse(newCardDigitsSchema(added), digits).issues?.[0].message;
}
