/**
 * Game Browse Page
 *
 * Shows all categories for a specific game
 * SEO-friendly URL: /fortnite (clean URL, no /marketplace prefix)
 */

import React from 'react'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ArrowRight, Package, TrendingUp } from 'lucide-react'
import Image from 'next/image'

interface PageProps {
  params: Promise<{
    gameSlug: string
  }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { gameSlug } = await params
  const supabase = await createClient()

  const { data: game } = await supabase
    .from('games')
    .select('name, description')
    .eq('slug', gameSlug)
    .single()

  if (!game) {
    return {
      title: 'Game Not Found | GameVault'
    }
  }

  return {
    title: `${game.name} Marketplace | Buy & Sell ${game.name} Accounts & Items | GameVault`,
    description: `Browse ${game.name} accounts, items, and currency. ${game.description} All transactions protected by VaultShield escrow.`,
    keywords: [
      `${game.name.toLowerCase()} accounts`,
      `buy ${game.name.toLowerCase()} account`,
      `sell ${game.name.toLowerCase()} items`,
      `${game.name.toLowerCase()} marketplace`,
      `${game.name.toLowerCase()} currency`
    ],
    openGraph: {
      title: `${game.name} Marketplace - GameVault`,
      description: `Buy and sell ${game.name} accounts and items safely`,
      type: 'website'
    }
  }
}

async function getGameData(gameSlug: string) {
  const supabase = await createClient()

  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('*')
    .eq('slug', gameSlug)
    .eq('is_active', true)
    .single()

  if (gameError || !game) {
    return null
  }

  const { data: categories, error: categoriesError } = await supabase
    .from('categories')
    .select('id, name, slug, description, icon')
    .eq('game_id', game.id)
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .order('name', { ascending: true })

  if (categoriesError) {
    console.error('Error fetching categories:', categoriesError)
  }

  return {
    ...game,
    categories: categories || []
  }
}

async function getCategoryListingCounts(gameId: string) {
  const supabase = await createClient()

  const { data: counts, error } = await supabase
    .from('listings')
    .select('category_id')
    .eq('game_id', gameId)
    .eq('status', 'active')

  if (error) {
    console.error('Error fetching listing counts:', error)
    return {}
  }

  const countMap: Record<string, number> = {}
  counts?.forEach(item => {
    countMap[item.category_id] = (countMap[item.category_id] || 0) + 1
  })

  return countMap
}

