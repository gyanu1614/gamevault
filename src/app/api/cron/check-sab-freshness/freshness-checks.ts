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
