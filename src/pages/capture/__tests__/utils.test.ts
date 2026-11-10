import { describe, expect, it } from 'vitest';
import { bootHint, notificationBody } from '../utils';
import type { CapturedNotification } from '@/services/capture';

function notification(texts: Partial<CapturedNotification>): CapturedNotification {
  return {
    id: 1,
    packageName: 'by.bank',
    appLabel: 'Банк',
    postedAt: 0,
    capturedAt: 0,
    origin: 'posted',
    title: null,
    text: null,
    bigText: null,
    subText: null,
    lines: null,
    ...texts,
  };
}

describe('notificationBody', () => {
  it('prefers the expanded text a bank push hides behind its first line', () => {
    const body = notificationBody(
      notification({ text: 'Оплата', bigText: 'Оплата\nСумма: -12.50 BYN\nОстаток: 100 BYN' }),
    );

    expect(body).toBe('Оплата\nСумма: -12.50 BYN\nОстаток: 100 BYN');
  });

  it('adds the newest message of an SMS app unless the text already has it', () => {
    expect(notificationBody(notification({ text: '2 сообщения', lines: 'OPLATA 12.50 BYN' }))).toBe(
      '2 сообщения\nOPLATA 12.50 BYN',
    );
    expect(
      notificationBody(notification({ text: 'OPLATA 12.50 BYN', lines: 'OPLATA 12.50 BYN' })),
    ).toBe('OPLATA 12.50 BYN');
  });
});

describe('bootHint', () => {
  it('marks only an event soon after the phone booted', () => {
    expect(bootHint(42_000)).toBe('через 42 с после включения телефона');
    expect(bootHint(4 * 60_000)).toBe('через 4 мин после включения телефона');
    expect(bootHint(3 * 60 * 60_000)).toBeNull();
  });
});
