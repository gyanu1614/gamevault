/**
 * Public Seller Storefront
 *
 * Marketplace seller page: banner header (custom banner for Silver+, else
 * generated art) → stat strip → Offers (game / category / sort / search over
 * the shared ItemCard) · Reviews (rating breakdown + filter) · About.
 *
 * Static-first (CLAUDE.md): ISR, no cookie client, no searchParams. The rows
 * are read with the service role (seller_applications is RLS-protected) and
 * mapped HERE into slim, allowlisted shapes before they reach the client
 * component — no raw listing/review/order row is serialized. Viewer-specific
 * bits (own shop, online dot) are resolved in the browser.
 */

import { sellerDisplayName } from '@/lib/seller/identity'
import { PUBLIC_SELLER_PROFILE_SELECT, PUBLIC_REVIEW_SELECT } from '@/lib/shop/public-profile'
import { SITE_URL } from '@/config/site'
import React, { cache } from 'react'
import { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import SellerStorefront from '@/components/shop/SellerStorefront'
import { listingToOffer, type RawListing } from '@/app/(marketplace)/[gameSlug]/[categorySlug]/_itemsData'
import type { ItemsTaxonomy } from '@/app/(marketplace)/[gameSlug]/[categorySlug]/_itemsTypes'
import {
  anonymiseBuyer,
  avgStatedDeliveryLabel,
  ratingBreakdown,
  type StoreOffer,
  type StoreReview,
} from '@/lib/shop/storefront-model'
import { resolveStoreBanner } from '@/lib/shop/store-banner'

// Public page — use service role to bypass RLS on seller_applications
function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * STATE-004 — the seller profile, by shop_slug with a username fallback for
 * backward compatibility. generateMetadata and the page body both need it, and
 * each ran the primary + fallback pair separately (up to 4 profiles reads per
 * render). cache() makes the two runs of one request share a single lookup.
 */
const getSellerProfile = cache(async function getSellerProfile(slug: string) {
  const supabase = getServiceClient()

  const shopSlugQuery = await supabase
    .from('profiles')
    // AUTH-001 — explicit allowlist; this row is serialized to anonymous visitors.
    .select(PUBLIC_SELLER_PROFILE_SELECT)
    .eq('shop_slug', slug)
    .single()

  if (shopSlugQuery.data) return { profile: shopSlugQuery.data as any, error: null }

  // Fallback: try by username for backward compatibility
  const usernameQuery = await supabase
    .from('profiles')
    .select(PUBLIC_SELLER_PROFILE_SELECT)
    .eq('username', slug)
    .single()

  if (usernameQuery.data) return { profile: usernameQuery.data as any, error: null }

  return { profile: null, error: shopSlugQuery.error || usernameQuery.error }
})

interface PageProps {
  params: Promise<{
    slug: string
  }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const supabase = getServiceClient()

  // Fetch seller data for rich metadata — shared with the page body via cache().
  const { profile } = await getSellerProfile(slug)

  // Check if seller is approved
  const hasApprovedApplication = profile?.seller_applications?.some(
    (app: any) => app.status === 'approved'
  )

  if (!profile || !hasApprovedApplication) {
    return {
      title: 'Shop Not Found',
      description: 'The requested seller shop could not be found.'
    }
  }

  // Get seller stats
  const { count: totalSales } = await supabase
    .from('orders')
    .select('*', { count: 'exact' })
    .eq('seller_id', profile.id)
    .eq('status', 'completed').limit(1)

  const { data: ratingData } = await supabase
    .from('reviews')
    .select('rating')
    .eq('seller_id', profile.id)
    .eq('is_visible', true)

  const avgRating = ratingData && ratingData.length > 0
    ? (ratingData.reduce((sum, r) => sum + r.rating, 0) / ratingData.length).toFixed(1)
    : '0.0'

  const businessName = sellerDisplayName(profile) || profile.business_name
  const description = `Shop for gaming accounts, items, and services from ${businessName}. ${totalSales || 0} sales • ${avgRating}/5 rating • Trusted DropMarket seller.`

  // Always advertise the canonical slug, even when reached via the legacy
  // username URL — otherwise the two URLs self-declare as separate pages.
  const shopUrl = `${SITE_URL}/shop/${(profile.shop_slug || '').trim() || slug}`
  const { getAvatarUrl: getAvatar } = await import('@/lib/utils/avatar')
  const avatarUrl = getAvatar(profile.avatar_url, slug)

  return {
    title: `${businessName}'s Shop`,
    description: description.slice(0, 160), // Optimal length for SEO
    keywords: [
      businessName,
      slug,
      'gaming marketplace',
      'game accounts',
      'gaming services',
      'trusted seller',
      'DropMarket seller'
    ],
    authors: [{ name: businessName }],
    creator: businessName,
    publisher: 'DropMarket',

    // Open Graph
    openGraph: {
      type: 'profile',
      url: shopUrl,
      title: `${businessName} - Gaming Marketplace Seller`,
      description,
      siteName: 'DropMarket',
      images: [
        {
          url: avatarUrl,
          width: 400,
          height: 400,
          alt: `${businessName} profile picture`,
        }
      ],
      locale: 'en_US',
    },

    // Twitter Card
    twitter: {
      card: 'summary',
      title: `${businessName}'s Shop`,
      description: description.slice(0, 200),
      images: [avatarUrl],
      creator: '@dropmarket', // Update with your actual Twitter handle
    },

    // Additional meta tags
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },

    // Canonical URL
    alternates: {
      canonical: shopUrl,
    },
  }
}

