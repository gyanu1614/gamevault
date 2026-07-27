'use client'

/**
 * V19/P24/P4 — Bundle-mode currency page.
 *
 * Routed by page.tsx when the currency config has bundles defined
 * (Fortnite V-Bucks / Apex Coins / mobile top-ups). The buyer flow is
 * fundamentally different from flexible-quantity currency (Robux):
 *
 *   1. Pick a region (if the admin enabled region as a platform field)
 *   2. Pick a bundle from a visual grid of admin-defined tiles
 *   3. See the cheapest active listing for THAT (bundle, region) combo
 *      in a sticky "Offer Price" panel on the right
 *   4. Use the quantity stepper to buy multiple of the same bundle
 *   5. Click Buy -> /checkout/<bestOffer.listingId> (existing flow)
 *
 * Below the grid we show the other sellers for the selected bundle.
 * Self-purchase is blocked (matches existing flexible-mode behaviour).
 *
 * Built on shadcn Card + RadioGroup + our NumberField. Lime "Popular"
 * chip marks the cheapest bundle across all listings.
 *
 * V47 — Lower page rewired to the shared marketplace section library
 * (same stack as the item detail + flexible currency pages): editorial
 * Other Sellers heading with per-game watermark, pinned HowItWorksBand,
 * SectionHeading + FaqCards, BlogSection, PaymentsMarquee, and the
 * SafeDrop-watermarked offer panel with the shared TrustBand.
 */

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthDialog } from '@/components/auth/AuthDialog'
import { BadgeCheck, Check, Clock, Flame, Package, ShieldCheck, SlidersHorizontal, Star, Zap, type LucideIcon  } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { NumberField } from '@/components/ui/number-field'
import { MobileSlider } from '@/components/ui/mobile-slider'
import { Button } from '@/components/ui/button'
import HowItWorksBand from '@/components/marketplace/HowItWorksBand'
import { SectionHeading } from '@/components/marketplace/SectionHeading'
import { FaqCards } from '@/components/marketplace/FaqCards'
import { TrustBand } from '@/components/marketplace/TrustBand'
import { PaymentsMarquee } from '@/components/marketplace/PaymentsMarquee'
import type { CurrencyBundle, PlatformOption } from '@/lib/types/category-configs'
import { getRegionIcon } from '@/lib/marketplace/region-platform-presets'
import type { CurrencyFaq, CurrencyStep } from './_CurrencyMeta'

export interface BundleOffer {
  listingId: string
  sellerId: string | null
  /** Stable handle for the seller's public shop URL ("/shop/{username}"). */
  sellerUsername: string | null
  sellerName: string
  sellerAvatarUrl?: string | null
  verified: boolean
  rating: number
  reviews: number
  /** $ per bundle (the listing.price column). */
  pricePerBundle: number
  /** How many of this bundle the seller has in stock. */
  stock: number
  deliveryLabel: string
  deliveryMin: number
  deliveryMax: number
  blurb: string
  bundleId: string
  region: string | null
  platform: string | null
}

export interface BundleCurrencyPageData {
  unitLabel: string
  tagline: string
  gameName: string
  gameSlug: string
  currencyIconUrl: string | null
  /** Sorted by sort_order asc (admin-controlled). */
  bundles: CurrencyBundle[]
  /**
   * V51 — All region options the admin enabled (empty array hides the
   * selector). Now PlatformOption[] so preset flags flow through;
   * legacy string values are normalized upstream and resolve a flag
   * via getRegionIcon at render time.
   */
  regions: PlatformOption[]
  /**
   * V19/P24/P7 — Platform options the admin enabled, with optional
   * icon_url per option (PS5/Xbox/PC logos). Empty array hides the
   * Platform tile row.
   */
  platforms: PlatformOption[]
  offers: BundleOffer[]
  // V19/P24/P7.d — How it works + FAQ blocks. Same shape and same
  // source (currency category config) as the flexible page.
  steps: CurrencyStep[]
  faq: CurrencyFaq[]
}

