/**
 * SAB listing lifecycle — mark listings that vanished from their source as
 * ended.
 *
 * Nothing did this before the cron existed: `ended_at` was null on all 16,412
 * rows and `listing_status` was 'active' on every one, because the import only
 * ever upserts what it currently sees and never reasons about what vanished.
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
 * WHERE IT RUNS (2026-09-20): on the GH Actions runner, as its own workflow
 * step between the crawl and the reprice (scripts/expire-listings.mjs), the
 * same move repricing made in PR #76. As a Vercel route it read ~36–42k active
 * listings in 1000-row pages and then issued one UPDATE per distinct ended_at —
 * millisecond-precision fetched_at, so one round-trip per listing — and was
 * killed at the 300s budget in 3 of 8 runs. The route survives as a thin
 * manual trigger over this module. The write is now one RPC per 1000 ids
 * (sab_end_listings), which resolves ended_at server-side.
 */

import { isRetryableReadError } from '@/lib/pricing/games/sab'
import { createServiceRoleClient } from '@/lib/supabase/service'

const PAGE_SIZE = 1000

/**
 * ROUTE-018: attempts per page / per write batch before giving up. Mirrors
 * PAGE_MAX_ATTEMPTS in src/lib/pricing/games/sab.ts (ROUTE-011): a deep page
 * over a large table intermittently exceeds its budget depending on cache
 * warmth, and a page that fails is very likely to succeed moments later. Before
 * this, a single unlucky page aborted the whole job and nothing was expired.
 */
const PAGE_MAX_ATTEMPTS = 4

const delay = (ms: number) => new Promise((done) => setTimeout(done, ms))

/**
 * A group's newest crawl must be at least this fresh before we draw any
 * conclusion from absence. Slightly over a day, so one late or skipped daily
 * run doesn't cause a wave of false endings.
 */
export const RECENT_CRAWL_HOURS = 36

/**
 * A listing must be this much older than its group's newest crawl to count as
 * missed. Absorbs within-run clock spread — a crawl of one Brainrot writes
 * `fetched_at` across many minutes, and without this the last listings written
 * in a run would look stale relative to the first.
 */
export const STALE_GRACE_HOURS = 2

const HOUR_MS = 60 * 60 * 1000

export type ActiveListing = {
  id: string
  source_id: string
  brainrot_id: string | null
  fetched_at: string
}

export type ExpiryPlan = {
  /** Listings the latest crawl of their group demonstrably missed. */
  ids: string[]
  groupsTotal: number
  groupsRecentlyCrawled: number
  groupsSkippedNotRecentlyCrawled: number
}

/** Thrown by runExpireSabListings so the route can name the failing stage. */
export class ExpireListingsError extends Error {
  constructor(
    readonly stage: 'read' | 'write',
    message: string,
    /** How many listings were already ended before the write failed. */
    readonly expired = 0,
  ) {
    super(message)
    this.name = 'ExpireListingsError'
  }
}

type ServiceClient = ReturnType<typeof createServiceRoleClient>

/**
 * Read every active listing, in bounded pages, with a STABLE order and a retry
 * per page.
 *
 * Why not read the materialized sab_market_evidence_display instead — the
 * obvious fix, and the wrong one. That snapshot is the *candidates* set: it
 * drops unmatched and low-confidence rows, bundles, account and inventory
 * listings, duplicates, outliers, non-USD rows, and anything priced below the
 * watchlist floor. Those rows are still listing_status='active' in the raw
 * table, so expiring only what survives that filter would leave them active
 * forever.
 *
 * Worse, it would corrupt the safety guard this job rests on. The per-group
 * newest crawl is a MAX over fetched_at and licenses every conclusion the job
 * draws. Computed from a filtered subset, a group whose newest crawl happened
 * to produce only filtered-out rows would report an older newest-crawl, and
 * the job would start declaring listings ended on the strength of a crawl it
 * never actually saw. The guard has to see exactly what the crawl wrote.
 *
 * The ORDER BY is not cosmetic. PostgREST .range() without one gives Postgres
 * no row-order guarantee across pages, so boundaries silently SKIP and
 * DUPLICATE rows, differently on every call (see selectAll in
 * src/lib/pricing/games/sab.ts). Here a skipped row is one never considered
 * for expiry, and a skipped row that carried a group's newest fetched_at drags
 * that group's max backwards and can expire listings that are in fact still
 * live. `id` is the primary key, so ordering by it makes every page a clean,
 * gap-free, duplicate-free slice.
 */