// ISR Configuration - Revalidate every 60 seconds
export const revalidate = 60

/**
 * Seller storefronts are an open-ended, constantly growing set, so none are
 * prerendered at build time. Declaring generateStaticParams still opts the
 * route into ISR: each shop is rendered once on first request and then served
 * from the cache for the 60s window above, instead of on every request.
 */
export function generateStaticParams() {
  return []
}

export default async function SellerShopPage({ params }: PageProps) {
  const { slug } = await params
  const supabase = getServiceClient()

  const { profile, error } = await getSellerProfile(slug)

  // Check if seller is approved (has at least one approved application)
  const hasApprovedApplication = profile?.seller_applications?.some(
    (app: any) => app.status === 'approved'
  )

  if (error || !profile || !hasApprovedApplication) {
    notFound()
  }

  // Canonicalize the storefront URL. The lookup above still accepts a
  // username so old links and shared URLs keep working, but a shop with a
  // shop_slug has exactly ONE canonical address — otherwise every shop is
  // reachable at two URLs and Google splits the ranking signal between
  // them. 308 so the old link is not re-crawled indefinitely.
  const canonicalSlug = (profile.shop_slug || '').trim()
  if (canonicalSlug && canonicalSlug !== slug) {
    permanentRedirect(`/shop/${canonicalSlug}`)
  }

  const [listingsRes, reviewsRes, salesRes, ratingsRes, presenceRes] = await Promise.all([
    // Active offers — explicit columns only (the old `*` shipped moderation
    // notes and approver ids to the browser).
    supabase
      .from('listings')
      .select(
        `
        id, slug, title, price, original_price, delivery_time, quantity,
        is_unlimited, images, template_data, created_at, sales,
        game:games(id, name, slug),
        category:game_categories!listings_game_category_id_fkey(slug, name, type)
      `,
      )
      .eq('seller_id', profile.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(STORE_OFFER_LIMIT),
    // Latest visible reviews for the list (the breakdown uses every rating).
    supabase
      .from('reviews')
      .select(PUBLIC_REVIEW_SELECT)
      .eq('seller_id', profile.id)
      .eq('is_visible', true)
      .order('created_at', { ascending: false })
      .limit(STORE_REVIEW_LIMIT),
    supabase
      .from('orders')
      .select('id', { count: 'exact' })
      .eq('seller_id', profile.id)
      .eq('status', 'completed')
      .limit(1),
    supabase
      .from('reviews')
      .select('rating')
      .eq('seller_id', profile.id)
      .eq('is_visible', true),
    supabase
      .from('seller_presence')
      .select('store_paused')
      .eq('seller_id', profile.id)
      .maybeSingle(),
  ])

  const breakdown = ratingBreakdown(((ratingsRes.data ?? []) as { rating: number }[]).map((r) => r.rating))
  const totalSales = salesRes.count ?? 0

  // The card's seller block, from what this page already knows (the
  // allowlisted profile + the live review/sales figures).
  const cardSeller = {
    id: profile.id,
    username: profile.username,
    shop_name: profile.shop_name,
    shop_slug: profile.shop_slug,
    avatar_url: profile.avatar_url,
    seller_tier: profile.seller_tier,
    seller_rating: breakdown.average,
    total_reviews: breakdown.total,
    total_sales: totalSales,
    is_verified: profile.is_verified,
  }

  const rows = (listingsRes.data ?? []) as unknown as ShopListingRow[]
  const offers: StoreOffer[] = rows
    .filter((r) => r.game?.slug)
    .map((r) => {
      const offer = listingToOffer({ ...r, seller: cardSeller } as RawListing, EMPTY_TAXONOMY)
      const categoryName = r.category?.name?.trim() || 'Other'
      return {
        // Top line of the card: "Game · Category" (no per-game taxonomy here).
        offer: { ...offer, breadcrumb: [r.game!.name, categoryName] },
        game: { id: r.game!.id, slug: r.game!.slug, name: r.game!.name },
        category: { slug: r.category?.slug ?? 'other', name: categoryName, type: r.category?.type ?? null },
        createdAt: r.created_at,
        sales: Number(r.sales ?? 0) || 0,
      }
    })
    .filter((o) => Number.isFinite(o.offer.pricePerUnit) && o.offer.pricePerUnit > 0)

  const reviews: StoreReview[] = ((reviewsRes.data ?? []) as any[]).map((r) => ({
    id: r.id,
    rating: Number(r.rating) || 0,
    title: r.title ?? null,
    comment: r.comment ?? '',
    // Anonymised HERE so the full handle never reaches the browser.
    buyerLabel: anonymiseBuyer(r.buyer?.username),
    verifiedPurchase: r.is_verified_purchase === true,
    createdAt: r.created_at,
    gameName: r.game?.name ?? null,
    listingTitle: r.listing?.title ?? null,
    sellerResponse: r.seller_response ?? null,
  }))

  const sellerData = {
    profile,
    offers,
    reviews,
    breakdown,
    banner: resolveStoreBanner({ bannerUrl: profile.banner_url, tier: profile.seller_tier }),
    isPaused: (presenceRes.data as { store_paused?: boolean } | null)?.store_paused === true,
    stats: {
      totalSales,
      activeListings: offers.length,
      avgDelivery: avgStatedDeliveryLabel(rows.map((r) => r.delivery_time ?? null)),
    },
  }

  return <SellerStorefront seller={sellerData} />
}

/** Offers shown on one storefront (filtered + paged in the browser). */
const STORE_OFFER_LIMIT = 500
/** Reviews in the list; the breakdown counts every visible rating. */
const STORE_REVIEW_LIMIT = 100

/** No per-game attribute template on a cross-game page: the card falls back to its title + the breadcrumb set above. */
const EMPTY_TAXONOMY: ItemsTaxonomy = { filters: [], categories: [], mutations: [] }

interface ShopListingRow {
  id: string
  slug: string | null
  title: string
  price: number | null
  original_price: number | null
  delivery_time: string | null
  quantity: number | null
  is_unlimited: boolean | null
  images: string[] | null
  template_data: Record<string, unknown> | null
  created_at: string
  sales: number | null
  game: { id: string; name: string; slug: string } | null
  category: { slug: string | null; name: string | null; type: string | null } | null
}
