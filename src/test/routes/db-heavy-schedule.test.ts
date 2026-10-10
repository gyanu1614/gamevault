/**
 * Supabase free plan (Nano, ~0.5 GB RAM) went into heavy swap on 2026-10-09
 * when GitHub ran four delayed schedules together around 11:30 UTC: the
 * nightly backup (a 413 MB data dump), SAB retention, the trend-radar rollup
 * and the tail of the SAB pricing job. Egress was 6.3 of 5 GB, mostly that
 * nightly dump.
 *
 * GitHub starts this repo's schedules 5–7 h late (gh run list, 2026-10-01..09),
 * but the delay is near-identical for every workflow on a given day (10-09:
 * pricing +6.8 h, retention +6.8 h, radar +6.8 h, backup +6.6 h). So the
 * spacing between CRON times is the spacing between real runs, and that is
 * what this file pins:
 *
 *   1. the backup is WEEKLY and skips the bulk tables we can rebuild by
 *      re-crawling — never a money, order, user or history table;
 *   2. the watchdog tolerates a weekly cadence (so it does not page daily) but
 *      still pages after one missed week;
 *   3. every DB-heavy schedule starts at least 3 h after the previous one's
 *      worst-case (timeout-length) end, around the whole 24 h clock.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const WF = '.github/workflows'
const read = (file: string) => readFileSync(join(WF, file), 'utf8')
const cronsOf = (source: string) =>
  [...source.matchAll(/^\s*-\s*cron:\s*['"]([^'"]+)['"]/gm)].map((m) => m[1])

describe('db-backup.yml — weekly, without the rebuildable bulk', () => {
  const yml = read('db-backup.yml')

  it('runs once a week', () => {
    const crons = cronsOf(yml)
    expect(crons).toHaveLength(1)
    const [minute, hour, dom, month, dow] = crons[0].split(' ')
    expect(minute).toMatch(/^\d+$/)
    expect(hour).toMatch(/^\d+$/)
    expect([dom, month]).toEqual(['*', '*'])
    expect(dow, 'one weekday').toMatch(/^[0-6]$/)
  })

  /**
   * Tables passed to `supabase db dump --data-only --exclude`: a bash array
   * `exclude=( ... )`, each entry expanded to its own `--exclude <table>`.
   */
  const excluded = (() => {
    const body = yml.match(/\n\s*exclude=\(\n([\s\S]*?)\n\s*\)\n/)?.[1] ?? ''
    return body
      .split('\n')
      .map((l) => l.replace(/#.*$/, '').trim())
      .filter(Boolean)
  })()

  it('feeds the exclude list to the data pass, one --exclude per table', () => {
    expect(excluded.length).toBeGreaterThan(0)
    expect(yml).toMatch(/for t in "\$\{exclude\[@\]\}"; do args\+=\(--exclude "\$t"\); done/)
    const dataPass =
      yml.split('\n').find((l) => /^\s*supabase db dump .*--data-only/.test(l)) ?? ''
    expect(dataPass).toContain('"${args[@]}"')
  })

  it('excludes the rebuildable bulk tables from the DATA dump only', () => {
    for (const table of [
      'public.sab_market_raw_listings',
      'public.sab_market_evidence_display',
      'public.values_raw_listings',
      'public.adopt_me_market_raw_listings',
      'public.value_funnel_events',
      'public.rate_limits',
    ]) {
      expect(excluded, `${table} should be excluded`).toContain(table)
    }
    // The schema pass still dumps every table's DDL, so a restore recreates the
    // excluded tables empty and the next crawl refills them.
    expect(yml).toMatch(/supabase db dump --db-url "\$SUPABASE_DB_URL" -f schema\.sql --schema public,auth\n/)
  })

  it('never excludes money, order, user, listing or history data', () => {
    const protectedTable =
      /order|wallet|ledger|payout|withdrawal|profile|listings$|review|dispute|message|_history|payment|refund|promo|seller|kyc|auth\./
    const offenders = excluded.filter(
      (t) => protectedTable.test(t) && !/raw_listings$/.test(t),
    )
    expect(offenders).toEqual([])
  })

  it('every excluded table exists in the migrations (a typo would silently keep it)', () => {
    const sql = readdirSync('supabase/migrations')
      .filter((f) => f.endsWith('.sql'))
      .map((f) => readFileSync(join('supabase/migrations', f), 'utf8'))
      .join('\n')
    for (const table of excluded) {
      const name = table.replace(/^public\./, '')
      expect(sql, `${table} not created by any migration`).toMatch(
        new RegExp(`create table (if not exists )?("?public"?\\.)?"?${name}"?\\s*\\(`, 'i'),
      )
    }
  })

  it('the watchdog allows a weekly cadence but pages after one missed week', () => {
    const hours = Number(read('db-backup-watchdog.yml').match(/MAX_AGE_HOURS: "(\d+)"/)?.[1])
    expect(hours).toBeGreaterThanOrEqual(7 * 24 + 12)
    expect(hours).toBeLessThanOrEqual(9 * 24)
  })
})

