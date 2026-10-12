import { Temporal } from '@js-temporal/polyfill';

export function localDateBounds(date: string, timezone: string): { start: number; end: number } {
  const day = Temporal.PlainDate.from(date);
  return {
    start: day.toZonedDateTime({ timeZone: timezone, plainTime: '00:00' }).epochMilliseconds,
    end: day.add({ days: 1 }).toZonedDateTime({ timeZone: timezone, plainTime: '00:00' }).epochMilliseconds,
  };
}

export function localMinuteToEpoch(date: string, minute: number, timezone: string): number {
  const day = Temporal.PlainDate.from(date);
  return Temporal.ZonedDateTime.from({
    timeZone: timezone,
    year: day.year,
    month: day.month,
    day: day.day,
    hour: Math.floor(minute / 60),
    minute: minute % 60,
  }, { disambiguation: 'reject' }).epochMilliseconds;
}

export function instantInTimezone(epochMilliseconds: number, timezone: string) {
  return Temporal.Instant.fromEpochMilliseconds(epochMilliseconds).toZonedDateTimeISO(timezone);
}

export function weekdayForDate(date: string): number {
  return Temporal.PlainDate.from(date).dayOfWeek % 7;
}

export function isBookableDate(date: string, timezone: string, horizonDays = 180): boolean {
  const requested = Temporal.PlainDate.from(date);
  const today = Temporal.Now.plainDateISO(timezone);
  return Temporal.PlainDate.compare(requested, today) >= 0
    && Temporal.PlainDate.compare(requested, today.add({ days: horizonDays })) <= 0;
}
