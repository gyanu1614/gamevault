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
 */

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { BadgeCheck, Check, Clock, Flame, Headphones, Package, ShieldCheck, SlidersHorizontal, Star, Zap, type LucideIcon } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { NumberField } from '@/components/ui/number-field'
import { Button } from '@/components/ui/button'
import type { CurrencyBundle, PlatformOption } from '@/lib/types/category-configs'
import { FAQ, HowItWorks, type CurrencyFaq, type CurrencyStep } from './_CurrencyMeta'

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
  /** All region options the admin enabled (empty array hides the selector). */
  regions: string[]
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
}: {
  data: BundleCurrencyPageData
  viewerId: string | null
}) {
  // V19/P24/P4 — Region selection defaults to the first enabled region.
  // When admin disabled regions entirely we use empty string as a
  // sentinel ("no region constraint") and skip the region selector
  // section.
  const [region, setRegion] = useState<string>(data.regions[0] ?? '')

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

  return (
    <main className="min-h-screen pb-24">
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
          <RadioGroup
            value={platform}
            onValueChange={(v) => {
              setPlatform(v)
              setPickedListingId('')
            }}
            className="flex flex-wrap gap-3"
          >
            {data.platforms.map((p) => {
              const on = platform === p.value
              return (
                <label key={p.value} className="block">
                  <RadioGroupItem value={p.value} className="sr-only" />
                  <Card
                    className={cn(
                      'relative flex h-[88px] w-[140px] cursor-pointer flex-col items-center justify-center gap-1.5 overflow-hidden border-2 bg-[rgba(20,20,27,0.56)] p-2 backdrop-blur-md transition-colors',
                      on
                        ? 'border-lime'
                        : 'border-border-default hover:border-border-strong hover:bg-[rgba(26,26,35,0.70)]',
                    )}
                  >
                    {on && (
                      <span
                        aria-hidden
                        className="absolute right-1.5 top-1.5 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-lime text-text-inverse"
                      >
                        <Check className="h-2.5 w-2.5" strokeWidth={3} />
                      </span>
                    )}
                    {p.icon_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={p.icon_url}
                        alt=""
                        className="h-10 w-10 shrink-0 object-contain"
                      />
                    ) : (
                      <div
                        aria-hidden
                        className="h-10 w-10 shrink-0 rounded-lg bg-bg-raised-hover"
                      />
                    )}
                    <span className="text-[12.5px] font-semibold uppercase tracking-wide text-text-primary">
                      {p.value}
                    </span>
                  </Card>
                </label>
              )
            })}
          </RadioGroup>
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
          <RadioGroup
            value={region}
            onValueChange={(v) => {
              setRegion(v)
              setPickedListingId('')
            }}
            className="flex flex-wrap gap-2"
          >
            {data.regions.map((r) => {
              const on = region === r
              return (
                <label
                  key={r}
                  className={cn(
                    'inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border px-4 text-[13px] font-semibold transition-colors',
                    on
                      ? 'border-lime bg-lime-tint-bg text-lime-text'
                      : 'border-border-default bg-bg-inset text-text-secondary hover:border-border-strong hover:text-text-primary',
                  )}
                >
                  <RadioGroupItem value={r} className="sr-only" />
                  {r}
                  {on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                </label>
              )
            })}
          </RadioGroup>
        </section>
      )}

      <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 pt-6 sm:px-6 lg:grid-cols-[1fr_360px] lg:items-stretch lg:gap-8 lg:px-8">
        {/* LEFT COLUMN — bundle grid + other sellers */}
        <div className="space-y-6">
          <section>
            <h2 className="mb-3 text-[15px] font-bold text-text-primary">
              Choose Amount
            </h2>
            <RadioGroup
              value={bundleId}
              onValueChange={(v) => {
                setBundleId(v)
                setQty(1)
                setPickedListingId('')
              }}
              className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
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
                  <label key={bundle.id} className="block">
                    <RadioGroupItem value={bundle.id} className="sr-only" />
                    <Card
                      className={cn(
                        'relative cursor-pointer overflow-hidden border-2 bg-[rgba(20,20,27,0.56)] p-3 backdrop-blur-md transition-colors',
                        on
                          ? 'border-lime'
                          : 'border-border-default hover:border-border-strong hover:bg-[rgba(26,26,35,0.70)]',
                      )}
                    >
                      {isPopular && (
                        <span className="absolute left-1.5 top-1.5 z-10 inline-flex items-center gap-0.5 rounded-full bg-lime-text px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-text-inverse">
                          <Flame className="h-2 w-2" /> Popular
                        </span>
                      )}
                      {on && (
                        <span
                          aria-hidden
                          className="absolute right-1.5 top-1.5 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-lime text-text-inverse"
                        >
                          <Check className="h-2.5 w-2.5" strokeWidth={3} />
                        </span>
                      )}
                      <div className="flex h-16 items-center justify-center sm:h-20">
                        {bundle.icon_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={bundle.icon_url}
                            alt=""
                            className="max-h-full max-w-full object-contain"
                          />
                        ) : (
                          <div
                            aria-hidden
                            className="h-full w-full rounded-lg bg-bg-raised-hover"
                          />
                        )}
                      </div>
                      <div className="mt-2 line-clamp-1 text-[13px] font-semibold text-text-primary">
                        {bundle.name}
                      </div>
                      {/* V19/P24/P7.n — Faint divider between name and
                          price for clearer visual hierarchy. */}
                      <div
                        className="mt-2 h-px bg-border-subtle"
                        aria-hidden
                      />
                      <div className="mt-2 text-[12px] text-text-tertiary">
                        {cheapestForBundle === Infinity
                          ? 'No offers'
                          : `from ${formatPrice(cheapestForBundle)}`}
                      </div>
                    </Card>
                  </label>
                )
              })}
            </RadioGroup>
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
          />
        </aside>
      </div>

      {/* V19/P24/P7.j — Other Sellers is now a full-width section
          BELOW the 2-col grid. Bundles + offer card share the
          top area; this section owns its own scroll space. */}
      {bestOffer && (
        <section className="mx-auto mt-12 w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-3 px-1">
            <div className="min-w-0 space-y-1">
              <h2 className="text-[20px] font-bold text-text-primary sm:text-[22px]">
                Other Sellers
              </h2>
              <p className="text-[13px] text-text-tertiary sm:text-[13.5px]">
                {otherOffers.length} more {otherOffers.length === 1 ? 'offer' : 'offers'} — pick by price, speed, or rating
              </p>
            </div>
            {otherOffers.length > 0 && (
              <FilterChips
                filter={otherFilter}
                setFilter={setOtherFilter}
              />
            )}
          </div>

          {/* V19/P24/P7.oo — Outer "box-in-box" wrapper removed.
              Seller rows float directly on the page; each row is its
              own <Card> surface (handled in SellerRow). */}
          <div className="mt-3">
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

      {/* V19/P24/P7.d — How it works + FAQ. Same blocks as the
          flexible currency page; admin edits flow through the same
          currency_config rows. */}
      {(data.steps.length > 0 || data.faq.length > 0) && (
        <div className="mx-auto mt-16 w-full max-w-7xl space-y-16 px-4 sm:px-6 lg:px-8">
          {data.steps.length > 0 && <HowItWorks steps={data.steps} />}
          {data.faq.length > 0 && <FAQ items={data.faq} />}
        </div>
      )}
    </main>
  )
}

