'use client'

/**
 * Currency page client — V12.
 *
 * Recreates the currency listing design handoff using GV tokens and
 * existing primitives. See sibling _currencyData.ts for the data shape
 * and the design handoff README for spec details.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthDialog } from '@/components/auth/AuthDialog'
import { useAuth } from '@/hooks/use-auth'
import { ShieldCheck, Zap, Store, Minus, Plus, ArrowRight, ChevronDown } from 'lucide-react'
import StarRoundedIcon from '@mui/icons-material/StarRounded'
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded'
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded'
import TuneRoundedIcon from '@mui/icons-material/TuneRounded'
import * as Collapsible from '@radix-ui/react-collapsible'
import { Card } from '@/components/ui/card'
import { CollapsibleText } from '@/components/ui/collapsible-text'
import { Expand } from '@/components/ui/expand'
import { PhoneBuySheet } from './_PhoneBuySheet'
import { cn } from '@/lib/utils'
import ShopLink from '@/components/seller/ShopLink'
import HowItWorksBand from '@/components/marketplace/HowItWorksBand'
import { SectionHeading } from '@/components/marketplace/SectionHeading'
import { FaqCards } from '@/components/marketplace/FaqCards'
import { TrustBand } from '@/components/marketplace/TrustBand'
import { motion, useReducedMotion } from 'framer-motion'
import { PaymentsMarquee } from '@/components/marketplace/PaymentsMarquee'
import type { CurrencyPageData, Offer } from './_currencyData'
import { PURCHASES_ENABLED } from '@/lib/config/purchases'
import { quantityUnit, priceUnit } from '@/lib/currency/quantity-unit'
import { SellerStats } from '@/components/seller/SellerStats'
import { VerifiedBadge } from '@/components/seller/VerifiedBadge'
import { SegmentedTabs } from '@/components/account/SegmentedTabs'
import { BuyButton, BuySweep, FACE as BUY_FACE } from '@/components/marketplace/BuyButton'
import { sellerStatLine } from '@/lib/seller/stat-line'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function unitPrice(p: number) { return `$${p.toFixed(4)}` }
function money(n: number) { return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }

// V21/P7.i — Professional, fully-spelled delivery copy. Renders
// "15 Minutes" / "5–12 Minutes" / "2 Hours", never "15 min" / "2 hr".
function fmtMinutes(min: number, max: number): string {
  const unitWord = (n: number, singular: string, plural: string) =>
    n === 1 ? singular : plural
  // Promote to hours when both bounds are clean multiples of 60.
  if (min >= 60 && min % 60 === 0 && max % 60 === 0) {
    const lo = min / 60
    const hi = max / 60
    return lo === hi
      ? `${lo} ${unitWord(lo, 'Hour', 'Hours')}`
      : `${lo}–${hi} Hours`
  }
  return min === max
    ? `${min} ${unitWord(min, 'Minute', 'Minutes')}`
    : `${min}–${max} Minutes`
}
function compact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`
  return String(n)
}
function deliveryRange(o: Offer) { return `${o.deliveryMin}–${o.deliveryMax}m` }
function priceForQty(offer: Offer, qty: number) {
  if (!offer.ladder?.length) return offer.pricePerUnit
  let p = offer.ladder[0].price
  offer.ladder.forEach((t) => { if (qty >= t.min) p = t.price })
  return p
}

function Avatar({
  name, hue, size = 38, imageUrl,
}: { name: string; hue: number; size?: number; imageUrl?: string | null }) {
  const bg = `linear-gradient(135deg, oklch(0.72 0.15 ${hue}), oklch(0.55 0.18 ${(hue + 30) % 360}))`
  // V14d — Prefer the seller's uploaded avatar when present; fall back to
  // the deterministic hue tile so accounts without a pic still get a
  // distinct, recognisable mark.
  if (imageUrl) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={imageUrl}
        alt={name}
        className="shrink-0 object-cover shadow-sm"
        style={{ width: size, height: size, borderRadius: size * 0.32 }}
      />
    )
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center font-bold text-text-primary shadow-sm"
      style={{ width: size, height: size, borderRadius: size * 0.32, background: bg, fontSize: Math.round(size * 0.42) }}
      aria-hidden
    >
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

// V14j — Fullscreen route loader. Backdrop-blurred dark overlay with a
// soft lime ring spinner + label. Used while React is resolving a route
// change (e.g. Buy now → /checkout). Inspired by the Vercel dashboard
// transition loader: subtle, blocks input, gone in <1 frame on resolve.
function RouteLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[color-mix(in_srgb,var(--color-bg-base)_70%,transparent)] backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative flex flex-col items-center gap-4">
        {/* Spinner */}
        <div className="relative flex h-14 w-14 items-center justify-center">
          <div
            aria-hidden
            className="absolute inset-0 rounded-full border-2 border-border-subtle"
          />
          <div
            aria-hidden
            className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-lime border-r-lime"
            style={{ animationDuration: '0.9s' }}
          />
          <Zap className="h-5 w-5 text-lime" />
        </div>
        <div className="relative text-center">
          <div className="text-[14px] font-semibold text-text-primary">{label}</div>
          <div className="mt-0.5 text-[12px] text-text-tertiary">Hang tight — one moment</div>
        </div>
      </div>
    </div>
  )
}

function StockDot({ stock }: { stock: number }) {
  const tone =
    stock === 0
      ? { dot: 'bg-text-disabled', text: 'text-text-tertiary', label: 'Out of stock' }
      : stock < 50_000
        ? { dot: 'bg-warning', text: 'text-warning', label: `${compact(stock)} in stock` }
        : { dot: 'bg-success', text: 'text-success', label: `${compact(stock)} in stock` }
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('h-1.5 w-1.5 rounded-full', tone.dot)} />
      <span className={cn('text-[13px]', tone.text)}>{tone.label}</span>
    </span>
  )
}

// V14 — Hero-card info row. Left label / right value, bordered pill.
function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-bg-raised px-3 py-2.5">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
        {label}
      </div>
      {children}
    </div>
  )
}

