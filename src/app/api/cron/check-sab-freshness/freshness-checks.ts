/**
 * ROUTE-014 — freshness guard for the SAB pricing pipeline.
 *
 * The pipeline is now three materialized hops deep:
 *
 *   raw listings  --(crawl, every 3h)-->  sab_market_raw_listings.observed_at
 *   evidence      --(refresh)---------->  sab_market_evidence_display.refreshed_at
 *   prices        --(refresh)---------->  sab_price_display.price_updated_at
 *
 * Each hop reads a snapshot rather than recomputing a view, which is what made
 * the correction pipeline fast enough to finish — but it also means a hop can
 * quietly stop advancing while every layer above it keeps serving the last good
 * snapshot. That is not a hypothetical: sab_price_display.refreshed_at sat at
 * 2026-08-14 for a month while the values pages served an Aug 13 snapshot with a
 * confident "Updated" timestamp, because sab_refresh_price_display() was failing
 * with SQLSTATE 21000 and the caller logged it as non-fatal (ROUTE-010/013).
 * Nothing was broken enough to page anyone.
 *
 * So this route exists to make staleness loud. It fails NON-200 — which is what
 * turns a silent data problem into a red Vercel cron — and emails an operator,
 * because a red cron nobody is looking at is how the last one went unnoticed
 * for a month.
 *
 * NOTE: these helpers live beside the route rather than inside it because
 * Next.js only permits a fixed set of exports from a route.ts (GET/POST/
 * runtime/dynamic/...). Exporting `evaluate`, `FRESHNESS_CHECKS` etc. from the
 * route file itself fails the production build with "\"evaluate\" is not a
 * valid Route export field" — which is how it broke `next build` on main.
 *
 * Threshold is 2x each hop's own cadence: late enough that one skipped or slow
 * run is not an alert (the crawl self-heals — a failed tick just leaves items
 * for the next one), early enough to catch a hop that has actually stopped.
 */


/** Where a staleness alert goes. */
export const FRESHNESS_ALERT_EMAIL = 'admin@dropmarket.gg'

export type FreshnessCheck = {
  /** The snapshot being checked. */
  table: string
  /** The timestamp column whose max() is the freshness signal. */
  column: string
  /** How often this hop is expected to advance, in hours. */
  cadenceHours: number
  /** Why that cadence — quoted in the alert so the reader need not dig. */
  cadence: string
}

/**
 * The three hops, each with its real cadence read off the schedules:
 *
 *  - evidence + raw listings advance once per crawl. The Eldorado collector runs
 *    every 3 hours (.github/workflows/sab-eldorado-daily.yml) and the import
 *    edge function refreshes the evidence snapshot at the end of every run, so
 *    both hops have a 3h cadence and a 6h threshold.
 *  - sab_price_display advances from the same crawl AND from the 10:00 UTC
 *    correct-prices cron (vercel.json). The crawl is the tighter of the two, so
 *    3h is its cadence too — but the daily cron is the backstop that must not be
 *    missed, so a 6h threshold still fires well inside one day.
 *
 * Cadence is deliberately the CRAWL's, not the daily cron's: a pipeline that has
 * fallen back to once-a-day repricing is already degraded.
 */
export const FRESHNESS_CHECKS: FreshnessCheck[] = [
  {
    table: 'sab_market_evidence_display',
    column: 'refreshed_at',
    cadenceHours: 3,
    cadence: 'refreshed at the end of every Eldorado crawl (every 3 hours)',
  },
  {
    table: 'sab_price_display',
    column: 'price_updated_at',
    cadenceHours: 3,
    cadence:
      'refreshed by every crawl, and by the 10:00 UTC correct-prices cron as a backstop',
  },
  {
    table: 'sab_market_raw_listings',
    column: 'observed_at',
    cadenceHours: 3,
    cadence: 'written by every Eldorado crawl (every 3 hours)',
  },
]

export type CheckResult = {
  table: string
  column: string
  /** The max() timestamp found, or null when the table is empty. */
  latest: string | null
  ageHours: number | null
  thresholdHours: number
  stale: boolean
  /** Set when the freshness read itself failed. */
  error?: string
}

/**
 * Read max(column) from one snapshot.
 *
 * Ordering descending with limit 1 rather than an aggregate, because PostgREST
 * has no max() over a plain select. The two display tables have a dedicated
 * `refreshed_at desc` index; sab_market_raw_listings does not (its only
 * observed_at index is partial and variant-prefixed), so that hop is a Seq Scan
 * plus a top-N sort. Acceptable for a once-an-hour single-row read, and cheaper
 * than carrying an index purely for a monitoring query.
 */
