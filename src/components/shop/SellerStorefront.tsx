'use client'

/**
 * SellerStorefront — the public /shop/[slug] page.
 *
 *   Header   ONE card: banner strip (Silver+ custom / generated art) melting
 *            into the identity block (avatar + rank halo, name, action), then
 *            a hairline and the stats row: feedback · sold · offers · stated
 *            delivery · rank
 *   Tabs     Offers (filters + shared ItemCard grid) · Reviews · About
 *
 * Every tab panel is in the HTML (inactive ones `hidden`), so the cached page
 * carries the reviews and policies for crawlers, not just the active tab.
 * Viewer-specific bits (own shop, presence) resolve client-side.
 */

import { sellerShopSlug } from '@/lib/seller/identity'
import { useLayoutEffect, useState } from 'react'
import { CalendarBlankIcon } from '@phosphor-icons/react/dist/csr/CalendarBlank'
import { GameControllerIcon } from '@phosphor-icons/react/dist/csr/GameController'
import { LightningIcon } from '@phosphor-icons/react/dist/csr/Lightning'
import { MedalIcon } from '@phosphor-icons/react/dist/csr/Medal'
import { ShoppingBagIcon } from '@phosphor-icons/react/dist/csr/ShoppingBag'
import { MoonIcon } from '@phosphor-icons/react/dist/csr/Moon'

import { SegmentedTabs, TabCount } from '@/components/account/SegmentedTabs'
import { TierIcon } from '@/components/seller/tiers/TierIcon'
import SellerProfileBanner from '@/components/shop/SellerProfileBanner'
import { StoreOffers } from '@/components/shop/StoreOffers'
import { StoreReviews } from '@/components/shop/StoreReviews'
import { SITE_URL } from '@/config/site'
import { sellerDisplayName, sellerShopHref } from '@/lib/seller/identity'
import { tierByKey } from '@/lib/seller/tiers'
import { serializeJsonLd } from '@/lib/seo/jsonld'
import { gameFacets, memberSinceLabel, type RatingBreakdown, type StoreOffer, type StoreReview } from '@/lib/shop/storefront-model'
import type { ResolvedStoreBanner } from '@/lib/shop/store-banner'
import { MARKET_CARD } from '@/lib/ui/surfaces'
import { getAvatarUrl } from '@/lib/utils/avatar'
import { cn } from '@/lib/utils'

export interface SellerStorefrontProps {
  seller: {
    /** The allowlisted PUBLIC_SELLER_PROFILE_SELECT row. */
    profile: any
    offers: StoreOffer[]
    reviews: StoreReview[]
    breakdown: RatingBreakdown
    banner: ResolvedStoreBanner
    isPaused: boolean
    stats: {
      totalSales: number
      activeListings: number
      avgDelivery: string | null
    }
  }
}

type Tab = 'offers' | 'reviews' | 'about'

