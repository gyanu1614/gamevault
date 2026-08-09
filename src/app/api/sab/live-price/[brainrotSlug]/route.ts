/**
 * Live per-item price for a SAB brainrot's DEFAULT variant.
 *
 * Fetches the item's CURRENT Eldorado listings and runs the SAME reputable
 * engine the batch cron uses, so the item page can show a seconds-fresh price
 * instead of the up-to-an-hour-old stored correction. Degrades safely:
 *   - Eldorado slow / down / 403 / 429 → returns the stored correction
 *   - fewer than 2 reputable listings live → returns the stored correction
 *     (the batch value is deeper-sampled, so live can only match-or-freshen)
 * Never 500s, never blanks, never publishes an unvetted phantom.
 *
 * Freshness/rate-limit design:
 *   - unstable_cache keyed by slug, 60s TTL: the requests that reach this
 *     function make at most ~1 Eldorado call per slug per minute.
 *   - Cache-Control s-maxage=60, stale-while-revalidate=120: the CDN absorbs
 *     repeat viewers, so 50 viewers/min ≈ 1 upstream call.
 *   - Module-level circuit breaker: after an Eldorado block, skip the live path
 *     for 30s and serve stored — no retry storm against a rate limit.
 */

import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'

import { createServiceRoleClient } from '@/lib/supabase/service'
import { asNumber } from '@/lib/sab/format'
import { fetchItemListings } from '@/lib/sab/eldorado-live'
import { reputablePrice } from '@/lib/sab/reputable-pricing'

export const runtime = 'nodejs'
// This route is inherently dynamic (per-slug live fetch); its own caching is
// handled by unstable_cache + Cache-Control below.
export const dynamic = 'force-dynamic'

type PricePayload = {
  slug: string
  cheapestUsd: number | null
  marketUsd: number | null
  reputableCount: number | null
  source: 'live' | 'stored'
  fetchedAt: string
}

// Circuit breaker: after Eldorado blocks us, stop hitting it for a cooldown so a
// broad block degrades the whole site to stored prices instantly, cost-free.
let blockedUntil = 0
const BLOCK_COOLDOWN_MS = 30_000

/** The stored correction for a slug's default variant — the always-present
 * fallback. Reads the same corrected view the page itself uses. */
async function storedPrice(slug: string): Promise<{
  cheapestUsd: number | null
  marketUsd: number | null
  name: string | null
} | null> {
  const admin = createServiceRoleClient()
  const { data } = await (admin as any)
    .from('sab_public_price_catalog_corrected')
    .select('brainrot_name,cheapest_usd,average_usd,market_value_usd')
    .eq('brainrot_slug', slug)
    .eq('mutation_slug', 'default')
    .maybeSingle()
  if (!data) return null
  return {
    cheapestUsd: asNumber(data.cheapest_usd),
    marketUsd: asNumber(data.average_usd) ?? asNumber(data.market_value_usd),
    name: data.brainrot_name ?? null,
  }
}

/** Compute the live price for one slug, or null to signal "use stored". Wrapped
 * in unstable_cache by the handler so concurrent viewers share one fetch. */
async function computeLive(
  slug: string,
  name: string,
): Promise<{ cheapestUsd: number; marketUsd: number; reputableCount: number } | null> {
  if (Date.now() < blockedUntil) return null
  try {
    const listings = await fetchItemListings(slug, name, { timeoutMs: 2500 })
    const priced = reputablePrice(listings)
    if (!priced) return null // < 2 reputable → let the caller use stored
    return {
      cheapestUsd: priced.cheapestUsd,
      marketUsd: priced.averageUsd,
      reputableCount: priced.reputableCount,
    }
  } catch (error: any) {
    if (String(error?.message).startsWith('ELDORADO_BLOCKED')) {
      blockedUntil = Date.now() + BLOCK_COOLDOWN_MS
    }
    return null // any failure → stored
  }
}

export async function GET(
  _request: Request,
  { params }: { params: { brainrotSlug: string } },
) {
  const slug = String(params.brainrotSlug)

  const stored = await storedPrice(slug)
  // Unknown slug: nothing to show and nothing to fetch.
  if (!stored) {
    return NextResponse.json(
      { error: 'not_found' },
      { status: 404 },
    )
  }

  // Live compute, cached per-slug for 60s so repeat viewers share one call.
  const live = await unstable_cache(
    () => computeLive(slug, stored.name ?? slug),
    ['sab-live-price', slug],
    { revalidate: 60 },
  )()

  const payload: PricePayload = live
    ? {
        slug,
        cheapestUsd: live.cheapestUsd,
        marketUsd: live.marketUsd,
        reputableCount: live.reputableCount,
        source: 'live',
        fetchedAt: new Date().toISOString(),
      }
    : {
        slug,
        cheapestUsd: stored.cheapestUsd,
        marketUsd: stored.marketUsd,
        reputableCount: null,
        source: 'stored',
        fetchedAt: new Date().toISOString(),
      }

  return NextResponse.json(payload, {
    headers: {
      'Cache-Control':
        'public, s-maxage=60, stale-while-revalidate=120',
    },
  })
}
