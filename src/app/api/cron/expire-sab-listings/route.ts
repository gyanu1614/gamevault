/**
 * Daily SAB listing-lifecycle cron.
 *
 * Marks listings that have disappeared from their source as ended. Nothing did
 * this before: `ended_at` was null on all 16,412 rows and `listing_status` was
 * 'active' on every one, because the import only ever upserts what it currently
 * sees and never reasons about what vanished.
 *
 * WHY THIS MATTERS: the pipeline has zero completed sales (0 of 12,475
 * samples), so every published price is an asking price. A listing that
 * disappears shortly after being seen is the closest thing to a transaction
 * signal we can get without a marketplace handing us sale data. Accumulated
 * over weeks, the price at which listings stop surviving approximates the real
 * clearing price.
 *
 * THE TRAP THIS AVOIDS: a first attempt at that signal measured 49% — a coin
 * flip — because the collector backfilled (each Brainrot crawled once, never
 * revisited), so "not seen" almost always meant "we did not look". Absence is
 * only evidence when you actually looked again.
 *
 * So this job never infers disappearance from age alone. It only considers a
 * (source, Brainrot) group whose most recent crawl is RECENT, and within such a
 * group only marks listings that the latest crawl demonstrably missed. If
 * collection stops for a week, this job stops concluding anything rather than
 * declaring the whole catalog sold.
 *
 * Depends on the collector running with --refresh-after-hours so panel items
 * are actually re-crawled. Without that, groups go stale, the recency guard
 * rejects them, and this job correctly does nothing.
 */

import { NextRequest, NextResponse } from 'next/server'

import { isRetryableReadError } from '@/lib/pricing/games/sab'
import { createServiceRoleClient } from '@/lib/supabase/service'

const CRON_SECRET = process.env.CRON_SECRET

/**
 * ROUTE-018: this route scans every active listing, ~36,600 rows on prod and
 * growing ~3k/day. The default Vercel function budget killed it mid-read — the
 * 2026-09-13 post-crawl run returned
 * 500 {"error":"Failed to read listings","details":"Gateway Timeout"}
 * while the correct-prices step that follows it succeeded.
 *
 * Note the failure arrives as a GATEWAY timeout, not Postgres 57014: migration
 * 20260913121000 already gives service_role a 120s statement budget, so the
 * individual queries are inside their limit and it is the FUNCTION that runs out
 * of wall clock across ~37 sequential round-trips.
 */
export const maxDuration = 300

const PAGE_SIZE = 1000

/**
 * ROUTE-018: attempts per page before giving up. Mirrors PAGE_MAX_ATTEMPTS in
 * src/lib/pricing/games/sab.ts (ROUTE-011): a deep page over a large table
 * intermittently exceeds its budget depending on cache warmth, and a page that
 * fails is very likely to succeed moments later. Before this, a single unlucky
 * page aborted the whole job and nothing was expired at all.
 */
const PAGE_MAX_ATTEMPTS = 4

const delay = (ms: number) => new Promise((done) => setTimeout(done, ms))

/**
 * A group's newest crawl must be at least this fresh before we draw any
 * conclusion from absence. Slightly over a day, so one late or skipped daily
 * run doesn't cause a wave of false endings.
 */
const RECENT_CRAWL_HOURS = 36

/**
 * A listing must be this much older than its group's newest crawl to count as
 * missed. Absorbs within-run clock spread — a crawl of one Brainrot writes
 * `fetched_at` across many minutes, and without this the last listings written
 * in a run would look stale relative to the first.
 */
const STALE_GRACE_HOURS = 2

const HOUR_MS = 60 * 60 * 1000

type ActiveListing = {
  id: string
  source_id: string
  brainrot_id: string | null
  fetched_at: string
}

