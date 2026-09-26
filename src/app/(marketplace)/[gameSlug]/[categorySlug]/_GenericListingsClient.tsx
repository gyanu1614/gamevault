'use client'

/**
 * Generic category grid (the branch for category types with no dedicated
 * client — gift cards today).
 *
 * Step 7a — the page used to filter/sort/paginate on the server from
 * `searchParams`, which made the whole route dynamic. The ISR page now ships
 * the full active set and this component applies the URL rules in the
 * browser (`_genericListingFilters.ts`, pinned by tests to the old query).
 *
 * The default view (no params) is what the static HTML contains; URL-driven
 * state arrives through SearchParamsBridge after hydration, so the grid stays
 * in the markup instead of falling into the useSearchParams() bailout.
 */

import { Suspense, useCallback, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import SafeDropBadge from '@/components/safedrop/SafeDropBadge'
import PresenceIndicator from '@/components/presence/PresenceIndicator'
import CategoryPills from '@/components/marketplace/CategoryPills'
import CategoryPageLayout from '@/components/marketplace/CategoryPageLayout'
import { SearchParamsBridge } from '@/components/navigation/SearchParamsBridge'
import { tierByKey } from '@/lib/seller/tiers'
import { applyCategoryListingParams, type GenericListing } from './_genericListingFilters'

export interface GenericGridListing extends GenericListing {
  slug: string | null
  original_price: number | null
  images: string[] | null
  seller: {
    id: string
    username: string | null
    seller_tier: string | null
    avatar_url: string | null
    presence: { is_online: boolean | null; last_seen_at: string | null } | null
  } | null
}

export default function GenericListingsClient({
  gameSlug,
  gameName,
  categorySlug,
  categoryName,
  listings,
  subTypes,
}: {
  gameSlug: string
  gameName: string
  categorySlug: string
  categoryName: string
  listings: GenericGridListing[]
  subTypes: string[]
}) {
  const [params, setParams] = useState(() => new URLSearchParams())
  const onParams = useCallback((next: URLSearchParams) => setParams(next), [])

  const view = useMemo(
    () => applyCategoryListingParams(listings, (k) => params.get(k)),
    [listings, params],
  )

  return (
    <>
      <SearchParamsBridge onParams={onParams} />

      {/* ── Sub-type pills (CS2 Skins / Knives etc.) ─────────────────── */}
      {subTypes.length > 0 && (
        <div className="mb-6">
          <Suspense fallback={null}>
            <CategoryPills subTypes={subTypes} activeType={view.activeType} />
          </Suspense>
        </div>
      )}

      {/* ── Main content with collapsible filter ─────────────────────── */}
      <div className="pb-20">
        <CategoryPageLayout
          maxPrice={view.maxPrice}
          totalListings={view.totalListings}
          hasMore={view.hasMore}
          currentPage={view.currentPage}
        >
          {view.listings.length === 0 ? (
            <EmptyState gameSlug={gameSlug} gameName={gameName} categoryName={categoryName} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {view.listings.map((listing) => (
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
    </>
  )
}

// ─── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({
  gameSlug,
  gameName,
  categoryName,
}: {
  gameSlug: string
  gameName: string
  categoryName: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-6 w-16 h-16 rounded-full bg-bg-overlay flex items-center justify-center">
        <svg className="w-7 h-7 text-text-disabled" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-text-primary mb-1">No listings found</h3>
      <p className="text-sm text-text-tertiary mb-4">
        Be the first to sell {gameName} {categoryName} on DropMarket — list in minutes with low seller fees.
      </p>
      <Link
        href="/sell"
        className="mb-5 inline-flex items-center rounded-full bg-lime px-5 py-2 text-sm font-semibold text-text-inverse transition-opacity hover:opacity-90"
      >
        Start Selling
      </Link>
      <Link
        href={`/${gameSlug}`}
        className="inline-flex items-center gap-1.5 text-sm text-lime-text hover:text-lime-text transition-colors font-medium"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to {gameName}
      </Link>
    </div>
  )
}

// ─── Listing Card ──────────────────────────────────────────────────────────────

function ListingCard({
  gameSlug,
  categorySlug,
  listing,
}: {
  gameSlug: string
  categorySlug: string
  listing: GenericGridListing
}) {
  const imageUrl = listing.images?.[0] || null
  const tierColor = tierByKey(listing.seller?.seller_tier).colors.text
  const hasPriceDrop = !!listing.original_price && listing.original_price > listing.price
  const discountPct = hasPriceDrop
    ? Math.round(((listing.original_price! - listing.price) / listing.original_price!) * 100)
    : 0

  return (
    <Link href={`/${gameSlug}/${categorySlug}/${listing.slug || listing.id}`}>
      <div className="group relative overflow-hidden rounded-2xl border border-border-subtle bg-bg-raised transition-colors hover:border-lime-tint-border hover:bg-bg-raised-hover">
        {/* Image */}
        <div className="relative aspect-[4/3] overflow-hidden bg-bg-overlay">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={listing.title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-lime/10 via-lime/5 to-bg-base text-5xl">
              🎮
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-bg-base/80 via-transparent to-transparent" />

          {/* SafeDrop badge — top-left */}
          <div className="absolute left-2.5 top-2.5">
            <SafeDropBadge
              level={listing.price >= 500 ? 'premium' : listing.price >= 100 ? 'enhanced' : 'standard'}
              size="sm"
              showLabel={false}
            />
          </div>

          {/* Discount — top-right */}
          {hasPriceDrop && (
            <div className="absolute right-2.5 top-2.5 inline-flex items-center rounded-full border border-success/40 bg-success-bg/80 px-2 py-0.5 text-[10px] font-bold text-success backdrop-blur-sm">
              -{discountPct}%
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex flex-col gap-2 p-4">
          <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug text-text-primary transition-colors group-hover:text-lime-text">
            {listing.title}
          </h3>

          <div className="flex items-baseline gap-2">
            <span className="font-mono text-lg font-bold tabular-nums text-text-primary">
              ${listing.price.toFixed(2)}
            </span>
            {hasPriceDrop && (
              <span className="font-mono text-xs text-text-tertiary line-through tabular-nums">
                ${listing.original_price!.toFixed(2)}
              </span>
            )}
          </div>

          <div className="mt-1 flex items-center justify-between gap-2 border-t border-border-subtle pt-2">
            <span className={cn('truncate text-xs font-medium', tierColor)}>
              @{listing.seller?.username}
            </span>
            {listing.seller?.presence && (
              <PresenceIndicator
                isOnline={!!listing.seller.presence.is_online}
                lastSeenAt={listing.seller.presence.last_seen_at ?? undefined}
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