export async function readActiveListings(
  admin: ServiceClient,
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

/**
 * The decision, pure: which listings did the latest crawl of their group miss?
 *
 * Newest crawl per (source, Brainrot) is "when did we last look at this item",
 * which is the only thing that licenses an absence conclusion.
 */
export function planExpiries(listings: ActiveListing[], now: number): ExpiryPlan {
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

  const recencyFloor = now - RECENT_CRAWL_HOURS * HOUR_MS
  const staleGroups = new Set<string>()
  for (const [key, lastCrawl] of lastCrawlByGroup) {
    if (lastCrawl < recencyFloor) staleGroups.add(key)
  }

  const ids: string[] = []
  for (const listing of listings) {
    if (!listing.brainrot_id) continue

    const key = `${listing.source_id}|${listing.brainrot_id}`
    if (staleGroups.has(key)) continue

    const lastCrawl = lastCrawlByGroup.get(key)
    if (lastCrawl == null) continue

    const fetchedAt = Date.parse(listing.fetched_at)
    if (!Number.isFinite(fetchedAt)) continue

    if (fetchedAt < lastCrawl - STALE_GRACE_HOURS * HOUR_MS) ids.push(listing.id)
  }

  return {
    ids,
    groupsTotal: lastCrawlByGroup.size,
    groupsRecentlyCrawled: lastCrawlByGroup.size - staleGroups.size,
    groupsSkippedNotRecentlyCrawled: staleGroups.size,
  }
}

/**
 * End the planned listings, one RPC per batch, retrying transient failures.
 * The RPC re-asserts listing_status='active', so a replayed batch ends only
 * what is still active — an import that refreshed a listing between our read
 * and this write wins.
 */
async function endListings(admin: ServiceClient, ids: string[]): Promise<number> {
  let expired = 0

  for (let index = 0; index < ids.length; index += PAGE_SIZE) {
    const batch = ids.slice(index, index + PAGE_SIZE)
    let lastError: { message?: string; code?: string } | null = null
    let written: number | null = null

    for (let attempt = 1; attempt <= PAGE_MAX_ATTEMPTS; attempt += 1) {
      const { data, error } = await (admin as any).rpc('sab_end_listings', {
        p_ids: batch,
      })

      if (!error) {
        written = Number(data ?? 0)
        break
      }

      lastError = error
      if (!isRetryableReadError(error) || attempt === PAGE_MAX_ATTEMPTS) break

      console.warn(
        `sab_end_listings batch at ${index} failed (attempt ${attempt}/` +
          `${PAGE_MAX_ATTEMPTS}: ${error.message}) — retrying…`,
      )
      await delay(1000 * attempt)
    }

    if (written == null) {
      throw new ExpireListingsError(
        'write',
        lastError?.message ?? 'unknown write error',
        expired,
      )
    }

    expired += written
  }

  return expired
}

export type ExpireSummary = {
  success: true
  active_listings_scanned: number
  groups_total: number
  groups_recently_crawled: number
  groups_skipped_not_recently_crawled: number
  /** Listings the RPC actually ended (still-active ones only). */
  expired: number
  /** Listings the plan selected; differs from `expired` only if an import refreshed some mid-run. */
  planned: number
}

/** Read, decide, write. Throws ExpireListingsError naming the failing stage. */
export async function runExpireSabListings(
  admin: ServiceClient = createServiceRoleClient(),
  now: number = Date.now(),
): Promise<ExpireSummary> {
  let listings: ActiveListing[]
  try {
    listings = await readActiveListings(admin)
  } catch (error: any) {
    throw new ExpireListingsError('read', error?.message ?? String(error))
  }

  const plan = planExpiries(listings, now)
  const expired = await endListings(admin, plan.ids)

  console.log(
    `✅ SAB listing lifecycle: ${expired} expired across ` +
      `${plan.groupsRecentlyCrawled} freshly-crawled groups ` +
      `(${plan.groupsSkippedNotRecentlyCrawled} groups skipped as not recently crawled)`,
  )

  return {
    success: true,
    active_listings_scanned: listings.length,
    groups_total: plan.groupsTotal,
    groups_recently_crawled: plan.groupsRecentlyCrawled,
    groups_skipped_not_recently_crawled: plan.groupsSkippedNotRecentlyCrawled,
    expired,
    planned: plan.ids.length,
  }
}