// V14g — Seller-row metric column (desktop). Fixed width per column so
// every seller row aligns vertically regardless of how big the number is
// (a seller with 100 stock and a seller with 10,000,000 stock must show
// their value in exactly the same horizontal slot).
function MetricCol({
  icon: Icon, label, value, width = 110,
}: {
  icon: typeof StarRoundedIcon
  label: string
  value: string
  /** Fixed column width in pixels. Set wide enough to fit the longest
   *  realistic value so the column never shifts between rows. */
  width?: number
}) {
  return (
    <div
      className="hidden shrink-0 sm:block"
      style={{ width }}
    >
      <div className="flex items-center gap-1.5 text-[14px] font-bold tabular-nums text-text-primary sm:text-[15px]">
        <Icon className="shrink-0 text-text-tertiary" style={{ fontSize: 15 }} />
        <span className="truncate">{value}</span>
      </div>
      <div className="mt-0.5 text-[12px] text-text-tertiary">
        {label}
      </div>
    </div>
  )
}

// V13 — Seller-row metric chip (mobile second row). Inline with caption to
// the right of the value, keeps the row scannable on small screens.
function MetricChipMobile({ icon: Icon, label, value }: { icon: typeof StarRoundedIcon; label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-text-secondary">
      <Icon className="text-text-tertiary" style={{ fontSize: 13 }} />
      <span className="font-semibold tabular-nums text-text-primary">{value}</span>
      <span className="text-text-tertiary">{label}</span>
    </span>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CurrencyPageClient({
  data,
  gameImageUrl,
  gameSlug,
  introLine,
  blogRail,
}: {
  data: CurrencyPageData
  gameImageUrl?: string | null
  /** V43 — Game slug for the blog rail's relevance filter. */
  gameSlug?: string
  /** SEO intro sentence (live stats), server-computed so it lands in
   *  the initial HTML. Rendered under the hero header. */
  introLine?: string | null
  /** Server-rendered blog rail (DB-backed), passed as a slot. */
  blogRail?: React.ReactNode
}) {
  const allOffers = useMemo<Offer[]>(() => [data.hero, ...data.sellers], [data])
  const [activeId, setActiveId] = useState<string>(data.hero.id)
  const activeOffer = allOffers.find((o) => o.id === activeId) ?? data.hero
  // V14m/Step 7a — the viewer comes from the client auth context now (the
  // page is ISR; resolving the session on the server made it dynamic). While
  // auth is still loading a click goes straight to checkout, which enforces
  // sign-in itself — never bounce a signed-in buyer to the login dialog.
  const { user: viewer, loading: authLoading } = useAuth()
  const viewerId = viewer?.id ?? null
  // V14m — Is the current viewer the seller of the active offer?
  const isOwnOffer = !!viewerId && !!activeOffer.sellerId && activeOffer.sellerId === viewerId

  const [qty, setQty] = useState<number>(activeOffer.minQty)
  useEffect(() => { setQty(activeOffer.minQty) }, [activeOffer.id, activeOffer.minQty])

  // V14j — Buy now → /checkout/{listingId}?qty={qty}. Wrapped in a
  // transition so React keeps the old UI interactive while the route
  // resolves; we show a fullscreen loader during the pending state.
  const router = useRouter()
  const { open: openAuth } = useAuthDialog()
  const [navigating, startNavigation] = useTransition()
  const goToCheckout = (offerId: string, quantity: number) => {
    // Logged out: open the sign-in modal in place with checkout as the
    // post-auth redirect (no bounce to home; buyer keeps their context).
    if (!viewerId && !authLoading) {
      openAuth('login', { redirect: `/checkout/${offerId}?qty=${quantity}` })
      return
    }
    startNavigation(() => {
      router.push(`/checkout/${offerId}?qty=${quantity}`)
    })
  }

  const [filter, setFilter] = useState<'recommended' | 'cheapest' | 'fastest'>('recommended')
  const heroRef = useRef<HTMLDivElement>(null)

  // V14v — Always land at the top on mount. Covers back/forward
  // navigation in some browsers, and deep-links from elsewhere on the
  // site. (As of V17g there are no slug redirects in play — the DB
  // stores canonical slugs and the URL is the URL.)
  //
  // useLayoutEffect (not useEffect) so the scroll happens BEFORE the
  // browser paints the new route. Otherwise the user sees one frame at
  // the previous scroll position (often the footer area), then a jump to
  // the top — read as "the page flashed the bottom for a second".
  //
  // We also disable the browser's automatic scroll restoration so it
  // doesn't fight us on back/forward navigation.
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual'
    }
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [])

  const otherSellers = useMemo(() => {
    const list = allOffers.filter((o) => o.id !== activeId)
    switch (filter) {
      case 'cheapest': return [...list].sort((a, b) => a.pricePerUnit - b.pricePerUnit)
      case 'fastest':  return [...list].sort((a, b) => a.deliveryMin - b.deliveryMin)
      default:         return [...list].sort((a, b) => (b.recommended ?? 0) - (a.recommended ?? 0))
    }
  }, [allOffers, activeId, filter])

  const pickOffer = (id: string) => {
    setActiveId(id)
    // V14f — Scroll to absolute top. With the sub-nav no longer sticky the
    // user sees: sub-nav → "Buy Robux" title → swapped hero card, all from
    // the top of the page.
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }, 0)
  }

  const [showBuyBar, setShowBuyBar] = useState(false)
  useEffect(() => {
    const el = heroRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => setShowBuyBar(!entry.isIntersecting),
      { rootMargin: '-80px 0px 0px 0px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const unit = priceForQty(activeOffer, qty)
  const total = unit * qty

  return (
    // `isolate` keeps the -z-10 backdrop art INSIDE main's stacking
    // context — without it the logo would sink below the page's own
    // hero backdrop layer and disappear.
    <main className="relative isolate min-h-screen pb-24 pt-3 sm:pt-4">
      <div className="mx-auto w-full max-w-7xl px-3 sm:px-6 lg:px-8">
        {/* V14b — No outer wrapping card. Each section is its own surface
            with its own external title and gap, so the page reads as a
            stack of distinct, well-paced modules. */}

        {data.currency.variants.length > 0 && (
          <div className="mb-5 space-y-3">
            {data.currency.variants.map((v) => (
              <VariantSelector key={v.id} variant={v} />
            ))}
          </div>
        )}

        {/* Hero — title + product logo sit OUTSIDE the card */}
        <SectionHeader
          eyebrow={data.currency.game}
          title={`Buy ${data.currency.name}`}
          iconUrl={data.currency.iconUrl ?? null}
          iconFallback={data.currency.name.slice(0, 2).toUpperCase()}
          size="hero"
        />
        {/* SEO intro — live stats, same source as metadata + JSON-LD. */}
        {/* SEO intro stays in the HTML for crawlers; visually hidden (owner
            call 2026-09-29: header = logo + game + title only). */}
        {introLine && <p className="sr-only">{introLine}</p>}
        <div ref={heroRef} className="mt-3">
          <HeroCard
            offer={activeOffer}
            unitLabel={quantityUnit(data.currency.granularity, data.currency.unitLabel)}
            granularity={data.currency.granularity ?? 'unit'}
            qty={qty}
            setQty={setQty}
            unit={unit}
            total={total}
            onBuy={() => goToCheckout(activeOffer.id, qty)}
            buying={navigating}
            isOwnOffer={isOwnOffer}
          />
        </div>

        {/* Other sellers — V43: left-aligned editorial heading with the
            faint lime rule (same treatment as the item detail page),
            filter chips on the right. */}
        <div className="relative mt-10 sm:mt-14">
          {/* V45 — Per-game 3D logo backdrop, LEFT side of the section.
              No mask, no glow — masking flattened the art and the glow
              read as a rectangular blob. Like the SafeDrop emblem
              behind Buy Now, the art stays crisp (its own 3D shading
              intact) and just sits dimmed behind the content, cut off by
              the section edge. Convention:
              public/watermarks/{gameSlug}.webp. */}
          {gameSlug && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={`/watermarks/${gameSlug}.webp`}
              alt=""
              aria-hidden
              onError={(e) => { e.currentTarget.style.display = 'none' }}
              className="pointer-events-none absolute -left-32 -top-8 -z-10 hidden h-[22rem] w-[22rem] -rotate-12 select-none object-contain opacity-[0.35] lg:block"
            />
          )}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[26px] font-extrabold leading-tight tracking-tight text-text-primary sm:text-[30px]">
                Other Sellers
              </h2>
              <p className="mt-1.5 text-[13.5px] text-text-tertiary sm:text-[14px]">
                {otherSellers.length} more {otherSellers.length === 1 ? 'offer' : 'offers'}. Pick by price, speed or rating.
              </p>
            </div>
            <FilterChips filter={filter} setFilter={setFilter} />
          </div>
          <div className="mt-5 space-y-2">
            {otherSellers.length === 0 ? (
              <EmptyState />
            ) : (
              otherSellers.map((o) => (
                <SellerRow
                  key={o.id}
                  offer={o}
                  unitLabel={quantityUnit(data.currency.granularity, data.currency.unitLabel)}
                  perLabel={
                    (data.currency.granularity ?? 'unit') === 'unit'
                      ? `${data.currency.glyph} ${data.currency.unitLabel}`
                      : priceUnit(data.currency.granularity)
                  }
                  onSelect={() => pickOffer(o.id)}
                  isOwn={!!viewerId && o.sellerId === viewerId}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* ─── HOW IT WORKS — full-bleed angled band (outside the max-w
          wrapper), pinned scroll-story with currency-context copy. */}
      <HowItWorksBand
        steps={[
          { title: 'Pick Your Amount', body: 'Choose a seller and how much you need.' },
          { title: 'Pay At Checkout', body: 'Every order is covered by SafeDrop Protection.' },
          { title: `Get Your ${data.currency.name}`, body: 'Delivered in-game within the stated window.' },
          { title: 'Confirm Delivery', body: 'Confirm and the order is complete — or you get a full refund.' },
        ]}
      />

      <div className="mx-auto w-full max-w-7xl px-3 sm:px-6 lg:px-8">
        {/* ─── FAQ — admin-configured items, Flock-geometry cards. */}
        {data.faq.length > 0 && (
          <section className="mt-10 sm:mt-14">
            <SectionHeading
              kicker="FAQ"
              title="Frequently Asked"
              accent="Questions"
              sub={`Everything you need to know about buying ${data.currency.name}.`}
            />
            <FaqCards items={data.faq} />
          </section>
        )}

        {/* ─── SEO block (kept for search copy). */}
        <div className="mx-auto mt-14 max-w-4xl">
          <SeoBlock currency={data.currency} />
        </div>

        {/* ─── BLOG — game-relevant guides rail (server-rendered, slot). */}
        {blogRail}
      </div>

      {/* ─── ACCEPTED PAYMENTS — full-bleed wordmark marquee. */}
      <PaymentsMarquee />

      {/* V14j — Fullscreen route-transition loader. Renders while the
          checkout route is resolving (useTransition pending). Animation
          mimics the Vercel/Linear "soft glow + spinner" pattern. */}
      {navigating && <RouteLoader label="Preparing checkout" />}

      {/* V21/P7.i — Legacy mobile sticky buy bar removed. The new
          HeroCard renders an inline mobile price tile + slide-up
          drawer that replaces this. */}
    </main>
  )
}

// V14b — Section header that sits OUTSIDE the card. Title + small
// subtitle on the left, optional trailing element (e.g. filter chips)
// on the right. Gives the page a strong rhythm without the box-in-box look.
function SectionHeader({
  title, subtitle, eyebrow, trailing, iconUrl, iconFallback, size = 'default',
}: {
  title: string
  subtitle?: string
  /** Small uppercase line above the title (the game name on the hero). */
  eyebrow?: string
  trailing?: ReactNode
  /** V21/P7.i — Optional product logo rendered before the title.
   *  Used on the currency hero header to show the admin-uploaded icon. */
  iconUrl?: string | null
  iconFallback?: string
  /** V21/P7.j — 'hero' matches the bundle page's bigger header
   *  (text-[20px] → sm:26 → lg:30, font-black). 'default' is the
   *  smaller section heading used by "Other sellers" etc. */
  size?: 'default' | 'hero'
}) {
  const showIcon = iconUrl !== undefined
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 px-1">
      <div className="flex min-w-0 items-center gap-3">
        {showIcon && (
          iconUrl ? (
            /* V21/P7.i — Floating logo, no frame. Transparent PNG sits
               directly on the page. Fallback (no icon) keeps a subtle
               tile so the two-letter monogram has something to sit on. */
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={iconUrl}
              alt=""
              className="h-14 w-14 flex-shrink-0 rounded-xl object-contain sm:h-[60px] sm:w-[60px]"
            />
          ) : (
            <span className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-lg bg-bg-overlay text-[15px] font-extrabold tracking-tight text-lime-text">
              {iconFallback}
            </span>
          )
        )}
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-1.5 text-[13px] font-semibold uppercase leading-none tracking-[0.08em] text-text-secondary sm:text-[14px]">
              {eyebrow}
            </p>
          )}
          <h2
            className={cn(
              'text-text-primary',
              eyebrow ? 'leading-none' : 'leading-tight',
              size === 'hero'
                ? 'text-[20px] font-black tracking-tight sm:text-[26px] lg:text-[30px]'
                : 'text-[20px] font-bold sm:text-[22px]',
            )}
          >
            {title}
          </h2>
          {subtitle && (
            <p
              className={cn(
                'mt-1 text-text-secondary',
                size === 'hero'
                  ? 'text-[13px] font-medium sm:text-[14px]'
                  : 'text-[13px] sm:text-[13.5px]',
              )}
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </div>
  )
}

// V14 — Reusable section card. Each block on the page is its own surface
// with one of three tonal backdrops so the stack feels varied instead of
// being a uniform slab of grey.
function SectionCard({
  tone = 'raised', className, children,
}: {
  tone?: 'raised' | 'overlay' | 'gradient'
  className?: string
  children: ReactNode
}) {
  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-lg p-5 sm:p-6 lg:p-8',
        tone === 'raised' && 'bg-bg-raised shadow-elevated',
        tone === 'overlay' && 'bg-[color-mix(in_srgb,var(--color-bg-overlay)_60%,transparent)] shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)]',
        tone === 'gradient' && 'bg-gradient-to-br from-bg-raised via-bg-raised to-[color-mix(in_srgb,var(--color-bg-overlay)_40%,transparent)] shadow-elevated',
        className,
      )}
    >
      {children}
    </section>
  )
}

