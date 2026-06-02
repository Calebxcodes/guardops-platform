/**
 * Fix #2 — All times displayed in London timezone (Europe/London = GMT/BST).
 * Uses the built-in Intl API — no extra dependencies needed.
 */

const LONDON = 'Europe/London'

/** Format a date/string as London time, e.g. "14:30" */
export function formatLondon(
  date: Date | string | number,
  opts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false }
): string {
  const d = new Date(date)
  if (isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('en-GB', { ...opts, timeZone: LONDON }).format(d)
}

/** Format as "h:mm a" (12-hour) in London time, e.g. "2:30 pm" */
export function formatLondon12(date: Date | string | number): string {
  const d = new Date(date)
  if (isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: LONDON,
  }).format(d)
}

/** Format as "EEE d MMM" in London time, e.g. "Mon 3 Jun" */
export function formatLondonDate(date: Date | string | number): string {
  const d = new Date(date)
  if (isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: LONDON,
  }).format(d)
}

/** Format as "d MMM yyyy" in London time */
export function formatLondonFullDate(date: Date | string | number): string {
  const d = new Date(date)
  if (isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: LONDON,
  }).format(d)
}

/** Returns a Date object set to midnight London time on the given date */
export function londonMidnight(date: Date | string | number): Date {
  const d = new Date(date)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: LONDON, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d).split('-')
  return new Date(`${parts[0]}-${parts[1]}-${parts[2]}T00:00:00`)
}

/** Returns true if two dates are on the same calendar day in London time */
export function isSameLondonDay(a: Date | string, b: Date | string): boolean {
  const fmt = (d: Date | string) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: LONDON, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(d))
  return fmt(a) === fmt(b)
}
