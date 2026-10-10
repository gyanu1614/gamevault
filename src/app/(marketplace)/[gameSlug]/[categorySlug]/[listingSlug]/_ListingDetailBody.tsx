/**
 * The listing detail body, shared by the public ISR page (./page.tsx, active
 * listings only) and the owner/admin preview (/listing-preview/[id], any
 * status, session client). It takes the listing row its route already read
 * and reads only PUBLIC data itself (seller stats, the two carousels) on the
 * tagged listing read clients, so on the cached page a listing mutation
 * refreshes them too (lib/listings/read-client).
 *
 * No viewer here: own-listing controls and the buy flow resolve the viewer in
 * the client (useAuth), so the public page is one cached HTML for everyone.
 */

import { sellerRatingPercent, sellerShopSlug } from '@/lib/seller/identity'
import { SITE_URL } from '@/config/site'
import { JsonLd, breadcrumbList, serializeJsonLd } from '@/lib/seo/jsonld'
import { getTemplateFields } from '@/lib/templates'
import ViewTracker from '@/components/listings/ViewTracker'
import ListingDetailClient, { type ListingForDetail } from './_ListingDetailClient'
import { BlogRail } from '@/components/blog/BlogRail'
import { listingToOffer as listingToItemOffer, loadItemsTaxonomy } from '../_itemsData'
import { partitionSameItem } from '../_offerMatching'
import type { ItemsTaxonomy } from '../_itemsTypes'
import {
  createCategoryListingsReadClient,
  createHomeListingsReadClient,
} from '@/lib/listings/read-client'

// V15p — Empty taxonomy for ad-hoc ItemOffer shaping in the similar-
// offers carousel. The detail page doesn't need the filter chain, so we
// pass an empty one to the shaper. (The full taxonomy is only needed by
// the /items page filter UI.)
const EMPTY_ITEMS_TAXONOMY: ItemsTaxonomy = { filters: [], categories: [], mutations: [] }

/** The listings row the body renders, as both routes read it. */
export const LISTING_DETAIL_SELECT = `
  *,
  seller:public_profiles!listings_seller_id_fkey(*),
  game:games!listings_game_id_fkey(*),
  category:game_categories!listings_game_category_id_fkey(*)
`

/**
 * Seller stats for the rail. `total_sales` comes from public_profiles (the
 * counter every listing card shows) — this is a public page, so its client
 * cannot read `orders`, and a count there silently returned 0 for every
 * seller (2026-09-28: a seller with a completed sale showed "0 sold" here
 * and "1" on the card). Only the active-listings count is queried.
 */
async function getSellerStats(sellerId: string, gameCategoryId: string) {
  // Tagged with this listing's category: a mutation there refreshes it; the
  // seller's other categories catch up within the 24 h window.
  const supabase = createCategoryListingsReadClient([gameCategoryId])
  const { count: activeListings } = await supabase
    .from('listings')
    .select('id', { count: 'exact' })
    .eq('seller_id', sellerId)
    .eq('status', 'active')
    .limit(1)
  return { activeListings: activeListings || 0 }
}

/**
 * V15k — Shape a raw listings row into the compact `MiniListing` the
 * detail-page carousels consume.
 */
function shapeMini(row: any) {
  const seller = row.seller ?? {}
  return {
    id: row.id as string,
    slug: (row.slug && String(row.slug).trim()) || row.id,
    title: row.title as string,
    price: Number(row.price ?? 0),
    image: Array.isArray(row.images) && row.images.length > 0 ? (row.images[0] as string) : null,
    seller: {
      username: seller.username ?? 'seller',
      shopName: seller.shop_name ?? null,
      shopSlug: sellerShopSlug(seller),
      avatarUrl: seller.avatar_url ?? null,
      verified: !!seller.is_verified,
      ratingPercent: sellerRatingPercent(seller),
      totalSales: Number(seller.total_sales ?? 0),
      reviewCount: Number(seller.total_reviews ?? 0),
      tier: seller.seller_tier ?? null,
    },
    categorySlug: row.category?.slug ?? 'items',
  }
}

/**
 * V15k — Carousel listing card row. Selects N active listings for a
 * given filter (same seller, same category) in a single query.
 */
