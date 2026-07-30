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

    // Capture today's catalog. Idempotent per calendar day (UTC).
    const { data, error } = await admin.rpc('sab_capture_price_history')

    if (error) {
      console.error('Error capturing SAB price snapshot:', error)
      return NextResponse.json(
        { error: 'Failed to capture price snapshot', details: error.message },
        { status: 500 }
      )
    }

    const capturedCount = typeof data === 'number' ? data : 0
    console.log(`✅ Captured ${capturedCount} SAB price snapshot rows`)

    // Freshness signal: now that today's prices are captured, ping IndexNow so
    // Bing/Yandex (+ ChatGPT search, which reads Bing's index) re-crawl the SAB
    // value pages the same day they change. This makes our "updated daily" claim
    // a real signal engines act on — not just sitemap lastmod on the next crawl.
    // Fire-and-forget + no-op outside prod; never blocks the capture result.
    let pingedCount = 0
    try {
      const { data: slugRows } = await admin
        .from('sab_public_price_catalog')
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
