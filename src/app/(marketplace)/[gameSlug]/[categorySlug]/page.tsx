/**
 * Category Browse Page — /{gameSlug}/{categorySlug}
 *
 * Layout: sticky GameSubNav → centered header → CategoryPageLayout (filter toggle)
 * Apple/Spotify-inspired minimal dark theme with game vibe.
 */

import React, { Suspense } from 'react'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import Image from 'next/image'
import VaultShieldBadge from '@/components/vaultshield/VaultShieldBadge'
import PresenceIndicator from '@/components/presence/PresenceIndicator'
import CategoryPills from '@/components/marketplace/CategoryPills'
import GameSubNav, { type GameCategory } from '@/components/marketplace/GameSubNav'
import CategoryPageLayout from '@/components/marketplace/CategoryPageLayout'
import { buildSynonymSearchQuery } from '@/lib/utils/gaming-synonyms'
import { ChevronLeft } from 'lucide-react'

interface PageProps {
  params: Promise<{
    gameSlug: string
    categorySlug: string
  }>
  searchParams: Promise<{
    sort?: string
    minPrice?: string
    maxPrice?: string
    search?: string
    tiers?: string
    delivery?: string
    online?: string
    page?: string
    type?: string
  }>
}

// ─── SEO ───────────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { gameSlug, categorySlug } = await params
  const supabase = await createClient()

  const { data: game } = await supabase
    .from('games')
    .select('name, id')
    .eq('slug', gameSlug)
    .single() as any

  if (!game) return { title: 'Not Found | GameVault' }

  const { data: category } = await supabase
    .from('categories')
    .select('name')
    .eq('slug', categorySlug)
    .eq('game_id', game.id)
    .single() as any

  if (!category) return { title: 'Not Found | GameVault' }

  return {
    title: `${game.name} ${category.name} for Sale | GameVault`,
    description: `Browse verified ${game.name} ${category.name.toLowerCase()} listings. Secure transactions with VaultShield escrow. Instant delivery guaranteed.`,
    keywords: [
      `${game.name.toLowerCase()} ${category.name.toLowerCase()}`,
      `buy ${game.name.toLowerCase()} ${category.name.toLowerCase()}`,
      `cheap ${game.name.toLowerCase()} ${category.name.toLowerCase()}`,
      `${game.name.toLowerCase()} marketplace`,
    ],
    openGraph: {
      title: `${game.name} ${category.name} - GameVault`,
      description: `Buy and sell ${game.name} ${category.name.toLowerCase()} safely`,
      type: 'website',
    },
  }
}

// ─── Data fetching ─────────────────────────────────────────────────────────────

async function getGameAndCategory(gameSlug: string, categorySlug: string) {
  const supabase = await createClient()

  const gameResult = await supabase
    .from('games')
    .select('*')
    .eq('slug', gameSlug)
    .eq('is_active', true)
    .single() as any

  if (gameResult.error || !gameResult.data) return null

  const categoryResult = await supabase
    .from('categories')
    .select('*')
    .eq('slug', categorySlug)
    .eq('game_id', gameResult.data.id)
    .eq('is_active', true)
    .single() as any

  if (categoryResult.error || !categoryResult.data) return null

  return { game: gameResult.data, category: categoryResult.data }
}

async function getAllGameCategories(gameId: string): Promise<GameCategory[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('categories')
    .select('id, name, slug')
    .eq('game_id', gameId)
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .order('name', { ascending: true }) as any
  return (data || []) as GameCategory[]
}