export default function BundleCurrencyPageClient({
  data,
  viewerId,
  introLine,
  blogRail,
}: {
  data: BundleCurrencyPageData
  viewerId: string | null
  /** SEO intro sentence (live stats), server-computed so it lands in
   *  the initial HTML. Rendered under the header tagline. */
  introLine?: string | null
  /** Server-rendered blog rail (DB-backed), passed as a slot. */
  blogRail?: React.ReactNode
}) {
  // V19/P24/P4 — Region selection defaults to the first enabled region.
  // When admin disabled regions entirely we use empty string as a
  // sentinel ("no region constraint") and skip the region selector
  // section.
  const [region, setRegion] = useState<string>(data.regions[0]?.value ?? '')

  // V19/P24/P7 — Platform selection. Defaults to the first enabled
  // platform; empty array hides the row entirely. Filters offers the
  // same way region does — null platform on a listing is treated as
  // "any platform".
  const [platform, setPlatform] = useState<string>(
    data.platforms[0]?.value ?? '',
  )

  // V19/P24/P4 — Bundle selection defaults to the cheapest available
  // bundle (the "Popular" pick) so the right-side panel has a real
  // price on first render rather than an empty state.
  const popularBundleId = useMemo(() => {
    let bestId = data.bundles[0]?.id ?? ''
    let bestPrice = Infinity
    for (const bundle of data.bundles) {
      const cheapest = data.offers
        .filter((o) => o.bundleId === bundle.id)
        .reduce((min, o) => Math.min(min, o.pricePerBundle), Infinity)
      if (cheapest < bestPrice) {
        bestPrice = cheapest
        bestId = bundle.id
      }
    }
    return bestId
  }, [data.bundles, data.offers])
  const [bundleId, setBundleId] = useState<string>(popularBundleId)

  // V53 — Feeds MobileSlider so the selected tile is always scrolled into
  // view on mobile (the pre-selected "Popular" bundle is often not the first).
  const selectedBundleIndex = useMemo(
    () => Math.max(0, data.bundles.findIndex((b) => b.id === bundleId)),
    [data.bundles, bundleId],
  )

  // V19/P24/P4 — Buyer-side quantity stepper. Always integer; bundles
  // sell in whole multiples. Capped at the best seller's stock.
  const [qty, setQty] = useState<number>(1)

  // V19/P24/P7.h — Other Sellers sort mode. Matches the flexible
  // Robux page's filter chips (Recommended / Cheapest / Fastest).
  // "Recommended" = lowest price first (same as the recommended
  // seller on the right panel, broken by rating). Cheapest = price
  // asc. Fastest = deliveryMin asc.
  const [otherFilter, setOtherFilter] = useState<
    'recommended' | 'cheapest' | 'fastest'
  >('recommended')

  // V19/P24/P7.k — User-picked listing id from the Other Sellers
  // table. Empty string = no override (use the recommended seller).
  // Clears whenever the upstream selection changes (bundle, region,
  // platform), since the picked listing may not survive a re-filter.
  const [pickedListingId, setPickedListingId] = useState<string>('')

  // Offers filtered to the currently-picked (bundle, region) combo,
  // sorted ascending by price. Index 0 = best seller (recommended);
  // the rest render below as "Other Sellers".
  const offersForSelection = useMemo(() => {
    return data.offers
      .filter((o) => {
        if (o.bundleId !== bundleId) return false
        // Region match: if region is empty we accept any region (or
        // listings without a region); otherwise listings tagged with
        // null region are treated as "any region" and shown alongside
        // exact matches.
        if (region && o.region && o.region !== region) return false
        // V19/P24/P7 — Platform match: same permissive rule. Null
        // platform on the listing means "any platform" (legacy data).
        if (platform && o.platform && o.platform !== platform) return false
        return true
      })
      .sort((a, b) => a.pricePerBundle - b.pricePerBundle)
  }, [data.offers, bundleId, region, platform])

  const bestOffer = offersForSelection[0] ?? null
  // V19/P24/P7.k — Active offer the right-side panel renders. When
  // the buyer clicks Select on another row, swap to that listing;
  // otherwise the recommended (cheapest) seller stays selected.
  const pickedOffer = pickedListingId
    ? offersForSelection.find((o) => o.listingId === pickedListingId) ?? null
    : null
  const activeOffer = pickedOffer ?? bestOffer
  const isPicked = !!pickedOffer
  // V19/P24/P7.h — Other offers re-sorted by filter chip. Default
  // 'recommended' keeps the cheapest-with-rating-tiebreak order
  // produced by offersForSelection. Exclude whichever offer is
  // currently being shown on the right panel so it never appears
  // twice on the page.
  const otherOffers = useMemo(() => {
    const rest = offersForSelection.filter(
      (o) => o.listingId !== activeOffer?.listingId,
    )
    switch (otherFilter) {
      case 'cheapest':
        return [...rest].sort((a, b) => a.pricePerBundle - b.pricePerBundle)
      case 'fastest':
        return [...rest].sort((a, b) => a.deliveryMin - b.deliveryMin)
      case 'recommended':
      default:
        return rest
    }
  }, [offersForSelection, otherFilter, activeOffer?.listingId])
  const isOwn = !!viewerId && activeOffer?.sellerId === viewerId
  const cappedQty = Math.min(qty, activeOffer?.stock ?? 1)

  const router = useRouter()
  const { open: openAuth } = useAuthDialog()
  // Buy handler shared with OfferPanel. Logged out → open the sign-in modal in
  // place with checkout as the post-auth redirect (no bounce to home).
  const onBuy = (listingId: string, quantity: number) => {
    const dest = `/checkout/${listingId}?qty=${quantity}`
    if (!viewerId) {
      openAuth('login', { redirect: dest })
      return
    }
    router.push(dest)
  }

  return (
    // `isolate` keeps the -z-10 backdrop art (game watermark, shield
    // emblem) inside main's stacking context — same as the flexible
    // currency page.
    <main className="relative isolate min-h-screen pb-24">
      {/* Header — currency icon + SEO title + tagline */}
      <header className="relative overflow-hidden border-b border-border-subtle">
        <div className="relative mx-auto flex w-full max-w-7xl items-center gap-4 px-4 py-6 sm:gap-5 sm:px-6 sm:py-8 lg:px-8">
          {data.currencyIconUrl ? (
            /* V21/P7.i — Floating logo, no frame (matches the flexible
               currency page). Transparent PNG sits directly on the page. */
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={data.currencyIconUrl}
              alt=""
              className="h-14 w-14 shrink-0 rounded-xl object-contain sm:h-[60px] sm:w-[60px]"
            />
          ) : (
            <div
              aria-hidden
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-border-default bg-bg-overlay sm:h-16 sm:w-16"
            >
              <Flame className="h-6 w-6 text-lime-text" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[20px] font-black leading-tight tracking-tight text-text-primary sm:text-[26px] lg:text-[30px]">
              Buy {data.gameName} {data.unitLabel}
            </h1>
            {data.tagline && (
              <p className="mt-1 line-clamp-2 text-[13px] font-medium text-text-secondary sm:text-[14px]">
                {data.tagline}
              </p>
            )}
            {introLine && (
              <p className="mt-1 text-[12px] text-text-tertiary sm:text-[12.5px]">
                {introLine}
              </p>
            )}
          </div>
        </div>
      </header>

      {/* V19/P24/P7 — Platform tiles. Sits above Region as a single
          line of logo + label pills. Admin uploads each logo on the
          per-game Currency tab. Hidden when admin has no platforms
          enabled (e.g. Roblox, PC-only games). */}
      {data.platforms.length > 0 && (
        <section className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
          <h2 className="mb-3 text-[15px] font-bold text-text-primary">
            Choose Platform
          </h2>
          {/* V19/P24/P7.b — Rectangular tiles matching the bundle
              grid look. Icon centered on top, label below. Sized
              snug so PC / PS / XBOX fit one line on desktop. */}
          <OptionTiles
            variant="pill"
            options={data.platforms.map((p) => ({
              value: p.value,
              icon: p.icon_url ?? null,
              label: p.value,
            }))}
            selected={platform}
            uppercase
            onSelect={(v) => {
              setPlatform(v)
              setPickedListingId('')
            }}
          />
        </section>
      )}

      {/* V19/P24/P7 — Region row is pulled OUT of the 2-col grid so
          "Available Offers" (left) and "Offer Price" (right) always
          start on the same baseline. Region sits above as a
          full-width selector. */}
      {data.regions.length > 0 && (
        <section className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
          <h2 className="mb-3 text-[15px] font-bold text-text-primary">
            Region
          </h2>
          <OptionTiles
            variant="pill"
            options={data.regions.map((r) => ({
              value: r.value,
              // V51 — Flag from the stored option, else resolved by
              // name for legacy string configs; text-only fallback.
              icon: r.icon_url ?? getRegionIcon(r.value),
              label: r.value,
            }))}
            selected={region}
            onSelect={(v) => {
              setRegion(v)
              setPickedListingId('')
            }}
          />
        </section>
      )}

      {/* V52 — pt bumped (was pt-4): the selector rows above and the
          bundle grid read as separate sections, not one blob. */}
      <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 pt-10 sm:px-6 sm:pt-12 lg:grid-cols-[1fr_360px] lg:items-stretch lg:gap-8 lg:px-8">
        {/* LEFT COLUMN — bundle grid + other sellers.
            min-w-0 is load-bearing: grid items default to `min-width: auto`,
            so without it this column sizes itself to the min-content width of
            the bundle slider's full 12-card row (~1900px) and stretches the
            whole page sideways on mobile. */}
        <div className="min-w-0 space-y-6">
          <section>
            <h2 className="mb-3 text-[15px] font-bold text-text-primary">
              Choose Amount
            </h2>
            {/* V53 — Below `md` the tiles become a swipeable embla slider
                (peeking neighbour signals "there's more" without needing
                dots or arrows); at `md`+ the container flips back to the
                same 3/4-up grid as before. One markup tree, CSS-only
                layout switch — see MobileSlider for why that can't flash. */}
            <MobileSlider
              activeIndex={selectedBundleIndex}
              itemCount={data.bundles.length}
            >
              <RadioGroup
                value={bundleId}
                onValueChange={(v) => {
                  setBundleId(v)
                  setQty(1)
                  setPickedListingId('')
                }}
                // V47b — 4-up ~195px tiles: middle ground between the
                // original bulky cards and the too-tight 5-up pass.
                className="flex gap-3 md:grid md:grid-cols-3 lg:grid-cols-4"
              >
                {data.bundles.map((bundle) => {
                  const cheapestForBundle = data.offers
                    .filter(
                      (o) =>
                        o.bundleId === bundle.id &&
                        (!region || !o.region || o.region === region),
                    )
                    .reduce(
                      (min, o) => Math.min(min, o.pricePerBundle),
                      Infinity,
                    )
                  const on = bundleId === bundle.id
                  const isPopular = bundle.id === popularBundleId
                  return (
                    // Slide sizing — FIXED widths, deliberately not a % basis:
                    // a percentage flex-basis resolves against an indefinite
                    // width while the parent grid column measures itself, falls
                    // back to content sizing, and blows the row (and the page)
                    // wide. 152px puts 2 cards + a peeking third on a 390px
                    // phone, so the row reads as swipeable at a glance.
                    // md:w-auto is required — unlike flex-basis, an explicit
                    // width is NOT inert on a grid item and would otherwise
                    // pin the desktop tiles to 152px.
                    <label
                      key={bundle.id}
                      className="block w-[152px] shrink-0 sm:w-[168px] md:w-auto"
                    >
                      <RadioGroupItem value={bundle.id} className="sr-only" />
                      {/* V47b — Refined tile: top sheen, icon spotlight,
                          floating drop-shadow on the 3D art, hover lift,
                          soft lime glow + lime price when selected. Alpha
                          colors are hex/rgba literals (lime/[0.x]
                          utilities don't compile). */}
                      <Card
                        className={cn(
                          'group relative cursor-pointer overflow-hidden border-2 bg-[rgba(20,20,27,0.56)] p-3 backdrop-blur-md transition-all duration-200',
                          on
                            ? 'border-[#ABE52BB3] shadow-[0_10px_26px_-10px_rgba(171,229,43,0.22)]'
                            : 'border-border-default hover:-translate-y-0.5 hover:border-border-strong hover:bg-[rgba(26,26,35,0.70)] hover:shadow-[0_12px_24px_-12px_rgba(0,0,0,0.6)]',
                        )}
                      >
                        {/* Top sheen — faint light falling from above. */}
                        <span
                          aria-hidden
                          className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.06),transparent)]"
                        />
                        {/* Icon spotlight — soft pool of light behind the
                            art so the 3D render pops off the surface. */}
                        <span
                          aria-hidden
                          className={cn(
                            'pointer-events-none absolute left-1/2 top-2 h-14 w-24 -translate-x-1/2 rounded-full blur-xl transition-colors duration-200',
                            on ? 'bg-[#C6FF3D24]' : 'bg-white/[0.07]',
                          )}
                        />
                        {isPopular && (
                          <span className="absolute left-1.5 top-1.5 z-10 inline-flex items-center gap-0.5 rounded-full bg-lime-text px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-text-inverse">
                            <Flame className="h-2 w-2" /> Popular
                          </span>
                        )}
                        {on && (
                          <span
                            aria-hidden
                            className="absolute right-1.5 top-1.5 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-lime-pressed text-text-inverse"
                          >
                            <Check className="h-2.5 w-2.5" strokeWidth={3} />
                          </span>
                        )}
                        <div className="relative flex h-14 items-center justify-center sm:h-16">
                          {bundle.icon_url ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={bundle.icon_url}
                              alt=""
                              className="max-h-full max-w-full object-contain drop-shadow-[0_10px_10px_rgba(0,0,0,0.45)] transition-transform duration-300 group-hover:scale-[1.06]"
                            />
                          ) : (
                            <div
                              aria-hidden
                              className="h-full w-full rounded-lg bg-bg-raised-hover"
                            />
                          )}
                        </div>
                        <div className="relative mt-2 line-clamp-1 text-[13px] font-semibold text-text-primary">
                          {bundle.name}
                        </div>
                        {/* Hairline fading right — softer than a full rule. */}
                        <div
                          className="mt-2 h-px bg-gradient-to-r from-border-default to-transparent"
                          aria-hidden
                        />
                        <div className="relative mt-2 text-[11px] text-text-tertiary">
                          {cheapestForBundle === Infinity ? (
                            'No offers'
                          ) : (
                            <>
                              from{' '}
                              <span
                                className={cn(
                                  'text-[13px] font-bold tabular-nums',
                                  on ? 'text-lime-text' : 'text-text-primary',
                                )}
                              >
                                {formatPrice(cheapestForBundle)}
                              </span>
                            </>
                          )}
                        </div>
                      </Card>
                    </label>
                  )
                })}
              </RadioGroup>
            </MobileSlider>
          </section>
        </div>

        {/* RIGHT COLUMN — offer panel. V19/P24/P7.j — Sticky removed
            so once the buyer scrolls past the bundle grid both
            columns release together; the page below (Other Sellers)
            becomes its own full-width section. */}
        <aside className="flex flex-col">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-[15px] font-bold text-text-primary">
              {isPicked ? 'Selected Seller' : 'Recommended Seller'}
            </h2>
            {isPicked && (
              <button
                type="button"
                onClick={() => setPickedListingId('')}
                className="text-[12px] font-semibold text-text-tertiary transition-colors hover:text-text-primary"
              >
                Reset
              </button>
            )}
          </div>
          <OfferPanel
            bestOffer={activeOffer}
            qty={cappedQty}
            setQty={setQty}
            isOwn={isOwn}
            onBuy={onBuy}
          />
        </aside>
      </div>

      {/* V19/P24/P7.j — Other Sellers is now a full-width section
          BELOW the 2-col grid. Bundles + offer card share the
          top area; this section owns its own scroll space. */}
      {bestOffer && (
        <section className="relative mx-auto mt-12 w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* V49 — Per-game 3D art backdrop, RIGHT edge of the section,
              fading softly toward the page content (Lone-Hawk-style
              edge art). The radial falloff is BAKED into the asset's
              alpha channel — no CSS mask, so no viewport- or
              section-boundary clipping can ever cut it. Convention:
              public/watermarks/{gameSlug}.webp, self-hiding when the
              file doesn't exist. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/watermarks/${data.gameSlug}.webp`}
            alt=""
            aria-hidden
            onError={(e) => { e.currentTarget.style.display = 'none' }}
            className="pointer-events-none absolute -top-20 right-0 -z-10 hidden h-80 w-80 rotate-12 select-none object-contain opacity-40 lg:block"
          />
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[26px] font-extrabold leading-tight tracking-tight text-text-primary sm:text-[30px]">
                Other <span className="text-lime-text">Sellers</span>
              </h2>
              <p className="mt-1.5 text-[13.5px] text-text-tertiary sm:text-[14px]">
                {otherOffers.length} more {otherOffers.length === 1 ? 'offer' : 'offers'} — pick by price, speed, or rating.
              </p>
            </div>
            {otherOffers.length > 0 && (
              <FilterChips
                filter={otherFilter}
                setFilter={setOtherFilter}
              />
            )}
          </div>
          <div
            aria-hidden
            className="mt-4 h-px w-full bg-[linear-gradient(to_right,#C6FF3D66,transparent_40%)]"
          />

          {/* V19/P24/P7.oo — Outer "box-in-box" wrapper removed.
              Seller rows float directly on the page; each row is its
              own <Card> surface (handled in SellerRow). */}
          <div className="mt-4">
            {otherOffers.length > 0 ? (
              <div className="space-y-2">
                {otherOffers.map((o) => (
                  <SellerRow
                    key={o.listingId}
                    offer={o}
                    isOwn={!!viewerId && o.sellerId === viewerId}
                    onSelect={() => {
                      setPickedListingId(o.listingId)
                      setQty(1)
                      if (typeof window !== 'undefined') {
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border-default bg-bg-raised/40 p-6 text-center">
                <p className="text-[13px] text-text-tertiary">
                  No other sellers for this bundle yet. The best price above is the only
                  offer right now.
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ─── HOW IT WORKS — full-bleed angled band (outside the max-w
          wrapper), pinned scroll-story with bundle-context copy. */}
      <HowItWorksBand
        steps={[
          { title: 'Pick Your Bundle', body: 'Choose platform, region, and amount.' },
          { title: 'Pay At Checkout', body: 'Every order is covered by SafeDrop Buyer Protection.' },
          { title: `Get Your ${data.unitLabel}`, body: 'Delivered to your account within the stated window.' },
          { title: 'Confirm Delivery', body: 'Confirm receipt and the seller gets paid — or you get a full refund.' },
        ]}
      />

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* ─── FAQ — admin-configured items, Flock-geometry cards. */}
        {data.faq.length > 0 && (
          <section className="mt-10 sm:mt-14">
            <SectionHeading
              kicker="FAQ"
              title="Frequently Asked"
              accent="Questions"
              sub={`Everything you need to know about buying ${data.gameName} ${data.unitLabel}.`}
            />
            <FaqCards items={data.faq} />
          </section>
        )}

        {/* ─── BLOG — game-relevant guides rail. */}
        {blogRail}
      </div>

      {/* ─── ACCEPTED PAYMENTS — full-bleed wordmark marquee. */}
      <PaymentsMarquee />
    </main>
  )
}

/* ── Option tiles — Region / Platform selector ──────────────────── */

/**
 * V52 — Column-aware selector row.
 *
 * The tiles never cross the "amount line" (the boundary where the
 * offer-panel column starts): on lg+ the row is capped to the left
 * column width (100% − 360px panel − 32px gap). Up to 6 options the
 * tiles lay out as ONE line at full size; 7+ becomes a themed
 * dropdown (tiles smaller than this read as clutter). Mobile keeps
 * fixed-size wrapping tiles.
 */
function OptionTiles({
  options,
  selected,
  onSelect,
  uppercase = false,
  variant = 'tile',
}: {
  options: Array<{ value: string; icon: string | null; label: string }>
  selected: string
  onSelect: (value: string) => void
  uppercase?: boolean
  /**
   * `tile` — square-ish card, icon stacked over label (platform logos).
   * `pill` — horizontal card, icon + label + check on one line (regions).
   *   "Pill" is the LAYOUT, not the radius: corners stay rectangular per the
   *   site's no-pill-shapes direction, unlike the fully-rounded reference.
   */
  variant?: 'tile' | 'pill'
}) {
  const n = options.length
  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === selected),
  )



  return (
    // V53 — Below `md` the row swipes instead of wrapping onto a second line
    // (4 platforms used to wrap 3+1, which read as a broken grid on a phone).
    <MobileSlider activeIndex={selectedIndex} itemCount={n}>
      <RadioGroup
        value={selected}
        onValueChange={onSelect}
        className="flex gap-2.5 md:flex-wrap lg:max-w-[calc(100%-24.5rem)] lg:flex-nowrap lg:gap-3"
      >
        {options.map((o) => {
          const on = selected === o.value
          return (
            <label
              key={o.value}
              className={cn(
                'block shrink-0',
                // Fixed width, never a % basis — see the bundle slides for why
                // a percentage collapses to content sizing here.
                variant === 'pill'
                  ? 'w-auto'
                  : 'w-[122px] lg:w-auto lg:min-w-0 lg:max-w-[122px] lg:flex-1',
              )}
            >
              <RadioGroupItem value={o.value} className="sr-only" />
              {/* V47b — Refined pick tile: sheen + hover lift + muted
                  lime selection glow. */}
              <Card
                className={cn(
                  'group relative flex cursor-pointer overflow-hidden border-2 bg-[rgba(20,20,27,0.56)] backdrop-blur-md transition-all duration-200',
                  variant === 'pill'
                    ? // Horizontal: icon + label + check on one line.
                      'h-[52px] items-center gap-2.5 px-3.5 py-0'
                    : 'h-[76px] flex-col items-center justify-center gap-1.5 p-2',
                  on
                    ? 'border-[#ABE52BB3] shadow-[0_8px_22px_-8px_rgba(171,229,43,0.22)]'
                    : 'border-border-default hover:-translate-y-0.5 hover:border-border-strong hover:bg-[rgba(26,26,35,0.70)] hover:shadow-[0_10px_22px_-10px_rgba(0,0,0,0.6)]',
                )}
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.06),transparent)]"
                />
                {/* Tile: check floats in the corner. Pill: it's the trailing
                    item on the line (like the reference's radio dot), so it
                    can't overlap the label. */}
                {on && variant === 'tile' && (
                  <span
                    aria-hidden
                    className="absolute right-1.5 top-1.5 z-10 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-lime-pressed text-text-inverse"
                  >
                    <Check className="h-2 w-2" strokeWidth={3} />
                  </span>
                )}
                {o.icon ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={o.icon}
                    alt=""
                    className={cn(
                      'shrink-0 object-contain drop-shadow-[0_6px_8px_rgba(0,0,0,0.45)] transition-transform duration-300 group-hover:scale-105',
                      variant === 'pill' ? 'h-6 w-6' : 'h-8 w-8',
                    )}
                  />
                ) : (
                  <div
                    aria-hidden
                    className={cn(
                      'shrink-0 rounded-lg bg-bg-raised-hover',
                      variant === 'pill' ? 'h-6 w-6' : 'h-8 w-8',
                    )}
                  />
                )}
                <span
                  className={cn(
                    'truncate font-semibold text-text-primary',
                    variant === 'pill'
                      ? 'text-[13px]'
                      : 'max-w-full text-[11px]',
                    uppercase && 'uppercase tracking-wide',
                  )}
                >
                  {o.label}
                </span>
                {variant === 'pill' && (
                  <span
                    aria-hidden
                    className={cn(
                      'ml-1 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border transition-colors duration-200',
                      on
                        ? 'border-transparent bg-lime-pressed text-text-inverse'
                        : 'border-border-strong bg-transparent',
                    )}
                  >
                    {on && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                  </span>
                )}
              </Card>
            </label>
          )
        })}
      </RadioGroup>
    </MobileSlider>
  )
}

/* ── Sticky Offer Panel ──────────────────────────────────────────── */

function OfferPanel({
  bestOffer,
  qty,
  setQty,
  isOwn,
  onBuy,
}: {
  bestOffer: BundleOffer | null
  qty: number
  setQty: (n: number) => void
  isOwn: boolean
  onBuy: (listingId: string, quantity: number) => void
}) {
  if (!bestOffer) {
    return (
      <Card className="relative overflow-hidden border-border-default bg-bg-overlay p-6">
        <div className="text-[24px] font-black text-text-disabled">N/A</div>
        <p className="mt-3 text-[13px] text-text-tertiary">
          No sellers for this bundle in the selected region yet. Try another region
          or check back soon.
        </p>
      </Card>
    )
  }

  const total = bestOffer.pricePerBundle * qty

  return (
    <>
    {/* V43 — SafeDrop emblem watermark peeks from the corner (matches
        the item + currency buy panels). `isolate` creates the stacking
        context so the -z-10 art paints above the card bg but below rows. */}
    <Card className="relative isolate flex h-full min-h-[440px] flex-col overflow-hidden border-border-default bg-bg-overlay p-5 shadow-elevated">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icons/safedrop-emblem.png"
        alt=""
        aria-hidden
        className="pointer-events-none absolute -bottom-16 -right-8 -z-10 h-44 w-44 rotate-12 select-none opacity-[0.32]"
      />
      {/* V19/P24/P7.m — Each block is its own row with `py-3` padding
          and a `border-b border-border-subtle` divider, giving the
          panel a clean "stacked table" feel that fills vertical space
          naturally without `mt-auto` hacks. Last block before the
          Buy CTA drops its border so we don't double-line. */}

      {/* 1) Seller */}
      <div className="pb-4">
        <SellerStatsChip offer={bestOffer} />
      </div>

      {/* 2) Delivery time */}
      <div className="border-t border-border-subtle py-3.5">
        <KeyValue
          label="Delivery Time"
          value={
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-text-secondary" />
              {bestOffer.deliveryLabel}
            </span>
          }
        />
      </div>

      {/* 3) Delivery instructions — always render, falls back to a
          generic line so the row never disappears. */}
      <div className="border-t border-border-subtle py-3.5">
        <div className="mb-1.5 text-[14.5px] font-semibold text-text-primary">
          Delivery Instructions
        </div>
        <CollapsibleText
          text={
            bestOffer.blurb ||
            'Seller will message you for delivery details after purchase.'
          }
        />
      </div>

      {/* 4) Quantity */}
      <div className="flex items-center justify-between gap-3 border-t border-border-subtle py-3.5">
        <span className="text-[14.5px] font-semibold text-text-primary">
          Quantity
        </span>
        <NumberField
          value={qty}
          onChange={(v) => setQty(Math.max(1, Math.min(bestOffer.stock, v)))}
          minValue={1}
          maxValue={Math.max(1, bestOffer.stock)}
          className="h-10 w-32"
          ariaLabel="Quantity"
        />
      </div>

      {/* 5) Total */}
      <div className="flex items-baseline justify-between gap-2 border-t border-border-subtle py-3.5">
        <span className="text-[14.5px] font-semibold text-text-primary">
          Total
        </span>
        <div className="text-right">
          <div className="flex items-baseline justify-end gap-1.5">
            <span className="text-[26px] font-black tabular-nums leading-none text-text-primary">
              {formatPrice(total)}
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
              USD
            </span>
          </div>
        </div>
      </div>

      {/* 6) Buy now */}
      {isOwn ? (
        <div className="mt-4 rounded-xl border border-warning/40 bg-warning-bg/40 px-3 py-2.5 text-[12px] text-warning">
          This is your listing. Buyers see the Buy button here.
        </div>
      ) : (
        <Button
          onClick={() => onBuy(bestOffer.listingId, qty)}
          className="mt-4 h-12 w-full bg-lime text-[15px] font-bold tracking-wide text-text-inverse hover:bg-lime-hover"
        >
          Buy Now
        </Button>
      )}

    </Card>

      {/* 7) Trust tiles — own card below the panel (item-page rail
          format; same width so alignment is automatic). */}
      <Card className="relative mt-3 overflow-hidden border-border-default bg-bg-overlay p-4 shadow-elevated">
        <TrustBand />
      </Card>
    </>
  )
}

/* ── Collapsible instructions ──────────────────────────────────── */

function CollapsibleText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  // V19/P24/P7.g — Soft truncation: line-clamp to 3 lines when
  // collapsed. We compute a heuristic for "is it actually overflowing"
  // off line breaks + length so we only render Show more when needed.
  const looksTruncated =
    text.split(/\r?\n/).length > 3 || text.length > 180
  return (
    <div>
      <p
        className={cn(
          'whitespace-pre-line text-[13.5px] leading-relaxed text-text-secondary',
          !expanded && 'line-clamp-3',
        )}
      >
        {text}
      </p>
      {looksTruncated && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-[12px] font-semibold text-lime-text transition-colors hover:text-text-primary"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  )
}

/* ── Inline label / value row ──────────────────────────────────── */

function KeyValue({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-[14.5px]">
      <span className="font-semibold text-text-primary">{label}</span>
      {/* V21/P7 — Value is real data, not a caption. Use secondary
          (now brightened) + medium weight, not the dim tertiary. */}
      <div className="font-medium text-text-secondary">{value}</div>
    </div>
  )
}

/* ── Seller stats chip ─────────────────────────────────────────── */

function SellerStatsChip({ offer }: { offer: BundleOffer }) {
  const inner = (
    <div className="flex items-center gap-2.5">
      {offer.sellerAvatarUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={offer.sellerAvatarUrl}
          alt=""
          className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-border-subtle"
        />
      ) : (
        <div
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg-overlay text-[13px] font-bold text-text-primary ring-1 ring-border-subtle"
        >
          {offer.sellerName.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="truncate text-[13.5px] font-semibold text-text-primary">
            {offer.sellerName}
          </span>
          {offer.verified && (
            <BadgeCheck
              className="h-3.5 w-3.5 shrink-0 text-lime-text"
              aria-label="Verified"
            />
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-text-tertiary">
          <span className="font-semibold text-text-secondary">
            {offer.rating.toFixed(1)}%
          </span>
          <span aria-hidden>·</span>
          <span>
            {offer.reviews.toLocaleString()} review{offer.reviews === 1 ? '' : 's'}
          </span>
        </div>
      </div>
    </div>
  )

  if (!offer.sellerUsername) {
    return <div>{inner}</div>
  }
  return (
    <Link
      href={`/shop/${offer.sellerUsername}`}
      className="block rounded-xl transition-colors hover:bg-bg-overlay/40"
    >
      {inner}
    </Link>
  )
}

/* ── Other Seller row ──────────────────────────────────────────── */

function SellerRow({
  offer,
  isOwn,
  onSelect,
}: {
  offer: BundleOffer
  isOwn: boolean
  onSelect: () => void
}) {
  return (
    <Card className="group relative overflow-hidden border-border-default bg-[rgba(20,20,27,0.56)] backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:bg-[rgba(26,26,35,0.70)] hover:shadow-[0_12px_24px_-12px_rgba(0,0,0,0.6)]">
      {/* Top sheen — bundle-tile light-from-above. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.05),transparent)]"
      />
      <div className="relative flex items-center gap-3 p-4 sm:gap-5 sm:p-5">
        {/* Seller — leads the row, clickable chip → /shop/{username} */}
        <div className="min-w-0 flex-1">
          <SellerChip offer={offer} />
          <div className="mt-1.5 flex items-center gap-2 text-[12.5px] text-text-tertiary">
            <span className="font-semibold text-text-secondary">
              {offer.rating.toFixed(1)}%
            </span>
            <span aria-hidden>·</span>
            <span>
              {offer.reviews.toLocaleString()} review{offer.reviews === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        {/* V19/P24/P7.h — Stock + Delivery metric columns, desktop
            only. Mirrors the flexible Robux page's row geometry so
            buyers see consistent data across both flows. */}
        <div className="hidden items-center gap-5 sm:flex">
          <MetricCol
            icon={Package}
            label="Stock"
            value={offer.stock.toLocaleString('en-US')}
            width={100}
          />
          <MetricCol
            icon={Clock}
            label="Delivery"
            value={offer.deliveryLabel}
            width={110}
          />
          <span aria-hidden className="h-10 w-px bg-border-subtle" />
        </div>

        {/* Price + CTA */}
        <div className="shrink-0 text-right">
          <div className="text-[18px] font-bold tabular-nums text-text-primary sm:text-[20px]">
            {formatPrice(offer.pricePerBundle)}
          </div>
          {isOwn ? (
            <Button
              disabled
              size="sm"
              variant="outline"
              className="mt-1.5 h-9 px-4"
            >
              Yours
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={onSelect}
              className="mt-1.5 h-9 bg-lime px-4 font-bold text-text-inverse hover:bg-lime-hover"
            >
              Select
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}

/* ── Metric column for Other Sellers row ───────────────────────── */

function MetricCol({
  icon: Icon,
  label,
  value,
  width,
}: {
  icon: LucideIcon
  label: string
  value: string
  width: number
}) {
  return (
    <div style={{ width }} className="shrink-0">
      <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-0.5 truncate text-[14px] font-semibold tabular-nums text-text-primary">
        {value}
      </div>
    </div>
  )
}

/* ── Filter chips — Recommended / Cheapest / Fastest ───────────── */

function FilterChips({
  filter,
  setFilter,
}: {
  filter: 'recommended' | 'cheapest' | 'fastest'
  setFilter: (f: 'recommended' | 'cheapest' | 'fastest') => void
}) {
  return (
    // Mobile-audit — flex-wrap so the chip group never forces horizontal
    // page scroll at 360px (mirrors the fix in _CurrencyPageClient).
    <div className="flex flex-wrap items-center gap-1.5">
      <FilterChip
        active={filter === 'recommended'}
        onClick={() => setFilter('recommended')}
        icon={Star}
        label="Recommended"
      />
      <FilterChip
        active={filter === 'cheapest'}
        onClick={() => setFilter('cheapest')}
        icon={SlidersHorizontal}
        label="Cheapest"
      />
      <FilterChip
        active={filter === 'fastest'}
        onClick={() => setFilter('fastest')}
        icon={Zap}
        label="Fastest"
      />
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: LucideIcon
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        // Mobile-audit — min-h-9 (36px) keeps the tap target at the dense
        // control floor on phones without changing the visual pill shape.
        'inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-colors sm:text-[13px]',
        active
          ? 'border-lime-tint-border bg-lime-tint-bg text-lime-text'
          : 'border-border-subtle bg-transparent text-text-secondary hover:border-border-default hover:text-text-primary',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}

/* ── Reusable seller chip — avatar + name + verified -> /shop/{username} ── */

function SellerChip({
  offer,
  size = 'md',
}: {
  offer: BundleOffer
  size?: 'md' | 'lg'
}) {
  const avatarSize = size === 'lg' ? 36 : 28
  const nameClass =
    size === 'lg'
      ? 'truncate text-[14px] font-semibold text-text-primary'
      : 'truncate text-[13.5px] font-semibold text-text-primary'

  const inner = (
    <>
      {offer.sellerAvatarUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={offer.sellerAvatarUrl}
          alt=""
          className="shrink-0 rounded-full object-cover ring-1 ring-border-subtle"
          style={{ width: avatarSize, height: avatarSize }}
        />
      ) : (
        <div
          aria-hidden
          className="flex shrink-0 items-center justify-center rounded-full bg-bg-overlay font-bold text-text-primary ring-1 ring-border-subtle"
          style={{
            width: avatarSize,
            height: avatarSize,
            fontSize: Math.round(avatarSize * 0.42),
          }}
        >
          {offer.sellerName.slice(0, 1).toUpperCase()}
        </div>
      )}
      <span className={nameClass}>{offer.sellerName}</span>
      {offer.verified && (
        <ShieldCheck
          className="h-3.5 w-3.5 shrink-0 text-lime-text"
          aria-label="Verified"
        />
      )}
    </>
  )

  // Falls back to non-link when we don't have a username (legacy data).
  if (!offer.sellerUsername) {
    return (
      <div className="inline-flex min-w-0 items-center gap-2">{inner}</div>
    )
  }

  return (
    <Link
      href={`/shop/${offer.sellerUsername}`}
      className="group inline-flex min-w-0 items-center gap-2 rounded-full transition-colors hover:text-lime-text"
    >
      {inner}
    </Link>
  )
}

/* ── Helpers ─────────────────────────────────────────────────────── */

function formatPrice(n: number): string {
  if (!Number.isFinite(n)) return '$0.00'
  return `$${n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}