describe('DB-heavy schedules are hours apart', () => {
  /**
   * Worst-case length of each run: its timeout(s). Values pricing chains
   * sab-g2g (60) → sab (150) → adopt-me (90); the other games run beside SAB.
   * Weekly jobs are treated as daily: the check is on clock time only.
   */
  const HEAVY: { file: string; cron?: string; minutes: number }[] = [
    { file: 'values-pricing-daily.yml', minutes: 60 + 150 + 90 },
    { file: 'sab-retention-nightly.yml', minutes: 30 },
    { file: 'db-backup.yml', minutes: 60 },
    { file: 'adopt-me-weekly-catalog.yml', minutes: 60 },
    // Trend radar: two schedules in one file (collect+prepare, nightly).
    { file: 'trend-radar.yml', cron: 'collect', minutes: 15 },
    { file: 'trend-radar.yml', cron: 'nightly', minutes: 10 },
  ]
  const MIN_GAP_MINUTES = 3 * 60

  function startMinute(file: string, which?: string): number {
    const crons = cronsOf(read(file))
    const expression =
      which === 'nightly' ? crons[1] : which === 'collect' ? crons[0] : crons[0]
    expect(crons.length, `${file}: unexpected schedule count`).toBe(which ? 2 : 1)
    const [minute, hour] = expression.split(' ').map(Number)
    expect(Number.isInteger(minute) && Number.isInteger(hour), `${file}: ${expression}`).toBe(true)
    return hour * 60 + minute
  }

  it(`every heavy run starts ≥ ${MIN_GAP_MINUTES / 60} h after the previous one can end`, () => {
    const runs = HEAVY.map((h) => ({
      label: h.cron ? `${h.file} (${h.cron})` : h.file,
      start: startMinute(h.file, h.cron),
      minutes: h.minutes,
    }))
    // Weekly jobs on different weekdays may share a clock slot (backup Sunday,
    // catalogue Saturday): they never meet. Collapse identical slots.
    const weekly = new Set(['db-backup.yml', 'adopt-me-weekly-catalog.yml'])
    const slots = runs
      .filter(
        (r, i) =>
          !(weekly.has(r.label) && runs.some((o, j) => j < i && weekly.has(o.label) && o.start === r.start)),
      )
      .sort((a, b) => a.start - b.start)

    const tooClose: string[] = []
    slots.forEach((run, i) => {
      const next = slots[(i + 1) % slots.length]
      const end = run.start + run.minutes
      const nextStart = next.start + (i + 1 === slots.length ? 24 * 60 : 0)
      const gap = nextStart - end
      if (gap < MIN_GAP_MINUTES) {
        tooClose.push(`${run.label} can end ${gap} min before ${next.label} starts`)
      }
    })
    expect(tooClose).toEqual([])
  })

  it('the two weekly jobs are on different days', () => {
    const dow = (file: string) => cronsOf(read(file))[0].split(' ')[4]
    expect(dow('db-backup.yml')).not.toBe(dow('adopt-me-weekly-catalog.yml'))
  })
})

describe('schedule conditions match the crons they gate', () => {
  /**
   * A job gated on `github.event.schedule == '<cron>'` silently never runs when
   * the cron is re-timed and the condition is not: trend-radar collect was
   * skipped from 2026-09-23 to 2026-10-09 because its `if:` still named the
   * old every-6-hours cron.
   */
  it('every github.event.schedule comparison names a cron in the same file', () => {
    const stale: string[] = []
    for (const file of readdirSync(WF).filter((f) => /\.ya?ml$/.test(f))) {
      const source = read(file)
      const crons = cronsOf(source)
      for (const m of source.matchAll(/github\.event\.schedule\s*==\s*'([^']+)'/g)) {
        if (!crons.includes(m[1])) stale.push(`${file}: '${m[1]}' is not one of ${JSON.stringify(crons)}`)
      }
    }
    expect(stale).toEqual([])
  })
})

describe('Vercel crons that read the day’s prices run after pricing', () => {
  /**
   * Vercel crons fire on time; GitHub starts Values Pricing Daily 5–7 h late
   * and it may run its full timeout chain. snapshot-sab-prices writes the day's
   * (uncorrectable) history row and discord-daily-post posts the day's movers
   * from it, so both must start after pricing's latest possible end, on the
   * same UTC day, snapshot first.
   */
  const MAX_DELAY_MINUTES = 7 * 60
  const PRICING_MINUTES = 60 + 150 + 90
  const vercel = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
    crons: { path: string; schedule: string }[]
  }
  const at = (path: string) => {
    const entry = vercel.crons.find((c) => c.path === path)
    expect(entry, path).toBeDefined()
    const [minute, hour, ...rest] = entry!.schedule.split(' ')
    expect(rest, `${path} runs daily`).toEqual(['*', '*', '*'])
    return Number(hour) * 60 + Number(minute)
  }

  it('snapshot then Discord post, both after the latest pricing end', () => {
    const [pm, ph] = cronsOf(read('values-pricing-daily.yml'))[0].split(' ').map(Number)
    const pricingEnd = ph * 60 + pm + MAX_DELAY_MINUTES + PRICING_MINUTES
    const snapshot = at('/api/cron/snapshot-sab-prices')
    const post = at('/api/cron/discord-daily-post')
    expect(snapshot).toBeGreaterThan(pricingEnd)
    expect(post).toBeGreaterThan(snapshot)
    expect(post).toBeLessThan(24 * 60)
  })
})
