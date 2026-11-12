import type { NotificationTemplate, TemplateSlot } from './notificationParsing.types';

// ISO 4217 codes the parser takes as written, upper case only. The capture filter
// (`CaptureAmounts.java`) also knows BYR, «руб», «р.» and «¥»; the parser leaves them out: each may
// name two currencies, and a wrong currency is worse than a draft without an amount
export const CURRENCY_CODES: ReadonlySet<string> = new Set([
  'BYN',
  'RUB',
  'USD',
  'EUR',
  'KZT',
  'PLN',
  'UAH',
  'GBP',
  'CHF',
  'CNY',
  'JPY',
  'TRY',
  'GEL',
  'AMD',
  'AZN',
  'UZS',
  'KGS',
  'AED',
  'CZK',
  'SEK',
  'NOK',
  'DKK',
  'HUF',
  'ILS',
  'THB',
  'INR',
]);

// Other spellings of a currency, lower case, by the ISO code they stand for. RUR has meant the
// Russian rouble since 1998
export const CURRENCY_ALIASES: Readonly<Record<string, string>> = {
  rur: 'RUB',
  br: 'BYN',
  тенге: 'KZT',
  тг: 'KZT',
  '₽': 'RUB',
  '₸': 'KZT',
  $: 'USD',
  '€': 'EUR',
  '£': 'GBP',
};

// «бел. руб.», «бел.рублей»: the Belarusian rouble spelled out
export const BELARUSIAN_ROUBLE_WORD = /^[Бб]ел\.?\s?[Рр]уб/u;

// The sources of slots have no capturing groups: a template numbers its slots by groups

// A signed number, plain or grouped by thousands, with a fraction after a dot or a comma. A group
// needs a short head, so the card number in «#9284 100.00» does not swallow the amount
const NUMBER_SOURCE = String.raw`[+\-\u2212]?(?:\d{1,3}(?:[ \u00A0\u202F]\d{3})+|\d+)(?:[.,]\d+)?`;

const CURRENCY_SOURCE = String.raw`[A-Z]{3}|Br|[Бб]ел\.?\s?[Рр]уб(?:л\p{L}*)?\.?|[Тт]енге|[Тт][Гг]|[₽₸$€£]`;

// An amount next to its currency on either side, on one line. A letter code must stand alone, and
// the number must end where it seems to: «12.11» in «12.11.2026» is not an amount
export const MONEY_MENTION = new RegExp(
  String.raw`(?<![\d.,])(${NUMBER_SOURCE})[ \u00A0]?(${CURRENCY_SOURCE})(?![\p{L}\d])` +
    String.raw`|(?<![\p{L}\d])(${CURRENCY_SOURCE})[ \u00A0]?(${NUMBER_SOURCE})(?!\d|[.,]\d)`,
  'gu',
);

// The text right before a balance on its line: «Остаток: », «OSTATOK », «Доступно на карте: »
export const BALANCE_LABEL =
  /(?:остаток|ostatok|баланс|balans|balance|доступно|dostupno)[^\d\n]{0,20}$/iu;

// «*9884», «#9284», «Карта 9.3593» — the last four digits
export const CARD_DIGITS =
  /(?:[*#•]|(?<!\p{L})(?:карт[аы]?|karta|card)\s*[\d.*•#xX]*?)(\d{4})(?!\d)/iu;

export const DATE_TIME =
  /(?<!\d)(\d{2}\.\d{2}\.(?:\d{4}|\d{2}))[ ,]+(\d{2}:\d{2}(?::\d{2})?)(?!\d)/u;

// Word beginnings, so endings and transliteration do not matter. A declined word is checked first:
// «неуспешно» ends with «успешно»
export const DECLINED_WORDS =
  /(?<!\p{L})(?:неуспешн|отказ|отклон|недостаточно|neuspeshn|otkaz|otklon|declined|rejected)/iu;
export const OK_WORDS = /(?<!\p{L})(?:успешн|uspeshn|одобрен|odobren|approved)/iu;

// For an amount without a sign. «Отмена оплаты» names both sides, and then the direction stays unknown
export const DEBIT_WORDS =
  /(?<!\p{L})(?:оплат|покупк|списан|снят|oplat|pokupk|spisan|snyat|snjat)/iu;
export const CREDIT_WORDS =
  /(?<!\p{L})(?:зачисл|поступл|пополн|возврат|отмен|zachisl|postupl|popoln|vozvrat|otmen)/iu;

// The time a bank writes is taken when it is plausible for the post time: a little ahead for clocks
// that disagree, up to a week behind for a phone that was off. Otherwise the text names some other
// moment, and the post time is closer to the truth
export const BANK_TIME_MAX_AHEAD_MS = 5 * 60_000;
export const BANK_TIME_MAX_BEHIND_MS = 7 * 24 * 60 * 60_000;

export const TEMPLATE_SLOT_SYNTAX = /\{([^{}]*)\}/g;

export const TEMPLATE_SLOTS: Readonly<Record<TemplateSlot, string>> = {
  amount: NUMBER_SOURCE,
  currency: CURRENCY_SOURCE,
  balance: NUMBER_SOURCE,
  card: String.raw`[\d.*•#xX]*\d{4}`,
  payee: '.+?',
  status: '.+?',
  date: String.raw`\d{2}\.\d{2}\.(?:\d{4}|\d{2})`,
  time: String.raw`\d{2}:\d{2}(?::\d{2})?`,
  '*': '.*?',
};

// Formats of the owner's banks from their notifications of 10–12 November 2026
// (docs/product/bank-notifications.md)
export const BUILT_IN_TEMPLATES: readonly NotificationTemplate[] = [
  {
    id: 'alfabank.push',
    packageName: 'by.alfabank.app.insnc3',
    // The amount repeats in the title. The card is the first digit of its number and the last four
    pattern:
      '{amount} {currency}\n{*}\nКарта {card} {status} Сумма: {amount} {currency}\nОстаток:{balance} {currency}\n{date} {time}',
    direction: null,
  },
  {
    id: 'bnb.push',
    packageName: 'com.iskra.mobile',
    pattern: '{*}\n{status}, *{card}, {amount} {currency}, Остаток: {balance} {currency}, {payee}',
    direction: null,
  },
  {
    id: 'belinvest.sms.payment',
    packageName: null,
    // The payee is padded with spaces and followed by «>city>country». A transfer from the internet
    // bank to an own card comes as a payment too, with INTERNET-BANKING for the payee
    pattern:
      'Belinvest\nOPLATA {amount} {currency} KARTA #{card} {date} {time} {payee} >{*} OSTATOK {balance} {currency}',
    direction: 'debit',
  },
];