export async function readLatest(
  client: { from: (t: string) => any },
  check: FreshnessCheck,
): Promise<{ latest: string | null; error?: string }> {
  const { data, error } = await client
    .from(check.table)
    .select(check.column)
    .order(check.column, { ascending: false })
    .limit(1)

  if (error) return { latest: null, error: error.message }

  const row = Array.isArray(data) ? data[0] : null
  return { latest: (row?.[check.column] as string | undefined) ?? null }
}

/**
 * Decide staleness for one hop. Pure, so the thresholds are unit-testable
 * without a database.
 *
 * An EMPTY table counts as stale. A snapshot with no rows cannot serve prices,
 * and treating "no timestamp" as "not stale" is exactly the shape of bug this
 * route is here to catch — the absence of a signal is not a pass.
 */
export function evaluate(
  check: FreshnessCheck,
  latest: string | null,
  now: number,
  error?: string,
): CheckResult {
  const thresholdHours = check.cadenceHours * 2
  const base = {
    table: check.table,
    column: check.column,
    thresholdHours,
  }

  // A failed read is not a clean bill of health either.
  if (error) {
    return { ...base, latest: null, ageHours: null, stale: true, error }
  }

  if (!latest) {
    return { ...base, latest: null, ageHours: null, stale: true }
  }

  const parsed = Date.parse(latest)
  if (Number.isNaN(parsed)) {
    return {
      ...base,
      latest,
      ageHours: null,
      stale: true,
      error: `unparseable timestamp: ${latest}`,
    }
  }

  const ageHours = (now - parsed) / 3_600_000
  return {
    ...base,
    latest,
    ageHours: Math.round(ageHours * 100) / 100,
    stale: ageHours > thresholdHours,
  }
}

/**
 * A per-KEY staleness check: how many priced keys have evidence NEWER than
 * their price.
 *
 * The max() checks above answer "did ANY row move?". That question has a blind
 * spot, and on 2026-09-14 the pipeline fell straight into it: correct-prices
 * began 504-ing on every crawl, but ~173 of 393 brainrots still repriced, so
 * max(price_updated_at) was always minutes old and every check stayed green —
 * for five days — while 214 brainrots served Sep 14 prices behind a confident
 * "Updated" badge on the values pages.
 *
 * The first version of this check counted rows by AGE ("did any row NOT
 * move?"). That was the wrong question, and it cost a day of red runs and an
 * email every three hours (2026-09-20): with incremental writes (PR #76) a
 * row's computed_at moves only when its listings were re-observed, so every
 * item the crawl did not visit in the last 6h was "stale" by construction —
 * 1584 rows at 03:02Z, 688 at 22:56Z — while the reprice it watched was green.
 * Row age cannot tell "not crawled" from "crawled but not repriced".
 *
 * The partial-freeze shape is the second one: the crawl keeps landing new
 * listings and the price does not follow. That is evidence newer than price,
 * per key, and sab_count_unrepriced() counts exactly that (active + matched
 * listings only — the rows the correction reads — for keys that have a
 * correction). Right after a successful reprice it is 0 by definition.
 */
export type StaleCountCheck = {
  /** The snapshot whose keys are compared. */
  table: string
  /** The timestamp the evidence is compared against. */
  column: string
  /** The service-role RPC that does the per-key comparison. */
  rpc: string
  /**
   * Observations younger than this are ignored: the daily Vercel cron can land
   * mid-crawl (listings just imported, reprice not yet run) and must not page.
   * The in-job check runs AFTER the reprice, so 0 would also be correct there.
   */
  graceHours: number
  /**
   * How many unrepriced keys are tolerated before alerting. Not 0: the G2G
   * cross-check lands listings between Eldorado crawls, so a handful of keys
   * can legitimately lag by one run.
   */
  maxStaleRows: number
}

export type StaleCountResult = {
  table: string
  column: string
  staleRows: number | null
  maxStaleRows: number
  graceHours: number
  stale: boolean
  error?: string
}

/**
 * The partial-freeze checks. SAB is the one with a five-day outage behind it.
 */
export const STALE_COUNT_CHECKS: StaleCountCheck[] = [
  {
    table: 'sab_price_corrections',
    column: 'computed_at',
    rpc: 'sab_count_unrepriced',
    graceHours: 1,
    maxStaleRows: 25,
  },
]

