'use client'

/**
 * Listing detail client — floating-media layout.
 *
 * Full page composed of:
 *   1. Main grid (1.5fr : 1fr):
 *      - LEFT: floating image (no card), title + eyebrow, description
 *        block, and the "Similar listings" carousel.
 *      - RIGHT (sticky rail): separate small bg-bg-overlay cards — Buy,
 *        Details spec, Seller, Trust.
 *   2. From the same seller — horizontal scroll-snap carousel.
 *   3. Trust band — SafeDrop blurbs.
 *   4. FAQ — game/category-keyword stuffed for SEO.
 *   5. Accepted payments strip.
 *
 * All built from GV primitives (Card, Badge, Button, Tooltip,
 * Separator). Mobile-first; sticky bottom Buy bar.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft, ChevronRight, Clock, Package, Globe, Gamepad2,
  CheckCircle2, ShoppingBag, Loader2, ArrowUpRight,
  Award, Sparkles, ChevronDown,
} from 'lucide-react'
import { useAuthDialog } from '@/components/auth/AuthDialog'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import ItemCard from '../_ItemCard'
import type { ItemOffer } from '../_itemsTypes'
import { NumberField } from '@/components/ui/number-field'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { formatDeliveryLabel } from '@/lib/utils/delivery-time'
import DescriptionIcon from '@/components/icons/DescriptionIcon'
import HowItWorksBand from '@/components/marketplace/HowItWorksBand'
import { BlogSection } from '@/components/blog/BlogSection'
import { SectionHeading } from '@/components/marketplace/SectionHeading'
import { TrustBand } from '@/components/marketplace/TrustBand'
import { PaymentsMarquee } from '@/components/marketplace/PaymentsMarquee'
import { FaqCards } from '@/components/marketplace/FaqCards'
import type { TemplateField } from '@/lib/templates/types'

const fmtPrice = (n: number) => {
  if (n === 0) return '$0.00'
  if (Math.abs(n) < 0.01) return `$${n.toFixed(4)}`
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
const fmtCount = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return n.toLocaleString('en-US')
}

export interface ListingForDetail {
  id: string
  slug: string
  title: string
  description: string | null
  price: number
  originalPrice: number | null
  images: string[]
  views: number
  createdAt: string
  quantity: number | null
  isUnlimited: boolean
  deliveryMethod: string | null
  deliveryTime: string | null
  region: string | null
  platform: string | null
  templateData: Record<string, unknown> | null
  gameSlug: string
  gameName: string
  gameImageUrl: string | null
  categorySlug: string
  categoryName: string
  seller: {
    id: string
    username: string
    shopName: string | null
    avatarUrl: string | null
    tier: string | null
    verified: boolean
    rating: number
    totalSales: number
    activeListings: number
    createdAt: string | null
  }
}

export interface MiniListing {
  id: string
  slug: string
  title: string
  price: number
  image: string | null
  seller: {
    username: string
    shopName: string | null
    avatarUrl: string | null
    verified: boolean
    rating: number
    totalSales: number
  }
  categorySlug: string
}

interface Props {
  listing: ListingForDetail
  viewerId: string | null
  templateFields: TemplateField[] | null
  similarOffers: MiniListing[]
  /** V15p — When the current listing is in the items category, the
   *  server also ships a full ItemOffer[] so we can re-use the exact
   *  ItemCard from /items here. Avoids two-card-style drift between the
   *  catalog and the detail page's similar-offers strip. */
  similarOffersAsItems?: ItemOffer[] | null
  /** V28 — Cross-seller offers of THIS exact item (tier-sorted server-
   *  side: exact-variant matches cheapest-first, then same item with a
   *  different rarity/mutation). Replaces "From the same seller". */
  otherSellerOffers?: ItemOffer[] | null
}

const TIER_BADGES: Record<string, { label: string; color: string }> = {
  unverified: { label: 'Unverified', color: 'text-text-tertiary' },
  bronze: { label: 'Bronze', color: 'text-orange-300' },
  silver: { label: 'Silver', color: 'text-text-secondary' },
  gold: { label: 'Gold', color: 'text-warning' },
  platinum: { label: 'Platinum', color: 'text-cyan-300' },
  diamond: { label: 'Diamond', color: 'text-lime-text' },
}

