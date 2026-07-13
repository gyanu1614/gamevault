/**
 * Listing Detail Page
 *
 * Individual listing page with full details and Schema.org markup
 * SEO-friendly URL: /fortnite/accounts/rare-og-account-abc123 (no /marketplace prefix)
 */

import React from 'react'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getTemplateFields } from '@/lib/templates'
import ViewTracker from '@/components/listings/ViewTracker'
import ListingDetailClient, { type ListingForDetail } from './_ListingDetailClient'
import { listingToOffer as listingToItemOffer, loadItemsTaxonomy } from '../_itemsData'
import { partitionSameItem } from '../_offerMatching'
import type { ItemOffer, ItemsTaxonomy } from '../_itemsTypes'

// V15p — Empty taxonomy for ad-hoc ItemOffer shaping in the similar-
// offers carousel. The detail page doesn't need the filter chain, so we
// pass an empty one to the shaper. (The full taxonomy is only needed by
// the /items page filter UI.)
const EMPTY_ITEMS_TAXONOMY: ItemsTaxonomy = { filters: [], categories: [], mutations: [] }

interface PageProps {
  params: Promise<{
    gameSlug: string
    categorySlug: string
    listingSlug: string
  }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { gameSlug, categorySlug, listingSlug } = await params
  const supabase = await createClient()

  let { data: listing } = await supabase
    .from('listings')
    .select(`
      *,
      game:games!listings_game_id_fkey(name),
      category:categories!listings_category_id_fkey(name)
    `)
    .eq('slug', listingSlug)
    .single() as any

  if (!listing) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (uuidRegex.test(listingSlug)) {
      const result = await supabase
        .from('listings')
        .select(`
          *,
          game:games!listings_game_id_fkey(name),
          category:categories!listings_category_id_fkey(name)
        `)
        .eq('id', listingSlug)
        .single() as any
      listing = result.data
    }
  }

  if (!listing) {
    return { title: 'Listing Not Found' }
  }

  return {
    title: `${listing.title} | ${listing.game.name} ${listing.category.name}`,
    description: listing.description || `Buy ${listing.title} on DropMarket. Covered by SafeDrop Buyer Protection. Price: $${listing.price}`,
    keywords: [
      listing.game.name.toLowerCase(),
      listing.category.name.toLowerCase(),
      `buy ${listing.game.name.toLowerCase()}`,
      `${listing.game.name.toLowerCase()} for sale`
    ],
    openGraph: {
      title: listing.title,
      description: listing.description,
      images: listing.images || [],
      type: 'website'
    }
  }
}

async function getListing(listingSlug: string) {
  const supabase = await createClient()

  let { data: listing, error } = await supabase
    .from('listings')
    .select(`
      *,
      seller:profiles!listings_seller_id_fkey(*),
      game:games!listings_game_id_fkey(*),
      category:categories!listings_category_id_fkey(*)
    `)
    .eq('slug', listingSlug)
    .eq('status', 'active')
    .single() as any

  if (error || !listing) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (uuidRegex.test(listingSlug)) {
      const result = await supabase
        .from('listings')
        .select(`
          *,
          seller:profiles!listings_seller_id_fkey(*),
          game:games!listings_game_id_fkey(*),
          category:categories!listings_category_id_fkey(*)
        `)
        .eq('id', listingSlug)
        .eq('status', 'active')
        .single() as any

      listing = result.data
      error = result.error
    }
  }

  if (error || !listing) {
    return null
  }

  // Increment view count (fire and forget)
  ((supabase
    .from('listings') as any)
    .update({ views: (listing.views || 0) + 1 }))
    .eq('id', listing.id)
    .then()

  return listing
}

