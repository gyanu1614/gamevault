/**
 * Daily SAB Price Snapshot Cron Job
 *
 * Captures one immutable row per (brainrot, mutation) into sab_price_snapshots,
 * sourced from the public price catalog. Price history CANNOT be backfilled, so
 * this must run every day — each missed day is permanently lost data.
 *
 * Scheduled at 18:30 UTC (see vercel.json). Values Pricing Daily is set for
 * 02:10 but GitHub starts it 5–7 h late and it can run up to 5 h, so before
 * ~14 UTC this could record YESTERDAY's price as today's row (each day is
 * written once and cannot be backfilled). Pinned by
 * src/test/routes/db-heavy-schedule.test.ts.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { selectAllByKey } from '@/lib/db/select-all-by-key'
import { runEvidenceRefresh } from '@/lib/seo/gate/run'
import { isCronAuthorized } from '@/lib/security/cron-auth'

// Must be set in environment variables. No fallback — fail closed if unset

const PAGE_SIZE = 1000

type CorrectedRow = {
  brainrot_id: string
  mutation_id: string
  market_value_usd: number | string | null
  market_low_usd: number | string | null
  market_high_usd: number | string | null
  external_sample_size: number | null
  source_count: number | null
  confidence_label: string | null
  is_trade_ready: boolean | null
  is_public_estimate: boolean | null
  price_updated_at: string | null
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Snapshot today's CORRECTED prices into sab_price_history.
 *
 * Reads sab_price_display (the materialized numbers users actually see),
 * maps to the history columns, and upserts on (brainrot, mutation, day) so a
 * re-run within the same UTC day is idempotent. Only rows with a real value are
 * captured — a null price is "no data", not a $0 snapshot.
 */
async function captureFromCorrectedView(
  admin: ReturnType<typeof createServiceRoleClient>,
): Promise<number> {
  const historyDate = new Date().toISOString().slice(0, 10)
  // Keyset on sab_price_display's primary key (brainrot_id, mutation_slug).
  // The OFFSET loop this replaced had no ORDER BY, so page seams could skip or
  // repeat rows.
  const rows = await selectAllByKey<CorrectedRow>(admin, {
    table: 'sab_price_display',
    columns:
      'brainrot_id,mutation_id,market_value_usd,market_low_usd,market_high_usd,external_sample_size,source_count,confidence_label,is_trade_ready,is_public_estimate,price_updated_at',
    key: ['brainrot_id', 'mutation_slug'],
  })

  const snapshots = rows
    .map((row) => {
      const median = toNumber(row.market_value_usd)
      if (median == null) return null
      return {
        brainrot_id: row.brainrot_id,
        mutation_id: row.mutation_id,
        history_date: historyDate,
        median_usd: median,
        low_usd: toNumber(row.market_low_usd) ?? median,
        high_usd: toNumber(row.market_high_usd) ?? median,
        listing_count: row.external_sample_size ?? 0,
        source_count: row.source_count ?? 0,
        confidence_label: row.confidence_label ?? 'low',
        is_trade_ready: row.is_trade_ready ?? false,
        is_public_estimate: row.is_public_estimate ?? false,
        price_updated_at: row.price_updated_at,
      }
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)

  let captured = 0
  for (let index = 0; index < snapshots.length; index += PAGE_SIZE) {
    const batch = snapshots.slice(index, index + PAGE_SIZE)
    const { error } = await (admin as any)
      .from('sab_price_history')
      // The daily reprice already writes today's row (sab.ts); this cron is the
      // backstop for a day it did not run, so it never rewrites an existing row
      // (that left a dead tuple per row, ~3k a day).
      .upsert(batch, { onConflict: 'brainrot_id,mutation_id,history_date', ignoreDuplicates: true })

    if (error) throw new Error(`snapshot upsert: ${error.message}`)
    captured += batch.length
  }

  return captured
}

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (fail closed when the secret is not configured)
    // PAY-020: constant-time bearer compare, fails closed when CRON_SECRET is unset.
    if (!isCronAuthorized(request.headers)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // MUST be the service-role client. The capture function is defined as:
    //   revoke all on function sab_capture_price_history(date)
    //     from public, anon, authenticated;
    //   grant execute ... to service_role;
    // Calling it through the anon/SSR client (as this route originally did)
    // fails the permission check on every run, which is why the table held a
    // single manually-seeded day while the cron appeared to be scheduled and
    // healthy.
    const admin = createServiceRoleClient()

    // Capture today's CORRECTED prices — the same numbers users see — not the
    // raw catalog. The old `sab_capture_price_history()` RPC read the raw
    // pipeline, so history recorded uncorrected values that swing wildly
    // day-to-day (Spyder Elephant $323 -> $9.98, Headless $1000 -> $8999),
    // making trend charts and the daily-post "movers" pure noise. The RPC's
    // live definition is hand-edited and unreadable from the repo, so instead
    // of rewriting it we snapshot directly from sab_price_display.
    const capturedCount = await captureFromCorrectedView(admin)
    console.log(`✅ Captured ${capturedCount} SAB price snapshot rows (corrected)`)

    // Freshness signal: now that today's snapshot is captured, refresh the SEO
    // evidence (lib/seo/gate): days of history grow, and pages whose value REALLY
    // moved (>= 5% and >= $0.25 against the anchor) are logged to the SEO change
    // log, which /api/cron/seo-indexnow delivers to IndexNow. Never throws, and
    // never blocks the capture result.
    // The evidence refresh revalidates the pages whose evidence moved. It does
    // NOT re-render every price page: the pricing publish already revalidates
    // the items whose price moved and the list pages (2026-10-20 usage audit:
    // the old loop re-rendered all ~500 SAB pages every day).
    let indexNowChanged = 0
    try {
      indexNowChanged = (await runEvidenceRefresh('steal-a-brainrot'))?.moved.length ?? 0
    } catch (pingErr) {
      // Never fail the cron over a freshness ping or revalidation.
      console.error(
        'SEO evidence refresh after snapshot failed (non-fatal):',
        pingErr,
      )
    }

    return NextResponse.json({
      success: true,
      captured: capturedCount,
      indexnow_changed: indexNowChanged,
      message: `Captured ${capturedCount} SAB price snapshot rows; ${indexNowChanged} value pages changed enough for IndexNow`,
    })
  } catch (error: any) {
    console.error('Unexpected error in snapshot-sab-prices cron:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// Also support POST for flexibility
export async function POST(request: NextRequest) {
  return GET(request)
}
