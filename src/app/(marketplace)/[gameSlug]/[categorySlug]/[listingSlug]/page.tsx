/**
 * Listing Detail Page
 *
 * Individual listing page with full details and Schema.org markup
 * SEO-friendly URL: /fortnite/accounts/rare-og-account-abc123 (no /marketplace prefix)
 */

import React from 'react'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  ArrowRight,
  Shield,
  Clock,
  Eye,
  Calendar,
  CheckCircle2,
  AlertCircle,
  MessageCircle,
  Share2
} from 'lucide-react'
import Image from 'next/image'
import VaultShieldBadge from '@/components/vaultshield/VaultShieldBadge'
import ProtectionLevelCard from '@/components/vaultshield/ProtectionLevelCard'
import PriceHistoryChart from '@/components/listings/PriceHistoryChart'
import StaticFieldDisplay from '@/components/listings/StaticFieldDisplay'
import { getTemplateFields } from '@/lib/templates'
import { ListingActionButtons } from '@/components/marketplace/listing-action-buttons'
import ViewTracker from '@/components/listings/ViewTracker'
import GameSubNav, { type GameCategory } from '@/components/marketplace/GameSubNav'
import RelatedListings from '@/components/marketplace/RelatedListings'

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
    .single()

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
        .single()
      listing = result.data
    }
  }

  if (!listing) {
    return { title: 'Listing Not Found | GameVault' }
  }

  return {
    title: `${listing.title} | ${listing.game.name} ${listing.category.name} | GameVault`,
    description: listing.description || `Buy ${listing.title} on GameVault. Secure transaction with VaultShield protection. Price: $${listing.price}`,
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
    .single()

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
        .single()

      listing = result.data
      error = result.error
    }
  }

  if (error || !listing) return null

  // Increment view count (fire and forget)
  supabase
    .from('listings')
    .update({ views: (listing.views || 0) + 1 })
    .eq('id', listing.id)
    .then()

  return listing
}