function VariantSelector({ variant }: { variant: CurrencyPageData['currency']['variants'][number] }) {
  const [active, setActive] = useState(variant.options[0])
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold text-text-tertiary">
        {variant.label}
      </span>
      <div className="inline-flex w-fit gap-1 rounded-lg bg-bg-raised p-1">
        {variant.options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => setActive(o)}
            aria-pressed={active === o}
            className={cn(
              'rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors',
              active === o
                ? 'bg-bg-raised-hover text-text-primary shadow-[inset_0_0_0_1px_var(--color-border-default)]'
                : 'text-text-secondary hover:text-text-primary',
            )}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  )
}

function HeroCard({
  offer, unitLabel, granularity, qty, setQty, unit, total, onBuy, buying, isOwnOffer,
}: {
  offer: Offer
  unitLabel: string
  granularity: 'unit' | 'thousand' | 'million'
  qty: number
  setQty: (n: number) => void
  unit: number
  total: number
  onBuy: () => void
  buying: boolean
  /** V14m — When true, the viewer is the seller — hide Buy now and show
   *  an "own listing" notice with a link to edit it. */
  isOwnOffer: boolean
}) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const reduceMotion = useReducedMotion()
  const outOfStock = offer.stock === 0
  // Step in the unit the buyer is actually picking. On a per-K or
  // per-M game one "unit" is already a big number, so the old
  // 100/1000 jump (built for per-single-Robux) would leap the buyer
  // from 1K to 101K. Those games step by 1; only an absolute-count
  // currency uses the coarse chunks.
  const stepSize =
    granularity === 'unit' ? (offer.minQty < 1000 ? 100 : 1000) : 1
  const stepUp = () => setQty(Math.min(offer.stock || qty + stepSize, qty + stepSize))
  const stepDown = () => setQty(Math.max(offer.minQty, qty - stepSize))

  // V21/P7.i — Reused by both the desktop right card and the mobile sheet.
  const purchasePanel = (
    <PurchasePanel
      offer={offer}
      unitLabel={unitLabel}
      granularity={granularity}
      qty={qty}
      setQty={setQty}
      stepUp={stepUp}
      stepDown={stepDown}
      unit={unit}
      total={total}
      onBuy={onBuy}
      buying={buying}
      isOwnOffer={isOwnOffer}
      outOfStock={outOfStock}
    />
  )

  return (
    <section aria-label="Recommended offer">
      <div className="grid gap-4 lg:grid-cols-[1fr_minmax(360px,440px)]">
        {/* LEFT CARD — Product identity + seller + delivery + stock + instructions.
            Canonical OrderCard shape: rounded-lg, border-border-default,
            bg-bg-raised, no glass/blur. */}
        <Card className="border-0 bg-[linear-gradient(180deg,#212228_0%,#1A1B1F_100%)] shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)] p-5 sm:p-6">
          {/* `offer.seller` is a DISPLAY name ("BloxMarket"), not a slug —
              linking to it produced /shop/BloxMarket. Use the canonical
              sellerSlug, and degrade to a non-link when there is none. */}
          <ShopLink
            slug={offer.sellerSlug}
            className="group -m-1 mb-1 flex items-center gap-3 rounded-lg p-1 transition-colors hover:bg-bg-raised-hover"
          >
            <Avatar name={offer.seller} hue={offer.avatarHue} imageUrl={offer.avatarUrl} size={48} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-base font-bold text-text-primary sm:text-[17px]">
                  {offer.seller}
                </span>
                {offer.verified && <VerifiedBadge size={14} />}
              </div>
              <SellerStats
                ratingPercent={offer.rating}
                reviews={offer.reviews}
                sales={offer.sales}
                tier={offer.tier}
                className="mt-0.5 text-[12.5px]"
              />
            </div>
            <ArrowRight className="h-4 w-4 text-text-tertiary transition-[color,transform] group-hover:translate-x-0.5 group-hover:text-text-primary" />
          </ShopLink>

          {/* V19/P24/P7.rr — Equal py-3.5 rhythm on all three rows.
              Instructions clamps to 5 lines (whichever comes first
              between line count and ~180 chars) and exposes a
              View more / View less toggle. */}
          <div className="flex items-center justify-between gap-3 border-t border-white/[0.07] py-3.5">
            <span className="text-[14px] font-semibold text-text-primary">
              Delivery Time
            </span>
            <span className="text-[14px] font-medium tabular-nums text-text-secondary">
              {fmtMinutes(offer.deliveryMin, offer.deliveryMax)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-white/[0.07] py-3.5">
            <span className="text-[14px] font-semibold text-text-primary">
              In Stock
            </span>
            {outOfStock ? (
              <span className="text-[14px] font-medium text-text-secondary">
                Out Of Stock
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[14px] font-medium tabular-nums text-text-secondary">
                <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
                {offer.stock.toLocaleString('en-US')} {unitLabel}
              </span>
            )}
          </div>

          <div className="border-t border-white/[0.07] py-3.5">
            <div className="text-[14px] font-semibold text-text-primary">
              Delivery Instructions
            </div>
            <CollapsibleText
              lines={5}
              moreLabel="View more"
              lessLabel="View less"
              resetKey={offer.id}
              className="mt-1.5 text-[13px] leading-snug text-text-secondary"
            >
              {offer.blurb?.trim() || (
                <span className="italic text-text-tertiary">
                  This seller hasn&apos;t added instructions yet.
                </span>
              )}
            </CollapsibleText>
          </div>

          {offer.badges?.length ? (
            <ul className="mt-3 flex flex-wrap gap-2 border-t border-white/[0.07] pt-3.5">
              {offer.badges.map((b) => (
                <li
                  key={b}
                  className="inline-flex items-center gap-1 rounded-md bg-white/[0.06] px-2.5 py-1 text-[12px] font-medium text-text-secondary"
                >
                  <ShieldCheck className="h-3 w-3 text-text-tertiary" aria-hidden />
                  {b}
                </li>
              ))}
            </ul>
          ) : null}
        </Card>

        {/* RIGHT CARD — Price + quantity + buy + trust.
            Desktop only — mobile uses the sticky bar + slide-up sheet.
            V43 — SafeDrop emblem watermark peeks from the corner
            (matches the item-page buy panel). `isolate` creates the
            stacking context so the -z-10 art paints above the card bg
            but below every row. */}
        {/* V64 — Right rail: the buy panel exactly as before, plus the
            trust tiles in their OWN card below (item-page rail format;
            same width so alignment is automatic). */}
        <div className="hidden lg:block">
          <Card className="relative isolate overflow-hidden border-0 bg-[linear-gradient(180deg,#212228_0%,#1A1B1F_100%)] shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)] p-5 sm:p-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/safedrop-emblem.avif"
              width={128}
              height={128}
              alt=""
              aria-hidden
              className="pointer-events-none absolute -bottom-16 -right-8 -z-10 h-44 w-44 rotate-12 select-none opacity-50"
            />
            <div className="absolute right-5 top-5 z-10">
              {/* V24 — Amber/gold "Recommended" badge. Reads as a premium
                  distinction mark, distinct from lime (which is reserved for
                  the Buy CTA). Warm gold pairs cleanly with the black + lime. */}
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-400/10 px-2.5 py-1 text-[12px] font-semibold text-amber-300">
                <StarRoundedIcon style={{ fontSize: 14 }} />
                Recommended
              </span>
            </div>
            {purchasePanel}
          </Card>
          <Card className="relative mt-3 overflow-hidden border-0 bg-[linear-gradient(180deg,#212228_0%,#1A1B1F_100%)] shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)] p-4">
            <TrustBand />
          </Card>
        </div>
      </div>

      {/* MOBILE — Sticky bottom price/CTA tile. Tapping opens the
          slide-up sheet (PhoneBuySheet) with the keypad purchase flow.
          Mirrors GameBoost / Eldorado mobile pattern. */}
      <div className="mt-3 lg:hidden">
        {isOwnOffer ? (
          <a
            href={`/sell/edit/${offer.id}`}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-amber-500/10 text-[14px] font-semibold text-amber-300"
          >
            <Store className="h-4 w-4" />
            Edit Your Listing
          </a>
        ) : (
          <motion.button
            type="button"
            onClick={() => setMobileOpen(true)}
            disabled={outOfStock}
            whileTap={outOfStock || reduceMotion ? undefined : { scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 600, damping: 32 }}
            // One wide button carries the whole row (owner, 2026-09-30: the
            // box-with-a-button "doesn't look nice"): the action on the left,
            // what you get and what it costs on the right. Opens the sheet
            // with the quantity stepper.
            className={cn(
              'h-14 w-full justify-between rounded-lg px-5 text-[16px]',
              outOfStock
                ? 'flex cursor-not-allowed items-center bg-bg-raised font-semibold text-text-tertiary'
                : cn('group', BUY_FACE),
            )}
          >
            {outOfStock ? (
              <span>Out Of Stock</span>
            ) : (
              <>
                <BuySweep />
                <span className="relative">{PURCHASES_ENABLED ? 'Buy Now' : 'Opens Soon'}</span>
                <span className="relative flex min-w-0 items-center gap-2.5">
                  <span className="truncate text-[14px] font-medium text-white/75">
                    {qty.toLocaleString('en-US')} {unitLabel}
                  </span>
                  <span className="tabular-nums">{money(total)}</span>
                  <ArrowRight aria-hidden className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" strokeWidth={2.5} />
                </span>
              </>
            )}
          </motion.button>
        )}
      </div>

      {/* Phone purchase sheet: in-sheet keypad, never the OS keyboard
          (see _PhoneBuySheet). */}
      <PhoneBuySheet
        open={mobileOpen}
        onOpenChange={setMobileOpen}
        offer={offer}
        unitLabel={unitLabel}
        granularity={granularity}
        qty={qty}
        setQty={setQty}
        stepUp={stepUp}
        stepDown={stepDown}
        unit={unit}
        total={total}
        onBuy={onBuy}
        buying={buying}
        deliveryText={offer.deliveryLabel || fmtMinutes(offer.deliveryMin, offer.deliveryMax)}
      />
    </section>
  )
}