export default function SellerStorefront({ seller }: SellerStorefrontProps) {
  const [tab, setTab] = useState<Tab>('offers')
  const { profile, offers, reviews, breakdown, banner, isPaused, stats } = seller

  // V17k — land at the top of the shop. Pairs with `scroll={false}` on the
  // seller chip in _ItemCard; layout effect so there is no flash.
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [])

  const displayName = sellerDisplayName(profile) || profile.business_name || 'Seller'
  const tier = tierByKey(profile.seller_tier)
  const memberSince = memberSinceLabel(profile.created_at)
  const games = gameFacets(offers)

  // JSON-LD (unchanged shape: Store + AggregateRating).
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: sellerDisplayName(profile) || profile.business_name,
    image: getAvatarUrl(profile.avatar_url, profile.username),
    description: `Gaming marketplace seller on DropMarket`,
    url: `${SITE_URL}${sellerShopHref(profile) ?? ''}`,
    aggregateRating:
      breakdown.total > 0
        ? {
            '@type': 'AggregateRating',
            ratingValue: breakdown.average,
            reviewCount: breakdown.total,
            bestRating: 5,
            worstRating: 1,
          }
        : undefined,
    founder: { '@type': 'Person', name: profile.username },
    memberOf: { '@type': 'Organization', name: 'DropMarket' },
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />

      <main className="min-h-screen bg-bg-base pb-16">
        <div className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 sm:pt-8 lg:px-8">
          <SellerProfileBanner
            sellerId={profile.id}
            displayName={displayName}
            username={profile.username}
            avatarUrl={profile.avatar_url ? getAvatarUrl(profile.avatar_url, profile.username) : null}
            // The real profile flag — never a hardcoded badge.
            isVerified={profile.is_verified === true}
            isFoundingSeller={profile.founding_seller === true}
            sellerTier={profile.seller_tier}
            memberSince={memberSince}
            isPaused={isPaused}
            banner={banner}
            stats={
              <dl className="grid grid-cols-2 gap-x-5 gap-y-6 py-5 sm:gap-x-8 sm:py-6 lg:grid-cols-5 lg:gap-0 lg:divide-x lg:divide-white/[0.07]">
                <Stat
                  label="Positive Feedback"
                  value={breakdown.positivePercent != null ? `${breakdown.positivePercent}%` : '—'}
                  hint={
                    breakdown.total > 0
                      ? `${breakdown.total.toLocaleString('en-US')} ${breakdown.total === 1 ? 'Review' : 'Reviews'}`
                      : 'No Reviews Yet'
                  }
                />
                <Stat
                  label="Sold"
                  value={stats.totalSales > 0 ? stats.totalSales.toLocaleString('en-US') : '—'}
                  hint={stats.totalSales > 0 ? 'Completed Orders' : 'No Sales Yet'}
                />
                <Stat
                  label="Active Offers"
                  value={stats.activeListings.toLocaleString('en-US')}
                  hint={games.length > 0 ? `Across ${games.length} ${games.length === 1 ? 'Game' : 'Games'}` : 'None Listed'}
                />
                <Stat label="Avg. Delivery" value={stats.avgDelivery ?? '—'} hint="Seller's Stated Time" />
                <Stat
                  label="Rank"
                  value={
                    <span className={cn('inline-flex items-center gap-2', tier.colors.text)}>
                      <TierIcon tier={tier.key} size={17} decorative />
                      {tier.label}
                    </span>
                  }
                  hint={memberSince ? `Since ${memberSince}` : 'DropMarket Seller'}
                  className="col-span-2 lg:col-span-1"
                />
              </dl>
            }
          />

          {isPaused && (
            <div className="mt-4 flex items-start gap-3 rounded-lg bg-warning-bg px-4 py-3 text-[13px] text-warning">
              <MoonIcon size={18} weight="fill" aria-hidden className="mt-px shrink-0" />
              <p>
                <span className="font-semibold">This Store Is Paused.</span>{' '}
                The seller has paused their store, so their offers are hidden from the marketplace until they are back.
              </p>
            </div>
          )}

          {/* Tabs */}
          <div className="mt-6">
            <SegmentedTabs<Tab>
              tabs={[
                { id: 'offers', label: <>Offers<TabCount n={offers.length} /></> },
                { id: 'reviews', label: <>Reviews<TabCount n={breakdown.total} /></> },
                { id: 'about', label: 'About' },
              ]}
              value={tab}
              onChange={setTab}
              layoutId="shop-tabs"
              ariaLabel="Shop sections"
              idPrefix="shop"
            />
          </div>

          <section
            role="tabpanel"
            id="shop-panel-offers"
            aria-labelledby="shop-tab-offers"
            hidden={tab !== 'offers'}
            className="pt-5 motion-safe:animate-in motion-safe:fade-in-0"
          >
            <h2 className="sr-only">Offers</h2>
            <StoreOffers offers={offers} sellerName={displayName} shopSlug={sellerShopSlug(profile)} />
          </section>

          <section
            role="tabpanel"
            id="shop-panel-reviews"
            aria-labelledby="shop-tab-reviews"
            hidden={tab !== 'reviews'}
            className="pt-5 motion-safe:animate-in motion-safe:fade-in-0"
          >
            <h2 className="sr-only">Reviews</h2>
            <StoreReviews reviews={reviews} breakdown={breakdown} />
          </section>

          <section
            role="tabpanel"
            id="shop-panel-about"
            aria-labelledby="shop-tab-about"
            hidden={tab !== 'about'}
            className="pt-5 motion-safe:animate-in motion-safe:fade-in-0"
          >
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
              <div className="space-y-5">
                <Card title="About This Seller">
                  <p className="whitespace-pre-line break-words text-[14px] leading-relaxed text-text-secondary">
                    {profile.bio?.trim() || 'No description provided yet.'}
                  </p>
                </Card>

                <Card title="Shop Policies">
                  <div className="space-y-4 text-sm">
                    <PolicyBlock
                      title="Returns & Refunds"
                      body="Every order is covered by SafeDrop Protection. Not delivered or not as described within your protection window? Full refund."
                    />
                    <PolicyBlock
                      title="Delivery"
                      body="Digital goods are delivered immediately after payment confirmation."
                    />
                    <PolicyBlock
                      title="Support"
                      body="Message me anytime for questions or support — all communication stays on-platform, where SafeDrop covers your order."
                    />
                  </div>
                </Card>
              </div>

              <Card title="Seller Information">
                <dl className="text-[14px]">
                  <InfoRow icon={<CalendarBlankIcon size={16} aria-hidden />} label="Member Since" value={memberSince ?? '—'} />
                  <InfoRow
                    icon={<MedalIcon size={16} aria-hidden />}
                    label="Rank"
                    value={
                      <span className={cn('inline-flex items-center gap-1.5 font-semibold', tier.colors.text)}>
                        <TierIcon tier={tier.key} size={16} decorative />
                        {tier.label}
                      </span>
                    }
                  />
                  <InfoRow
                    icon={<ShoppingBagIcon size={16} aria-hidden />}
                    label="Completed Sales"
                    value={<span className="font-semibold tabular-nums">{stats.totalSales.toLocaleString('en-US')}</span>}
                  />
                  <InfoRow
                    icon={<LightningIcon size={16} aria-hidden />}
                    label="Avg. Stated Delivery"
                    value={stats.avgDelivery ?? '—'}
                  />
                  <InfoRow
                    icon={<GameControllerIcon size={16} aria-hidden />}
                    label="Games"
                    value={games.length > 0 ? games.map((g) => g.label).join(', ') : '—'}
                  />
                </dl>
              </Card>
            </div>
          </section>
        </div>
      </main>
    </>
  )
}