async function getListings(
  gameId: string,
  categoryId: string,
  searchParams: Awaited<PageProps['searchParams']>
) {
  const supabase = await createClient()
  const LISTINGS_PER_PAGE = 12
  const currentPage = parseInt(searchParams.page || '1', 10)

  let query: any = supabase
    .from('listings')
    .select(`
      *,
      seller:profiles!listings_seller_id_fkey(
        id, username, seller_tier, avatar_url,
        presence:seller_presence(is_online, last_seen_at)
      ),
      game:games!listings_game_id_fkey(name, slug),
      category:categories!listings_category_id_fkey(name, slug)
    `)
    .eq('game_id', gameId)
    .eq('category_id', categoryId)
    .eq('status', 'active')

  if (searchParams.minPrice) query = query.gte('price', parseFloat(searchParams.minPrice))
  if (searchParams.maxPrice) query = query.lte('price', parseFloat(searchParams.maxPrice))
  if (searchParams.search) {
    const synonymQuery = buildSynonymSearchQuery(searchParams.search)
    query = query.or(synonymQuery)
  }
  if (searchParams.type) {
    const typeLabel = searchParams.type.replace(/-/g, ' ')
    query = query.ilike('title', `%${typeLabel}%`)
  }
  if (searchParams.delivery) {
    query = query.in('delivery_time', searchParams.delivery.split(','))
  }

  switch (searchParams.sort) {
    case 'price_low':  query = query.order('price', { ascending: true }); break
    case 'price_high': query = query.order('price', { ascending: false }); break
    case 'popular':    query = query.order('view_count', { ascending: false }); break
    default:           query = query.order('created_at', { ascending: false })
  }

  const { data: listings, error } = await query
  if (error) return { listings: [], hasMore: false, currentPage: 1, totalListings: 0 }

  let filtered = listings || []
  if (searchParams.tiers) {
    const tiers = searchParams.tiers.split(',')
    filtered = filtered.filter((l: any) => tiers.includes(l.seller?.seller_tier))
  }
  if (searchParams.online === 'true') {
    filtered = filtered.filter((l: any) => l.seller?.presence?.is_online === true)
  }

  const totalListings = filtered.length
  const endIndex = currentPage * LISTINGS_PER_PAGE
  const paginatedListings = filtered.slice(0, endIndex)
  const hasMore = endIndex < totalListings

  return { listings: paginatedListings, hasMore, currentPage, totalListings }
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function CategoryBrowsePage({ params, searchParams }: PageProps) {
  const { gameSlug, categorySlug } = await params
  const resolvedSearchParams = await searchParams

  const data = await getGameAndCategory(gameSlug, categorySlug)
  if (!data) notFound()

  const { game, category } = data

  const [allCategories, listingsData] = await Promise.all([
    getAllGameCategories(game.id),
    getListings(game.id, category.id, resolvedSearchParams),
  ])

  const { listings, hasMore, currentPage, totalListings } = listingsData

  const maxPrice = listings.length > 0
    ? Math.max(...listings.map((l: any) => l.price))
    : 1000

  const subTypes = ((category as any).metadata?.sub_types as string[]) || []
  const activeType = resolvedSearchParams.type || null

  return (
    <div className="min-h-screen bg-black">
      {/* ── Game Sub-Nav ─────────────────────────────────────────────── */}
      <GameSubNav
        gameSlug={gameSlug}
        gameName={game.name}
        gameImageUrl={(game as any).image_url}
        currentCategorySlug={categorySlug}
        categories={allCategories}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ── Centered header ──────────────────────────────────────────── */}
        <div className="pt-2 sm:pt-3 pb-10 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white">
            {game.name}{' '}
            <span className="text-zinc-300">{category.name}</span>
          </h1>
          <p className="mt-3 text-base text-zinc-500 max-w-xl mx-auto">
            {(category as any).description ||
              `Browse verified ${category.name.toLowerCase()} listings for ${game.name}`}
          </p>
        </div>

        {/* ── Sub-type pills (CS2 Skins / Knives etc.) ─────────────────── */}
        {subTypes.length > 0 && (
          <div className="mb-6">
            <Suspense fallback={null}>
              <CategoryPills subTypes={subTypes} activeType={activeType} />
            </Suspense>
          </div>
        )}

        {/* ── Main content with collapsible filter ─────────────────────── */}
        <div className="pb-20">
          <CategoryPageLayout
            maxPrice={maxPrice}
            totalListings={totalListings}
            hasMore={hasMore}
            currentPage={currentPage}
          >
            {listings.length === 0 ? (
              <EmptyState gameSlug={gameSlug} gameName={game.name} />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {listings.map((listing: any) => (
                  <ListingCard
                    key={listing.id}
                    gameSlug={gameSlug}
                    categorySlug={categorySlug}
                    listing={listing}
                  />
                ))}
              </div>
            )}
          </CategoryPageLayout>
        </div>
      </div>
    </div>
  )
}

// ─── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ gameSlug, gameName }: { gameSlug: string; gameName: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-6 w-16 h-16 rounded-full bg-white/[0.04] flex items-center justify-center">
        <svg className="w-7 h-7 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-white mb-1">No listings found</h3>
      <p className="text-sm text-zinc-500 mb-6">Try adjusting your filters or check back later</p>
      <Link
        href={`/${gameSlug}`}
        className="inline-flex items-center gap-1.5 text-sm text-violet-400 hover:text-violet-300 transition-colors font-medium"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to {gameName}
      </Link>
    </div>
  )
}

// ─── Listing Card ──────────────────────────────────────────────────────────────

const TIER_COLORS: Record<string, string> = {
  bronze:   'text-orange-400',
  silver:   'text-zinc-400',
  gold:     'text-yellow-400',
  platinum: 'text-cyan-400',
}

function ListingCard({
  gameSlug,
  categorySlug,
  listing,
}: {
  gameSlug: string
  categorySlug: string
  listing: any
}) {
  const imageUrl = listing.images?.[0] || null
  const tierColor = TIER_COLORS[listing.seller?.seller_tier] || 'text-zinc-400'

  return (
    <Link href={`/${gameSlug}/${categorySlug}/${listing.slug || listing.id}`}>
      <div className="group relative bg-[#111] hover:bg-[#161616] border border-white/[0.06] hover:border-violet-500/30 rounded-2xl overflow-hidden transition-all duration-200">
        {/* ── Image / placeholder ─────────────────────────────────────── */}
        <div className="relative h-44 overflow-hidden">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={listing.title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-violet-900/30 via-indigo-900/20 to-black" />
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#111]/90 via-transparent to-transparent" />

          {/* VaultShield badge */}
          <div className="absolute top-3 left-3">
            <VaultShieldBadge
              level={listing.price >= 500 ? 'premium' : listing.price >= 100 ? 'enhanced' : 'standard'}
              size="sm"
              showLabel={false}
            />
          </div>

          {/* Price */}
          <div className="absolute bottom-3 right-3 bg-black/80 backdrop-blur-sm border border-white/[0.12] rounded-lg px-2.5 py-1">
            <span className="text-white text-sm font-semibold">${listing.price.toFixed(2)}</span>
          </div>
        </div>

        {/* ── Card body ───────────────────────────────────────────────── */}
        <div className="px-4 py-3">
          <h3 className="text-sm font-semibold text-white line-clamp-2 group-hover:text-violet-300 transition-colors leading-snug min-h-[2.5rem]">
            {listing.title}
          </h3>

          <div className="mt-2.5 flex items-center justify-between gap-2">
            <span className={`text-xs font-medium ${tierColor}`}>
              @{listing.seller?.username}
            </span>
            {listing.seller?.presence && (
              <PresenceIndicator
                isOnline={listing.seller.presence.is_online}
                lastSeenAt={listing.seller.presence.last_seen_at}
                showLabel={false}
                size="sm"
              />
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
