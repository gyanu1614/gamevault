/**
 * /listings/[id] — legacy listing resolver.
 *
 * ROUTE-006. This route used to be a `'use client'` page that re-rendered the
 * whole listing detail UI. That had three problems:
 *
 *   1. No `generateMetadata`, so every listing inherited root metadata — no
 *      per-listing title, description, canonical or OG tags, unlike the
 *      canonical /[gameSlug]/[categorySlug]/[listingSlug] route.
 *   2. A missing listing rendered an in-body "Listing not found" card under
 *      HTTP 200 — a soft 404. Commit c8cb309 removed exactly this pattern from
 *      the marketplace tree; this route was never included.
 *   3. It is crawlable: /shop/[slug] sets `robots: { index: true }` and links
 *      here via SellerStorefront, so dead listings became indexable 200s.
 *
 * The codebase already treated it as superseded — [categorySlug]/page.tsx
 * calls it "the legacy /listings/{id} resolver page". So it now does exactly
 * that job and nothing more: resolve the id to the canonical slug URL and
 * permanently redirect, or 404 for real.
 *
 * Kept (not deleted) because the id-shaped URLs are already published — the
 * seller storefront, /browse cards and admin review links all point here — and
 * a 301 preserves them.
 */

import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import { cache } from 'react'

import { createClient } from '@/lib/supabase/server'
import { isUuid } from '@/lib/ids'

interface PageProps {
  params: Promise<{ id: string }>
}

/**
 * Resolve the id to the pieces needed to build the canonical URL.
 *
 * `cache()` so generateMetadata and the page body share one execution per
 * request, mirroring the canonical route's own resolver.
 *
 * No status filter: an inactive or sold listing still has a canonical home,
 * and that page owns the "this listing is gone" story (including the
 * owner/admin preview path, which RLS governs there). Sending the visitor on
 * is strictly better than a dead end here.
 */
const resolveListing = cache(async function resolveListing(id: string) {
  // Shape-check before touching the DB: a malformed id is a guaranteed miss,
  // and Postgres would reject it as a cast error rather than an empty result.
  if (!isUuid(id)) return null

  const supabase = await createClient()

  const { data } = (await supabase
    .from('listings')
    .select(
      `
      slug,
      game:games!listings_game_id_fkey(slug),
      category:categories!listings_category_id_fkey(slug)
    `,
    )
    .eq('id', id)
    .single()) as any

  const listingSlug: string | null = data?.slug ?? null
  const gameSlug: string | null = data?.game?.slug ?? null
  const categorySlug: string | null = data?.category?.slug ?? null

  // listings.slug is nullable (the DB has a partial index `WHERE slug IS NOT
  // NULL`), and a listing can outlive its game/category join. Without all
  // three there is no canonical URL to send anyone to.
  if (!listingSlug || !gameSlug || !categorySlug) return null

  return { gameSlug, categorySlug, listingSlug }
})

/**
 * This route only ever redirects or 404s, so it must never be indexed in its
 * own right — the canonical page carries the real metadata.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const resolved = await resolveListing(id)

  if (!resolved) {
    return { title: 'Listing Not Found', robots: { index: false, follow: false } }
  }

  const { gameSlug, categorySlug, listingSlug } = resolved
  return {
    robots: { index: false, follow: true },
    alternates: { canonical: `/${gameSlug}/${categorySlug}/${listingSlug}` },
  }
}

export default async function LegacyListingRedirect({ params }: PageProps) {
  const { id } = await params
  const resolved = await resolveListing(id)

  // A real 404 with a real status code — not a 200 with an error card.
  if (!resolved) notFound()

  const { gameSlug, categorySlug, listingSlug } = resolved
  permanentRedirect(`/${gameSlug}/${categorySlug}/${listingSlug}`)
}
