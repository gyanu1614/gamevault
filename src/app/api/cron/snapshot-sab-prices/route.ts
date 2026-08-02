/**
 * Daily SAB Price Snapshot Cron Job
 *
 * Captures one immutable row per (brainrot, mutation) into sab_price_snapshots,
 * sourced from the public price catalog. Price history CANNOT be backfilled, so
 * this must run every day — each missed day is permanently lost data.
 *
 * Scheduled at 06:00 UTC (see vercel.json), after the other daily crons settle.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { pingIndexNow } from '@/lib/seo/indexnow'

// Must be set in environment variables. No fallback — fail closed if unset
// so a missing CRON_SECRET can never be triggered with a known default token.
const CRON_SECRET = process.env.CRON_SECRET

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
 * Reads sab_public_price_catalog_corrected (the numbers users actually see),
 * maps to the history columns, and upserts on (brainrot, mutation, day) so a
 * re-run within the same UTC day is idempotent. Only rows with a real value are
 * captured — a null price is "no data", not a $0 snapshot.
 */
async function captureFromCorrectedView(
  admin: ReturnType<typeof createServiceRoleClient>,
): Promise<number> {
  const historyDate = new Date().toISOString().slice(0, 10)
  const rows: CorrectedRow[] = []

  for (let page = 0; ; page += 1) {
    const from = page * PAGE_SIZE
    const { data, error } = await (admin as any)
      .from('sab_public_price_catalog_corrected')
      .select(
        'brainrot_id,mutation_id,market_value_usd,market_low_usd,market_high_usd,external_sample_size,source_count,confidence_label,is_trade_ready,is_public_estimate,price_updated_at',
      )
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw new Error(`corrected view: ${error.message}`)
    if (!data?.length) break
    rows.push(...(data as CorrectedRow[]))
    if (data.length < PAGE_SIZE) break
  }

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
      .upsert(batch, { onConflict: 'brainrot_id,mutation_id,history_date' })

    if (error) throw new Error(`snapshot upsert: ${error.message}`)
    captured += batch.length
  }

  return captured
}

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (fail closed when the secret is not configured)
    const authHeader = request.headers.get('authorization')
    if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
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
    // of rewriting it we snapshot directly from sab_public_price_catalog_corrected.
    const capturedCount = await captureFromCorrectedView(admin)
    console.log(`✅ Captured ${capturedCount} SAB price snapshot rows (corrected)`)

    // Freshness signal: now that today's prices are captured, ping IndexNow so
    // Bing/Yandex (+ ChatGPT search, which reads Bing's index) re-crawl the SAB
    // value pages the same day they change. This makes our "updated daily" claim
    // a real signal engines act on — not just sitemap lastmod on the next crawl.
    // Fire-and-forget + no-op outside prod; never blocks the capture result.
    let pingedCount = 0
    try {
      const { data: slugRows } = await admin
        .from('sab_public_price_catalog_corrected')
        .select('brainrot_slug')
        .eq('mutation_slug', 'default') as { data: { brainrot_slug: string }[] | null }

      const itemPaths = Array.from(
        new Set((slugRows ?? []).map((r) => r.brainrot_slug).filter(Boolean)),
      ).map((slug) => `/steal-a-brainrot/values/${slug}`)

      // Hub pages change daily too; lead with them. IndexNow accepts up to
      // 10k URLs/request, so the ~500 item pages fit in a single batch.
      const paths = [
        '/steal-a-brainrot',
        '/steal-a-brainrot/values',
        '/steal-a-brainrot/calculator',
        ...itemPaths,
      ]
      await pingIndexNow(paths)
      pingedCount = paths.length
    } catch (pingErr) {
      // Never fail the cron over a freshness ping.
      console.error('IndexNow ping after snapshot failed (non-fatal):', pingErr)
    }

    return NextResponse.json({
      success: true,
      captured: capturedCount,
      pinged: pingedCount,
      message: `Captured ${capturedCount} SAB price snapshot rows; pinged ${pingedCount} URLs to IndexNow`,
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
