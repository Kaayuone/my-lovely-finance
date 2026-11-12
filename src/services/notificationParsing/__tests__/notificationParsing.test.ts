import { describe, expect, it } from 'vitest';
import { parseNotification } from '../notificationParsing.service';
import { compileTemplate } from '../template';
import type {
  NotificationTemplate,
  NotificationTexts,
  ParsedNotification,
} from '../notificationParsing.types';
import {
  alfabankPurchase,
  alfabankTransferIn,
  belinvestInternetBanking,
  belinvestShop,
  bnbDeclined,
  bnbIncome,
  bnbPurchase,
  localTime,
} from './ownerBankSamples';

const ownerSamples: [string, NotificationTexts, ParsedNotification][] = [
  [
    'an Alfa-Bank purchase',
    alfabankPurchase,
    {
      templateId: 'alfabank.push',
      amountMinor: 2450,
      currency: 'BYN',
      direction: 'debit',
      status: 'ok',
      payee: null,
      cardDigits: '1111',
      balanceMinor: 10530,
      occurredAt: localTime(3, 21, 55, 27),
    },
  ],
  [
    'an Alfa-Bank incoming transfer',
    alfabankTransferIn,
    {
      templateId: 'alfabank.push',
      amountMinor: 5000,
      currency: 'BYN',
      direction: 'credit',
      status: 'ok',
      payee: null,
      cardDigits: '2222',
      balanceMinor: 15530,
      occurredAt: localTime(4, 20, 29, 32),
    },
  ],
  [
    'a BNB-Bank purchase without a time in the text',
    bnbPurchase,
    {
      templateId: 'bnb.push',
      amountMinor: 1190,
      currency: 'BYN',
      direction: 'debit',
      status: 'ok',
      payee: 'BOOSTY.TO',
      cardDigits: '3333',
      balanceMinor: 6110,
      occurredAt: bnbPurchase.postedAt,
    },
  ],
  [
    'a BNB-Bank declined purchase',
    bnbDeclined,
    {
      templateId: 'bnb.push',
      amountMinor: 47000,
      currency: 'BYN',
      direction: 'debit',
      status: 'declined',
      payee: 'GOOGLE PLAY',
      cardDigits: '3333',
      balanceMinor: 6110,
      occurredAt: bnbDeclined.postedAt,
    },
  ],
  [
    'a BNB-Bank income',
    bnbIncome,
    {
      templateId: 'bnb.push',
      amountMinor: 50000,
      currency: 'BYN',
      direction: 'credit',
      status: 'ok',
      payee: 'BNB-BANK (ZACHISLENIE NA KARTU)',
      cardDigits: '3333',
      balanceMinor: 56110,
      occurredAt: bnbIncome.postedAt,
    },
  ],
  [
    'a Belinvest SMS with a padded payee',
    belinvestShop,
    {
      templateId: 'belinvest.sms.payment',
      amountMinor: 1984,
      currency: 'BYN',
      direction: 'debit',
      status: null,
      payee: 'magazin Groshyk',
      cardDigits: '4444',
      balanceMinor: 253714,
      occurredAt: localTime(4, 13, 25, 8),
    },
  ],
  [
    'a Belinvest SMS of a transfer from the internet bank',
    belinvestInternetBanking,
    {
      templateId: 'belinvest.sms.payment',
      amountMinor: 50000,
      currency: 'BYN',
      direction: 'debit',
      status: null,
      payee: 'INTERNET-BANKING',
      cardDigits: '4444',
      balanceMinor: 203714,
      occurredAt: localTime(5, 20, 24, 3),
    },
  ],
];

function generalNotification(text: string, postedAt = localTime(4, 12, 0, 0)): NotificationTexts {
  return { packageName: 'by.some.bank', postedAt, title: null, text, bigText: null, lines: null };
}

