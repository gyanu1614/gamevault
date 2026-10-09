'use client'

/**
 * CurrencySellerRow — the ONE "Other Sellers" row on both currency pages
 * (flexible amounts like Robux, fixed bundles like V-Bucks / R6 Credits).
 * Before 2026-10-04 each page drew its own row; the bundle one put the stats
 * inline after the name link (so "👍 100% · 1 Sold" and "Verified Seller"
 * sat on the name's line, off its baseline) and its own offer showed an
 * outlined "Yours" button.
 *
 *   identity   avatar + two lines: name, blue check, tier icon
 *                                  rating · sold, or "Verified Seller" (muted)
 *   desktop    fixed-width metric columns, a hairline, the price column
 *   action     Select, or a quiet filled "Yours" pill of the same size, so
 *              the price column lines up on every row
 *   phone      identity + action on top, price and metrics in a strip below
 *   details    optional: makes the whole row an expand toggle (flexible page)
 *
 * Data, sorting and what Select does stay with each page.
 */

import { useState, type ReactNode } from 'react'
import Link from '@/components/navigation/AppLink'
import * as Collapsible from '@radix-ui/react-collapsible'
import type Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded'
import { Expand } from '@/components/ui/expand'
import { SellerStats } from '@/components/seller/SellerStats'
import { VerifiedBadge } from '@/components/seller/VerifiedBadge'
import { NewSellerBadge } from '@/components/seller/NewSellerBadge'
import { TierIcon } from '@/components/seller/tiers/TierIcon'
import { sellerStatLine } from '@/lib/seller/stat-line'
import { cn } from '@/lib/utils'
import { MARKET_CARD, MARKET_CARD_HOVER } from '@/lib/ui/surfaces'

export type MetricIcon = typeof Inventory2RoundedIcon

export interface SellerIdentityData {
  name: string
  avatarUrl?: string | null
  /** 0–360 hue for the initial tile when there is no avatar. */
  avatarHue?: number | null
  verified: boolean
  rating: number | null
  reviews: number
  sales: number
  tier: string | null
}

export interface RowMetric {
  icon: MetricIcon
  label: string
  value: string
  /** Fixed desktop column width (px) so columns line up across rows. */
  width: number
}

/* ── Identity ──────────────────────────────────────────────────── */

function SellerAvatar({ name, url, hue, size }: { name: string; url?: string | null; hue?: number | null; size: number }) {
  if (url) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={url}
        alt={`${name} avatar`}
        aria-hidden
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    )
  }
  const h = Number.isFinite(Number(hue)) ? Number(hue) : null
  return (
    <span
      aria-hidden
      className={cn('flex shrink-0 items-center justify-center rounded-full font-bold text-text-primary', h == null && 'bg-bg-overlay')}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
        background: h == null ? undefined : `linear-gradient(135deg, oklch(0.72 0.15 ${h}), oklch(0.55 0.18 ${(h + 30) % 360}))`,
      }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  )
}

/**
 * Avatar beside a two-line block, vertically centred on the avatar.
 * `href` links the name to the storefront (interactive rows only).
 */
export function SellerIdentity({
  seller,
  href,
  size = 40,
}: {
  seller: SellerIdentityData
  href?: string | null
  size?: number
}) {
  const line = sellerStatLine({ ratingPercent: seller.rating, reviews: seller.reviews, sales: seller.sales, tier: seller.tier })
  const name = (
    <span className="truncate text-[14px] font-semibold leading-5 text-text-primary sm:text-[15px]">{seller.name}</span>
  )
  return (
    <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
      <SellerAvatar name={seller.name} url={seller.avatarUrl} hue={seller.avatarHue} size={size} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-1.5">
          {href ? (
            <Link
              href={href}
              onClick={(e) => e.stopPropagation()}
              className="pointer-events-auto min-w-0 truncate rounded-sm transition-colors hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-soft"
            >
              {name}
            </Link>
          ) : (
            name
          )}
          {seller.verified ? <VerifiedBadge size={14} /> : <NewSellerBadge />}
          {line.kind === 'stats' && <TierIcon tier={seller.tier} size={14} className="h-3.5 w-3.5 shrink-0" />}
        </div>
        <SellerStats
          ratingPercent={seller.rating}
          reviews={seller.reviews}
          sales={seller.sales}
          tier={seller.tier}
verified={seller.verified}
          hideTier
          className={cn(
            'text-[12px] leading-4 sm:text-[12.5px]',
            line.kind === 'verified' && 'font-medium text-text-tertiary',
          )}
        />
      </div>
    </div>
  )
}

/* ── Action: Select, or the viewer's own offer ─────────────────── */

const ACTION_BOX = 'inline-flex h-10 min-w-[84px] items-center justify-center rounded-md px-4 text-[13px] font-semibold'

export function OfferRowAction({ isOwn, onSelect }: { isOwn: boolean; onSelect: () => void }) {
  if (isOwn) {
    // Not a button: you cannot buy your own offer. Same box as Select so the
    // price column stays aligned; quiet fill, no outline.
    return (
      <span className={cn(ACTION_BOX, 'cursor-default select-none bg-white/[0.05] text-text-tertiary')} title="This is your offer">
        Yours
      </span>
    )
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
      className={cn(
        ACTION_BOX,
        'bg-white/[0.08] text-text-primary transition-[background-color,transform] hover:bg-white/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-soft active:scale-[0.97]',
      )}
    >
      Select
    </button>
  )
}