async function getCarouselListings({
  gameId,
  categoryId,
  sellerId,
  excludeListingId,
  limit = 8,
}: {
  gameId?: string
  categoryId?: string
  sellerId?: string
  excludeListingId: string
  limit?: number
}) {
  // Same-category pools carry that category's tag; the game-wide top-up
  // spans categories, so it carries the tag every listing mutation fires.
  const supabase = categoryId
    ? createCategoryListingsReadClient([categoryId])
    : createHomeListingsReadClient()
  let query: any = supabase
    .from('listings')
    .select(`
      id, slug, title, price, original_price, delivery_time, quantity,
      is_unlimited, description, images, template_data, status,
      seller:public_profiles!listings_seller_id_fkey(
        id, username, shop_name, shop_slug, avatar_url, seller_tier,
        seller_rating, total_sales, total_reviews, is_verified
      ),
      category:game_categories!listings_game_category_id_fkey(slug, name)
    `)
    .eq('status', 'active')
    .neq('id', excludeListingId)
    .order('updated_at', { ascending: false })
    .limit(limit)
  if (gameId) query = query.eq('game_id', gameId)
  if (categoryId) query = query.eq('game_category_id', categoryId)
  if (sellerId) query = query.eq('seller_id', sellerId)
  const { data } = await query
  return (data ?? []) as any[]
}

