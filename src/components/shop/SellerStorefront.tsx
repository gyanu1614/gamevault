'use client'

/**
 * SellerStorefront — V10 reskin.
 *
 * Public shop page: banner → Tabs (Shop / Reviews / About). Listings grid
 * reuses the ListingCard for parity with browse/marketplace. Filter row
 * uses Combobox (game) and primitives across the board. Mobile-first.
 */

import { SITE_URL } from '@/config/site'
import React, { useLayoutEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Package, Calendar, Shield, Star, Crown, Gem, Sparkles, Award, ShieldCheck } from 'lucide-react'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Combobox, type ComboboxOption } from '@/components/ui/combobox'
import SellerProfileBanner from '@/components/shop/SellerProfileBanner'
import ReviewsList from '@/components/reviews/ReviewsList'
import { cn } from '@/lib/utils'
import { getAvatarUrl } from '@/lib/utils/avatar'

interface SellerStorefrontProps {
  seller: {
    profile: any
    listings: any[]
    reviews: any[]
    stats: {
      totalSales: number
      avgRating: number
      totalReviews: number
      positivePercentage: number
      activeListings: number
    }
  }
}

const TIER_CONFIG: Record<string, { label: string; cls: string }> = {
  unverified: { label: 'Unverified', cls: 'text-zinc-300' },
  bronze:     { label: 'Bronze',     cls: 'text-orange-300' },
  silver:     { label: 'Silver',     cls: 'text-slate-200' },
  gold:       { label: 'Gold',       cls: 'text-yellow-300' },
  platinum:   { label: 'Platinum',   cls: 'text-cyan-300' },
  diamond:    { label: 'Diamond',    cls: 'text-lime-text' },
}

