import { CAPTURE_TIME_FORMAT, RECENT_BOOT_MS } from './constants';
import type { CapturedNotification } from '@/services/capture';

export function formatCaptureTime(time: number): string {
  return CAPTURE_TIME_FORMAT.format(time);
}

// The full text of a notification: a bank push keeps it in the expanded text, a messenger — in its
// newest message, and the collapsed text is often only the first line of either
export function notificationBody(notification: CapturedNotification): string {
  const main = notification.bigText ?? notification.text;
  const { lines } = notification;
  if (!lines || main?.includes(lines)) return main ?? '';
  return main ? `${main}\n${lines}` : lines;
}

export function bootHint(uptimeMs: number): string | null {
  if (uptimeMs >= RECENT_BOOT_MS) return null;
  const seconds = Math.round(uptimeMs / 1000);
  const after = seconds < 60 ? `${seconds} с` : `${Math.round(seconds / 60)} мин`;
  return `через ${after} после включения телефона`;
}
