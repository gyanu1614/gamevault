/**
 * Listing Detail Page — /fortnite/accounts/rare-og-account-abc123
 *
 * Static-first (ISR) since 2026-10-09 (Supabase usage cut). It used to read
 * the session (cookie client + auth.getUser) on every hit, so each visit —
 * people and crawlers alike — cost a full render and ~8–10 database reads.
 * Now:
 *   - public reads only, on the tagged listing read clients: a listing
 *     mutation (revalidateListingSurfaces → `listings:category:<id>`) refreshes
 *     the page and its data; 24 h is the safety net;
 *   - ACTIVE listings only. The owner/admin preview of a pending, rejected or
 *     paused listing lives at /listing-preview/[id] (session client, never
 *     cached); /listings/[id] and the seller/admin links send them there;
 *   - the viewer (own-listing controls, buy flow) is resolved in the client.
 * Rendered on first request and cached (generateStaticParams → []), like the
 * value item pages; listings are noindex, so none are prerendered at build.
 */

import { listingMeta } from '@/lib/seo/listing-meta'
import { Suspense, cache } from 'react'
import { GameHeroBackdrop } from '@/components/marketplace/GameHeroBackdrop'
import { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import ListingDetailSkeleton from './_ListingDetailSkeleton'
import { LISTING_DETAIL_SELECT, ListingDetailBody } from './_ListingDetailBody'
import { getActiveGame, getEnabledCategory } from '../_routeGate'
import {
  createCategoryListingsReadClient,
  createHomeListingsReadClient,
} from '@/lib/listings/read-client'
import { currencyListingRedirect, isCurrencyCategoryType } from '@/lib/listings/url'
import { seoMeta } from '@/lib/seo/fit'

export const revalidate = 86400

export async function generateStaticParams() {
  return []
}

interface PageProps {
  params: Promise<{
    gameSlug: string
    categorySlug: string
    listingSlug: string
  }>
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Currency listings have no single-listing page (owner, 2026-10-04): their
 * URL 308s to the game's currency page with that seller's offer pinned
 * (`?seller=&offer=`, read client-side by the currency page). Decided from the
 * URL's (game, category) pair — two cached anon reads shared with the category
 * route gate — BEFORE any heavy read, and in both
 * generateMetadata and the route so the redirect lands before the shell
 * streams (a real 308, not a client hop). Item/account listings fall through
 * unchanged. A dead currency listing still redirects, to the plain page.
 */
const resolveCurrencyRedirect = cache(async function resolveCurrencyRedirect(
  gameSlug: string,
  categorySlug: string,
  listingSlug: string,
): Promise<string | null> {
  const game = await getActiveGame(gameSlug)
  if (!game) return null
  const category = await getEnabledCategory(game.id, categorySlug)
  if (!category || !isCurrencyCategoryType(category.type)) return null

  // Tagged with the category so a listing mutation (status, seller rename)
  // refreshes it (lib/listings/read-client).
  const supabase = createCategoryListingsReadClient([category.id])
  const SELECT = 'id, seller:public_profiles!listings_seller_id_fkey(username, shop_slug)'
  const scoped = (column: 'slug' | 'id', value: string) =>
    supabase
      .from('listings')
      .select(SELECT)
      .eq(column, value)
      .eq('game_category_id', category.id)
      .eq('status', 'active')
      .maybeSingle()
  let { data: listing } = (await scoped('slug', listingSlug)) as { data: any }
  if (!listing && UUID_RE.test(listingSlug)) {
    listing = ((await scoped('id', listingSlug)) as { data: any }).data
  }

  return currencyListingRedirect({
    gameSlug,
    category: { slug: category.slug, type: category.type },
    listing: listing ? { id: listing.id, seller: listing.seller ?? null } : null,
  })
})

type PublicListing =
  | { kind: 'listing'; listing: any }
  | { kind: 'redirect'; href: string }
  | null

/**
 * The ACTIVE listing at this URL, or where it really lives, or null (404).
 *
 *   1. The URL's own (game, category): one read, tagged with that category.
 *   2. Otherwise the listing by slug (or id) anywhere — tagged with the tag
 *      every listing mutation fires, so a cached 404 clears when it goes live.
 *      A listing whose canonical URL differs (alias segment, id instead of
 *      slug) 308s there; one whose game/category is not live renders here, as
 *      it always has (a game the public cannot see at all is a 404).
 *
 * `cache()` shares it between generateMetadata, the route gate and the body.
 */
const getPublicListing = cache(async function getPublicListing(
  gameSlug: string,
  categorySlug: string,
  listingSlug: string,
): Promise<PublicListing> {
  const byId = UUID_RE.test(listingSlug)

  const game = await getActiveGame(gameSlug)
  const category = game ? await getEnabledCategory(game.id, categorySlug) : null
  if (category) {
    const supabase = createCategoryListingsReadClient([category.id])
    const inCategory = (column: 'slug' | 'id') =>
      supabase
        .from('listings')
        .select(LISTING_DETAIL_SELECT)
        .eq(column, listingSlug)
        .eq('game_category_id', category.id)
        .eq('status', 'active')
        .maybeSingle()
    let { data } = (await inCategory('slug')) as { data: any }
    if (!data && byId) data = ((await inCategory('id')) as { data: any }).data
    if (data) return { kind: 'listing', listing: data }
  }

  const anywhere = createHomeListingsReadClient()
  const anyCategory = (column: 'slug' | 'id') =>
    anywhere
      .from('listings')
      .select(LISTING_DETAIL_SELECT)
      .eq(column, listingSlug)
      .eq('status', 'active')
      .maybeSingle()
  let { data: listing } = (await anyCategory('slug')) as { data: any }
  if (!listing && byId) listing = ((await anyCategory('id')) as { data: any }).data
  // A game or category the public cannot read (RLS hides inactive games) has
  // nothing to render the page with: 404, not a crash in the body.
  if (!listing?.game?.slug || !listing.category?.slug) return null

  const canonical = `/${listing.game.slug}/${listing.category.slug}/${listing.slug || listing.id}`
  if (canonical !== `/${gameSlug}/${categorySlug}/${listingSlug}`) {
    return { kind: 'redirect', href: canonical }
  }
  return { kind: 'listing', listing }
})

/**
 * Redirects (currency → currency page, alias → canonical) and the 404 are
 * decided here as well as in the route: metadata resolves before the shell
 * flushes, so this is what makes them a real 308 / 404 (not a 200 with a
 * "not found" body inside the Suspense boundary).
 */
async function resolveOrExit(params: PageProps['params']) {
  const { gameSlug, categorySlug, listingSlug } = await params
  const currencyTarget = await resolveCurrencyRedirect(gameSlug, categorySlug, listingSlug)
  if (currencyTarget) permanentRedirect(currencyTarget)
  const result = await getPublicListing(gameSlug, categorySlug, listingSlug)
  if (!result) notFound()
  if (result.kind === 'redirect') permanentRedirect(result.href)
  return { gameSlug, categorySlug, listing: result.listing }
}

async function generateMetadataRaw({ params }: PageProps): Promise<Metadata> {
  const { listing } = await resolveOrExit(params)

  // Seller text cleaned for the results snippet (lib/seo/listing-meta).
  const meta = listingMeta({
    title: listing.title,
    description: listing.description,
    price: listing.price,
    gameName: listing.game.name,
    categoryName: listing.category.name,
  })

  return {
    // Listings are never indexed (owner, 2026-10-06, after the competitor
    // audit: GameBoost and iGitems noindex seller listings). They are short-
    // lived and seller-written; the indexed category page shows them. `follow`
    // keeps their links (seller shop, category, game) crawlable. A test-seller
    // listing also drops follow. (Only active listings render here.)
    robots: listing.seller?.is_test
      ? { index: false, follow: false }
      : { index: false, follow: true },
    // Root template appends " | DropMarket".
    title: meta.title,
    description: meta.description,
    keywords: [
      listing.game.name.toLowerCase(),
      listing.category.name.toLowerCase(),
      `buy ${listing.game.name.toLowerCase()}`,
      `${listing.game.name.toLowerCase()} for sale`
    ],
    openGraph: {
      title: meta.title,
      description: meta.description,
      images: listing.images || [],
      type: 'website'
    }
  }
}

/**
 * Route gate — decides 308 / 404 BEFORE any HTML streams (the status code is
 * fixed when the shell flushes), then the body renders inside Suspense with
 * the skeleton as its fallback.
 */
export default async function ListingDetailRoute({ params }: PageProps) {
  const { gameSlug, categorySlug, listing } = await resolveOrExit(params)

  return (
    <GameHeroBackdrop gameSlug={gameSlug} size="market">
      <Suspense fallback={<ListingDetailSkeleton />}>
        <ListingDetailBody
          listing={listing}
          isPreview={false}
          gameSlug={gameSlug}
          categorySlug={categorySlug}
        />
      </Suspense>
    </GameHeroBackdrop>
  )
}

/** Search-length rules (title ≤ 60, description ≤ 155) — see src/lib/seo/fit.ts. */
export async function generateMetadata(
  ...args: Parameters<typeof generateMetadataRaw>
): Promise<Metadata> {
  return seoMeta(await generateMetadataRaw(...args))
}