// ─── Pieces ─────────────────────────────────────────────────────────────────

function Stat({
  label,
  value,
  hint,
  className,
}: {
  label: string
  value: React.ReactNode
  hint?: string
  className?: string
}) {
  return (
    // Phone / tablet: a 2-column grid on whitespace alone. lg+: one row,
    // hairlines between cells (the first is flush with the identity above).
    <div className={cn('min-w-0 lg:px-6 lg:first:pl-0 lg:last:pr-0 xl:px-8', className)}>
      <dt className="truncate text-[12px] font-medium text-text-tertiary">{label}</dt>
      <dd className="mt-1.5 truncate text-[17px] font-semibold leading-tight tracking-[-0.01em] tabular-nums text-text-primary">{value}</dd>
      {hint && <dd className="mt-1 truncate text-[12px] text-text-tertiary">{hint}</dd>}
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={cn('rounded-lg p-5 sm:p-6', MARKET_CARD)}>
      <h2 className="mb-3 text-[15px] font-semibold text-text-primary">{title}</h2>
      {children}
    </section>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] py-2.5 first:pt-0 last:border-b-0 last:pb-0">
      <dt className="inline-flex shrink-0 items-center gap-2 text-text-secondary">
        <span className="text-text-tertiary">{icon}</span>
        {label}
      </dt>
      <dd className="min-w-0 text-right text-text-primary">{value}</dd>
    </div>
  )
}

function PolicyBlock({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-text-secondary">{body}</p>
    </div>
  )
}