/**
 * ROUTE-018: read every active listing, in bounded pages, with a STABLE order
 * and a retry per page.
 *
 * Why not read the materialized sab_market_evidence_display instead — the
 * obvious fix, and the wrong one. That snapshot is the *candidates* set: it
 * drops unmatched and low-confidence rows, bundles, account and inventory
 * listings, duplicates, outliers, non-USD rows, and anything priced below the
 * watchlist floor (COALESCE(minimum_cash_value_usd, 1.00)). Those rows are still
 * listing_status='active' in the raw table, so expiring only what survives that
 * filter would leave them active forever.
 *
 * Worse, it would corrupt the safety guard this job rests on. lastCrawlByGroup
 * is a MAX over fetched_at per (source, Brainrot) and licenses every conclusion
 * the job draws. Computed from a filtered subset, a group whose newest crawl
 * happened to produce only filtered-out rows would report an older newest-crawl,
 * and the job would start declaring listings ended on the strength of a crawl it
 * never actually saw. The guard has to see exactly what the crawl wrote.
 *
 * So: paginate the raw table with ROUTE-011's retry treatment instead.
 *
 * The ORDER BY is not cosmetic. PostgREST .range() without one gives Postgres no
 * row-order guarantee across pages, so boundaries silently SKIP and DUPLICATE
 * rows, differently on every call — the exact bug that made the SAB correction
 * non-deterministic (see selectAll in src/lib/pricing/games/sab.ts). Here a
 * skipped row is one never considered for expiry, and a skipped row that carried
 * a group's newest fetched_at drags that group's max backwards and can expire
 * listings that are in fact still live. `id` is the primary key, so ordering by
 * it makes every page a clean, gap-free, duplicate-free slice.
 */