async function getFeaturedListings(gameId: string, limit: number = 6) {
  const supabase = await createClient()

  const { data: listings } = await supabase
    .from('listings')
    .select(`
      *,
      seller:profiles!listings_seller_id_fkey(username, seller_tier),
      category:categories!listings_category_id_fkey(name, slug)
    `)
    .eq('game_id', gameId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(limit)

  return listings || []
}

export default async function GameBrowsePage({ params }: PageProps) {
  const { gameSlug } = await params
  const game = await getGameData(gameSlug)

  if (!game) {
    notFound()
  }

  const listingCounts = await getCategoryListingCounts(game.id)
  const featuredListings = await getFeaturedListings(game.id)
  const categories = game.categories || []

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black">
      {/* Hero Section */}
      <section className="relative pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-gradient-to-b from-violet-500/5 via-transparent to-transparent" />

        <div className="max-w-7xl mx-auto relative">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-gray-400 mb-8">
            <Link href="/" className="hover:text-white transition-colors">
              Marketplace
            </Link>
            <ArrowRight className="w-4 h-4" />
            <span className="text-white">{game.name}</span>
          </nav>

          {/* Game Header */}
          <div className="flex flex-col md:flex-row gap-8 items-start md:items-center mb-12">
            {game.image_url && (
              <div className="relative w-32 h-32 rounded-2xl overflow-hidden border-2 border-white/[0.1] flex-shrink-0">
                <Image
                  src={game.image_url}
                  alt={game.name}
                  fill
                  className="object-cover"
                />
              </div>
            )}

            <div className="flex-1">
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
                {game.name} Marketplace
              </h1>
              <p className="text-xl text-gray-300 mb-6">
                {game.description}
              </p>

              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2 px-4 py-2 bg-white/[0.05] rounded-lg border border-white/[0.1]">
                  <Package className="w-5 h-5 text-violet-400" />
                  <span className="text-white font-medium">
                    {Object.values(listingCounts).reduce((a: number, b: number) => a + b, 0).toLocaleString()} Active Listings
                  </span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-white/[0.05] rounded-lg border border-white/[0.1]">
                  <TrendingUp className="w-5 h-5 text-green-400" />
                  <span className="text-white font-medium">
                    {categories.length} Categories
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-8">Browse by Category</h2>

          {categories.length === 0 ? (
            <div className="text-center py-12 bg-white/[0.03] border border-white/[0.05] rounded-xl">
              <p className="text-gray-400">No categories available for this game yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {categories.map((category: any) => (
                <CategoryCard
                  key={category.id}
                  gameSlug={gameSlug}
                  categorySlug={category.slug}
                  name={category.name}
                  description={category.description}
                  icon={category.icon}
                  listingCount={listingCounts[category.id] || 0}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Featured Listings */}
      {featuredListings.length > 0 && (
        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white/[0.02]">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-bold text-white">Recent Listings</h2>
              <Link
                href={`/${gameSlug}`}
                className="text-violet-400 hover:text-violet-300 font-medium flex items-center gap-2 transition-colors"
              >
                View All
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredListings.slice(0, 6).map((listing: any) => (
                <ListingPreviewCard
                  key={listing.id}
                  gameSlug={gameSlug}
                  categorySlug={listing.category.slug}
                  listingSlug={listing.slug}
                  title={listing.title}
                  price={listing.price}
                  imageUrl={listing.images?.[0]}
                  sellerUsername={listing.seller.username}
                  sellerTier={listing.seller.seller_tier}
                />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

// Component: Category Card
interface CategoryCardProps {
  gameSlug: string
  categorySlug: string
  name: string
  description: string
  icon: string
  listingCount: number
}

function CategoryCard({
  gameSlug,
  categorySlug,
  name,
  description,
  icon,
  listingCount
}: CategoryCardProps) {
  return (
    <Link href={`/${gameSlug}/${categorySlug}`}>
      <div className="group bg-white/[0.03] border border-white/[0.05] hover:border-violet-500/50 rounded-xl p-6 transition-all duration-300 hover:scale-105">
        <div className="flex items-start justify-between mb-4">
          <div className="p-3 bg-violet-500/10 border border-violet-500/20 rounded-lg">
            <span className="text-2xl">{icon || '📦'}</span>
          </div>
          <span className="text-sm text-gray-400">
            {listingCount.toLocaleString()} listings
          </span>
        </div>

        <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-violet-400 transition-colors">
          {name}
        </h3>
        <p className="text-sm text-gray-400 mb-4 line-clamp-2">
          {description}
        </p>

        <div className="flex items-center text-violet-400 text-sm font-medium">
          Browse {name.toLowerCase()}
          <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </Link>
  )
}

// Component: Listing Preview Card
interface ListingPreviewCardProps {
  gameSlug: string
  categorySlug: string
  listingSlug: string
  title: string
  price: number
  imageUrl?: string
  sellerUsername: string
  sellerTier: string
}

function ListingPreviewCard({
  gameSlug,
  categorySlug,
  listingSlug,
  title,
  price,
  imageUrl,
  sellerUsername,
  sellerTier
}: ListingPreviewCardProps) {
  const tierColors: Record<string, string> = {
    bronze: 'text-orange-400',
    silver: 'text-gray-400',
    gold: 'text-yellow-400',
    platinum: 'text-cyan-400'
  }

  return (
    <Link href={`/${gameSlug}/${categorySlug}/${listingSlug}`}>
      <div className="group bg-white/[0.03] border border-white/[0.05] hover:border-violet-500/50 rounded-xl overflow-hidden transition-all duration-300 hover:scale-105">
        {/* Image */}
        <div className="relative h-48 bg-gradient-to-br from-violet-500/20 to-blue-500/20">
          {imageUrl ? (
            <Image src={imageUrl} alt={title} fill className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-5xl">
              🎮
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

          <div className="absolute bottom-3 right-3 px-3 py-1.5 bg-violet-500 rounded-lg">
            <span className="text-white font-bold">${price.toFixed(2)}</span>
          </div>
        </div>

        {/* Info */}
        <div className="p-4">
          <h3 className="text-base font-semibold text-white mb-2 line-clamp-2 group-hover:text-violet-400 transition-colors">
            {title}
          </h3>

          <div className="flex items-center justify-between text-sm">
            <span className={`font-medium ${tierColors[sellerTier] || 'text-gray-400'}`}>
              @{sellerUsername}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
