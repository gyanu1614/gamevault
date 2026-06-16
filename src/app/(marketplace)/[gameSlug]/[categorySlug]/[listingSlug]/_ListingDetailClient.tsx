'use client'

/**
 * V15k — Listing detail client (GameBoost-style).
 *
 * Full page composed of:
 *   1. Hero card — title, breadcrumb pill, quick meta + image gallery on
 *      one side and a sticky purchase rail on the other.
 *   2. Info block — table-style template_data attributes.
 *   3. Description block.
 *   4. From the same seller — horizontal scroll-snap carousel.
 *   5. Similar offers — horizontal scroll-snap carousel.
 *   6. Trust band — VaultShield blurbs + Trustpilot widget.
 *   7. FAQ — game/category-keyword stuffed for SEO.
 *   8. Accepted payments strip.
 *
 * All built from GV primitives (Card, Tabs, Badge, Button, Tooltip,
 * Separator). Mobile-first; sticky bottom Buy bar.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft, ChevronRight, Eye, Calendar, Clock, Package, Globe, Gamepad2,
  CheckCircle2, ShieldCheck, Zap, ShoppingBag, Share2, Loader2, ArrowUpRight,
  Award, TrendingUp, Sparkles, MessageCircleQuestion, CreditCard, Wallet,
  Headphones, RefreshCcw, ChevronDown,
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import StaticFieldDisplay from '@/components/listings/StaticFieldDisplay'
import PriceHistoryChart from '@/components/listings/PriceHistoryChart'
import ItemCard from '../_ItemCard'
import type { ItemOffer } from '../_itemsTypes'
import WishlistButton from '@/components/wishlist/WishlistButton'
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
const fmtRelativeDate = (iso: string) => {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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
  sameSellerListings: MiniListing[]
  similarOffers: MiniListing[]
  /** V15p — When the current listing is in the items category, the
   *  server also ships a full ItemOffer[] so we can re-use the exact
   *  ItemCard from /items here. Avoids two-card-style drift between the
   *  catalog and the detail page's similar-offers strip. */
  similarOffersAsItems?: ItemOffer[] | null
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
  listing, viewerId, templateFields, sameSellerListings, similarOffers, similarOffersAsItems,
}: Props) {
  const router = useRouter()
  const [activeImg, setActiveImg] = useState(0)
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

  const onBuy = () => {
    if (isOwn) { router.push(`/account/listings/${listing.id}/edit`); return }
    startNav(() => router.push(`/checkout/${listing.id}`))
  }

  const onShare = async () => {
    const url = window.location.href
    try {
      if (navigator.share) await navigator.share({ title: listing.title, url })
      else { await navigator.clipboard.writeText(url); toast.success('Link copied') }
    } catch { /* user cancelled */ }
  }

  const discountPct = listing.originalPrice && listing.originalPrice > listing.price
    ? Math.round(((listing.originalPrice - listing.price) / listing.originalPrice) * 100)
    : 0

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
    <main className="min-h-screen bg-bg-base pb-32 sm:pb-12">
      {/* HERO CARD WRAPPER */}
      <div className="mx-auto w-full max-w-7xl px-3 pt-4 sm:px-6 sm:pt-6 lg:px-8">
        {/* Breadcrumb pills */}
        <nav
          aria-label="Breadcrumb"
          className="mb-4 flex flex-wrap items-center gap-1.5 text-[12.5px] text-text-tertiary sm:mb-5"
        >
          <Link
            href={`/${listing.gameSlug}/${listing.categorySlug}`}
            className="inline-flex items-center gap-1 transition-colors hover:text-text-primary"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            {listing.categoryName}
          </Link>
          <span aria-hidden>›</span>
          <span className="max-w-[60vw] truncate text-text-secondary sm:max-w-xs">
            {listing.title}
          </span>
        </nav>

        {/* Title + game eyebrow */}
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border-subtle bg-bg-overlay/60 px-2 py-1">
              {listing.gameImageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={listing.gameImageUrl}
                  alt=""
                  className="h-5 w-5 rounded ring-1 ring-border-subtle"
                />
              ) : (
                <Gamepad2 className="h-3.5 w-3.5 text-lime-text" />
              )}
              <span className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-lime-text">
                {listing.gameName}
              </span>
              <span aria-hidden className="text-text-disabled">·</span>
              <span className="text-[11.5px] font-semibold uppercase tracking-wider text-text-tertiary">
                {listing.categoryName}
              </span>
            </div>
            <h1 className="text-[22px] font-bold leading-tight text-text-primary sm:text-[28px] lg:text-[30px]">
              {listing.title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[12.5px] text-text-tertiary">
              <span className="inline-flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5" />
                {fmtCount(listing.views)} views
              </span>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Listed {fmtRelativeDate(listing.createdAt)}
              </span>
              {discountPct > 0 && (
                <>
                  <span aria-hidden>·</span>
                  <Badge className="bg-success-bg text-success border-success/30">
                    -{discountPct}% off
                  </Badge>
                </>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={onShare}
                  className="h-9 w-9 rounded-full"
                  aria-label="Share listing"
                >
                  <Share2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Share</TooltipContent>
            </Tooltip>
            <WishlistButton listingId={listing.id} variant="default" />
          </div>
        </div>

        {/* MAIN GRID — content + sticky purchase */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-7">
          {/* LEFT */}
          <div className="min-w-0 space-y-3 sm:space-y-4">
            {/* Gallery */}
            <Card className="overflow-hidden border-border-default bg-bg-raised">
              {/* V15m — Tighter gallery. Wider aspect on every breakpoint
                  + hard max-height so the image never dominates the page.
                  This was a vertical wall before; now it sits as a
                  visually-balanced hero, leaving room for the info table
                  to breathe underneath. */}
              <div
                role="region"
                aria-roledescription="carousel"
                aria-label={`Images for ${listing.title}`}
                tabIndex={0}
                onKeyDown={onGalleryKey}
                // V15q — Square 4:4 aspect with a hard size cap. Sellers
                // upload square game screenshots; widescreen letterboxed
                // them and made the hero feel oversized. Square + a strict
                // max keeps the gallery tight regardless of viewport.
                className="relative mx-auto aspect-square w-full max-w-[400px] overflow-hidden bg-bg-overlay focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-lime-tint-bg"
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
                      className="absolute inset-0 h-full w-full object-cover"
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
                <div className="flex gap-2 overflow-x-auto border-t border-border-subtle p-3">
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
            </Card>

            {/* Info / Description / Price history tabs */}
            <Card className="border-border-default bg-bg-raised">
              <CardContent className="p-0">
                <Tabs defaultValue="info" className="w-full">
                  <div className="border-b border-border-subtle px-3 sm:px-4">
                    <TabsList className="bg-transparent">
                      <TabsTrigger value="info">Info</TabsTrigger>
                      <TabsTrigger value="description">Description</TabsTrigger>
                      <TabsTrigger value="price-history">Price history</TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent value="info" className="px-4 py-5 sm:px-6">
                    {infoRows.length === 0 ? (
                      <p className="text-[13.5px] italic text-text-tertiary">
                        No extra details for this listing.
                      </p>
                    ) : (
                      <dl className="divide-y divide-border-subtle">
                        {infoRows.map((row, i) => (
                          <div
                            key={i}
                            className="grid grid-cols-[1fr_auto] items-center gap-4 py-3 first:pt-0 last:pb-0"
                          >
                            <dt className="inline-flex items-center gap-2 text-[13px] text-text-secondary">
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-bg-overlay text-text-tertiary">
                                <InfoLabelIcon label={row.label} />
                              </span>
                              {row.label}
                            </dt>
                            <dd className="text-[13.5px] font-semibold text-text-primary tabular-nums">
                              {row.value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </TabsContent>

                  <TabsContent value="description" className="px-4 py-5 sm:px-6">
                    {listing.description ? (
                      <p className="whitespace-pre-wrap text-[14px] leading-[1.65] text-text-secondary">
                        {listing.description}
                      </p>
                    ) : (
                      <p className="text-[13.5px] italic text-text-tertiary">
                        The seller hasn't added a description for this listing yet.
                      </p>
                    )}
                  </TabsContent>

                  <TabsContent value="price-history" className="px-4 py-5 sm:px-6">
                    <PriceHistoryChart listingId={listing.id} days={30} />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT — sticky purchase + seller */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <div ref={purchaseRef} className="space-y-3">
              {/* Purchase card */}
              <Card className="border-border-default bg-bg-raised shadow-elevated">
                <CardContent className="p-5">
                  <div className="mb-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-tertiary">
                      Price
                    </div>
                    <div className="mt-1 flex items-baseline gap-2">
                      <div className="text-[32px] font-black tabular-nums leading-none text-text-primary">
                        {fmtPrice(listing.price)}
                      </div>
                      {listing.deliveryMethod !== 'instant' && (
                        <span className="text-[12px] text-text-tertiary">/ unit</span>
                      )}
                    </div>
                    {listing.originalPrice && listing.originalPrice > listing.price && (
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="text-[13px] text-text-tertiary line-through tabular-nums">
                          {fmtPrice(listing.originalPrice)}
                        </span>
                        <Badge className="bg-success-bg text-success border-success/30">
                          {discountPct}% OFF
                        </Badge>
                      </div>
                    )}
                  </div>

                  <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border-subtle bg-bg-overlay px-2.5 py-1 text-[12px]">
                    <span
                      aria-hidden
                      className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        listing.isUnlimited || (listing.quantity ?? 0) > 0
                          ? 'bg-success animate-pulse'
                          : 'bg-text-disabled',
                      )}
                    />
                    {listing.isUnlimited ? (
                      <span className="text-text-secondary">Unlimited stock</span>
                    ) : (listing.quantity ?? 0) > 0 ? (
                      <span className="text-text-secondary">
                        <span className="font-semibold text-text-primary tabular-nums">
                          {fmtCount(listing.quantity ?? 0)}
                        </span>{' '}
                        in stock
                      </span>
                    ) : (
                      <span className="text-text-tertiary">Out of stock</span>
                    )}
                  </div>

                  {isOwn ? (
                    <Button
                      asChild
                      size="lg"
                      variant="outline"
                      className="h-12 w-full border-amber-500/35 bg-amber-500/10 text-amber-300 hover:bg-amber-500/15"
                    >
                      <Link href={`/account/listings/${listing.id}/edit`}>Edit your listing</Link>
                    </Button>
                  ) : (
                    <Button
                      size="lg"
                      onClick={onBuy}
                      disabled={navigating || (!listing.isUnlimited && (listing.quantity ?? 0) <= 0)}
                      className="h-12 w-full gap-2 bg-lime text-text-inverse shadow-glow hover:bg-lime-hover"
                    >
                      {navigating ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading checkout…
                        </>
                      ) : (
                        <>
                          <ShoppingBag className="h-4 w-4" />
                          Buy now
                          <span className="text-[13px] font-bold opacity-80">·</span>
                          <span className="tabular-nums">{fmtPrice(listing.price)}</span>
                        </>
                      )}
                    </Button>
                  )}

                  <Separator className="my-4 bg-border-subtle" />
                  <ul className="space-y-2 text-[12.5px]">
                    <TrustRow icon={ShieldCheck} tone="lime" text="VaultShield escrow protection" />
                    <TrustRow icon={Zap} tone="lime" text="Instant payout on delivery" />
                    <TrustRow icon={CheckCircle2} tone="success" text="Full refund guarantee" />
                  </ul>
                </CardContent>
              </Card>

              {/* Seller compact card */}
              <Card className="border-border-default bg-bg-raised">
                <CardContent className="p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-tertiary">
                    Seller
                  </div>
                  <Link
                    href={`/shop/${listing.seller.username}`}
                    className="group mt-2 flex items-center gap-3 rounded-lg p-1 transition-colors hover:bg-bg-raised-hover"
                  >
                    {listing.seller.avatarUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={listing.seller.avatarUrl}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-border-subtle"
                      />
                    ) : (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg-overlay text-sm font-bold text-text-primary ring-1 ring-border-subtle">
                        {sellerInitial}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[14px] font-bold text-text-primary group-hover:text-lime-text">
                          {sellerName}
                        </span>
                        {listing.seller.verified && (
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 fill-lime text-text-inverse" />
                        )}
                      </div>
                      <div className={cn('text-[11.5px] font-semibold', tier.color)}>
                        {tier.label} Seller
                      </div>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-text-tertiary group-hover:text-lime-text" />
                  </Link>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <Stat label="Sales" value={fmtCount(listing.seller.totalSales)} icon={TrendingUp} />
                    <Stat label="Active" value={fmtCount(listing.seller.activeListings)} icon={Sparkles} />
                    <Stat label="Rating" value={`${listing.seller.rating.toFixed(0)}%`} icon={Award} />
                  </div>
                </CardContent>
              </Card>

              {/* Mini why-trust strip */}
              <Card className="border-border-subtle bg-bg-overlay/40">
                <CardContent className="grid grid-cols-3 gap-2 p-3 text-center">
                  <MiniTrust icon={RefreshCcw} label="Refund" />
                  <MiniTrust icon={Headphones} label="24/7 Help" />
                  <MiniTrust icon={CreditCard} label="Secure pay" />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* ─── FROM THE SAME SELLER ──────────────────────────────────── */}
        {sameSellerListings.length > 0 && (
          <CarouselSection
            title="From the same seller"
            subtitle={`More listings by ${sellerName}`}
            items={sameSellerListings}
            gameSlug={listing.gameSlug}
          />
        )}

        {/* ─── SIMILAR OFFERS ──────────────────────────────────────── */}
        {/* V15p — For items-category listings, re-use the exact ItemCard
            from /{game}/items so the strip matches the catalog. For
            anything else, fall back to the compact MiniCard. */}
        {similarOffersAsItems && similarOffersAsItems.length > 0 ? (
          <ItemCarouselSection
            title="Similar offers"
            subtitle={`Other ${listing.categoryName.toLowerCase()} listings for ${listing.gameName}`}
            offers={similarOffersAsItems}
            gameSlug={listing.gameSlug}
            viewerId={viewerId}
          />
        ) : (
          similarOffers.length > 0 && (
            <CarouselSection
              title="Similar offers"
              subtitle={`Other ${listing.categoryName.toLowerCase()} listings for ${listing.gameName}`}
              items={similarOffers}
              gameSlug={listing.gameSlug}
            />
          )
        )}

        {/* ─── TRUST BAND ──────────────────────────────────────────── */}
        <section className="mt-16 sm:mt-20">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
            <TrustCard
              icon={ShieldCheck}
              title="VaultShield escrow"
              body="Your payment is held safely until delivery is confirmed. No-questions-asked refund if anything goes wrong."
            />
            <TrustCard
              icon={Zap}
              title="Instant payouts"
              body="The moment you confirm receipt, funds release to the seller — no holds, no delays."
            />
            <TrustCard
              icon={Headphones}
              title="24/7 human support"
              body="Real people on call around the clock to mediate disputes, answer questions, and keep trades on track."
            />
          </div>
        </section>

        {/* ─── FAQ — SEO-rich ─────────────────────────────────────── */}
        <FAQSection
          gameName={listing.gameName}
          categoryName={listing.categoryName}
        />

        {/* ─── ACCEPTED PAYMENTS ──────────────────────────────────── */}
        <AcceptedPayments />
      </div>

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
                <div className="text-[10.5px] font-semibold uppercase tracking-wider text-text-tertiary">
                  Total
                </div>
                <div className="text-[20px] font-bold tabular-nums leading-tight text-text-primary">
                  {fmtPrice(listing.price)}
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

function TrustRow({
  icon: Icon, tone, text,
}: {
  icon: React.ComponentType<{ className?: string }>
  tone: 'lime' | 'success'
  text: string
}) {
  return (
    <li className={cn('flex items-center gap-2', tone === 'success' ? 'text-success' : 'text-lime-text')}>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="text-text-secondary">{text}</span>
    </li>
  )
}

function Stat({
  icon: Icon, label, value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg border border-border-subtle bg-bg-overlay/60 p-2.5">
      <div className="inline-flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-text-tertiary">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-0.5 text-[16px] font-bold tabular-nums text-text-primary">{value}</div>
    </div>
  )
}

function MiniTrust({
  icon: Icon, label,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <Icon className="h-4 w-4 text-lime-text" />
      <span className="text-[11px] font-semibold text-text-secondary">{label}</span>
    </div>
  )
}

function TrustCard({
  icon: Icon, title, body,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  body: string
}) {
  return (
    <Card className="border-border-default bg-bg-raised">
      <CardContent className="flex items-start gap-3 p-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-lime-tint-border bg-lime-tint-bg text-lime-text">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <div className="text-[14px] font-bold text-text-primary">{title}</div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-text-secondary">{body}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function InfoLabelIcon({ label }: { label: string }) {
  const l = label.toLowerCase()
  if (l.includes('delivery')) return <Clock className="h-3 w-3" />
  if (l.includes('region')) return <Globe className="h-3 w-3" />
  if (l.includes('platform')) return <Gamepad2 className="h-3 w-3" />
  if (l.includes('stock') || l.includes('quantity')) return <Package className="h-3 w-3" />
  if (l.includes('rar')) return <Sparkles className="h-3 w-3" />
  return <Award className="h-3 w-3" />
}

/* ─── Carousel ──────────────────────────────────────────────────── */

function CarouselSection({
  title, subtitle, items, gameSlug,
}: {
  title: string
  subtitle: string
  items: MiniListing[]
  gameSlug: string
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current
    if (!el) return
    const card = el.querySelector<HTMLElement>('[data-mini-card]')
    const step = card?.offsetWidth ? card.offsetWidth + 16 : 280
    el.scrollBy({ left: dir * step * 2, behavior: 'smooth' })
  }
  return (
    <section className="mt-16 sm:mt-20">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[20px] font-bold leading-tight text-text-primary sm:text-[22px]">
            {title}
          </h2>
          <p className="mt-0.5 truncate text-[12.5px] text-text-tertiary">{subtitle}</p>
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
  title, subtitle, offers, gameSlug, viewerId,
}: {
  title: string
  subtitle: string
  offers: ItemOffer[]
  gameSlug: string
  viewerId: string | null
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current
    if (!el) return
    const card = el.querySelector<HTMLElement>('[data-item-card]')
    const step = card?.offsetWidth ? card.offsetWidth + 16 : 380
    el.scrollBy({ left: dir * step, behavior: 'smooth' })
  }
  return (
    <section className="mt-16 sm:mt-20">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[20px] font-bold leading-tight text-text-primary sm:text-[22px]">
            {title}
          </h2>
          <p className="mt-0.5 truncate text-[12.5px] text-text-tertiary">{subtitle}</p>
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
        {offers.map((o) => (
          <div
            key={o.id}
            data-item-card
            className="w-[320px] shrink-0 snap-start sm:w-[380px]"
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
            <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-text-tertiary">
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
  const [openIdx, setOpenIdx] = useState<number>(0)
  const cat = categoryName.toLowerCase()
  const items = useMemo(
    () => [
      {
        q: `Is it safe to buy ${gameName} ${cat} on GameVault?`,
        a: `Yes — every ${gameName} ${cat} purchase on GameVault is protected by VaultShield escrow. Your payment is held safely until you confirm delivery of your ${gameName} ${cat}, which means sellers are only paid once you actually receive what you ordered. If a ${gameName} seller fails to deliver or the ${cat} aren't as described, you get a full refund — no questions asked. Thousands of ${gameName} ${cat} trades happen on GameVault every week with zero risk to the buyer.`,
      },
      {
        q: `How fast is ${gameName} ${cat} delivery?`,
        a: `Most ${gameName} ${cat} listings on GameVault are delivered within minutes. Sellers set their own delivery windows — automated sellers can deliver ${gameName} ${cat} near-instantly, while manual sellers complete delivery within the time they've stated on the listing. You'll see the exact delivery window for any ${gameName} ${cat} order before you check out, and you'll be notified the moment your ${cat} are on the way.`,
      },
      {
        q: `What if I don't receive my ${gameName} ${cat}?`,
        a: `If a seller misses their stated ${gameName} ${cat} delivery window, you can open a dispute directly from your order page. Because VaultShield holds the payment until you confirm receipt, you get a full refund automatically — the seller never receives the money. Our 24/7 support team reviews ${gameName} ${cat} disputes within minutes and most are resolved within an hour.`,
      },
      {
        q: `Do I need to share my password to buy ${gameName} ${cat}?`,
        a: `Never. Legitimate ${gameName} ${cat} delivery on GameVault is always in-game — through trading, gifting, or whatever the official ${gameName} mechanism is. No seller should ever ask for your account password, two-factor code, or recovery email to deliver ${gameName} ${cat}. If a seller does, report them immediately and we'll refund you and remove them from the platform.`,
      },
      {
        q: `Why buy ${gameName} ${cat} from GameVault instead of in-game?`,
        a: `${gameName} ${cat} on the GameVault marketplace are usually significantly cheaper than the in-game store. Independent sellers compete on price, speed, and reputation, which keeps ${gameName} ${cat} prices buyer-friendly. Plus every ${gameName} ${cat} order is escrow-protected by VaultShield, which the in-game store simply can't match — you get the cheap price AND the safety net.`,
      },
      {
        q: `What payment methods are accepted for ${gameName} ${cat}?`,
        a: `GameVault accepts all major credit and debit cards, PayPal, Apple Pay, Google Pay, and a range of cryptocurrencies (USDT, USDC, BTC, ETH) for ${gameName} ${cat} purchases. Every payment method is processed through encrypted, PCI-compliant providers; your card details are never seen by the seller. You can complete a ${gameName} ${cat} order in under 60 seconds from any supported payment method.`,
      },
      {
        q: `Can I get cashback on ${gameName} ${cat} orders?`,
        a: `Yes — buyers earn loyalty rewards on every ${gameName} ${cat} order. Rewards accumulate automatically in your GameVault wallet and can be redeemed against future ${gameName} ${cat} purchases or any other listing on the platform. The longer you've been buying ${gameName} ${cat}, the higher your tier and the bigger the cashback rate.`,
      },
    ],
    [gameName, cat],
  )

  return (
    <section className="mt-16 sm:mt-20">
      <div className="mb-5 text-center">
        <h2 className="text-[22px] font-bold leading-tight text-text-primary sm:text-[26px]">
          FAQ — Buying {gameName} {categoryName} on GameVault
        </h2>
        <p className="mt-1.5 text-[13.5px] text-text-tertiary">
          Everything you need to know about {gameName} {cat} marketplace trades.
        </p>
      </div>
      <Card className="mx-auto max-w-3xl border-border-default bg-bg-raised">
        <CardContent className="p-0">
          {items.map((item, i) => {
            const open = openIdx === i
            return (
              <div
                key={i}
                className={cn(
                  'border-b border-border-subtle last:border-b-0',
                  open && 'bg-bg-overlay/30',
                )}
              >
                <button
                  type="button"
                  onClick={() => setOpenIdx(open ? -1 : i)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-bg-raised-hover"
                >
                  <span className="inline-flex items-start gap-2 text-[14px] font-semibold text-text-primary">
                    <MessageCircleQuestion className="mt-0.5 h-4 w-4 shrink-0 text-lime-text" />
                    <span>{item.q}</span>
                  </span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 shrink-0 text-text-tertiary transition-transform',
                      open && 'rotate-180 text-lime-text',
                    )}
                  />
                </button>
                {open && (
                  <div className="px-5 pb-5 pl-12 text-[13.5px] leading-[1.65] text-text-secondary">
                    {item.a}
                  </div>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>
    </section>
  )
}

/* ─── Accepted payments ──────────────────────────────────────────── */

const PAYMENT_METHODS: Array<{ key: string; label: string }> = [
  { key: 'visa', label: 'Visa' },
  { key: 'mastercard', label: 'Mastercard' },
  { key: 'amex', label: 'Amex' },
  { key: 'paypal', label: 'PayPal' },
  { key: 'apple', label: 'Apple Pay' },
  { key: 'google', label: 'Google Pay' },
  { key: 'usdt', label: 'USDT' },
  { key: 'btc', label: 'Bitcoin' },
  { key: 'eth', label: 'Ethereum' },
]

function AcceptedPayments() {
  return (
    <section className="mt-16 sm:mt-20">
      <Card className="border-border-default bg-bg-raised">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-lime-text" />
              <span className="text-[13px] font-semibold text-text-primary">
                Accepted payment methods
              </span>
            </div>
            <span className="text-[11.5px] text-text-tertiary">
              All transactions are PCI-compliant and end-to-end encrypted.
            </span>
          </div>
          <Separator className="my-4 bg-border-subtle" />
          <div className="flex flex-wrap items-center gap-2">
            {PAYMENT_METHODS.map((m) => (
              <span
                key={m.key}
                className="inline-flex items-center gap-1.5 rounded-md border border-border-subtle bg-bg-overlay px-2.5 py-1.5 text-[12px] font-semibold text-text-secondary"
              >
                <CreditCard className="h-3.5 w-3.5 text-text-tertiary" />
                {m.label}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
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
