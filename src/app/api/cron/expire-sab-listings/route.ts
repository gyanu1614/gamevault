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

import { createServiceRoleClient } from '@/lib/supabase/service'

const CRON_SECRET = process.env.CRON_SECRET

const PAGE_SIZE = 1000

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

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createServiceRoleClient()

    const listings: ActiveListing[] = []

    for (let page = 0; ; page += 1) {
      const from = page * PAGE_SIZE
      const { data, error } = await (admin as any)
        .from('sab_market_raw_listings')
        .select('id,source_id,brainrot_id,fetched_at')
        .eq('listing_status', 'active')
        .range(from, from + PAGE_SIZE - 1)

      if (error) {
        console.error('Failed to read active SAB listings:', error)
        return NextResponse.json(
          { error: 'Failed to read listings', details: error.message },
          { status: 500 },
        )
      }

      if (!data?.length) break
      listings.push(...(data as ActiveListing[]))
      if (data.length < PAGE_SIZE) break
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

        if (error) {
          console.error('Failed to expire SAB listings:', error)
          return NextResponse.json(
            {
              error: 'Failed to expire listings',
              details: error.message,
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