export default function SellerStorefront({ seller }: SellerStorefrontProps) {
  const [activeTab, setActiveTab] = useState<'shop' | 'reviews' | 'about'>('shop')
  const [selectedGame, setSelectedGame] = useState<string>('all')

  // V17k — Scroll-to-top on mount. Pairs with `scroll={false}` on the
  // seller chip in _ItemCard, which suppresses Next's pre-navigation
  // scroll-jump on the SOURCE page. The user should still land at the
  // top of THIS page; useLayoutEffect runs before paint so there's no
  // visible flash at the previous scroll position.
  useLayoutEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
    }
  }, [])

  // Group listings by game
  const listingsByGame = useMemo(() => {
    const grouped: Record<string, any[]> = {}
    seller.listings.forEach((listing) => {
      const game = listing.game?.name || 'Other'
      if (!grouped[game]) grouped[game] = []
      grouped[game].push(listing)
    })
    return grouped
  }, [seller.listings])

  const gameOptions: ComboboxOption[] = useMemo(
    () => [
      { value: 'all', label: `All games (${seller.listings.length})` },
      ...Object.keys(listingsByGame).map((g) => ({
        value: g,
        label: `${g} (${listingsByGame[g].length})`,
      })),
    ],
    [listingsByGame, seller.listings.length],
  )

  const filteredListings =
    selectedGame === 'all' ? seller.listings : listingsByGame[selectedGame] || []

  const isOnline = false
  const sellerTier = (seller.profile.seller_tier || 'bronze') as keyof typeof TIER_CONFIG
  const tier = TIER_CONFIG[sellerTier] ?? TIER_CONFIG.bronze

  // JSON-LD
  const businessName = seller.profile.shop_name || seller.profile.business_name || seller.profile.username
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: businessName,
    image: getAvatarUrl(seller.profile.avatar_url, seller.profile.username),
    description: `Gaming marketplace seller on DropMarket`,
    url: `${SITE_URL}/shop/${seller.profile.shop_slug || seller.profile.username}`,
    aggregateRating:
      seller.stats.totalReviews > 0
        ? {
            '@type': 'AggregateRating',
            ratingValue: seller.stats.avgRating,
            reviewCount: seller.stats.totalReviews,
            bestRating: 5,
            worstRating: 1,
          }
        : undefined,
    founder: { '@type': 'Person', name: seller.profile.username },
    memberOf: { '@type': 'Organization', name: 'DropMarket' },
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <main className="min-h-screen bg-bg-base pb-16">
        {/* Banner */}
        <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
          <SellerProfileBanner
            sellerId={seller.profile.id}
            username={seller.profile.username}
            shopName={seller.profile.shop_name || seller.profile.business_name}
            avatarUrl={getAvatarUrl(seller.profile.avatar_url, seller.profile.username)}
            isOnline={isOnline}
            isVerified={true}
            rating={seller.stats.avgRating}
            reviewsCount={seller.stats.totalReviews}
            listingsCount={seller.stats.activeListings}
            totalSales={seller.stats.totalSales}
            sellerTier={sellerTier as 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'}
            bannerConfig={
              seller.profile.banner_url
                ? { type: 'custom', url: seller.profile.banner_url }
                : { type: 'preset' }
            }
            onMessageClick={() => {
              window.location.href = `/account/messages?seller=${seller.profile.id}`
            }}
          />
        </div>

        {/* Tabs */}
        <div className="mx-auto mt-6 max-w-7xl px-4 sm:px-6 lg:px-8">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList variant="underline" className="w-full justify-start gap-6">
              <TabsTrigger value="shop">Shop</TabsTrigger>
              <TabsTrigger value="reviews">
                Reviews
                <span className="ml-1.5 rounded-full bg-bg-inset px-1.5 text-[10px] font-semibold text-text-tertiary data-[state=active]:bg-lime-tint-bg data-[state=active]:text-lime-text">
                  {seller.stats.totalReviews}
                </span>
              </TabsTrigger>
              <TabsTrigger value="about">About</TabsTrigger>
            </TabsList>

            {/* Shop */}
            <TabsContent value="shop" className="pt-6">
              {/* Filter row */}
              <div className="mb-5 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="sm:w-64">
                  <Combobox
                    value={selectedGame}
                    onChange={setSelectedGame}
                    options={gameOptions}
                    ariaLabel="Filter by game"
                    unsorted
                  />
                </div>
                <span className="text-xs text-text-tertiary">
                  {filteredListings.length} {filteredListings.length === 1 ? 'listing' : 'listings'}
                </span>
              </div>

              {filteredListings.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredListings.map((listing) => (
                    <ShopListingCard key={listing.id} listing={listing} />
                  ))}
                </div>
              ) : (
                <EmptyShop sellerName={seller.profile.username} />
              )}
            </TabsContent>

            {/* Reviews */}
            <TabsContent value="reviews" className="pt-6">
              <div className="mx-auto max-w-3xl">
                <ReviewsList
                  sellerId={seller.profile.id}
                  initialReviews={seller.reviews}
                  allowSellerReply={false}
                />
              </div>
            </TabsContent>

            {/* About */}
            <TabsContent value="about" className="pt-6">
              <div className="mx-auto max-w-3xl space-y-5">
                {/* About */}
                <section className="rounded-2xl border border-border-subtle bg-bg-overlay p-5 sm:p-6">
                  <h2 className="mb-3 text-base font-bold text-text-primary">About this seller</h2>
                  <p className="text-sm leading-relaxed text-text-secondary">
                    {seller.profile.bio?.trim() || 'No description provided yet.'}
                  </p>
                </section>

                {/* Info */}
                <section className="rounded-2xl border border-border-subtle bg-bg-overlay p-5 sm:p-6">
                  <h2 className="mb-4 text-base font-bold text-text-primary">Seller information</h2>
                  <dl className="space-y-2.5 text-sm">
                    <InfoRow
                      icon={Calendar}
                      label="Member since"
                      value={new Date(seller.profile.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                      })}
                    />
                    <InfoRow icon={Shield} label="Response time" value="Within 2 hours" />
                    <InfoRow
                      icon={Star}
                      label="Seller tier"
                      value={
                        <span className={cn('font-semibold uppercase', tier.cls)}>
                          {tier.label}
                        </span>
                      }
                    />
                    <InfoRow
                      icon={Package}
                      label="Total sales"
                      value={
                        <span className="font-mono font-semibold tabular-nums text-text-primary">
                          {seller.stats.totalSales}
                        </span>
                      }
                    />
                  </dl>
                </section>

                {/* Policies */}
                <section className="rounded-2xl border border-border-subtle bg-bg-overlay p-5 sm:p-6">
                  <h2 className="mb-4 text-base font-bold text-text-primary">Shop policies</h2>
                  <div className="space-y-4 text-sm">
                    <PolicyBlock
                      title="Returns & refunds"
                      body="Every order is covered by SafeDrop Buyer Protection. Not delivered or not as described within your protection window? Full refund."
                    />
                    <PolicyBlock
                      title="Delivery"
                      body="Digital goods are delivered immediately after payment confirmation. Physical items ship within 1–3 business days."
                    />
                    <PolicyBlock
                      title="Support"
                      body="Message me anytime for questions or support. I aim to respond within 2 hours during business hours."
                    />
                  </div>
                </section>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </>
  )
}