/* ── Sticky Offer Panel ──────────────────────────────────────────── */

function OfferPanel({
  bestOffer,
  qty,
  setQty,
  isOwn,
}: {
  bestOffer: BundleOffer | null
  qty: number
  setQty: (n: number) => void
  isOwn: boolean
}) {
  if (!bestOffer) {
    return (
      <Card className="relative overflow-hidden border-border-default bg-[rgba(20,20,27,0.56)] p-6 backdrop-blur-md">
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
    <Card className="relative flex h-full min-h-[440px] flex-col overflow-hidden border-border-default bg-[rgba(20,20,27,0.56)] p-5 shadow-elevated backdrop-blur-md">
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
          asChild
          className="mt-4 h-12 w-full bg-lime text-[15px] font-bold tracking-wide text-text-inverse hover:bg-lime-hover"
        >
          <Link href={`/checkout/${bestOffer.listingId}?qty=${qty}`}>
            Buy Now
          </Link>
        </Button>
      )}

      {/* 7) Trust band */}
      <TrustBand />
    </Card>
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

/* ── Trust band — 3 hover-revealed guarantees ────────────────────── */

const TRUST_ITEMS: Array<{
  key: 'guarantee' | 'fast' | 'support'
  label: string
  tooltip: string
  icon: React.ComponentType<{ className?: string }>
  accent: string
}> = [
  {
    key: 'guarantee',
    label: 'Money-back',
    tooltip:
      'Full refund if the seller doesn’t deliver. Escrow holds your payment until you confirm.',
    icon: ShieldCheck,
    accent: 'text-lime-text',
  },
  {
    key: 'fast',
    label: 'Quick delivery',
    tooltip:
      'Average delivery under 15 minutes. Listings are ranked by speed so the fastest sellers come first.',
    icon: Zap,
    accent: 'text-warning',
  },
  {
    key: 'support',
    label: '24/7 support',
    tooltip:
      'Live human support every day of the year. Open a ticket or chat in-app any time.',
    icon: Headphones,
    accent: 'text-info',
  },
]

function TrustBand() {
  return (
    <TooltipProvider delayDuration={150}>
      {/* V19/P24/P7.e.c — Column layout per tile (icon above label),
          compact so 3 fit without overlap in the 360px panel. Label
          allowed to wrap to 2 lines, balanced. */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        {TRUST_ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <Tooltip key={item.key}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="group flex min-w-0 flex-col items-center gap-1.5 rounded-xl border border-border-subtle bg-bg-inset/70 px-1.5 py-2.5 transition-colors hover:border-border-default hover:bg-bg-overlay"
                >
                  <span
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg-overlay transition-transform group-hover:scale-110',
                      item.accent,
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-balance text-center text-[10.5px] font-semibold leading-tight text-text-secondary group-hover:text-text-primary">
                    {item.label}
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                sideOffset={6}
                className="max-w-[220px] text-[12.5px] leading-snug"
              >
                {item.tooltip}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </TooltipProvider>
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
    <Card className="overflow-hidden border-border-default bg-[rgba(20,20,27,0.56)] backdrop-blur-md transition-colors hover:bg-[rgba(26,26,35,0.70)]">
      <div className="flex items-center gap-3 p-4 sm:gap-5 sm:p-5">
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
    <div className="flex items-center gap-1.5">
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
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-colors sm:text-[13px]',
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
