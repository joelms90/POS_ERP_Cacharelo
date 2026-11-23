import { dayEnd, dayStart, todayInTz } from './supervision-dates';

describe('supervision-dates', () => {
  const tz = 'America/Mexico_City'; // UTC-6, no DST since 2022

  it('computes today in the business timezone, not UTC', () => {
    // 2026-11-23 03:00 UTC is still 2026-11-22 21:00 in Mexico City
    expect(todayInTz(new Date('2026-11-23T03:00:00Z'), tz)).toBe('2026-11-22');
    expect(todayInTz(new Date('2026-11-23T18:00:00Z'), tz)).toBe('2026-11-23');
  });

  it('returns the UTC bounds of a business day', () => {
    expect(dayStart('2026-11-23', tz)?.toISOString()).toBe('2026-11-23T06:00:00.000Z');
    expect(dayEnd('2026-11-23', tz)?.toISOString()).toBe('2026-11-24T05:59:59.999Z');
  });

  it('ignores missing or malformed days', () => {
    expect(dayStart(undefined, tz)).toBeNull();
    expect(dayEnd('23/11/2026', tz)).toBeNull();
  });
});
