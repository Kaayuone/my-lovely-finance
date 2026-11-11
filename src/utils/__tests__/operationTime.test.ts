import { afterEach, describe, expect, it, vi } from 'vitest';
import { currentOperationTime, operationLocalDay } from '@/utils/operationTime';

const LATE_EVENING_UTC = Date.UTC(2026, 10, 10, 21, 30);
const MACHINE_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

function dateWithOffset(timezoneOffset: number): Date {
  const date = new Date(LATE_EVENING_UTC);
  vi.spyOn(date, 'getTimezoneOffset').mockReturnValue(timezoneOffset);
  return date;
}

afterEach(() => {
  // Node resets the zone when TZ is set but not when it is deleted: set the machine zone back
  // before restoring the variable itself
  vi.stubEnv('TZ', MACHINE_TIME_ZONE);
  vi.unstubAllEnvs();
});

describe('currentOperationTime', () => {
  it('keeps the moment and the offset in minutes east of UTC', () => {
    expect(currentOperationTime(dateWithOffset(-180))).toEqual({
      occurredAt: LATE_EVENING_UTC,
      utcOffsetMin: 180,
    });
    expect(currentOperationTime(dateWithOffset(300)).utcOffsetMin).toBe(-300);
  });

  it('gives a plain zero offset at UTC', () => {
    expect(Object.is(currentOperationTime(dateWithOffset(0)).utcOffsetMin, 0)).toBe(true);
  });
});

describe('operationLocalDay', () => {
  it('takes the day by the offset of the operation', () => {
    expect(operationLocalDay({ occurredAt: LATE_EVENING_UTC, utcOffsetMin: 180 })).toBe(
      '2026-11-11',
    );
    expect(operationLocalDay({ occurredAt: LATE_EVENING_UTC, utcOffsetMin: -300 })).toBe(
      '2026-11-10',
    );
    expect(operationLocalDay({ occurredAt: LATE_EVENING_UTC, utcOffsetMin: 0 })).toBe('2026-11-10');
  });

  it('does not depend on the zone of the phone', () => {
    vi.stubEnv('TZ', 'Pacific/Kiritimati');

    expect(operationLocalDay({ occurredAt: LATE_EVENING_UTC, utcOffsetMin: -300 })).toBe(
      '2026-11-10',
    );
  });
});