export async function ListingDetailBody({
  listing,
  isPreview,
  gameSlug,
  categorySlug,
}: {
  /** The listings row with seller (public_profiles *), game (*), category (*). */
  listing: any
  /** Owner/admin preview of a non-active listing (preview route only). */
  isPreview: boolean
  /** URL segments the template fields are keyed by. */
  gameSlug: string
  categorySlug: string
}) {
  // V28 — Items-type categories get the same-item matching treatment
  // (Other Sellers). Accounts are one-of-a-kind and currency has its own
  // page type, so those keep the plain relevance carousel.
  const isItemsCategory =
    listing.category?.type === 'items' ||
    listing.category?.slug === 'items'

  const [sellerStats, candidates, itemsTaxonomy] = await Promise.all([
    getSellerStats(listing.seller.id, listing.category.id),
    // One wide candidate pool (same game + category); partitioned below
    // into same-item offers vs related listings.
    getCarouselListings({
      gameId: listing.game.id,
      categoryId: listing.category.id,
      excludeListingId: listing.id,
      limit: 40,
    }),
    // Real taxonomy (admin attribute template) so ItemOffer breadcrumbs /
    // mutation chips resolve to their proper labels in the carousels and
    // the Other Sellers preview.
    isItemsCategory
      ? loadItemsTaxonomy(listing.game.id, 'items')
      : Promise.resolve(EMPTY_ITEMS_TAXONOMY),
  ])
  const templateFields = getTemplateFields(gameSlug, categorySlug) ?? null

  // V28 — Partition candidates: cross-seller offers of THIS item (tiered:
  // exact variant first, then same item with a different rarity/mutation)
  // vs merely-related listings for the Similar carousel.
  const { sameItem, related } = isItemsCategory
    ? partitionSameItem(
        { id: listing.id, title: listing.title, template_data: listing.template_data },
        candidates as Array<{ id: string; title: string; template_data: Record<string, unknown> | null }>,
      )
    : { sameItem: [], related: candidates }

  // Within each tier, cheapest first — it's a price-comparison surface.
  const otherSellerRows = [...sameItem]
    .sort((a, b) => a.tier - b.tier || Number((a.listing as any).price ?? 0) - Number((b.listing as any).price ?? 0))
    .slice(0, 8)
  let similarOffers = related.slice(0, 12)

  // V28 — Young-marketplace fallback: when the same-category pool is thin
  // (few sellers yet), top the Similar carousel up with listings from the
  // REST of the game so the section never runs empty. Only costs an extra
  // query when actually needed.
  if (similarOffers.length < 4) {
    const gameWide = await getCarouselListings({
      gameId: listing.game.id,
      excludeListingId: listing.id,
      limit: 12,
    })
    const seen = new Set([
      ...similarOffers.map((r: any) => r.id),
      ...otherSellerRows.map((r) => (r.listing as any).id),
    ])
    for (const row of gameWide) {
      if (similarOffers.length >= 12) break
      if (seen.has(row.id)) continue
      seen.add(row.id)
      similarOffers.push(row)
    }
  }

  // Card offers for the two carousels (items-type categories only for the
  // similar row).
  const similarItems = isItemsCategory
    ? similarOffers.map((row) => listingToItemOffer(row, itemsTaxonomy))
    : null
  const otherSellerItems = otherSellerRows.length > 0
    ? otherSellerRows.map((r) => listingToItemOffer(r.listing as any, itemsTaxonomy))
    : null

  // Canonical path from the DB slugs (URL params may be aliases).
  const canonicalPath = `/${listing.game.slug}/${listing.category.slug}/${listing.slug || listing.id}`

  // Schema.org structured data — outcome language only, no fabricated
  // ratings (removed the seller-rating-as-product-rating block; product
  // reviews don't exist yet, so no aggregateRating is the honest markup).
  const schemaData = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: listing.title,
    description:
      listing.description ||
      `Buy ${listing.title} on DropMarket. Get what you ordered, or your money back with SafeDrop Protection.`,
    image: listing.images || [],
    offers: {
      '@type': 'Offer',
      url: `${SITE_URL}${canonicalPath}`,
      priceCurrency: 'USD',
      price: listing.price,
      availability: 'https://schema.org/InStock',
      seller: {
        '@type': 'Person',
        name: listing.seller.username
      }
    },
    brand: {
      '@type': 'Brand',
      name: listing.game.name
    },
    category: listing.category.name
  }

  // BreadcrumbList — Home › Game › Category › Listing.
  const breadcrumbData = breadcrumbList([
    { name: 'Home', path: '/' },
    { name: listing.game.name, path: `/${listing.game.slug}` },
    { name: listing.category.name, path: `/${listing.game.slug}/${listing.category.slug}` },
    { name: listing.title, path: canonicalPath },
  ])


  // V15i — Shape the raw row into the ListingForDetail contract.
  const shaped: ListingForDetail = {
    id: listing.id,
    slug: listing.slug,
    title: listing.title,
    description: listing.description ?? null,
    price: Number(listing.price ?? 0),
    originalPrice: listing.original_price != null ? Number(listing.original_price) : null,
    images: Array.isArray(listing.images) ? listing.images : [],
    views: Number(listing.views ?? 0),
    createdAt: listing.created_at,
    quantity: listing.quantity ?? null,
    isUnlimited: !!listing.is_unlimited,
    deliveryMethod: listing.delivery_method ?? null,
    deliveryTime: listing.delivery_time ?? null,
    region: listing.region ?? null,
    platform: listing.platform ?? null,
    templateData: listing.template_data ?? null,
    gameSlug: listing.game.slug,
    gameName: listing.game.name,
    gameImageUrl: (listing.game as any).image_url ?? null,
    categorySlug: listing.category.slug,
    categoryName: listing.category.name,
    seller: {
      id: listing.seller.id,
      username: listing.seller.username,
      shopName: listing.seller.shop_name ?? null,
      shopSlug: sellerShopSlug(listing.seller),
      avatarUrl: listing.seller.avatar_url ?? null,
      tier: listing.seller.seller_tier ?? null,
      verified: !!listing.seller.is_verified,
      // Null when the seller has no reviews — the UI shows no rating
      // rather than a fabricated 95%. Same rule checkout already used.
      ratingPercent: sellerRatingPercent(listing.seller),
      totalSales: Number(listing.seller.total_sales ?? 0),
      activeListings: sellerStats.activeListings,
      createdAt: listing.seller.created_at ?? null,
      reviewCount: Number(listing.seller.total_reviews ?? 0),
    },
  }

  return (
    <>
      {!isPreview && <ViewTracker listingId={listing.id} />}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(schemaData) }}
      />
      <JsonLd data={breadcrumbData} />

      {/* V29 — GameSubNav removed on the detail page: the in-page
          context row (game logo · Game › Category) already covers the
          back/up-level affordance, so the pill was pure vertical cost.
          Category pages keep it. */}
      <ListingDetailClient
        listing={shaped}
        blogRail={<BlogRail gameSlug={shaped.gameSlug} gameName={shaped.gameName} />}
        // Owner/admin preview of a non-active listing: amber banner +
        // purchase disabled (buying would bypass moderation).
        previewStatus={isPreview ? (listing.status as string) : null}
        templateFields={templateFields}
        similarOffers={similarOffers.map(shapeMini)}
        // V15p — Re-use the full ItemCard from the items page for the
        // Similar Offers carousel when the current listing belongs to an
        // items-type category. Same visual + interaction language as the
        // /items page, no drift between surfaces.
        similarOffersAsItems={similarItems}
        // V28 — Cross-seller offers of THIS item (replaces "From the same
        // seller"). Tier-sorted server-side: exact-variant matches first
        // (cheapest→dearest), then same-item-different-variant.
        otherSellerOffers={otherSellerItems}
      />
    </>
  )
}