/**
 * PurchasePanel — V21/P7.i
 *
 * Right-card body extracted so the desktop card and the mobile
 * slide-up drawer can share one implementation. Renders price + qty
 * stepper + min/in-stock helper + CTA + trust tiles.
 */
function PurchasePanel({
  offer, unitLabel, granularity, qty, setQty, stepUp, stepDown, unit, total, onBuy, buying,
  isOwnOffer, outOfStock,
}: {
  offer: Offer
  unitLabel: string
  granularity: 'unit' | 'thousand' | 'million'
  qty: number
  setQty: (n: number) => void
  stepUp: () => void
  stepDown: () => void
  unit: number
  total: number
  onBuy: () => void
  buying: boolean
  isOwnOffer: boolean
  outOfStock: boolean
}) {
  return (
    <>
      <div>
        <div className="text-[12.5px] font-medium text-text-tertiary">
          Price Per {priceUnit(granularity)}
        </div>
        <div className="mt-0.5 text-[26px] font-bold tabular-nums leading-none text-text-primary">
          {unitPrice(unit)}
        </div>
      </div>

      <div className="mt-4 border-t border-white/[0.07] pt-4">
        <div className="flex h-12 items-center overflow-hidden rounded-md bg-bg-overlay transition-[background-color,box-shadow] focus-within:bg-bg-overlay-2 focus-within:ring-1 focus-within:ring-white/15 sm:h-[52px]">
          <button
            type="button"
            onClick={stepDown}
            disabled={qty <= offer.minQty}
            aria-label="Decrease quantity"
            className={cn(
              'flex h-full w-12 shrink-0 items-center justify-center text-text-secondary transition-colors sm:w-14',
              'hover:text-text-primary',
              'disabled:cursor-not-allowed disabled:opacity-40',
            )}
          >
            <Minus className="h-4 w-4" />
          </button>
          <span aria-hidden className="h-6 w-px bg-border-subtle" />
          {/* Number + unit centred as one ("100 M"), matching the seller's
              Stock / Minimum boxes. The input is sized to its digits so the
              pair centres; the label makes the unit and the empty space
              either side focus the field. */}
          <label className="flex h-full min-w-0 flex-1 cursor-text items-center justify-center gap-1.5 text-[17px] font-semibold tabular-nums text-text-primary sm:text-[18px]">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={String(qty)}
              style={{ width: `${Math.max(String(qty).length, 1) + 0.5}ch` }}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 9)
                const n = parseInt(digits || '0', 10)
                setQty(Number.isFinite(n) ? n : offer.minQty)
              }}
              onFocus={(e) => e.currentTarget.select()}
              onBlur={() => {
                if (qty < offer.minQty) setQty(offer.minQty)
                else if (offer.stock > 0 && qty > offer.stock) setQty(offer.stock)
              }}
              aria-label={`Quantity in ${unitLabel}`}
              // The field around it shows focus; the input itself draws no
              // box (the global :focus-visible ring boxed just the digits).
              className="h-full min-w-0 border-0 bg-transparent p-0 text-center outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:shadow-none focus-visible:outline-none"
            />
            <span className="text-text-secondary">{unitLabel}</span>
          </label>
          <span aria-hidden className="h-6 w-px bg-border-subtle" />
          <button
            type="button"
            onClick={stepUp}
            aria-label="Increase quantity"
            className="flex h-full w-12 shrink-0 items-center justify-center text-text-secondary transition-colors hover:text-text-primary sm:w-14"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between px-1 text-[12.5px] font-medium text-text-secondary">
          <span>Minimum Quantity: <span className="font-semibold tabular-nums text-text-primary">{offer.minQty.toLocaleString('en-US')} {unitLabel}</span></span>
          <span>{outOfStock ? 'Out Of Stock' : <>Stock: <span className="font-semibold tabular-nums text-text-primary">{offer.stock.toLocaleString('en-US')} {unitLabel}</span></>}</span>
        </div>
      </div>

      {isOwnOffer ? (
        <a
          href={`/sell/edit/${offer.id}`}
          className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-amber-500/10 text-[14px] font-semibold text-amber-300 transition-colors hover:bg-amber-500/15"
        >
          <Store className="h-4 w-4" />
          Edit Your Listing
        </a>
      ) : outOfStock ? (
        <button
          type="button"
          disabled
          className="mt-4 flex h-12 w-full cursor-not-allowed items-center justify-center rounded-md bg-bg-overlay text-[14px] font-semibold text-text-tertiary"
        >
          Out Of Stock
        </button>
      ) : (
        <BuyButton onClick={onBuy} loading={buying} className="mt-4 w-full">
          {PURCHASES_ENABLED ? 'Buy Now · ' : 'Buying Opens Soon · '}
          <span className="tabular-nums">{money(total)}</span>
        </BuyButton>
      )}
    </>
  )
}