/**
 * Decide staleness from a key count. Pure, so the threshold is unit-testable
 * without a database.
 *
 * A failed count is stale, never a pass — same principle the max() check
 * applies to an empty table: the absence of a signal is not a clean bill.
 */
export function evaluateStaleCount(
  check: StaleCountCheck,
  staleRows: number | null,
  error?: string,
): StaleCountResult {
  const base = {
    table: check.table,
    column: check.column,
    maxStaleRows: check.maxStaleRows,
    graceHours: check.graceHours,
  }

  if (error) return { ...base, staleRows: null, stale: true, error }
  if (staleRows == null) {
    return { ...base, staleRows: null, stale: true, error: 'no count returned' }
  }

  return { ...base, staleRows, stale: staleRows > check.maxStaleRows }
}

/**
 * Count unrepriced keys through the RPC. Never a PostgREST row count over a
 * timestamp column: that measures age, and age is "not crawled", not "frozen".
 */
export async function readStaleCount(
  client: { rpc: (fn: string, args: Record<string, unknown>) => any },
  check: StaleCountCheck,
): Promise<{ staleRows: number | null; error?: string }> {
  const { data, error } = await client.rpc(check.rpc, {
    p_grace_seconds: Math.round(check.graceHours * 3600),
  })

  if (error) return { staleRows: null, error: error.message }
  const count = data == null ? null : Number(data)
  return { staleRows: count != null && Number.isFinite(count) ? count : null }
}

/** The alert body. Plain text — sendAdminNoticeEmail escapes it. */
export function buildAlertBody(stale: CheckResult[], checkedAt: string): string {
  const lines = stale.map((r) => {
    const checkMeta = FRESHNESS_CHECKS.find((c) => c.table === r.table)
    const age =
      r.ageHours === null
        ? r.error
          ? `could not be read (${r.error})`
          : 'is EMPTY (no rows)'
        : `is ${r.ageHours}h old (threshold ${r.thresholdHours}h)`
    return [
      `• ${r.table}.${r.column} ${age}`,
      r.latest ? `    last advanced: ${r.latest}` : null,
      checkMeta ? `    expected: ${checkMeta.cadence}` : null,
    ]
      .filter(Boolean)
      .join('\n')
  })

  return [
    `The SAB pricing pipeline has a hop that stopped advancing.`,
    ``,
    ...lines,
    ``,
    `Checked at ${checkedAt}.`,
    ``,
    `Where to look, in pipeline order:`,
    `  1. sab_market_raw_listings stale -> the Eldorado crawl is not landing.`,
    `     Check the SAB Eldorado Daily workflow runs.`,
    `  2. only evidence stale -> sab_refresh_evidence_display() is failing.`,
    `     The crawl returns 500 with the RPC error in "details".`,
    `  3. only prices stale -> sab_refresh_price_display() is failing, or`,
    `     correct-prices?game=sab is timing out.`,
    ``,
    `Prices on the values pages are still being served from the last good`,
    `snapshot, so this is silent to visitors — the pages will show an old`,
    `"Updated" date rather than no price.`,
  ].join('\n')
}

/**
 * The stale-ROW section of the alert. Appended to the hop alert so one email
 * carries both questions: "did anything move?" and "did anything not move?".
 */
export function buildStaleCountAlertBody(stale: StaleCountResult[]): string {
  if (!stale.length) return ''

  const lines = stale.map((r) => {
    const what =
      r.staleRows === null
        ? `could not be counted (${r.error ?? 'unknown error'})`
        : `has ${r.staleRows} priced key(s) whose newest listing is newer than ` +
          `their ${r.column} (ignoring the last ${r.graceHours}h; ` +
          `tolerated: ${r.maxStaleRows})`
    return `• ${r.table} ${what}`
  })

  return [
    ``,
    ``,
    `PARTIAL FREEZE — the crawl landed listings and the price did not follow:`,
    ``,
    ...lines,
    ``,
    `max() looks healthy in this state, which is why this check exists. The`,
    `usual cause is the repricing run failing partway or not covering every`,
    `item. Check the most recent "Reprice <game>" step in that game's workflow`,
    `— it hard-fails now, so a red job is the signal. An item that was simply`,
    `not crawled recently is NOT counted here: its price is as old as its`,
    `evidence, which is honest, not frozen.`,
  ].join('\n')
}
