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
 *
 * 2026-09-20: two jobs moved OFF Vercel entirely. Repricing (PR #76) and the
 * SAB listing-expire (PR #78) run on the GitHub Actions runner, as steps of
 * the workflows that produce their input, because both outgrew the 300s
 * function budget and their failures were being swallowed. Their routes stay
 * as thin manual triggers with no vercel.json entry. For those, "scheduled"
 * means "a named runner step exists" — so the exemption below is not a
 * free pass: each exempt route must still have its handler, must NOT be in
 * vercel.json (a double schedule is the ROUTE-004 bug in reverse), and every
 * workflow that took over the job must actually carry the step.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, existsSync } from 'node:fs'

const CRON_DIR = 'src/app/api/cron'
const WORKFLOW_DIR = '.github/workflows'

/**
 * Routes whose scheduled path is a runner step, keyed by the exact command the
 * workflow must contain. A game repriced through the unified route needs its
 * own workflow to carry `pnpm reprice --game=<key>`; the day this list and
 * src/lib/pricing/registry.ts disagree is the day a game silently stops
 * repricing, which is why the registry keys are asserted below too.
 */
const RUNNER_SCHEDULED: Record<string, { workflow: string; step: string }[]> = {
  '/api/cron/correct-prices': [
    { workflow: 'sab-eldorado-daily.yml', step: 'pnpm reprice --game=sab' },
    { workflow: 'adopt-me-daily.yml', step: 'pnpm reprice --game=adopt-me' },
    { workflow: 'steal-an-egg-values.yml', step: 'pnpm reprice --game=steal-an-egg' },
  ],
  '/api/cron/expire-sab-listings': [
    { workflow: 'sab-eldorado-daily.yml', step: 'pnpm sab:expire' },
  ],
}
const runnerScheduled = Object.keys(RUNNER_SCHEDULED).sort()

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

  it('has no handler without a schedule — vercel.json or a named runner step', () => {
    expect(
      handlers.filter((h) => !scheduled.includes(h) && !runnerScheduled.includes(h)),
    ).toEqual([])
  })

  it('every runner-scheduled route still has its handler (the manual trigger)', () => {
    expect(runnerScheduled.filter((r) => !handlers.includes(r))).toEqual([])
  })

  it('a runner-scheduled route is NOT also in vercel.json — one schedule, not two', () => {
    // The daily correct-prices entry ran the SAB reprice a second time, on a
    // 300s budget it could not meet, hours after the runner had already done
    // it; the daily expire entry did the same. Two schedules for one job is
    // the ROUTE-004 bug in reverse.
    expect(runnerScheduled.filter((r) => scheduled.includes(r))).toEqual([])
  })

  it('every workflow that took over a route actually carries the step', () => {
    for (const [route, steps] of Object.entries(RUNNER_SCHEDULED)) {
      for (const { workflow, step } of steps) {
        const yml = readFileSync(`${WORKFLOW_DIR}/${workflow}`, 'utf8')
        expect(yml, `${route} → ${workflow} must run \`${step}\``).toContain(step)
      }
    }
  })

  it('every registered pricing game is repriced by a runner step', () => {
    // src/lib/pricing/registry.ts is the list the runner can price; a game in
    // it with no workflow step is exactly the silent-never-runs shape.
    const registry = readFileSync('src/lib/pricing/registry.ts', 'utf8')
    const keys = [...registry.matchAll(/key: '([a-z0-9-]+)'/g)].map((m) => m[1])
    expect(keys.length).toBeGreaterThan(0)
    const covered = RUNNER_SCHEDULED['/api/cron/correct-prices'].map(
      (s) => s.step.replace('pnpm reprice --game=', ''),
    )
    expect(keys.filter((k) => !covered.includes(k))).toEqual([])
  })

  it('has no schedule without a handler', () => {
    expect(scheduled.filter((s) => !handlers.includes(s))).toEqual([])
  })

  it('no longer ships the superseded correct-sab-prices wrapper', () => {
    expect(existsSync(`${CRON_DIR}/correct-sab-prices`)).toBe(false)
  })
})