function FilterChips({
  filter, setFilter,
}: { filter: 'recommended' | 'cheapest' | 'fastest'; setFilter: (f: 'recommended' | 'cheapest' | 'fastest') => void }) {
  // The shared account/marketplace tab control (sliding pill, no lime).
  // Icons from sm up; short labels on phones so all three fit one line.
  const tab = (iconSrc: string, label: string, shortLabel: string) => (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={iconSrc} alt="" aria-hidden draggable={false} width={18} height={18} className="hidden h-[18px] w-[18px] select-none object-contain sm:block" />
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">{shortLabel}</span>
    </>
  )
  return (
    <SegmentedTabs
      tabs={[
        { id: 'recommended', label: tab('/icons/sort/recommended.webp', 'Recommended', 'Recommended') },
        { id: 'cheapest', label: tab('/icons/sort/cheapest.webp', 'Cheapest First', 'Cheapest') },
        { id: 'fastest', label: tab('/icons/sort/fastest.webp', 'Fastest Delivery', 'Fastest') },
      ]}
      value={filter}
      onChange={setFilter}
      layoutId="currency-sort-pill"
      ariaLabel="Sort sellers"
    />
  )
}

/** V60 — Icon-chip stat row for the expanded seller panel. */
/** Short seller value for the Offer details tile ("100% (12) · 34 Sold",
 *  or "Verified Seller" before the first sale); the header above it carries
 *  the full line with the tier. */