async function getAllGameCategories(gameId: string): Promise<GameCategory[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('categories')
    .select('id, name, slug')
    .eq('game_id', gameId)
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .order('name', { ascending: true })
  return (data || []) as GameCategory[]
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

export default async function ListingDetailPage({ params }: PageProps) {
  const { gameSlug, categorySlug, listingSlug } = await params
  const listing = await getListing(listingSlug)

  if (!listing) notFound()

  const [sellerStats, allCategories] = await Promise.all([
    getSellerStats(listing.seller.id),
    getAllGameCategories(listing.game.id),
  ])
  const templateFields = getTemplateFields(gameSlug, categorySlug)
  const vaultshieldLevel = listing.price >= 500 ? 'premium' : listing.price >= 100 ? 'enhanced' : 'standard'

  // Schema.org structured data
  const schemaData = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: listing.title,
    description: listing.description,
    image: listing.images || [],
    offers: {
      '@type': 'Offer',
      url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://gamevault.com'}/${gameSlug}/${categorySlug}/${listingSlug}`,
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

  return (
    <>
      <ViewTracker listingId={listing.id} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
      />

      <div className="min-h-screen bg-black">
        {/* ── Game Sub-Nav (same pill as category page) ─────────────────── */}
        <GameSubNav
          gameSlug={gameSlug}
          gameName={listing.game.name}
          gameImageUrl={(listing.game as any).image_url}
          currentCategorySlug={categorySlug}
          categories={allCategories}
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6">
            <Link href={`/${gameSlug}/${categorySlug}`} className="hover:text-white transition-colors">
              {listing.category.name}
            </Link>
            <ArrowRight className="w-3.5 h-3.5" />
            <span className="text-zinc-400 truncate max-w-[200px] sm:max-w-xs">{listing.title}</span>
          </nav>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Image Gallery */}
              <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl overflow-hidden">
                <div className="relative h-80 bg-gradient-to-br from-violet-500/20 to-blue-500/20">
                  {listing.images && listing.images[0] ? (
                    <Image
                      src={listing.images[0]}
                      alt={listing.title}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-7xl">
                      🎮
                    </div>
                  )}
                </div>

                {listing.images && listing.images.length > 1 && (
                  <div className="p-3 flex gap-2 overflow-x-auto">
                    {listing.images.slice(1).map((img: string, idx: number) => (
                      <div key={idx} className="relative w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden border border-white/[0.1] hover:border-violet-500/50 transition-colors cursor-pointer">
                        <Image src={img} alt={`${listing.title} ${idx + 2}`} fill className="object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Title & Meta */}
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
                      {listing.title}
                    </h1>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span className="flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5" />
                        {listing.views || 0} views
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(listing.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <button className="p-2 hover:bg-white/[0.05] rounded-lg transition-colors">
                    <Share2 className="w-4 h-4 text-gray-400" />
                  </button>
                </div>

                {listing.description && (
                  <div className="prose prose-invert max-w-none">
                    <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                      {listing.description}
                    </p>
                  </div>
                )}
              </div>

              {/* Quick Info Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white/[0.03] border border-white/[0.05] rounded-lg p-3">
                  <div className="text-xs text-gray-400 mb-1">Delivery</div>
                  <div className="text-sm font-medium text-white capitalize">{listing.delivery_method}</div>
                  {listing.delivery_time && (
                    <div className="text-xs text-gray-500 mt-0.5">{listing.delivery_time}</div>
                  )}
                </div>

                <div className="bg-white/[0.03] border border-white/[0.05] rounded-lg p-3">
                  <div className="text-xs text-gray-400 mb-1">Stock</div>
                  <div className="text-sm font-medium text-white">
                    {listing.is_unlimited ? 'Unlimited' : `${listing.quantity || 0} available`}
                  </div>
                </div>

                {listing.region && (
                  <div className="bg-white/[0.03] border border-white/[0.05] rounded-lg p-3">
                    <div className="text-xs text-gray-400 mb-1">Region</div>
                    <div className="text-sm font-medium text-white uppercase">{listing.region}</div>
                  </div>
                )}

                {listing.platform && (
                  <div className="bg-white/[0.03] border border-white/[0.05] rounded-lg p-3">
                    <div className="text-xs text-gray-400 mb-1">Platform</div>
                    <div className="text-sm font-medium text-white capitalize">{listing.platform}</div>
                  </div>
                )}
              </div>

              {/* Template Data */}
              {templateFields && listing.template_data && (
                <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-5">
                  <h2 className="text-lg font-semibold text-white mb-3">Details</h2>
                  <StaticFieldDisplay
                    fields={templateFields}
                    values={listing.template_data}
                  />
                </div>
              )}

              {/* Price History */}
              <PriceHistoryChart listingId={listing.id} days={30} />
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Purchase Card */}
              <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-5">
                <div className="mb-4">
                  <div className="text-xs text-gray-400 mb-1">Price</div>
                  <div className="text-3xl font-bold text-white">
                    ${listing.price.toFixed(2)}
                  </div>
                  {listing.original_price && listing.original_price > listing.price && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm text-gray-500 line-through">
                        ${listing.original_price.toFixed(2)}
                      </span>
                      <span className="text-xs font-semibold text-green-400 bg-green-400/10 px-2 py-0.5 rounded">
                        {Math.round(((listing.original_price - listing.price) / listing.original_price) * 100)}% OFF
                      </span>
                    </div>
                  )}
                </div>

                <VaultShieldBadge
                  level={vaultshieldLevel}
                  orderValue={listing.price}
                  showLabel={true}
                  showTooltip={false}
                  className="mb-4 w-full justify-center"
                />

                <ListingActionButtons
                  listingId={listing.id}
                  listingTitle={listing.title}
                  sellerId={listing.seller.id}
                  sellerUsername={listing.seller.username}
                  price={listing.price}
                  image={listing.images?.[0] || ''}
                  gameSlug={listing.game.slug}
                  categorySlug={listing.category.slug}
                  listingSlug={listing.slug}
                  quantity={listing.quantity}
                  isUnlimited={listing.is_unlimited}
                />

                <div className="mt-4 pt-4 border-t border-white/[0.05] space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Secure escrow payment</span>
                  </div>
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>48-hour buyer protection</span>
                  </div>
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Full refund guarantee</span>
                  </div>
                </div>
              </div>

              {/* Seller Card */}
              <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-5">
                <h3 className="text-sm font-semibold text-white mb-3">Seller</h3>
                <div className="flex items-center gap-3 mb-3">
                  {listing.seller.avatar_url ? (
                    <Image
                      src={listing.seller.avatar_url}
                      alt={listing.seller.username}
                      width={40}
                      height={40}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center text-violet-400 text-sm font-bold">
                      {listing.seller.username[0].toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-semibold text-white">
                      {listing.seller.username}
                    </div>
                    <div className="text-xs text-gray-400 capitalize">
                      {listing.seller.seller_tier} Seller
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="bg-white/[0.02] rounded-lg p-2.5 border border-white/[0.05]">
                    <div className="text-xl font-bold text-white">{sellerStats.totalSales}</div>
                    <div className="text-xs text-gray-400">Total Sales</div>
                  </div>
                  <div className="bg-white/[0.02] rounded-lg p-2.5 border border-white/[0.05]">
                    <div className="text-xl font-bold text-white">{sellerStats.activeListings}</div>
                    <div className="text-xs text-gray-400">Active Listings</div>
                  </div>
                </div>

                <Link
                  href={`/seller/${listing.seller.username}`}
                  className="block w-full py-2.5 bg-white/[0.05] hover:bg-white/[0.08] text-white text-center text-sm font-medium rounded-lg transition-colors"
                >
                  View Profile
                </Link>
              </div>

              {/* Protection Info */}
              <ProtectionLevelCard
                level={vaultshieldLevel}
                orderValue={listing.price}
                showDetails={true}
              />
            </div>
          </div>

          {/* Related Listings — full width below the grid */}
          <RelatedListings
            gameId={listing.game.id}
            categoryId={listing.category.id}
            currentListingId={listing.id}
            gameSlug={gameSlug}
            categorySlug={categorySlug}
          />
        </div>
      </div>
    </>
  )
}
