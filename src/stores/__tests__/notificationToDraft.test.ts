import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseNotification } from '@/services/notificationParsing';
import { notificationToDraft } from '@/stores/notificationToDraft';
import type { PendingNotification } from '@/services/capture';
import type { NotificationTexts } from '@/services/notificationParsing';
import {
  BNB_BANK,
  alfabankPurchase,
  bnbDeclined,
  bnbPurchase,
  localTime,
} from '@/services/notificationParsing/__tests__/ownerBankSamples';

vi.mock('@/services/notificationParsing', async importOriginal => {
  const actual = await importOriginal<typeof import('@/services/notificationParsing')>();
  return { ...actual, parseNotification: vi.fn(actual.parseNotification) };
});

function pending(texts: NotificationTexts, id = 7): PendingNotification {
  return {
    ...texts,
    id,
    appLabel: 'Банк',
    capturedAt: texts.postedAt + 1000,
    origin: 'posted',
    subText: null,
    fingerprint: `fingerprint-${id}`,
  };
}

// The zone offset of the phone, minutes west of UTC as Date tells it, at one moment and another
function phoneOffsets(moment: number, offsetAtMoment: number, offsetOtherwise: number) {
  vi.spyOn(Date.prototype, 'getTimezoneOffset').mockImplementation(function (this: Date) {
    return this.getTime() === moment ? offsetAtMoment : offsetOtherwise;
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('notificationToDraft', () => {
  it('takes what the template read, with the raw texts and the fingerprint', () => {
    const notification = pending(bnbPurchase);

    expect(notificationToDraft(notification)).toEqual({
      captureFingerprint: 'fingerprint-7',
      packageName: BNB_BANK,
      postedAt: bnbPurchase.postedAt,
      title: 'Безналичная оплата',
      text: bnbPurchase.text,
      bigText: bnbPurchase.bigText,
      lines: null,
      templateId: 'bnb.push',
      amount: { amountMinor: 1190, currency: 'BYN' },
      direction: 'debit',
      bankStatus: 'ok',
      payee: 'BOOSTY.TO',
      cardDigits: '3333',
      balanceMinor: 6110,
      // The text names no time
      occurredAt: bnbPurchase.postedAt,
      utcOffsetMin: expect.any(Number),
      state: 'pending',
    });
  });

  it('dates the draft by the time the bank wrote and the offset of the phone at that time', () => {
    const bankTime = localTime(3, 21, 55, 27);
    phoneOffsets(bankTime, -180, -120);

    const draft = notificationToDraft(pending(alfabankPurchase));

    expect(draft.occurredAt).toBe(bankTime);
    expect(draft.occurredAt).not.toBe(alfabankPurchase.postedAt);
    expect(draft.utcOffsetMin).toBe(180);
  });

  it('keeps a notification the parser cannot read as a draft without an amount', () => {
    phoneOffsets(bnbPurchase.postedAt, 0, -180);
    // Two different amounts: the parser would have to guess which one the account lost
    const twoAmounts = pending({
      ...bnbPurchase,
      title: 'Оплата',
      text: 'Покупка 10.00 USD, списано 32.50 BYN',
      bigText: null,
    });

    expect(notificationToDraft(twoAmounts)).toMatchObject({
      text: 'Покупка 10.00 USD, списано 32.50 BYN',
      templateId: null,
      amount: null,
      direction: null,
      bankStatus: null,
      payee: null,
      cardDigits: null,
      balanceMinor: null,
      occurredAt: bnbPurchase.postedAt,
      // A zero offset is +0, not -0
      utcOffsetMin: 0,
      state: 'pending',
    });
  });

  it('dismisses a declined operation from the start', () => {
    expect(notificationToDraft(pending(bnbDeclined))).toMatchObject({
      amount: { amountMinor: 47000, currency: 'BYN' },
      bankStatus: 'declined',
      state: 'dismissed',
    });
  });

  it('keeps a notification the parser throws on as an unparsed draft', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(parseNotification).mockImplementationOnce(() => {
      throw new Error('broken template');
    });

    const draft = notificationToDraft(pending(bnbPurchase, 12));

    expect(draft).toMatchObject({
      captureFingerprint: 'fingerprint-12',
      text: bnbPurchase.text,
      amount: null,
      bankStatus: null,
      occurredAt: bnbPurchase.postedAt,
      state: 'pending',
    });
    expect(consoleError).toHaveBeenCalledWith(
      'Failed to parse the captured notification 12',
      expect.any(Error),
    );
  });
});