function sellerFactText(offer: Offer): string {
  const line = sellerStatLine({ ratingPercent: offer.rating, reviews: offer.reviews, sales: offer.sales, tier: offer.tier })
  if (line.kind === 'verified') return 'Verified Seller'
  return [
    line.rating ? `${line.rating.percent}% (${line.rating.reviews.toLocaleString('en-US')})` : null,
    line.sales > 0 ? `${line.sales.toLocaleString('en-US')} Sold` : null,
  ].filter(Boolean).join(' · ') || line.tierLabel
}

function Fact({ icon: Icon, label, value }: { icon: typeof StarRoundedIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-8 w-8 flex-none place-items-center rounded-md bg-bg-overlay">
        <Icon className="text-text-tertiary" style={{ fontSize: 16 }} aria-hidden />
      </span>
      <div className="min-w-0">
        <div className="text-[12px] text-text-tertiary">{label}</div>
        <div className="truncate text-[13px] font-bold tabular-nums text-text-primary">{value}</div>
      </div>
    </div>
  )
}

function SellerRow({
  offer, unitLabel, perLabel, onSelect, isOwn,
}: {
  offer: Offer
  /** Quantity suffix: 'K' / 'M' on bulk games, the currency name otherwise. */
  unitLabel: string
  /** What one price covers, after "per": 'M', or "R$ Robux" on unit games. */
  perLabel: string
  onSelect: () => void
  /** V14m — When true, the viewer owns this listing — disable Select and
   *  swap in a "Yours" badge so they don't try to buy their own offer. */
  isOwn?: boolean
}) {
  const [open, setOpen] = useState(false)
  const hasInstructions = !!offer.blurb?.trim()

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen} asChild>
      <article
        className={cn(
          // V19/P24/P7.pp — Standalone card surface (rounded-lg) since
          // the outer SectionCard wrapper is gone. Border bumped to
          // border-default so each row reads as its own card.
          // Frosted-glass panel: dark translucent + blur so the hero backdrop
          // is softened behind the row (a light 4% wash let the busy hero
          // image show through and look muddy). Open/hover lift the fill.
          // V49 — bundle-tile hover language: gentle lift + deeper shadow.
          // Fill-only card (owner 2026-09-29: no outlines); open/hover step
          // one shade lighter in the same black family.
          'relative overflow-hidden rounded-lg transition-[background-color,transform,box-shadow] duration-200',
          open
            ? 'bg-bg-raised-hover'
            : 'bg-bg-raised hover:-translate-y-0.5 hover:bg-bg-raised-hover hover:shadow-[0_12px_24px_-12px_rgba(0,0,0,0.6)]',
        )}
      >
        {/* V13b/V60 — The expand trigger is a transparent overlay button
            behind the content; the content layers are pointer-events-none
            so every click on the row (not just a caret) reaches it. Only
            Select / Yours restore pointer-events. The caret buttons are
            gone — the whole row IS the toggle. Select stays a separate
            sibling <button> to avoid button-in-button hydration errors. */}
        <div className="relative">
          {/* Background trigger — full-row click target for expand/collapse */}
          <Collapsible.Trigger asChild>
            <button
              type="button"
              aria-expanded={open}
              aria-label={open ? 'Collapse seller details' : 'Expand seller details'}
              className="absolute inset-0 z-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-soft"
            />
          </Collapsible.Trigger>

          {/* Foreground content — sits above the trigger via z-10. Interactive
              elements (Select btn, caret) use pointer-events to stay clickable
              while non-interactive parts pass clicks through to the trigger
              underneath. */}
          <div className="pointer-events-none relative z-10 flex items-center gap-3 p-4 sm:gap-5 sm:p-5">
            {/* Seller — leads the row */}
            <div className="pointer-events-none flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
              <Avatar name={offer.seller} hue={offer.avatarHue} imageUrl={offer.avatarUrl} size={40} />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[14px] font-bold text-text-primary sm:text-[15px]">{offer.seller}</span>
                  {offer.verified && <VerifiedBadge size={13} />}
                </div>
                <SellerStats
                  ratingPercent={offer.rating}
                  reviews={offer.reviews}
                  sales={offer.sales}
                  tier={offer.tier}
                  className="mt-0.5 text-[11.5px] sm:text-[12.5px]"
                />
              </div>
            </div>

            {/* V14g — Fixed-width metric columns so the layout stays linear
                across all rows. Full numbers, capitalised labels. Price
                column is wider to fit the unit caption. */}
            <div className="pointer-events-none hidden items-center gap-5 sm:flex">
              <MetricCol
                icon={Inventory2RoundedIcon}
                label="Stock"
                value={offer.stock.toLocaleString('en-US')}
                width={120}
              />
              <MetricCol
                icon={TuneRoundedIcon}
                label="Minimum"
                value={offer.minQty.toLocaleString('en-US')}
                width={100}
              />
              <MetricCol
                icon={ScheduleRoundedIcon}
                label="Delivery"
                value={offer.deliveryLabel || `${offer.deliveryMin}-${offer.deliveryMax} Min`}
                width={110}
              />
              <span aria-hidden className="h-10 w-px bg-border-subtle" />
              <div className="w-[120px] shrink-0">
                <div className="text-[20px] font-bold tabular-nums leading-none text-text-primary sm:text-[22px]">
                  {unitPrice(offer.pricePerUnit)}
                </div>
                <div className="mt-1 text-[12px] text-text-tertiary">
                  per {perLabel}
                </div>
              </div>
            </div>

            {/* Select button + caret — pointer-events restored, both are
                real buttons so neither needs to nest inside the trigger */}
            <div className="pointer-events-auto flex shrink-0 items-center gap-2">
              {isOwn ? (
                // V14m — Viewer's own listing: clearly mark with an amber
                // "Yours" chip linking to edit. Can't select your own offer.
                <a
                  href={`/sell/edit/${offer.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-amber-500/10 px-4 text-[13px] font-semibold text-amber-300 transition-colors hover:bg-amber-500/15"
                >
                  <Store className="h-3.5 w-3.5" />
                  Yours
                </a>
              ) : (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onSelect() }}
                  className="inline-flex h-10 items-center justify-center rounded-md bg-white/[0.08] px-4 text-[13px] font-semibold text-text-primary transition-[background-color,transform] hover:bg-white/[0.14] active:scale-[0.97]"
                >
                  Select
                </button>
              )}
            </div>
          </div>

          {/* Mobile metric strip — second row below; click-through so the
              full-row trigger handles taps here too. Mobile-audit —
              flex-wrap so long delivery windows ("1-24 Hours") wrap to a
              second line instead of getting clipped by the card's
              overflow-hidden at 360px. */}
          <div className="pointer-events-none relative z-10 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-t border-white/[0.07] px-4 py-2.5 sm:hidden">
            <span className="inline-flex items-center gap-1.5 text-[12px] text-text-secondary">
              <span className="font-bold tabular-nums text-text-primary">{unitPrice(offer.pricePerUnit)}</span>
              <span className="text-text-tertiary">per {perLabel}</span>
            </span>
            <MetricChipMobile icon={Inventory2RoundedIcon} label="Stock" value={`${offer.stock.toLocaleString('en-US')} ${unitLabel}`} />
            <MetricChipMobile icon={ScheduleRoundedIcon} label="Delivery" value={offer.deliveryLabel || `${offer.deliveryMin}-${offer.deliveryMax} Min`} />
          </div>
        </div>

        {/* Force-mounted so Expand can animate the close (height + fade,
            like the account sidebar); Radix still wires the trigger's
            aria-controls to it. */}
        <Collapsible.Content forceMount asChild>
          <Expand open={open}>
            {/* V60 — Full-width detail panel: two glass tiles (the seller's
                own instructions + structured offer facts) over the whole row,
                then an action bar. Replaces the old left-hugging text block. */}
            <div className="border-t border-white/[0.07] p-3.5 sm:p-4">
              <div className="flex flex-col gap-3 lg:flex-row">
                {/* Seller instructions tile */}
                <div className="relative flex-1 overflow-hidden rounded-md bg-bg-overlay p-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-text-primary">
                      Seller Instructions
                    </span>
                  </div>
                  {hasInstructions ? (
                    <p className="mt-2.5 line-clamp-5 whitespace-pre-line text-[13.5px] leading-relaxed text-text-secondary">
                      {offer.blurb}
                    </p>
                  ) : (
                    <p className="mt-2.5 text-[13.5px] italic text-text-tertiary">
                      This seller hasn&apos;t added instructions yet.
                    </p>
                  )}
                </div>

                {/* Offer facts tile */}
                <div className="relative shrink-0 overflow-hidden rounded-md bg-bg-overlay p-4 lg:w-[380px]">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-text-primary">
                      Offer Details
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
                    <Fact icon={StarRoundedIcon} label="Seller" value={sellerFactText(offer)} />
                    <Fact icon={Inventory2RoundedIcon} label="In Stock" value={`${offer.stock.toLocaleString('en-US')} ${unitLabel}`} />
                    <Fact icon={ScheduleRoundedIcon} label="Delivery" value={offer.deliveryLabel || fmtMinutes(offer.deliveryMin, offer.deliveryMax)} />
                    <Fact
                      icon={TuneRoundedIcon}
                      label="Minimum Quantity"
                      value={`${offer.minQty.toLocaleString('en-US')} ${unitLabel} · ${money(offer.minQty * offer.pricePerUnit)}`}
                    />
                  </div>
                </div>
              </div>

              {/* Action bar — CTA left, SafeDrop Protection assurance right */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                {isOwn ? (
                  <a
                    href={`/sell/edit/${offer.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex h-9 items-center gap-1 rounded-md bg-amber-500/10 px-3 text-[13px] font-semibold text-amber-300 transition-colors hover:bg-amber-500/15"
                  >
                    Edit Listing
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onSelect() }}
                    className="inline-flex h-9 items-center gap-1 rounded-md bg-white/[0.08] px-3 text-[13px] font-semibold text-text-primary transition-colors hover:bg-white/[0.14]"
                  >
                    View Full Offer
                    <ChevronDown className="h-3.5 w-3.5 -rotate-90" />
                  </button>
                )}
                <span className="inline-flex items-center gap-1.5 text-[12px] text-text-tertiary">
                  <ShieldCheck className="h-3.5 w-3.5 text-text-tertiary" aria-hidden />
                  SafeDrop Protection: Item Guaranteed or Full Refund
                </span>
              </div>
            </div>
          </Expand>
        </Collapsible.Content>
      </article>
    </Collapsible.Root>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg bg-bg-raised p-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-bg-overlay">
        <Store className="h-5 w-5 text-text-tertiary" />
      </div>
      <h3 className="text-base font-bold text-text-primary">No Other Sellers Yet</h3>
      <p className="max-w-md text-sm text-text-secondary">
        This is the only offer for now. New sellers list daily, so check back soon.
      </p>
    </div>
  )
}


