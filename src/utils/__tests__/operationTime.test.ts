import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  currentOperationTime,
  operationLocalDay,
  operationTimeAt,
  operationWallClock,
} from '@/utils/operationTime';

const LATE_EVENING_UTC = Date.UTC(2026, 10, 10, 21, 30);
const MACHINE_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;
const MOMENT_WITH_SECONDS = Date.UTC(2026, 10, 10, 20, 30, 45, 678);
const MOMENT_TO_THE_MINUTE = Date.UTC(2026, 10, 10, 20, 30);
// Phone zones whose offset differs from every operation offset below, so a wall clock read in the
// phone's zone would show another hour. Neither has summer time. In a phone zone that has it, the
// hour skipped at the switch moves forward by the gap: a known limit of a local Date, left as it is
// because Belarus and Kazakhstan have no such switch
const PHONE_TIME_ZONES = [
  { zone: 'Asia/Kolkata', offsetWestMin: -330 },
  { zone: 'Pacific/Honolulu', offsetWestMin: 600 },
];

function setPhoneTimeZone(zone: string, offsetWestMin: number) {
  vi.stubEnv('TZ', zone);
  // Guards the test itself: the zone must really have switched for the result to mean anything
  expect(new Date(MOMENT_WITH_SECONDS).getTimezoneOffset()).toBe(offsetWestMin);
}

function localFields(date: Date): number[] {
  return [
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds(),
  ];
}

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

describe.each(PHONE_TIME_ZONES)('with the phone in $zone', ({ zone, offsetWestMin }) => {
  describe('operationWallClock', () => {
    it('shows the day and time of the offset of the operation, without seconds', () => {
      setPhoneTimeZone(zone, offsetWestMin);

      expect(
        localFields(operationWallClock({ occurredAt: MOMENT_WITH_SECONDS, utcOffsetMin: 180 })),
      ).toEqual([2026, 10, 10, 23, 30, 0, 0]);
      expect(
        localFields(operationWallClock({ occurredAt: LATE_EVENING_UTC, utcOffsetMin: 180 })),
      ).toEqual([2026, 10, 11, 0, 30, 0, 0]);
      expect(
        localFields(operationWallClock({ occurredAt: LATE_EVENING_UTC, utcOffsetMin: -300 })),
      ).toEqual([2026, 10, 10, 16, 30, 0, 0]);
    });
  });

  describe('operationTimeAt', () => {
    it('takes the picked wall clock in the given offset and drops its seconds', () => {
      setPhoneTimeZone(zone, offsetWestMin);

      expect(operationTimeAt(new Date(2026, 10, 11, 0, 30, 15, 500), 180)).toEqual({
        occurredAt: LATE_EVENING_UTC,
        utcOffsetMin: 180,
      });
    });

    it.each([0, 180, -300, 345, 840, -720])(
      'gives back the moment cut to the minute for the offset %d',
      utcOffsetMin => {
        setPhoneTimeZone(zone, offsetWestMin);
        const time = { occurredAt: MOMENT_WITH_SECONDS, utcOffsetMin };

        expect(operationTimeAt(operationWallClock(time), utcOffsetMin)).toEqual({
          occurredAt: MOMENT_TO_THE_MINUTE,
          utcOffsetMin,
        });
      },
    );
  });
});