// ─── Listing card (shop-local variant) ───────────────────────────────────────

function ShopListingCard({ listing }: { listing: any }) {
  const img = listing.images?.[0]
  const game = listing.game?.name ?? ''
  const category = listing.category?.name ?? ''
  const hasPriceDrop = listing.original_price && listing.original_price > listing.price
  const discountPct = hasPriceDrop
    ? Math.round(((listing.original_price - listing.price) / listing.original_price) * 100)
    : 0

  return (
    <Link
      href={`/listings/${listing.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border-subtle bg-bg-overlay transition-colors hover:border-lime-tint-border hover:bg-bg-raised-hover"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-bg-raised">
        {img ? (
          <Image
            src={img}
            alt={listing.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-5xl">
            {listing.game?.emoji ?? '🎮'}
          </div>
        )}
        {/* Game chip */}
        <div className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full border border-lime-tint-border bg-lime-tint-bg/80 px-2 py-0.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-lime-text backdrop-blur-sm">
          {game}
        </div>
        {hasPriceDrop && (
          <div className="absolute right-2.5 top-2.5 rounded-full border border-success/40 bg-success-bg/80 px-2 py-0.5 text-[10px] font-bold text-success backdrop-blur-sm">
            -{discountPct}%
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
          {category}
        </div>
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-text-primary group-hover:text-lime-text">
          {listing.title}
        </h3>
        <div className="mt-auto flex items-center justify-between pt-2">
          <div>
            <div className="font-mono text-lg font-bold tabular-nums text-text-primary">
              ${listing.price.toFixed(2)}
            </div>
            {hasPriceDrop && (
              <div className="font-mono text-[11px] text-text-tertiary line-through tabular-nums">
                ${listing.original_price.toFixed(2)}
              </div>
            )}
          </div>
          {listing.quantity > 0 ? (
            <span className="text-[11px] text-text-secondary">
              {listing.quantity > 10000 ? '∞' : listing.quantity} in stock
            </span>
          ) : (
            <span className="text-[11px] text-error">Out of stock</span>
          )}
        </div>
      </div>
    </Link>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function InfoRow({
  icon: Icon, label, value,
}: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border-subtle pb-2 last:border-b-0 last:pb-0">
      <dt className="inline-flex items-center gap-2 text-text-secondary">
        <Icon className="h-4 w-4 text-text-tertiary" />
        {label}
      </dt>
      <dd className="text-text-primary">{value}</dd>
    </div>
  )
}

function PolicyBlock({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      <p className="mt-1 text-sm text-text-secondary">{body}</p>
    </div>
  )
}

function EmptyShop({ sellerName }: { sellerName: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border-subtle bg-bg-overlay p-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border-default bg-bg-raised">
        <Package className="h-5 w-5 text-text-tertiary" />
      </div>
      <div>
        <h3 className="text-base font-semibold text-text-primary">No listings yet</h3>
        <p className="mt-1 text-sm text-text-secondary">
          @{sellerName} hasn’t listed anything in this category.
        </p>
      </div>
    </div>
  )
}