// V14e — Match the How it works width (full max-w-4xl wrapper). The
// previous max-w-2xl looked starved next to the 3-column grid above.
// Prose inside is still capped to a comfortable reading measure.
function SeoBlock({ currency }: { currency: CurrencyPageData['currency'] }) {
  return (
    <section className="rounded-lg bg-bg-raised p-6 sm:p-8 lg:p-10">
      <h2 className="text-[22px] font-bold text-text-primary sm:text-[26px]">
        About buying {currency.name}
      </h2>
      <div className="mt-4 max-w-3xl space-y-5 text-[14px] leading-[1.7] text-text-secondary">
        <p>
          {currency.name} is the in-game currency for {currency.game}. Players use it to unlock
          cosmetic items, game passes, and other premium experiences across the platform.
          DropMarket connects you with independent sellers — verified by us and rated by real
          buyers — so you can choose by price, speed, and reputation.
        </p>
        <div>
          <h3 className="text-[16.5px] font-bold text-text-primary">
            Why people buy {currency.name} on a marketplace
          </h3>
          <p className="mt-2">
            Marketplace prices typically beat first-party rates, especially in bulk. Sellers
            compete on per-unit price, delivery speed, and stock availability, which keeps the
            ecosystem buyer-friendly. Pick the seller whose trade-offs match what you care about.
          </p>
        </div>
        <div>
          <h3 className="text-[16.5px] font-bold text-text-primary">
            How delivery and safety work here
          </h3>
          <p className="mt-2">
            Every order is covered by SafeDrop Protection: your {currency.name} arrives
            as described, or you get your money back. No password
            sharing is ever required — delivery is through in-game gifting or group payouts.
            Not delivered or not as described? You get a full refund.
          </p>
        </div>
      </div>
    </section>
  )
}