async function readActiveListings(
  admin: ReturnType<typeof createServiceRoleClient>,
): Promise<ActiveListing[]> {
  const rows: ActiveListing[] = []

  for (let page = 0; ; page += 1) {
    const from = page * PAGE_SIZE
    let lastError: { message?: string; code?: string } | null = null
    let data: ActiveListing[] | null = null

    for (let attempt = 1; attempt <= PAGE_MAX_ATTEMPTS; attempt += 1) {
      const result = await (admin as any)
        .from('sab_market_raw_listings')
        .select('id,source_id,brainrot_id,fetched_at')
        .eq('listing_status', 'active')
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)

      if (!result.error) {
        data = (result.data ?? []) as ActiveListing[]
        break
      }

      lastError = result.error
      // Anything non-transient (a bad column, a missing relation) throws at once:
      // a retry could not help and would only delay the real error.
      if (!isRetryableReadError(result.error) || attempt === PAGE_MAX_ATTEMPTS) {
        break
      }

      console.warn(
        `sab_market_raw_listings: page ${from}+ failed (attempt ${attempt}/` +
          `${PAGE_MAX_ATTEMPTS}: ${result.error.message}) — retrying…`,
      )
      await delay(1000 * attempt)
    }

    if (!data) {
      throw new Error(lastError?.message ?? 'unknown read error')
    }

    if (!data.length) break
    rows.push(...data)
    if (data.length < PAGE_SIZE) break
  }

  return rows
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createServiceRoleClient()

    let listings: ActiveListing[]
    try {
      listings = await readActiveListings(admin)
    } catch (readError: any) {
      console.error('Failed to read active SAB listings:', readError)
      return NextResponse.json(
        { error: 'Failed to read listings', details: readError.message },
        { status: 500 },
      )
    }

    // Newest crawl per (source, Brainrot). This is "when did we last look at
    // this item", which is the only thing that licenses an absence conclusion.
    const lastCrawlByGroup = new Map<string, number>()

    for (const listing of listings) {
      if (!listing.brainrot_id) continue
      const key = `${listing.source_id}|${listing.brainrot_id}`
      const fetchedAt = Date.parse(listing.fetched_at)
      if (!Number.isFinite(fetchedAt)) continue
      const current = lastCrawlByGroup.get(key)
      if (current == null || fetchedAt > current) {
        lastCrawlByGroup.set(key, fetchedAt)
      }
    }

    const now = Date.now()
    const recencyFloor = now - RECENT_CRAWL_HOURS * HOUR_MS

    const expiring: { id: string; endedAt: string }[] = []
    let skippedStaleGroups = 0

    const staleGroups = new Set<string>()

    for (const [key, lastCrawl] of lastCrawlByGroup) {
      if (lastCrawl < recencyFloor) staleGroups.add(key)
    }
    skippedStaleGroups = staleGroups.size

    for (const listing of listings) {
      if (!listing.brainrot_id) continue

      const key = `${listing.source_id}|${listing.brainrot_id}`
      if (staleGroups.has(key)) continue

      const lastCrawl = lastCrawlByGroup.get(key)
      if (lastCrawl == null) continue

      const fetchedAt = Date.parse(listing.fetched_at)
      if (!Number.isFinite(fetchedAt)) continue

      if (fetchedAt < lastCrawl - STALE_GRACE_HOURS * HOUR_MS) {
        // ended_at is the last moment we actually saw it, not now — that's the
        // timestamp any survival analysis needs.
        expiring.push({ id: listing.id, endedAt: listing.fetched_at })
      }
    }

    let expired = 0

    // Group by shared ended_at so each distinct timestamp is one update.
    const byEndedAt = new Map<string, string[]>()
    for (const row of expiring) {
      const ids = byEndedAt.get(row.endedAt)
      if (ids) ids.push(row.id)
      else byEndedAt.set(row.endedAt, [row.id])
    }

    for (const [endedAt, ids] of byEndedAt) {
      for (let index = 0; index < ids.length; index += PAGE_SIZE) {
        const batch = ids.slice(index, index + PAGE_SIZE)
        let lastError: { message?: string; code?: string } | null = null
        let written = false

        // ROUTE-018: retry the write too. It is idempotent — the
        // .eq('listing_status','active') guard below means a replayed batch
        // updates only what is still active — so a transient failure that
        // previously abandoned the job half-applied is now just a retry.
        for (let attempt = 1; attempt <= PAGE_MAX_ATTEMPTS; attempt += 1) {
          const { error } = await (admin as any)
            .from('sab_market_raw_listings')
            .update({
              listing_status: 'ended',
              ended_at: endedAt,
              updated_at: new Date().toISOString(),
            })
            .in('id', batch)
            // Re-assert the guard: another import may have refreshed a listing
            // between our read and this write.
            .eq('listing_status', 'active')

          if (!error) {
            written = true
            break
          }

          lastError = error
          if (!isRetryableReadError(error) || attempt === PAGE_MAX_ATTEMPTS) break

          console.warn(
            `expire batch at ${index} failed (attempt ${attempt}/` +
              `${PAGE_MAX_ATTEMPTS}: ${error.message}) — retrying…`,
          )
          await delay(1000 * attempt)
        }

        if (!written) {
          console.error('Failed to expire SAB listings:', lastError)
          return NextResponse.json(
            {
              error: 'Failed to expire listings',
              details: lastError?.message ?? 'unknown write error',
              expired,
            },
            { status: 500 },
          )
        }

        expired += batch.length
      }
    }

    console.log(
      `✅ SAB listing lifecycle: ${expired} expired across ${lastCrawlByGroup.size - skippedStaleGroups} freshly-crawled groups (${skippedStaleGroups} groups skipped as not recently crawled)`,
    )

    return NextResponse.json({
      success: true,
      active_listings_scanned: listings.length,
      groups_total: lastCrawlByGroup.size,
      groups_recently_crawled: lastCrawlByGroup.size - skippedStaleGroups,
      groups_skipped_not_recently_crawled: skippedStaleGroups,
      expired,
    })
  } catch (error: any) {
    console.error('Unexpected error in expire-sab-listings cron:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
