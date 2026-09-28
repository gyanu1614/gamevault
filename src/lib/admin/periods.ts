/**
 * Day / month boundaries for the admin numbers, in UTC — what the server runs
 * in on Vercel and what the 30-day charts key by. (Local-time boundaries made
 * a dev machine's "today" differ from production's.)
 */
export function utcPeriods(now: Date = new Date()) {
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()
  return {
    todayStart: new Date(Date.UTC(y, m, now.getUTCDate())),
    monthStart: new Date(Date.UTC(y, m, 1)),
    prevMonthStart: new Date(Date.UTC(y, m - 1, 1)),
  }
}
