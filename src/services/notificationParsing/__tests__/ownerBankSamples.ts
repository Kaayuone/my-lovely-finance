import type { NotificationTexts } from '../notificationParsing.types';

// Notifications of the owner's banks as the capture stored them on 10–12 November 2026, with the
// amounts, the cards and the dates replaced. Spacing and line breaks are kept as the banks send them

export const ALFABANK = 'by.alfabank.app.insnc3';
export const BNB_BANK = 'com.iskra.mobile';
export const GOOGLE_MESSAGES = 'com.google.android.apps.messaging';

// November is month 10 of Date
export function localTime(day: number, hours: number, minutes: number, seconds: number): number {
  return new Date(2026, 10, day, hours, minutes, seconds).getTime();
}

function push(
  packageName: string,
  postedAt: number,
  title: string,
  text: string,
): NotificationTexts {
  return { packageName, postedAt, title, text, bigText: text, lines: null };
}

function sms(postedAt: number, text: string): NotificationTexts {
  return {
    packageName: GOOGLE_MESSAGES,
    postedAt,
    title: 'Belinvest',
    text,
    bigText: null,
    lines: text,
  };
}

export const alfabankPurchase = push(
  ALFABANK,
  localTime(3, 21, 55, 29),
  '-24.50 BYN',
  'Оплата товаров/услуг\nКарта 9.1111 Успешно Сумма: -24.50 BYN\nОстаток:105.30 BYN\n03.11.2026 21:55:27',
);

export const alfabankTransferIn = push(
  ALFABANK,
  localTime(4, 20, 29, 35),
  '+50.00 BYN',
  'Перевод (Поступление)\nКарта 4.2222 Успешно Сумма: +50.00 BYN\nОстаток:155.30 BYN\n04.11.2026 20:29:32',
);

export const bnbPurchase = push(
  BNB_BANK,
  localTime(4, 17, 9, 26),
  'Безналичная оплата',
  'Успешно, *3333, -11.90 BYN, Остаток: 61.10 BYN, BOOSTY.TO',
);

export const bnbDeclined = push(
  BNB_BANK,
  localTime(5, 6, 37, 7),
  'Безналичная оплата',
  'Неуспешно, *3333, -470.00 BYN, Остаток: 61.10 BYN, GOOGLE PLAY',
);

export const bnbIncome = push(
  BNB_BANK,
  localTime(5, 20, 25, 11),
  'Зачисление на счет',
  'Успешно, *3333, +500.00 BYN, Остаток: 561.10 BYN, BNB-BANK (ZACHISLENIE NA KARTU)',
);

export const belinvestShop = sms(
  localTime(4, 13, 25, 13),
  'OPLATA 19.84 BYN KARTA #4444 04.11.2026 13:25:08 magazin Groshyk          >g.Minsk>BY OSTATOK 2537.14 BYN',
);

// A transfer from the internet bank to an own card of another bank: the SMS calls it a payment
export const belinvestInternetBanking = sms(
  localTime(5, 20, 24, 8),
  'OPLATA 500.00 BYN KARTA #4444 05.11.2026 20:24:03 INTERNET-BANKING       >MINSK>BY OSTATOK 2037.14 BYN',
);
