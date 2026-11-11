import type { OperationTime } from '@/types/finance';

export function currentOperationTime(now: Date = new Date()): OperationTime {
  const offsetWestMin = now.getTimezoneOffset();
  // Negating a zero offset would give -0
  return { occurredAt: now.getTime(), utcOffsetMin: offsetWestMin === 0 ? 0 : -offsetWestMin };
}

/** The `YYYY-MM-DD` day the operation happened in, by its own offset rather than the phone's zone. */
export function operationLocalDay({ occurredAt, utcOffsetMin }: OperationTime): string {
  return new Date(occurredAt + utcOffsetMin * 60_000).toISOString().slice(0, 10);
}
