import { parseNotification } from '@/services/notificationParsing';
import { currentOperationTime } from '@/utils/operationTime';
import type { NewDraft } from '@/entities/draft/draft.types';
import type { PendingNotification } from '@/services/capture';
import type { ParsedNotification } from '@/services/notificationParsing';

/**
 * The new draft of a notification of the capture queue: what the parser read of it, or only its
 * texts and post time when it read nothing. The zone offset is the phone's at the moment of the
 * operation, as the parser reads a bank's time in the zone of the phone.
 */
export function notificationToDraft(notification: PendingNotification): NewDraft {
  const parsed = parseSafely(notification);
  const occurredAt = parsed?.occurredAt ?? notification.postedAt;

  return {
    captureFingerprint: notification.fingerprint,
    packageName: notification.packageName,
    postedAt: notification.postedAt,
    title: notification.title,
    text: notification.text,
    bigText: notification.bigText,
    lines: notification.lines,
    templateId: parsed?.templateId ?? null,
    amount: parsed ? { amountMinor: parsed.amountMinor, currency: parsed.currency } : null,
    direction: parsed?.direction ?? null,
    bankStatus: parsed?.status ?? null,
    payee: parsed?.payee ?? null,
    cardDigits: parsed?.cardDigits ?? null,
    balanceMinor: parsed?.balanceMinor ?? null,
    occurredAt,
    utcOffsetMin: currentOperationTime(new Date(occurredAt)).utcOffsetMin,
    // A declined operation moved no money and must never become an expense
    state: parsed?.status === 'declined' ? 'dismissed' : 'pending',
  };
}

// A notification the parser throws on becomes a draft without an amount: otherwise it would stop the
// queue at itself on every run, and every notification after it with it
function parseSafely(notification: PendingNotification): ParsedNotification | null {
  try {
    return parseNotification(notification);
  } catch (error) {
    console.error(`Failed to parse the captured notification ${notification.id}`, error);
    return null;
  }
}
