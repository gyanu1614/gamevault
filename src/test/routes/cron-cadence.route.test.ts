/**
 * Cadence policy: every value game is priced ONCE a day, in one shared window
 * (values-pricing-daily.yml; T1, 2026-10-04 — owner: minimum ISR writes and
 * Vercel CPU, scaling to ~10 games). It was 12 h for SAB and Steal an Egg
 * (2026-09-22) before revalidation became changed-items-only. Every other
 * schedule is daily too, except the money paths below.
 *
 * Each crawl used to mark every one of a game's ~500 value item pages stale,
 * so an 8×/day cadence was ~80% of the monthly ISR budget (build audit §4).
 * Revalidation is per changed item now, but the cadence is still the thing
 * that decides how often the whole pipeline runs, so it is pinned here rather
 * than left to drift back a few minutes at a time.
 *
 * Vercel Hobby cannot schedule sub-daily cron at all, which is why the
 * sub-daily jobs live in GitHub Actions and `vercel.json` must stay daily.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const WORKFLOW_DIR = '.github/workflows'

/** Workflows allowed to run more often than daily, with the reason. */
const SUB_DAILY: Record<string, { maxPerDay: number; why: string }> = {
  'auto-complete-orders.yml': {
    // Money path: the SafeDrop Protection window closes at an exact hour and
    // the seller's credit is due then; a daily sweep would hold it up to 23 h.
    // Bounded query (page of 200), revalidates only the completed listings.
    maxPerDay: 24,
    why: 'money path — auto-complete + buyer reminders are due hourly',
  },
  'reconcile-payments.yml': {
    // Money path (checkout fix round B): voids charges the RPCs closed,
    // re-runs stuck webhook events. Bounded batches, revalidates nothing.
    maxPerDay: 96,
    why: 'money path — provider cancel outbox + stuck webhook events',
  },
  'expire-pending-payments.yml': {
    // Money path: an unpaid order holds inventory until it is expired, so a
    // 24 h window would strand stock for a day. Not a cache/CPU cost — the
    // handler is a bounded query, and it revalidates nothing.
    maxPerDay: 48,
    why: 'money path — unpaid orders hold inventory until expired',
  },
}

/** Every `- cron: "..."` line in a workflow file. */
function cronsOf(source: string): string[] {
  return [...source.matchAll(/^\s*-\s*cron:\s*['"]([^'"]+)['"]/gm)].map((m) => m[1])
}

/**
 * Runs per day for the schedules used here. Only the minute and hour fields
 * decide sub-daily frequency; a day-of-week restriction (e.g. weekly) only
 * makes it rarer, which is never a violation.
 */
function runsPerDay(expression: string): number {
  const [minute, hour] = expression.trim().split(/\s+/)
  const count = (field: string, total: number): number => {
    if (field === '*') return total
    const step = field.match(/^\*\/(\d+)$/)
    if (step) return Math.ceil(total / Number(step[1]))
    return field.split(',').length
  }
  return count(minute, 60) * count(hour, 24)
}

describe('cron cadence', () => {
  const files = readdirSync(WORKFLOW_DIR).filter((f) => f.endsWith('.yml'))

  it('finds the workflows', () => {
    expect(files.length).toBeGreaterThan(5)
  })

  it('nothing runs more often than daily without a reason', () => {
    const offenders: string[] = []

    for (const file of files) {
      const source = readFileSync(join(WORKFLOW_DIR, file), 'utf8')
      const allowed = SUB_DAILY[file]
      for (const expression of cronsOf(source)) {
        const perDay = runsPerDay(expression)
        if (perDay <= 1) continue
        if (allowed && perDay <= allowed.maxPerDay) continue
        offenders.push(
          `${file}: "${expression}" runs ${perDay}×/day` +
            (allowed ? ` (allowed ${allowed.maxPerDay}×: ${allowed.why})` : ''),
        )
      }
    }

    expect(
      offenders,
      offenders.length
        ? 'Only price pipelines run sub-daily (12 h). Add an entry to ' +
          `SUB_DAILY with a reason if that is deliberate:\n  ${offenders.join('\n  ')}`
        : '',
    ).toEqual([])
  })

  it('every value game is priced in ONE daily window, with no per-game schedules left', () => {
    // Not just "at most once a day" — that would pass with the window gone.
    const window = readFileSync(join(WORKFLOW_DIR, 'values-pricing-daily.yml'), 'utf8')
    const crons = cronsOf(window)
    expect(crons).toHaveLength(1)
    expect(runsPerDay(crons[0])).toBe(1)
    for (const step of ['--game=sab', '--game=adopt-me', '--game=steal-an-egg']) {
      expect(window, `values-pricing-daily.yml must reprice ${step}`).toContain(`pnpm reprice ${step}`)
    }
    // The scattered per-game crons it replaced must not come back beside it.
    for (const retired of [
      'sab-eldorado-daily.yml',
      'sab-g2g-daily.yml',
      'adopt-me-daily.yml',
      'steal-an-egg-values.yml',
    ]) {
      expect(files, `${retired} was folded into values-pricing-daily.yml`).not.toContain(retired)
    }
  })

  it('every vercel.json cron is daily (Hobby cannot do sub-daily)', () => {
    const { crons } = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
      crons: { path: string; schedule: string }[]
    }
    expect(crons.length).toBeGreaterThan(0)

    const offenders = crons
      .filter((c) => runsPerDay(c.schedule) > 1)
      .map((c) => `${c.path}: "${c.schedule}"`)

    expect(
      offenders,
      offenders.length
        ? `Vercel Hobby rejects sub-daily cron; move the cadence to a GitHub ` +
          `Actions workflow and leave the daily entry as the backstop:\n  ${offenders.join('\n  ')}`
        : '',
    ).toEqual([])
  })
})
