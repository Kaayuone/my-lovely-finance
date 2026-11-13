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

/**
 * A local Date whose year…minute read the operation's wall clock in its own offset; seconds and ms
 * are zero. The fields are carried one by one, so the phone's zone shifts neither the day nor the
 * hour, with one exception: an hour the phone's zone skips when it moves to summer time does not
 * exist in a local Date, which moves it forward by the gap.
 */
export function operationWallClock({ occurredAt, utcOffsetMin }: OperationTime): Date {
  // Read with the UTC getters, this instant shows the wall clock of the offset
  const shifted = new Date(occurredAt + utcOffsetMin * 60_000);
  return new Date(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
    shifted.getUTCHours(),
    shifted.getUTCMinutes(),
  );
}

/**
 * The moment whose wall clock in `utcOffsetMin` shows the local year…minute of `wallClock`; its
 * seconds and ms are dropped. A wall clock in the hour the phone's zone skips for summer time has
 * already been moved forward by the local Date, so it comes back later by the gap.
 */
export function operationTimeAt(wallClock: Date, utcOffsetMin: number): OperationTime {
  const wallClockAsUtc = Date.UTC(
    wallClock.getFullYear(),
    wallClock.getMonth(),
    wallClock.getDate(),
    wallClock.getHours(),
    wallClock.getMinutes(),
  );
  return { occurredAt: wallClockAsUtc - utcOffsetMin * 60_000, utcOffsetMin };
}