async function getSellerStats(sellerId: string) {
  const supabase = await createClient()

  const [
    { count: totalSales },
    { count: activeListings }
  ] = await Promise.all([
    supabase.from('orders').select('*', { count: 'exact', head: true })
      .eq('seller_id', sellerId)
      .eq('status', 'completed'),
    supabase.from('listings').select('*', { count: 'exact', head: true })
      .eq('seller_id', sellerId)
      .eq('status', 'active')
  ])

  return {
    totalSales: totalSales || 0,
    activeListings: activeListings || 0
  }
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
      avatarUrl: seller.avatar_url ?? null,
      verified:
        !!seller.is_verified ||
        (!!seller.seller_tier && seller.seller_tier !== 'unverified'),
      rating: Number(seller.seller_rating ?? 100),
      totalSales: Number(seller.total_sales ?? 0),
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
  const supabase = await createClient()
  let query: any = supabase
    .from('listings')
    .select(`
      id, slug, title, price, original_price, delivery_time, quantity,
      is_unlimited, description, images, template_data, status,
      seller:profiles!listings_seller_id_fkey(
        id, username, shop_name, avatar_url, seller_tier,
        seller_rating, total_sales, total_reviews, is_verified
      ),
      category:categories!listings_category_id_fkey(slug, name)
    `)
    .eq('status', 'active')
    .neq('id', excludeListingId)
    .order('updated_at', { ascending: false })
    .limit(limit)
  if (gameId) query = query.eq('game_id', gameId)
  if (categoryId) query = query.eq('category_id', categoryId)
  if (sellerId) query = query.eq('seller_id', sellerId)
  const { data } = await query
  return (data ?? []) as any[]
}

export default async function ListingDetailPage({ params }: PageProps) {
  const { gameSlug, categorySlug, listingSlug } = await params
  const listing = await getListing(listingSlug)

  if (!listing) notFound()

  const supabase = await createClient()
  const { data: { user: viewer } } = await supabase.auth.getUser()

  // V28 — Items-type categories get the same-item matching treatment
  // (Other Sellers). Accounts are one-of-a-kind and currency has its own
  // page type, so those keep the plain relevance carousel.
  const isItemsCategory =
    listing.category?.metadata?.type === 'items' ||
    listing.category?.slug === 'items'

  const [sellerStats, candidates, itemsTaxonomy] = await Promise.all([
    getSellerStats(listing.seller.id),
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

  // Schema.org structured data
  const schemaData = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: listing.title,
    description: listing.description,
    image: listing.images || [],
    offers: {
      '@type': 'Offer',
      url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://dropmarket.com'}/${gameSlug}/${categorySlug}/${listingSlug}`,
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
    category: listing.category.name,
    aggregateRating: listing.seller.rating ? {
      '@type': 'AggregateRating',
      ratingValue: listing.seller.rating || 5,
      reviewCount: sellerStats.totalSales
    } : undefined
  }


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
      avatarUrl: listing.seller.avatar_url ?? null,
      tier: listing.seller.seller_tier ?? null,
      verified:
        !!listing.seller.is_verified ||
        (!!listing.seller.seller_tier && listing.seller.seller_tier !== 'unverified'),
      rating: Number(listing.seller.seller_rating ?? 95),
      totalSales: sellerStats.totalSales,
      activeListings: sellerStats.activeListings,
      createdAt: listing.seller.created_at ?? null,
    },
  }

  return (
    <>
      <ViewTracker listingId={listing.id} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
      />

      {/* V29 — GameSubNav removed on the detail page: the in-page
          context row (game logo · Game › Category) already covers the
          back/up-level affordance, so the pill was pure vertical cost.
          Category pages keep it. */}
      <ListingDetailClient
        listing={shaped}
        viewerId={viewer?.id ?? null}
        templateFields={templateFields}
        similarOffers={similarOffers.map(shapeMini)}
        // V15p — Re-use the full ItemCard from the items page for the
        // Similar Offers carousel when the current listing belongs to an
        // items-type category. Same visual + interaction language as the
        // /items page, no drift between surfaces.
        similarOffersAsItems={
          isItemsCategory
            ? similarOffers.map((row) => listingToItemOffer(row, itemsTaxonomy))
            : null
        }
        // V28 — Cross-seller offers of THIS item (replaces "From the same
        // seller"). Tier-sorted server-side: exact-variant matches first
        // (cheapest→dearest), then same-item-different-variant.
        otherSellerOffers={
          otherSellerRows.length > 0
            ? otherSellerRows.map((r) => listingToItemOffer(r.listing as any, itemsTaxonomy))
            : null
        }
      />
    </>
  )
}
