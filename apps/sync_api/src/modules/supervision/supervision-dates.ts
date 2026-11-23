/**
 * Business-day helpers for the supervision inbox and audit log.
 * Dates arrive as YYYY-MM-DD and mean a calendar day in the business timezone,
 * not in the server's timezone (the API runs in UTC).
 */
export const SUPERVISION_TZ =
  process.env.SUPERVISION_TIMEZONE || 'America/Mexico_City';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Today's calendar date (YYYY-MM-DD) in the business timezone. */
export function todayInTz(now = new Date(), timeZone = SUPERVISION_TZ): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Offset (minutes, east of UTC) of `timeZone` at the instant `at`. */
function tzOffsetMinutes(at: Date, timeZone: string): number {
  const name = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'longOffset',
  })
    .formatToParts(at)
    .find((p) => p.type === 'timeZoneName')?.value;
  const match = name?.match(/GMT([+-])(\d{2}):?(\d{2})?/);
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3] ?? 0);
  return match[1] === '-' ? -minutes : minutes;
}

/** UTC instant of `day` at hh:mm:ss.ms wall-clock time in `timeZone`. */
function wallClockToUtc(
  day: string,
  time: [number, number, number, number],
  timeZone: string,
): Date {
  const [y, m, d] = day.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, ...time);
  const offset = tzOffsetMinutes(new Date(guess), timeZone);
  return new Date(guess - offset * 60000);
}

/** [start, end] of a YYYY-MM-DD business day; null for a missing or malformed value. */
export function dayStart(day?: string, timeZone = SUPERVISION_TZ): Date | null {
  if (!day || !DAY_RE.test(day)) return null;
  return wallClockToUtc(day, [0, 0, 0, 0], timeZone);
}

export function dayEnd(day?: string, timeZone = SUPERVISION_TZ): Date | null {
  if (!day || !DAY_RE.test(day)) return null;
  return wallClockToUtc(day, [23, 59, 59, 999], timeZone);
}
