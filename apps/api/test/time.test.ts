import { describe, expect, it } from 'vitest';
import { localDateBounds, localMinuteToEpoch } from '../src/bookings/time';

describe('booking timezone conversion', () => {
  it('rejects missing and ambiguous local times during DST transitions', () => {
    expect(() => localMinuteToEpoch('2026-03-29', 2 * 60 + 30, 'Europe/Zagreb')).toThrow();
    expect(() => localMinuteToEpoch('2026-10-25', 2 * 60 + 30, 'Europe/Zagreb')).toThrow();
  });

  it('uses the actual 23 and 25 hour duration of DST transition days', () => {
    const spring = localDateBounds('2026-03-29', 'Europe/Zagreb');
    const autumn = localDateBounds('2026-10-25', 'Europe/Zagreb');
    expect(spring.end - spring.start).toBe(23 * 60 * 60 * 1000);
    expect(autumn.end - autumn.start).toBe(25 * 60 * 60 * 1000);
  });
});