/* ── Row ───────────────────────────────────────────────────────── */

/** Value first (icon + bold number), label under it — the flexible page's
 *  approved column; fixed width so columns align across rows. */
function MetricCol({ icon: Icon, label, value, width }: RowMetric) {
  return (
    <div className="shrink-0" style={{ width }}>
      <div className="flex items-center gap-1.5 text-[14px] font-bold tabular-nums text-text-primary sm:text-[15px]">
        <Icon aria-hidden className="shrink-0 text-text-tertiary" style={{ fontSize: 15 }} />
        <span className="truncate">{value}</span>
      </div>
      <div className="mt-0.5 text-[12px] text-text-tertiary">{label}</div>
    </div>
  )
}

function MetricChip({ icon: Icon, label, value }: Omit<RowMetric, 'width'>) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-text-secondary">
      <Icon className="text-text-tertiary" aria-hidden style={{ fontSize: 13 }} />
      <span className="font-semibold tabular-nums text-text-primary">{value}</span>
      <span className="text-text-tertiary">{label}</span>
    </span>
  )
}

export interface CurrencySellerRowProps {
  seller: SellerIdentityData
  /** Storefront link for the name; omit on rows that expand on click. */
  sellerHref?: string | null
  metrics: RowMetric[]
  /** Price text ("$4.99", "$0.0055") and what it covers ("per bundle"). */
  price: string
  priceCaption?: string
  /** Phone strip values; `value` of each may differ from the desktop one (units). */
  mobileMetrics?: Array<Omit<RowMetric, 'width'>>
  isOwn: boolean
  onSelect: () => void
  /** When given, the row toggles this panel open/closed. */
  details?: ReactNode
}

// The marketplace card (gradient, no outline); hover lifts the gradient.
const ROW_SURFACE = cn('relative overflow-hidden rounded-lg', MARKET_CARD)
const ROW_IDLE = MARKET_CARD_HOVER
const ROW_OPEN = 'bg-[linear-gradient(180deg,#27282F_0%,#1E1F25_100%)]'

export function CurrencySellerRow(p: CurrencySellerRowProps) {
  const [open, setOpen] = useState(false)
  const expandable = p.details != null
  const mobile = p.mobileMetrics ?? p.metrics
  // Expandable rows pass clicks through to the toggle behind the content.
  const passThrough = expandable ? 'pointer-events-none' : ''

  const content = (
    <>
      <div className={cn(passThrough, 'relative z-10 flex items-center gap-3 p-4 sm:gap-5 sm:p-5')}>
        <div className="min-w-0 flex-1">
          <SellerIdentity seller={p.seller} href={expandable ? null : p.sellerHref} />
        </div>

        <div className="hidden items-center gap-5 sm:flex">
          {p.metrics.map((m) => (
            <MetricCol key={m.label} {...m} />
          ))}
          <span aria-hidden className="h-10 w-px bg-white/[0.07]" />
          <div className="w-[120px] shrink-0">
            <div className="text-[20px] font-bold leading-none tabular-nums text-text-primary sm:text-[22px]">{p.price}</div>
            {p.priceCaption && <div className="mt-1 truncate text-[12px] text-text-tertiary">{p.priceCaption}</div>}
          </div>
        </div>

        <div className="pointer-events-auto shrink-0">
          <OfferRowAction isOwn={p.isOwn} onSelect={p.onSelect} />
        </div>
      </div>

      {/* Phone: price first, then the metrics; wraps rather than clipping at 360px. */}
      <div className={cn(passThrough, 'relative z-10 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-t border-white/[0.07] px-4 py-2.5 sm:hidden')}>
        <span className="inline-flex items-center gap-1.5 text-[12px]">
          <span className="font-bold tabular-nums text-text-primary">{p.price}</span>
          {p.priceCaption && <span className="text-text-tertiary">{p.priceCaption}</span>}
        </span>
        {mobile.map((m) => (
          <MetricChip key={m.label} icon={m.icon} label={m.label} value={m.value} />
        ))}
      </div>
    </>
  )

  if (!expandable) {
    return (
      <article className={cn(ROW_SURFACE, ROW_IDLE)}>
        <div className="relative">{content}</div>
      </article>
    )
  }

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen} asChild>
      <article className={cn(ROW_SURFACE, open ? ROW_OPEN : ROW_IDLE)}>
        <div className="relative">
          {/* The whole row is the toggle: a transparent button behind the
              content (content is pointer-events-none; Select / the name link
              restore it). Avoids button-in-button. */}
          <Collapsible.Trigger asChild>
            <button
              type="button"
              aria-expanded={open}
              aria-label={open ? 'Collapse seller details' : 'Expand seller details'}
              className="absolute inset-0 z-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-soft"
            />
          </Collapsible.Trigger>
          {content}
        </div>
        <Collapsible.Content forceMount asChild>
          <Expand open={open}>{p.details}</Expand>
        </Collapsible.Content>
      </article>
    </Collapsible.Root>
  )
}