describe('parseNotification with the built-in templates', () => {
  it.each(ownerSamples)('reads %s', (_, notification, expected) => {
    expect(parseNotification(notification)).toEqual(expected);
  });

  it('reads an SMS template in any SMS app', () => {
    const notification = { ...belinvestShop, packageName: 'com.samsung.android.messaging' };
    expect(parseNotification(notification)?.templateId).toBe('belinvest.sms.payment');
  });

  it('does not read a notification of another app with the template of an app', () => {
    const notification = { ...bnbPurchase, packageName: 'by.some.bank' };
    expect(parseNotification(notification)).toMatchObject({ templateId: null, payee: null });
  });

  it('rejects a template when a repeated slot differs and leaves the general parser to judge', () => {
    const notification = { ...alfabankPurchase, title: '-42.50 BYN' };
    expect(parseNotification(notification)).toBeNull();
  });
});

describe('parseNotification without templates', () => {
  it.each(ownerSamples)('reads %s but its payee', (_, notification, expected) => {
    expect(parseNotification(notification, [])).toEqual({
      ...expected,
      templateId: null,
      payee: null,
    });
  });

  it('separates the balance from the amount', () => {
    expect(
      parseNotification(generalNotification('Списание 12,50 BYN. Доступно: 1 234,56 BYN'), []),
    ).toMatchObject({ amountMinor: 1250, balanceMinor: 123456, direction: 'debit' });
  });

  it('reads a typographic minus and thousands grouped by a no-break space', () => {
    const text = `Списано ${String.fromCharCode(0x2212)}1${String.fromCharCode(0xa0)}234,56 BYN`;
    expect(parseNotification(generalNotification(text), [])).toMatchObject({
      amountMinor: 123456,
      direction: 'debit',
    });
  });

  it('reads a currency written before the amount', () => {
    expect(parseNotification(generalNotification('Покупка: BYN 7.20'), [])).toMatchObject({
      amountMinor: 720,
      currency: 'BYN',
    });
  });

  it.each([
    ['two different amounts', 'Оплата 10.00 USD, списано 27.30 BYN'],
    ['opposite signs of one amount', 'Сумма: +5.00 BYN, списано -5.00 BYN'],
    ['the balance alone', 'Остаток: 100.00 BYN'],
    ['a rouble that may be Belarusian or Russian', 'Оплата 12.50 руб.'],
    ['the old Belarusian rouble code', 'Оплата 12.50 BYR'],
    ['more fraction digits than the currency has', 'Оплата 12.505 BYN'],
    ['a zero amount', 'Оплата 0.00 BYN'],
    ['no currency', 'Оплата 12.50, карта *1234'],
  ])('leaves %s unparsed', (_, text) => {
    expect(parseNotification(generalNotification(text), [])).toBeNull();
  });

  it('leaves the direction unknown when the words name both sides', () => {
    expect(parseNotification(generalNotification('Отмена оплаты 5.00 BYN'), [])?.direction).toBe(
      null,
    );
  });

  it.each([
    ['ahead of the post time', '04.11.2026 12:10:00'],
    ['more than a week behind it', '20.10.2026 12:00:00'],
    ['not a calendar date', '31.02.2026 12:00:00'],
  ])('takes the post time when the bank time is %s', (_, dateTime) => {
    const notification = generalNotification(`Оплата 5.00 BYN ${dateTime}`);
    expect(parseNotification(notification, [])?.occurredAt).toBe(notification.postedAt);
  });

  it('takes a bank time of a delayed notification', () => {
    const notification = generalNotification('Оплата 5.00 BYN 02.11.26 09:15');
    expect(parseNotification(notification, [])?.occurredAt).toBe(localTime(2, 9, 15, 0));
  });
});

describe('compileTemplate', () => {
  function template(pattern: string): NotificationTemplate {
    return { id: 'test', packageName: null, pattern, direction: null };
  }

  it('matches the characters of regular expressions literally', () => {
    const { regex } = compileTemplate(template('Pay (card *{card}) {amount} {currency}?'));
    expect(regex.test('Pay (card *1234) 5.00 USD?')).toBe(true);
    expect(regex.test('Pay (card 1234) 5.00 USD?')).toBe(false);
  });

  it('throws on a slot it does not know', () => {
    expect(() => compileTemplate(template('{amount} {currency} {merchant}'))).toThrow(
      /unknown slot \{merchant\}/,
    );
  });

  it('throws on a pattern without an amount or a currency', () => {
    expect(() => compileTemplate(template('Оплата {amount}'))).toThrow(/no \{amount\}/);
  });
});
