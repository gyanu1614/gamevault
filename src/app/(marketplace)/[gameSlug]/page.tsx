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
import { ArrowRight, Calculator, Package, TrendingUp } from 'lucide-react'
import Image from 'next/image'
import { JsonLd, breadcrumbList } from '@/lib/seo/jsonld'

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
    .select('id, name, description')
    .eq('slug', gameSlug)
    .single() as any

  if (!game) {
    return {
      title: 'Game Not Found'
    }
  }

  // Index bar (mirrors sitemap.ts): an empty hub — no active listings
  // and no curated currency config — stays out of the index until it
  // has something real to rank ({index:false, follow:true}).
  const [{ count: listingCount }, { data: curatedCfg }] = await Promise.all([
    supabase
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .eq('game_id', game.id)
      .eq('status', 'active'),
    supabase
      .from('category_configs')
      .select('game_id')
      .eq('game_id', game.id)
      .eq('category_type', 'currency')
      .limit(1),
  ] as const) as any
  const indexable = (listingCount ?? 0) > 0 || (curatedCfg?.length ?? 0) > 0

  return {
    // Root template appends " | DropMarket". Long game names get the
    // short pattern so the rendered title stays ≤60 chars.
    title:
      game.name.length > 12
        ? `Buy & Sell ${game.name} Items`
        : `Buy & Sell ${game.name} Accounts, Items & Currency`,
    description: `Browse ${game.name} accounts, items, and currency. ${game.description ? `${game.description} ` : ''}Every order is covered by SafeDrop Buyer Protection.`,
    robots: indexable ? undefined : { index: false, follow: true },
    keywords: [
      `${game.name.toLowerCase()} accounts`,
      `buy ${game.name.toLowerCase()} account`,
      `sell ${game.name.toLowerCase()} items`,
      `${game.name.toLowerCase()} marketplace`,
      `${game.name.toLowerCase()} currency`
    ],
    openGraph: {
      title: `${game.name} Marketplace - DropMarket`,
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
    .single() as any

  if (gameError || !game) {
    return null
  }

  const { data: categories, error: categoriesError } = await supabase
    .from('categories')
    .select('id, name, slug, description, icon')
    .eq('game_id', game.id)
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .order('name', { ascending: true }) as any

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
    .eq('status', 'active') as any

  if (error) {
    console.error('Error fetching listing counts:', error)
    return {}
  }

  const countMap: Record<string, number> = {}
  counts?.forEach((item: any) => {
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
    .limit(limit) as any

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
    <div className="min-h-screen bg-bg-base">
      <JsonLd
        data={breadcrumbList([
          { name: 'Home', path: '/' },
          { name: game.name, path: `/${gameSlug}` },
        ])}
      />
      {/* Hero Section */}
      <section className="relative pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-gradient-to-b from-[rgba(198,255,61,0.05)] via-transparent to-transparent" />

        <div className="max-w-7xl mx-auto relative">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-text-secondary mb-8">
            <Link href="/" className="hover:text-text-primary transition-colors">
              Marketplace
            </Link>
            <ArrowRight className="w-4 h-4" />
            <span className="text-text-primary">{game.name}</span>
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
              <h1 className="text-4xl md:text-5xl font-bold text-text-primary mb-4">
                {game.name} Marketplace
              </h1>
              <p className="text-xl text-text-secondary mb-6">
                {game.description}
              </p>

              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2 px-4 py-2 bg-bg-overlay rounded-lg border border-white/[0.1]">
                  <Package className="w-5 h-5 text-lime-text" />
                  <span className="text-text-primary font-medium">
                    {Object.values(listingCounts).reduce((a: number, b: number) => a + b, 0).toLocaleString()} Active Listings
                  </span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-bg-overlay rounded-lg border border-white/[0.1]">
                  <TrendingUp className="w-5 h-5 text-success" />
                  <span className="text-text-primary font-medium">
                    {categories.length} Categories
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {gameSlug === 'steal-a-brainrot' && (
        <section className="px-4 pb-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <h2 className="mb-6 text-3xl font-bold text-text-primary">
              Steal a Brainrot Tools
            </h2>

            <div className="grid gap-6 md:grid-cols-2">
              <Link
                href="/steal-a-brainrot/values"
                className="group rounded-xl border border-border-subtle bg-bg-overlay p-6 transition hover:-translate-y-0.5 hover:border-lime"
              >
                <TrendingUp className="h-7 w-7 text-lime-text" />
                <h3 className="mt-4 text-xl font-semibold text-text-primary">
                  Brainrot Values
                </h3>
                <p className="mt-2 text-sm leading-6 text-text-secondary">
                  Browse every Brainrot, rarity, income, mutation values, and marketplace availability.
                </p>
                <span className="mt-5 flex items-center gap-2 text-sm font-medium text-lime-text">
                  Browse all values
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>

              <Link
                href="/steal-a-brainrot/value-calculator"
                className="group rounded-xl border border-border-subtle bg-bg-overlay p-6 transition hover:-translate-y-0.5 hover:border-lime"
              >
                <Calculator className="h-7 w-7 text-lime-text" />
                <h3 className="mt-4 text-xl font-semibold text-text-primary">
                  Value Calculator
                </h3>
                <p className="mt-2 text-sm leading-6 text-text-secondary">
                  Select a Brainrot and mutation to calculate its income and compare variants.
                </p>
                <span className="mt-5 flex items-center gap-2 text-sm font-medium text-lime-text">
                  Open calculator
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Categories */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-text-primary mb-8">Browse by Category</h2>

          {categories.length === 0 ? (
            <div className="text-center py-12 bg-bg-overlay border border-border-subtle rounded-xl">
              <p className="text-text-secondary">No categories available for this game yet</p>
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
        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-bg-overlay">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-bold text-text-primary">Recent Listings</h2>
              <Link
                href="/browse"
                className="text-lime-text font-medium flex items-center gap-2 transition-opacity hover:opacity-80"
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
      {/* Mobile-audit — site-standard -translate-y lift instead of scale-105:
          scale on a full-width card pushes past the viewport edges after a
          tap (sticky hover) and causes transient horizontal scroll. */}
      <div className="group bg-bg-overlay border border-border-subtle hover:border-lime rounded-xl p-6 transition-all duration-300 hover:-translate-y-0.5">
        <div className="flex items-start justify-between mb-4">
          <div className="p-3 bg-lime/10 border border-lime-tint-border rounded-lg">
            <span className="text-2xl">{icon || '📦'}</span>
          </div>
          <span className="text-sm text-text-secondary">
            {listingCount.toLocaleString()} listings
          </span>
        </div>

        <h3 className="text-xl font-semibold text-text-primary mb-2 group-hover:text-lime-text transition-colors">
          {name}
        </h3>
        <p className="text-sm text-text-secondary mb-4 line-clamp-2">
          {description}
        </p>

        <div className="flex items-center text-lime-text text-sm font-medium">
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
    silver: 'text-text-secondary',
    gold: 'text-warning',
    platinum: 'text-cyan-400'
  }

  return (
    <Link href={`/${gameSlug}/${categorySlug}/${listingSlug}`}>
      {/* Mobile-audit — same swap as CategoryCard: lift, not scale. */}
      <div className="group bg-bg-overlay border border-border-subtle hover:border-lime rounded-xl overflow-hidden transition-all duration-300 hover:-translate-y-0.5">
        {/* Image */}
        <div className="relative h-48 bg-gradient-to-br from-[rgba(198,255,61,0.12)] to-[rgba(255,255,255,0.05)]">
          {imageUrl ? (
            <Image src={imageUrl} alt={title} fill className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-5xl">
              🎮
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

          <div className="absolute bottom-3 right-3 px-3 py-1.5 bg-lime rounded-lg">
            <span className="text-text-inverse font-bold">${price.toFixed(2)}</span>
          </div>
        </div>

        {/* Info */}
        <div className="p-4">
          <h3 className="text-base font-semibold text-text-primary mb-2 line-clamp-2 group-hover:text-lime-text transition-colors">
            {title}
          </h3>

          <div className="flex items-center justify-between text-sm">
            <span className={`font-medium ${tierColors[sellerTier] || 'text-text-secondary'}`}>
              @{sellerUsername}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
