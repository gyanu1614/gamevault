/**
 * ROUTE-004 — every cron handler must be scheduled, and every schedule must
 * have a handler.
 *
 * /api/cron/correct-sab-prices shipped a complete, auth-gated handler with no
 * entry in vercel.json, so it never ran. It turned out to be a superseded
 * legacy wrapper: its own docstring said the logic had moved to
 * @/lib/pricing/games/sab (shared with the unified /api/cron/correct-prices
 * route) and that it "can be removed once nothing references it". Scheduling
 * it would have run the SAB correction twice a day; it was deleted instead.
 *
 * This asserts parity in BOTH directions so the drift cannot recur — an
 * unscheduled handler is a job that silently never runs, and a schedule with
 * no handler is a daily 404.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, existsSync } from 'node:fs'

const CRON_DIR = 'src/app/api/cron'

const handlers = readdirSync(CRON_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory() && existsSync(`${CRON_DIR}/${e.name}/route.ts`))
  .map((e) => `/api/cron/${e.name}`)
  .sort()

const scheduled = (
  JSON.parse(readFileSync('vercel.json', 'utf8')) as {
    crons?: { path: string; schedule: string }[]
  }
).crons?.map((c) => c.path).sort() ?? []

describe('ROUTE-004 — cron handlers and vercel.json schedules agree', () => {
  it('finds both handlers and schedules (guards against an empty-glob false pass)', () => {
    expect(handlers.length).toBeGreaterThan(0)
    expect(scheduled.length).toBeGreaterThan(0)
  })

  it('has no handler without a schedule', () => {
    expect(handlers.filter((h) => !scheduled.includes(h))).toEqual([])
  })

  it('has no schedule without a handler', () => {
    expect(scheduled.filter((s) => !handlers.includes(s))).toEqual([])
  })

  it('no longer ships the superseded correct-sab-prices wrapper', () => {
    expect(existsSync(`${CRON_DIR}/correct-sab-prices`)).toBe(false)
  })
})