export default function ListingDetailClient({
  listing, viewerId, templateFields, similarOffers, similarOffersAsItems, otherSellerOffers,
}: Props) {
  const router = useRouter()
  const { open: openAuth } = useAuthDialog()
  const [activeImg, setActiveImg] = useState(0)
  const [qty, setQty] = useState(1)
  const [navigating, startNav] = useTransition()
  const purchaseRef = useRef<HTMLDivElement | null>(null)
  const [showMobileBar, setShowMobileBar] = useState(false)
  const isOwn = !!viewerId && viewerId === listing.seller.id

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual'
    }
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [])

  useEffect(() => {
    const el = purchaseRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => setShowMobileBar(!entry.isIntersecting),
      { rootMargin: '-80px 0px 0px 0px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // V30 — Centered sticky rail. Instead of a fixed top offset, the
  // pinned position is computed so the buy panel floats vertically
  // centered in the viewport while the left column scrolls past.
  // Clamped to 96px so it never slides under the fixed navbar.
  // Recomputes when the rail resizes (qty field, spec rows) or the
  // window does. Only meaningful on lg+ (sticky is lg-only); below
  // that the inline `top` is inert on a static element.
  const [railTop, setRailTop] = useState(128)
  useEffect(() => {
    const el = purchaseRef.current
    if (!el) return
    const compute = () =>
      setRailTop(Math.max(96, Math.round((window.innerHeight - el.offsetHeight) / 2)))
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(el)
    window.addEventListener('resize', compute)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', compute)
    }
  }, [])

  const onBuy = () => {
    if (isOwn) { router.push(`/sell/edit/${listing.id}`); return }
    // Logged out: open the sign-in modal IN PLACE (no bounce to home) with the
    // checkout as the post-auth redirect. After sign-in the modal sends the
    // buyer straight to checkout for this listing — they keep their context.
    // V14j — carry the picked quantity into checkout (?qty= deep-link);
    // without it multi-qty buys landed in checkout as Qty ×1.
    if (!viewerId) {
      openAuth('login', { redirect: `/checkout/${listing.id}?qty=${qty}` })
      return
    }
    startNav(() => router.push(`/checkout/${listing.id}?qty=${qty}`))
  }

  const discountPct = listing.originalPrice && listing.originalPrice > listing.price
    ? Math.round(((listing.originalPrice - listing.price) / listing.originalPrice) * 100)
    : 0

  // Quantity ceiling — unlimited stock caps at a sane 99, otherwise the
  // seller's available quantity. Instant-delivery listings are single-unit.
  const maxQty = listing.isUnlimited ? 99 : Math.max(1, listing.quantity ?? 1)

  const tierKey = (listing.seller.tier ?? 'unverified').toLowerCase()
  const tier = TIER_BADGES[tierKey] ?? TIER_BADGES.unverified
  const sellerName = listing.seller.shopName?.trim() || listing.seller.username
  const sellerInitial = sellerName.charAt(0).toUpperCase()

  const onGalleryKey = (e: React.KeyboardEvent) => {
    if (listing.images.length <= 1) return
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      setActiveImg((i) => (i + 1) % listing.images.length)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      setActiveImg((i) => (i - 1 + listing.images.length) % listing.images.length)
    }
  }

  const heroImg = listing.images[activeImg] || listing.images[0] || null

  // V15k — Info rows derived from listing meta + template_data.
  const infoRows = useMemo(() => {
    const rows: Array<{ label: string; value: string; hint?: string }> = []
    if (listing.deliveryTime || listing.deliveryMethod) {
      rows.push({
        label: 'Delivery Time',
        value:
          listing.deliveryMethod === 'instant'
            ? 'Instant'
            : prettifyDelivery(listing.deliveryTime) || 'Manual',
      })
    }
    if (listing.deliveryMethod) {
      rows.push({
        label: 'Delivery Method',
        value: listing.deliveryMethod === 'instant' ? 'Instant' : titleCase(listing.deliveryMethod),
      })
    }
    // V25 — "In Stock" moved out of the spec rows: it's now shown as the
    // "In stock: N" caption under the Quantity stepper, so a row here would
    // duplicate it. For instant / single-unit listings (no stepper) we still
    // surface stock so it isn't lost.
    if (listing.deliveryMethod === 'instant' || (!listing.isUnlimited && (listing.quantity ?? 0) <= 1)) {
      rows.push({
        label: 'In Stock',
        value: listing.isUnlimited
          ? 'Unlimited'
          : (listing.quantity ?? 0) > 0
            ? fmtCount(listing.quantity ?? 0)
            : 'Out of stock',
      })
    }
    if (listing.region) rows.push({ label: 'Region', value: listing.region.toUpperCase() })
    if (listing.platform) rows.push({ label: 'Platform', value: titleCase(listing.platform) })
    // Template fields — show every filled value.
    if (templateFields && listing.templateData) {
      for (const f of templateFields) {
        const raw = (listing.templateData as Record<string, unknown>)[(f as any).key]
        if (raw == null || raw === '') continue
        const value = Array.isArray(raw) ? (raw as string[]).join(', ') : String(raw)
        rows.push({
          label: (f as any).label as string,
          value: titleCase(value.replace(/-/g, ' ')),
        })
      }
    }
    return rows
  }, [listing, templateFields])

  return (
    <main className="min-h-screen pb-16 sm:pb-12">
      {/* PAGE WRAPPER — V29: the sub-navbar is gone on detail pages, so
          the wrapper owns its clearance under the fixed navbar and the
          context row (Game › Category) is the breadcrumb/back
          affordance. V30 — clearance bumped for breathing room between
          the navbar and the title block. */}
      <div className="mx-auto w-full max-w-7xl px-3 pt-8 sm:px-6 sm:pt-10 lg:px-8">
        {/* MAIN GRID — floating media + spec/purchase rail.
            V24 — Full max-w-7xl (matches items/currency pages). Left column
            flexes; the right rail is a fixed ~380px. The image is capped
            (max-w-[340px]) so it stays a modest hero even though the left
            column is wide — the description + similar carousel fill the rest. */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8 lg:items-start">
          {/* LEFT — header (logo+name eyebrow → title → meta) on top, then a
              centered floating image, then the description card + similar
              listings. */}
          <div className="min-w-0 space-y-5">
            {/* Header — stacked identity (Option A). A logo-led
                `Game › Category` context row sits on top, then the big
                title, then the meta row — one clean vertical rhythm.
                Game + category remain clickable (nav preserved). */}
            <div>
              {/* Context row: logo + Game › Category */}
              <div className="mb-3 flex items-center gap-2.5 text-[13px] font-medium">
                {listing.gameImageUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={listing.gameImageUrl}
                    alt={listing.gameName}
                    className="h-8 w-8 shrink-0 rounded-lg object-cover ring-1 ring-border-subtle"
                  />
                ) : (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-bg-overlay ring-1 ring-border-subtle">
                    <Gamepad2 className="h-4 w-4 text-lime-text" />
                  </span>
                )}
                <Link
                  href={`/${listing.gameSlug}`}
                  className="text-text-primary transition-colors hover:text-lime-text"
                >
                  {listing.gameName}
                </Link>
                <span aria-hidden className="text-text-disabled">›</span>
                <Link
                  href={`/${listing.gameSlug}/${listing.categorySlug}`}
                  className="text-text-secondary transition-colors hover:text-text-primary"
                >
                  {listing.categoryName}
                </Link>
              </div>
              <h1 className="text-[24px] font-bold leading-tight text-text-primary sm:text-[28px] lg:text-[30px]">
                {listing.title}
              </h1>
              {/* V27 — Views + listed-date meta row removed. The discount
                  badge (when present) stays as a standalone commercial cue. */}
              {discountPct > 0 && (
                <div className="mt-2.5">
                  <Badge className="bg-success-bg text-success border-success/30">
                    -{discountPct}% off
                  </Badge>
                </div>
              )}
            </div>

            {/* Floating gallery — centered, height-capped. */}
            <div>
              <div
                role="region"
                aria-roledescription="carousel"
                aria-label={`Images for ${listing.title}`}
                tabIndex={0}
                onKeyDown={onGalleryKey}
                className="relative mx-auto aspect-square w-full max-w-[360px] overflow-hidden rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent focus-visible:ring-lime-tint-bg"
              >
                <AnimatePresence mode="wait" initial={false}>
                  {heroImg ? (
                    <motion.img
                      key={heroImg}
                      src={heroImg}
                      alt={listing.title}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="absolute inset-0 h-full w-full rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-text-tertiary">
                      <Gamepad2 className="h-12 w-12" />
                    </div>
                  )}
                </AnimatePresence>
                {listing.images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setActiveImg((i) => (i - 1 + listing.images.length) % listing.images.length)}
                      aria-label="Previous image"
                      className="absolute left-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border-default bg-bg-base/70 text-text-primary backdrop-blur-md transition-colors hover:bg-bg-base"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveImg((i) => (i + 1) % listing.images.length)}
                      aria-label="Next image"
                      className="absolute right-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border-default bg-bg-base/70 text-text-primary backdrop-blur-md transition-colors hover:bg-bg-base"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-bg-base/70 px-2 py-1 backdrop-blur-md">
                      {listing.images.map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setActiveImg(i)}
                          aria-label={`Show image ${i + 1}`}
                          className={cn(
                            'h-1.5 rounded-full transition-all',
                            i === activeImg ? 'w-5 bg-lime' : 'w-1.5 bg-border-strong hover:bg-text-tertiary',
                          )}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
              {listing.images.length > 1 && (
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  {listing.images.map((img, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setActiveImg(i)}
                      aria-label={`Thumbnail ${i + 1}`}
                      aria-current={i === activeImg}
                      className={cn(
                        'relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border transition-all sm:h-20 sm:w-20',
                        i === activeImg
                          ? 'border-lime ring-2 ring-lime/30'
                          : 'border-border-subtle hover:border-border-default',
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img} alt="" className="h-full w-full object-cover" loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Description — its own card. Heading-weight label + a themed,
                swappable icon; body preserves the seller's exact input
                (line breaks + blank lines) via a single pre-wrap block. */}
            <Card className="border-border-default bg-bg-overlay rounded-lg">
              <CardContent className="p-5">
                <div className="mb-3.5 flex items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-lime/10 text-lime-text ring-1 ring-lime/20">
                    <DescriptionIcon className="h-[18px] w-[18px]" />
                  </span>
                  <h2 className="text-[17px] font-bold leading-none text-text-primary">
                    Description
                  </h2>
                </div>
                {listing.description?.trim() ? (
                  <p className="whitespace-pre-wrap text-[15px] leading-[1.75] text-text-secondary [&_strong]:font-semibold [&_strong]:text-text-primary">
                    {listing.description}
                  </p>
                ) : (
                  <p className="text-[14px] italic text-text-tertiary">
                    The seller hasn&apos;t added a description for this listing yet.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Similar listings — carousel moved into the left column */}
            {similarOffersAsItems && similarOffersAsItems.length > 0 ? (
              <ItemCarouselSection
                title="Similar Listings"
                subtitle={`Other ${listing.categoryName.toLowerCase()} listings for ${listing.gameName}`}
                offers={similarOffersAsItems}
                gameSlug={listing.gameSlug}
                viewerId={viewerId}
                className="mt-8 sm:mt-10"
              />
            ) : (
              similarOffers.length > 0 && (
                <CarouselSection
                  title="Similar Listings"
                  subtitle={`Other ${listing.categoryName.toLowerCase()} listings for ${listing.gameName}`}
                  items={similarOffers}
                  gameSlug={listing.gameSlug}
                  className="mt-8 sm:mt-10"
                />
              )
            )}
          </div>

          {/* RIGHT — combined details + buy panel (one card).
              V30 — Content-height sticky, pinned at a JS-computed offset
              (`railTop`) that keeps the whole rail vertically centered in
              the viewport while the left column scrolls. Releases with
              the page at the end like any sticky. */}
          <div ref={purchaseRef} className="lg:sticky lg:self-start" style={{ top: railTop }}>

              <Card className="relative flex flex-col overflow-hidden border-border-default bg-[rgba(20,20,27,0.56)] p-5 shadow-elevated backdrop-blur-md rounded-lg">
                {/* V31 — SafeDrop emblem watermark peeking from the
                    corner, clipped by the card edge. backdrop-blur creates
                    a stacking context so -z-10 paints above the card bg
                    but below every row. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/icons/safedrop-emblem.png"
                  alt=""
                  aria-hidden
                  className="pointer-events-none absolute -bottom-16 -right-8 -z-10 h-44 w-44 rotate-12 select-none opacity-50"
                />
                {/* 1) Seller */}
                <Link
                  href={`/shop/${listing.seller.username}`}
                  className="group -mx-1 flex items-center gap-2.5 rounded-lg px-1 pb-4 transition-colors"
                >
                  {listing.seller.avatarUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={listing.seller.avatarUrl}
                      alt=""
                      className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-border-subtle"
                    />
                  ) : (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg-overlay text-[13px] font-bold text-text-primary ring-1 ring-border-subtle">
                      {sellerInitial}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="truncate text-[13.5px] font-semibold text-text-primary group-hover:text-lime-text">
                        {sellerName}
                      </span>
                      {listing.seller.verified && (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 fill-lime text-text-inverse" />
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-text-tertiary">
                      <span className="font-semibold text-text-secondary">
                        {listing.seller.rating.toFixed(0)}%
                      </span>
                      <span aria-hidden>·</span>
                      <span>{fmtCount(listing.seller.totalSales)} sold</span>
                      <span aria-hidden>·</span>
                      <span className={cn('font-semibold', tier.color)}>{tier.label}</span>
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-text-tertiary group-hover:text-lime-text" />
                </Link>

                {/* 2) Spec rows — delivery, stock, rarity, etc. */}
                {infoRows.map((row, i) => (
                  <div key={i} className="border-t border-border-subtle py-3.5">
                    <div className="flex items-center justify-between gap-3 text-[14.5px]">
                      <span className="inline-flex items-center gap-2 font-semibold text-text-primary">
                        <InfoLabelIcon label={row.label} />
                        {row.label}
                      </span>
                      <div className="font-medium text-text-secondary">{row.value}</div>
                    </div>
                  </div>
                ))}

                {/* 3) Quantity — full-width NumberField (react-aria) with a
                    caption row: Min. qty left, In stock right. */}
                {!isOwn && listing.deliveryMethod !== 'instant' && maxQty > 1 && (
                  <div className="border-t border-border-subtle py-3.5">
                    <div className="mb-2 text-[14.5px] font-semibold text-text-primary">
                      Quantity
                    </div>
                    <NumberField
                      value={qty}
                      onChange={(v) => setQty(Math.max(1, Math.min(maxQty, v || 1)))}
                      minValue={1}
                      maxValue={maxQty}
                      className="h-11 w-full"
                      ariaLabel="Quantity"
                    />
                    <div className="mt-2 flex items-center justify-between text-[12px] text-text-tertiary">
                      <span>Min. qty: 1</span>
                      <span>
                        In stock:{' '}
                        <span className="font-semibold text-text-secondary tabular-nums">
                          {listing.isUnlimited ? 'Unlimited' : fmtCount(listing.quantity ?? 0)}
                        </span>
                      </span>
                    </div>
                  </div>
                )}

                {/* 4) Total */}
                <div className="flex items-baseline justify-between gap-2 border-t border-border-subtle py-3.5">
                  <span className="text-[14.5px] font-semibold text-text-primary">
                    Total
                  </span>
                  <div className="text-right">
                    <div className="flex items-baseline justify-end gap-1.5">
                      {listing.originalPrice && listing.originalPrice > listing.price && (
                        <span className="text-[13px] text-text-tertiary line-through tabular-nums">
                          {fmtPrice(listing.originalPrice * qty)}
                        </span>
                      )}
                      <span className="text-[26px] font-black tabular-nums leading-none text-text-primary">
                        {fmtPrice(listing.price * qty)}
                      </span>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                        USD
                      </span>
                    </div>
                    {discountPct > 0 && (
                      <div className="mt-1 text-[11.5px] font-semibold text-success">
                        You save {discountPct}%
                      </div>
                    )}
                  </div>
                </div>

                {/* 5) Buy now */}
                {isOwn ? (
                  <Button
                    asChild
                    className="mt-4 h-12 w-full border-amber-500/35 bg-amber-500/10 text-[15px] font-bold text-amber-300 hover:bg-amber-500/15"
                    variant="outline"
                  >
                    <Link href={`/sell/edit/${listing.id}`}>Edit your listing</Link>
                  </Button>
                ) : (
                  <Button
                    onClick={onBuy}
                    disabled={navigating || (!listing.isUnlimited && (listing.quantity ?? 0) <= 0)}
                    className="mt-4 h-12 w-full gap-2 bg-lime text-[15px] font-bold tracking-wide text-text-inverse hover:bg-lime-hover"
                  >
                    {navigating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading checkout…
                      </>
                    ) : (!listing.isUnlimited && (listing.quantity ?? 0) <= 0) ? (
                      'Out of stock'
                    ) : (
                      <>
                        <ShoppingBag className="h-[18px] w-[18px]" />
                        Buy Now
                      </>
                    )}
                  </Button>
                )}

              </Card>

              {/* V32 — Trust tiles card: moved OUT of the buy panel into
                  their own card directly below, inside the same sticky
                  rail (same width — alignment with the buy panel is
                  automatic). */}
              <Card className="relative mt-3 flex flex-col overflow-hidden border-border-default bg-[rgba(20,20,27,0.56)] p-4 shadow-elevated backdrop-blur-md rounded-lg">
                <TrustBand />
              </Card>
          </div>
        </div>

        {/* ─── OTHER SELLERS — same item, cross-seller price comparison.
            V28: replaces "From the same seller" (the seller's shop is one
            click away via their name in the buy panel). Expandable rows:
            click for a quick preview with photo + details + open-listing. */}
        {otherSellerOffers && otherSellerOffers.length > 0 && (
          <OtherSellersSection
            offers={otherSellerOffers}
            viewerId={viewerId}
            gameSlug={listing.gameSlug}
          />
        )}

      </div>

      {/* ─── HOW IT WORKS — full-bleed angled band (outside the
          max-w-7xl wrapper), pinned scroll-story steps. */}
      <HowItWorksBand />

      {/* ─── FAQ — SEO-rich ─────────────────────────────────────── */}
      <div className="mx-auto w-full max-w-7xl px-3 sm:px-6 lg:px-8">
        <FAQSection
          gameName={listing.gameName}
          categoryName={listing.categoryName}
        />

        {/* ─── BLOG — game-relevant guides rail ─────────────────── */}
        <BlogSection gameSlug={listing.gameSlug} gameName={listing.gameName} />
      </div>

      {/* ─── ACCEPTED PAYMENTS — full-bleed wordmark marquee, outside
          the max-w-7xl wrapper so it spans the whole viewport. */}
      <PaymentsMarquee />

      {/* Mobile sticky Buy bar */}
      <AnimatePresence>
        {showMobileBar && !isOwn && (
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-0 bottom-0 z-40 border-t border-border-default bg-bg-raised/95 px-3 py-3 backdrop-blur-md shadow-[0_-12px_30px_rgba(0,0,0,0.4)] sm:hidden"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 12px)' }}
          >
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                  Total
                </div>
                <div className="text-[20px] font-bold tabular-nums leading-tight text-text-primary">
                  {fmtPrice(listing.price * qty)}
                </div>
              </div>
              <Button
                size="lg"
                onClick={onBuy}
                disabled={navigating || (!listing.isUnlimited && (listing.quantity ?? 0) <= 0)}
                className="h-12 gap-2 bg-lime px-5 text-text-inverse shadow-glow hover:bg-lime-hover"
              >
                {navigating ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                  <>
                    Buy now
                    <ShoppingBag className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}

/* ─── Sub-components ────────────────────────────────────────────── */

function InfoLabelIcon({ label }: { label: string }) {
  const l = label.toLowerCase()
  const cls = 'h-3.5 w-3.5 text-text-tertiary'
  if (l.includes('delivery')) return <Clock className={cls} />
  if (l.includes('region')) return <Globe className={cls} />
  if (l.includes('platform')) return <Gamepad2 className={cls} />
  if (l.includes('stock') || l.includes('quantity')) return <Package className={cls} />
  if (l.includes('rar')) return <Sparkles className={cls} />
  return <Award className={cls} />
}

/* ─── Carousel ──────────────────────────────────────────────────── */

/** Split a section title so its LAST word becomes the lime accent —
 *  "Similar listings" → { head: "Similar", accent: "listings" }. */
function splitTitleAccent(title: string): { head: string; accent?: string } {
  const words = title.trim().split(/\s+/)
  if (words.length < 2) return { head: title }
  return { head: words.slice(0, -1).join(' '), accent: words[words.length - 1] }
}

function CarouselSection({
  title, subtitle, items, gameSlug, className,
}: {
  title: string
  subtitle: string
  items: MiniListing[]
  gameSlug: string
  className?: string
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current
    if (!el) return
    const card = el.querySelector<HTMLElement>('[data-mini-card]')
    const step = card?.offsetWidth ? card.offsetWidth + 16 : 280
    el.scrollBy({ left: dir * step * 2, behavior: 'smooth' })
  }
  const { head, accent } = splitTitleAccent(title)
  return (
    <section className={cn('mt-10 sm:mt-12', className)}>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <SectionHeading size="md" title={head} accent={accent} sub={subtitle} />
        </div>
        <div className="hidden gap-1.5 sm:flex">
          <Button
            size="icon"
            variant="outline"
            onClick={() => scrollBy(-1)}
            aria-label="Scroll left"
            className="h-9 w-9 rounded-full"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            onClick={() => scrollBy(1)}
            aria-label="Scroll right"
            className="h-9 w-9 rounded-full"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div
        ref={scrollerRef}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 sm:gap-4"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        {items.map((it) => (
          <MiniCard key={it.id} listing={it} gameSlug={gameSlug} />
        ))}
      </div>
    </section>
  )
}

/**
 * V15p — Items-flavored carousel. Same arrows + scroll-snap as the
 * MiniListing carousel above, but each row is the full `ItemCard` from
 * /{game}/items so the detail-page strip matches the catalog 1:1.
 *
 * ItemCard is a horizontal landscape card (~380px wide on desktop), so
 * we widen the snap step accordingly. The wrapping div locks each card
 * to a sensible min/max width so the carousel reads cleanly at any
 * viewport.
 */
function ItemCarouselSection({
  title, offers, gameSlug, viewerId, className,
}: {
  title: string
  /** Kept for call-site parity with CarouselSection; no longer rendered. */
  subtitle?: string
  offers: ItemOffer[]
  gameSlug: string
  viewerId: string | null
  className?: string
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current
    if (!el) return
    const card = el.querySelector<HTMLElement>('[data-item-card]')
    // Advance by a full "page" of 2 cards so the deliberate half-peek of
    // the next card resolves into two fresh full cards per click.
    const step = card?.offsetWidth ? card.offsetWidth + 16 : 380
    el.scrollBy({ left: dir * step * 2, behavior: 'smooth' })
  }
  const { head, accent } = splitTitleAccent(title)
  return (
    <section className={cn('mt-10 sm:mt-12', className)}>
      {/* V27 — Subtitle removed: the title alone is enough context here, and
          dropping the line shrinks the header so the carousel sits tighter. */}
      <div className="mb-4 flex items-end justify-between gap-3">
        <SectionHeading size="md" title={head} accent={accent} />
        <div className="hidden gap-1.5 sm:flex">
          <Button
            size="icon"
            variant="outline"
            onClick={() => scrollBy(-1)}
            aria-label="Scroll left"
            className="h-9 w-9 rounded-full"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            onClick={() => scrollBy(1)}
            aria-label="Scroll right"
            className="h-9 w-9 rounded-full"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div
        ref={scrollerRef}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 sm:gap-4"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        {offers.map((o) => (
          <div
            key={o.id}
            data-item-card
            /* V26 — Responsive card width tied to the container: exactly 2
               full cards fill the view with a deliberate ~half-card peek of
               the third, so the overflow reads as "scroll for more" rather
               than an accidental cutoff. Clamped so cards never get absurdly
               wide (few items) or too narrow. On mobile a single card fills
               the row with a small peek. */
            className="w-[calc(85%-0.5rem)] min-w-[280px] shrink-0 snap-start sm:w-[calc((100%-2rem)/2.4)] sm:min-w-[320px] sm:max-w-[420px]"
          >
            <ItemCard
              offer={o}
              gameSlug={gameSlug}
              isOwn={!!viewerId && o.sellerId === viewerId}
            />
          </div>
        ))}
      </div>
    </section>
  )
}

/* ─── Other Sellers — same item, cross-seller price rows ────────────
   V28 — Replaces "From the same seller". Each row is a compact price-
   comparison line (seller · rating · delivery · stock · price) that
   expands into a quick preview: photo, attribute chips, description
   snippet, and an Open Listing button. One row open at a time. */

function OtherSellersSection({
  offers, viewerId, gameSlug,
}: {
  offers: ItemOffer[]
  viewerId: string | null
  gameSlug: string
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  return (
    <section className="mt-10 sm:mt-14">
      {/* V36 — Left-aligned editorial heading with the faint lime rule
          (direction C from the heading exploration). Kicker dropped. */}
      <div className="mb-6">
        <h2 className="text-[26px] font-extrabold leading-tight tracking-tight text-text-primary sm:text-[30px]">
          Other <span className="text-lime-text">Sellers</span>
        </h2>
        <p className="mt-1.5 text-[13.5px] text-text-tertiary sm:text-[14px]">
          {offers.length} {offers.length === 1 ? 'offer' : 'offers'} for this item — cheapest first.
        </p>
        <div
          aria-hidden
          className="mt-4 h-px w-full bg-[linear-gradient(to_right,#C6FF3D66,transparent_40%)]"
        />
      </div>
      <div className="space-y-2">
        {offers.map((o) => (
          <OtherSellerRow
            key={o.id}
            offer={o}
            isOwn={!!viewerId && !!o.sellerId && o.sellerId === viewerId}
            gameSlug={gameSlug}
            open={openId === o.id}
            onOpenChange={(v) => setOpenId(v ? o.id : null)}
          />
        ))}
      </div>
    </section>
  )
}

function OtherSellerRow({
  offer, isOwn, gameSlug, open, onOpenChange,
}: {
  offer: ItemOffer
  isOwn: boolean
  gameSlug: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const sellerName = offer.seller.shopName?.trim() || offer.seller.username
  const href = `/${gameSlug}/${offer.detailCategorySlug}/${offer.detailSlug}`
  const delivery = offer.deliveryTime ? formatDeliveryLabel(offer.deliveryTime) : 'Instant'
  const stockLabel = offer.isUnlimited
    ? 'Unlimited'
    : offer.stock != null
      ? fmtCount(offer.stock)
      : '—'
  // Variant context (rarity, mutations, …) so a price difference between
  // rows is self-explanatory. Deduped case-insensitively (rarity often
  // appears in BOTH breadcrumb and mutations → "Secret" twice), and chips
  // already spelled out in the listing name are dropped (no "Dragon
  // Cannelloni" badge under a "Dragon Cannelloni" title).
  const chips = (() => {
    const seen = new Set<string>()
    const nameLc = offer.name.toLowerCase()
    return [...offer.breadcrumb, ...offer.mutations].filter((c) => {
      const k = c.trim().toLowerCase()
      if (!k || seen.has(k) || nameLc.includes(k)) return false
      seen.add(k)
      return true
    })
  })()

  return (
    <Card className="overflow-hidden border-border-default bg-bg-overlay rounded-lg transition-colors hover:border-border-strong">
      <Collapsible open={open} onOpenChange={onOpenChange}>
        {/* Header row — the trigger fills everything except the right-hand
            action slot (price ⇄ Open button), which must stay OUTSIDE the
            trigger: a link nested in a button is invalid HTML. */}
        <div className="flex items-center gap-3 pr-4 sm:pr-5">
          <CollapsibleTrigger className="group flex min-w-0 flex-1 items-center gap-3 p-4 text-left sm:gap-4 sm:px-5">
            {/* Listing thumbnail + name — what the buyer is comparing. */}
            {offer.imageUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={offer.imageUrl}
                alt=""
                className="h-12 w-12 shrink-0 rounded-md object-cover ring-1 ring-border-subtle"
              />
            ) : (
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-bg-base text-text-tertiary ring-1 ring-border-subtle">
                <Gamepad2 className="h-5 w-5" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[13.5px] font-semibold text-text-primary">
                  {offer.name}
                </span>
                {isOwn && (
                  <span className="inline-flex shrink-0 items-center rounded-md border border-amber-500/35 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                    Yours
                  </span>
                )}
              </div>
              {/* Mobile: seller folds under the listing name (the desktop
                  seller column below is sm+ only). */}
              <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-text-tertiary sm:hidden">
                <span className="truncate">{sellerName}</span>
                <span aria-hidden>·</span>
                <span className="font-semibold text-text-secondary">
                  {offer.seller.rating.toFixed(0)}%
                </span>
              </div>
            </div>

            {/* Seller column — desktop */}
            <span className="hidden w-[160px] shrink-0 items-center gap-2 sm:flex">
              {offer.seller.avatarUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={offer.seller.avatarUrl}
                  alt=""
                  className="h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-border-subtle"
                />
              ) : (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bg-base text-[11px] font-bold text-text-primary ring-1 ring-border-subtle">
                  {sellerName.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="min-w-0">
                <span className="flex items-center gap-1">
                  <span className="truncate text-[12.5px] font-semibold text-text-primary">
                    {sellerName}
                  </span>
                  {offer.seller.verified && (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 fill-lime text-text-inverse" />
                  )}
                </span>
                <span className="block text-[11px] text-text-tertiary">
                  <span className="font-semibold text-text-secondary">
                    {offer.seller.rating.toFixed(0)}%
                  </span>{' '}
                  · {fmtCount(offer.seller.sales)} sold
                </span>
              </span>
            </span>

            {/* Delivery — wider screens only */}
            <span className="hidden w-[100px] shrink-0 items-center gap-1.5 text-[12.5px] font-medium text-text-secondary md:inline-flex">
              <Clock className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
              {delivery}
            </span>

            <ChevronDown className="h-4 w-4 shrink-0 text-text-tertiary transition-transform duration-200 group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>

          {/* Action slot: price when collapsed → Open button when expanded
              (the price re-appears larger inside the dropdown). */}
          {open ? (
            <Button
              asChild
              size="sm"
              className="h-9 shrink-0 gap-1 bg-lime px-3.5 text-[12.5px] font-bold text-text-inverse hover:bg-lime-hover"
            >
              <Link href={href}>
                Open
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          ) : (
            <span className="shrink-0 text-[16px] font-black tabular-nums text-text-primary sm:text-[17px]">
              {fmtPrice(offer.pricePerUnit)}
            </span>
          )}
        </div>

        <CollapsibleContent>
          <div className="border-t border-border-subtle p-4 sm:p-5">
            <div className="flex gap-4">
              {/* Photo — bigger in the preview */}
              {offer.imageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={offer.imageUrl}
                  alt={offer.name}
                  className="h-24 w-24 shrink-0 rounded-lg object-cover ring-1 ring-border-subtle sm:h-28 sm:w-28"
                />
              ) : (
                <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg bg-bg-base text-text-tertiary ring-1 ring-border-subtle sm:h-28 sm:w-28">
                  <Gamepad2 className="h-8 w-8" />
                </span>
              )}

              {/* Details */}
              <div className="min-w-0 flex-1">
                {chips.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {chips.map((c, i) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className="rounded-md border-border-subtle bg-bg-base/50 text-[11px] font-semibold text-text-secondary"
                      >
                        {c}
                      </Badge>
                    ))}
                  </div>
                )}
                {offer.description && (
                  <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-[13px] leading-relaxed text-text-secondary">
                    {offer.description}
                  </p>
                )}
                {/* Facts row — price leads (it left the header while open). */}
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                  <span className="text-[20px] font-black tabular-nums leading-none text-text-primary">
                    {fmtPrice(offer.pricePerUnit)}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[12.5px] text-text-secondary">
                    <Clock className="h-3.5 w-3.5 text-text-tertiary" />
                    {delivery}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[12.5px] text-text-secondary">
                    <Package className="h-3.5 w-3.5 text-text-tertiary" />
                    {stockLabel} in stock
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}

function MiniCard({ listing, gameSlug }: { listing: MiniListing; gameSlug: string }) {
  const sellerName = listing.seller.shopName || listing.seller.username
  return (
    <Link
      data-mini-card
      href={`/${gameSlug}/${listing.categorySlug}/${listing.slug}`}
      className={cn(
        'group relative flex w-[240px] shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-border-subtle bg-bg-raised transition-all sm:w-[280px]',
        'hover:-translate-y-0.5 hover:border-lime-tint-border hover:shadow-[0_18px_40px_-14px_rgba(0,0,0,0.6)]',
      )}
    >
      <div className="relative aspect-[4/3] bg-bg-overlay">
        {listing.image ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={listing.image}
            alt={listing.title}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-text-tertiary">
            <Gamepad2 className="h-8 w-8" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <h3 className="text-[13.5px] font-semibold leading-snug text-text-primary line-clamp-2">
          {listing.title}
        </h3>
        <div className="mt-auto flex items-end justify-between gap-2 border-t border-border-subtle pt-2">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
              Price
            </div>
            <div className="text-[15px] font-bold tabular-nums leading-none text-text-primary">
              {fmtPrice(listing.price)}
            </div>
          </div>
          <span
            aria-hidden
            className="flex h-7 w-7 items-center justify-center rounded-full border border-lime-tint-border bg-lime-tint-bg text-lime-text transition-all group-hover:bg-lime group-hover:text-text-inverse"
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11.5px] text-text-tertiary">
          <span className="truncate">{sellerName}</span>
          {listing.seller.verified && (
            <CheckCircle2 className="h-3 w-3 shrink-0 fill-lime text-text-inverse" />
          )}
          <span aria-hidden>·</span>
          <span className="tabular-nums">{fmtCount(listing.seller.totalSales)} sold</span>
        </div>
      </div>
    </Link>
  )
}

/* ─── FAQ — SEO keyword-stuffed per game/category ────────────────── */

function FAQSection({ gameName, categoryName }: { gameName: string; categoryName: string }) {
  const cat = categoryName.toLowerCase()
  const items = useMemo(
    () => [
      {
        q: `Is it safe to buy ${gameName} ${cat} on DropMarket?`,
        a: `Yes — every ${gameName} ${cat} purchase on DropMarket is protected by SafeDrop escrow. Your payment is held safely until you confirm delivery of your ${gameName} ${cat}, which means sellers are only paid once you actually receive what you ordered. If a ${gameName} seller fails to deliver or the ${cat} aren't as described, you get a full refund — no questions asked. Thousands of ${gameName} ${cat} trades happen on DropMarket every week with zero risk to the buyer.`,
      },
      {
        q: `How fast is ${gameName} ${cat} delivery?`,
        a: `Most ${gameName} ${cat} listings on DropMarket are delivered within minutes. Sellers set their own delivery windows — automated sellers can deliver ${gameName} ${cat} near-instantly, while manual sellers complete delivery within the time they've stated on the listing. You'll see the exact delivery window for any ${gameName} ${cat} order before you check out, and you'll be notified the moment your ${cat} are on the way.`,
      },
      {
        q: `What if I don't receive my ${gameName} ${cat}?`,
        a: `If a seller misses their stated ${gameName} ${cat} delivery window, you can open a dispute directly from your order page. Because SafeDrop holds the payment until you confirm receipt, you get a full refund automatically — the seller never receives the money. Our 24/7 support team reviews ${gameName} ${cat} disputes within minutes and most are resolved within an hour.`,
      },
      {
        q: `Do I need to share my password to buy ${gameName} ${cat}?`,
        a: `Never. Legitimate ${gameName} ${cat} delivery on DropMarket is always in-game — through trading, gifting, or whatever the official ${gameName} mechanism is. No seller should ever ask for your account password, two-factor code, or recovery email to deliver ${gameName} ${cat}. If a seller does, report them immediately and we'll refund you and remove them from the platform.`,
      },
      {
        q: `Why buy ${gameName} ${cat} from DropMarket instead of in-game?`,
        a: `${gameName} ${cat} on the DropMarket marketplace are usually significantly cheaper than the in-game store. Independent sellers compete on price, speed, and reputation, which keeps ${gameName} ${cat} prices buyer-friendly. Plus every ${gameName} ${cat} order is escrow-protected by SafeDrop, which the in-game store simply can't match — you get the cheap price AND the safety net.`,
      },
      {
        q: `What payment methods are accepted for ${gameName} ${cat}?`,
        a: `DropMarket accepts all major credit and debit cards, PayPal, Apple Pay, Google Pay, and a range of cryptocurrencies (USDT, USDC, BTC, ETH) for ${gameName} ${cat} purchases. Every payment method is processed through encrypted, PCI-compliant providers; your card details are never seen by the seller. You can complete a ${gameName} ${cat} order in under 60 seconds from any supported payment method.`,
      },
      {
        q: `Can I get cashback on ${gameName} ${cat} orders?`,
        a: `Yes — buyers earn loyalty rewards on every ${gameName} ${cat} order. Rewards accumulate automatically in your DropMarket wallet and can be redeemed against future ${gameName} ${cat} purchases or any other listing on the platform. The longer you've been buying ${gameName} ${cat}, the higher your tier and the bigger the cashback rate.`,
      },
    ],
    [gameName, cat],
  )

  return (
    // V31 — Small top margin: the pinned How-It-Works band above already
    // exits with its own centering air, so a big margin here stacked into
    // an oversized gap.
    <section className="mt-10 sm:mt-14">
      {/* V28 — Same visual language as the currency page FAQ: centred
          header, separate frosted cards with a gap, and the Flock-style
          rounded-square toggle (lime-filled + rotated when open). */}
      <SectionHeading
        kicker="FAQ"
        title="Frequently Asked"
        accent="Questions"
        sub={`Everything you need to know about buying ${gameName} ${cat}.`}
      />
      {/* V43 — Shared Flock-geometry FAQ cards. */}
      <FaqCards items={items} />
    </section>
  )
}

/* ─── Helpers ────────────────────────────────────────────────────── */

function titleCase(s: string): string {
  return s
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .map((p) => (p ? p.charAt(0).toUpperCase() + p.slice(1) : ''))
    .join(' ')
}

function prettifyDelivery(s: string | null | undefined): string {
  if (!s) return ''
  const trimmed = String(s).trim()
  if (trimmed.toLowerCase() === 'instant') return 'Instant'
  const m = trimmed.match(/^(\d+)\s*(min|hr|hour|hrs|mins)s?$/i)
  if (!m) return titleCase(trimmed)
  const n = parseInt(m[1], 10)
  const unit = /^(hr|hrs|hour)/i.test(m[2])
    ? (n === 1 ? 'Hour' : 'Hours')
    : (n === 1 ? 'Min' : 'Mins')
  return `${n} ${unit}`
}
