'use client'

/**
 * Checkout — V5 reskin.
 *
 * Two-step wizard mirrors the sell-wizard chrome: clickable step labels
 * with a lime progress rail, sub-cards for each section, GV tokens, Radix
 * primitives (Checkbox, RadioGroup, NumberField, Dialog). Stripe Elements
 * theme retuned to lime accent on bg-bg-base surfaces.
 *
 * All payment + order logic preserved verbatim from the previous file —
 * only the surface chrome changed.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import Link from 'next/link'
import {
  Shield, Star, Award, Check, Loader2, AlertCircle, Lock, CheckCircle2,
  Coins, Tag, X, ChevronDown, ChevronRight, ChevronLeft, Zap, CreditCard, ShieldCheck, Wallet,
  ArrowRight, Plus, Minus,
} from 'lucide-react'

// V14l — Smart price formatter. For currency listings ($0.0045/unit) the
// per-unit price would round to "$0.00" at 2 decimals — confusing the
// buyer. Auto-extend to 4 decimals when needed. Subtotals/totals stay at
// 2 decimals since they're always at least a few cents.
function fmtUnitPrice(n: number): string {
  if (n === 0) return '$0.00'
  // If 2-decimal would round below half a cent, switch to 4 decimals.
  if (Math.abs(n) < 0.01) return `$${n.toFixed(4)}`
  return `$${n.toFixed(2)}`
}

import { createCheckout } from '@/lib/actions/checkout'
import { validatePromoCode, type PromoValidationResult } from '@/lib/actions/promo'
import { PaymentMethodPicker, type PaymentMethodId } from './_PaymentMethodPicker'
import {
  ApplePayIcon,
  CardIcon,
  CryptoIcon,
  GooglePayIcon,
  KlarnaIcon,
  PayPalIcon,
  PaysafeIcon,
} from './_PaymentBrands'
import { Card } from '@/components/ui/card'
import { getWalletBalance } from '@/lib/actions/wallet'
import type { VaultShieldTier } from '@/lib/utils/vaultshield-tiers'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'


// ─── Tier config ─────────────────────────────────────────────────────────────

interface TierConfig {
  id: VaultShieldTier
  name: string
  feeRate: number
  warranty: string
  icon: React.ElementType
  /** Highlight color when this tier is active. */
  accent: 'slate' | 'lime' | 'amber'
  badge?: string
  features: string[]
}

const TIERS: TierConfig[] = [
  {
    id: 'standard',
    name: 'Standard',
    feeRate: 0,
    warranty: '48h protection',
    icon: Shield,
    accent: 'slate',
    features: [
      '48-hour buyer protection',
      'Escrow payment hold',
      'Dispute resolution',
      'Email support',
    ],
  },
  {
    id: 'enhanced',
    name: 'Enhanced',
    feeRate: 2,
    warranty: '7-day warranty',
    icon: Star,
    accent: 'lime',
    badge: 'Most popular',
    features: [
      'Everything in Standard',
      '7-day extended warranty',
      'Priority dispute resolution',
      'Dedicated support agent',
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    feeRate: 5,
    warranty: '30-day warranty',
    icon: Award,
    accent: 'amber',
    features: [
      'Everything in Enhanced',
      '30-day extended warranty',
      '24/7 VIP support',
      'Full refund guarantee',
    ],
  },
]

const tierAccentClasses = (accent: TierConfig['accent'], selected: boolean) => {
  if (!selected) {
    return 'border-border-subtle bg-bg-overlay hover:border-border-default'
  }
  if (accent === 'lime')  return 'border-lime bg-lime-tint-bg'
  if (accent === 'amber') return 'border-amber-500/40 bg-amber-500/10'
  return 'border-border-default bg-bg-raised-hover'
}
const tierIconClass = (accent: TierConfig['accent']) =>
  accent === 'lime' ? 'text-lime-text'
  : accent === 'amber' ? 'text-amber-400'
  : 'text-text-secondary'

// ─── Step bar ────────────────────────────────────────────────────────────────

// V14n — Seller card. A small but information-dense card surface with
// avatar, name, verified badge, rating, review count, total sales, and
// an expandable "More about this seller" section (tier, member-since).
// Replaces the previous chip-only design which buried the seller's
// reputation behind a single click.
interface SellerCardSeller {
  id?: string
  username?: string
  shop_name?: string | null
  avatar_url?: string | null
  seller_tier?: string | null
  seller_rating?: number | null
  total_reviews?: number | null
  total_sales?: number | null
  is_verified?: boolean | null
  created_at?: string | null
}

function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return String(n)
}
function memberSince(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString('en-US', { month: 'short', year: 'numeric' })
}
const TIER_LABEL: Record<string, string> = {
  unverified: 'Unverified',
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
}

function SellerCard({
  seller, compact,
}: {
  seller: SellerCardSeller | null | undefined
  /** Compact variant for the right sidebar (smaller paddings, no expand). */
  compact?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  if (!seller?.username) return null
  const displayName = seller.shop_name?.trim() || seller.username
  const initial = (displayName[0] || 'S').toUpperCase()
  const isVerified = !!seller.is_verified || (!!seller.seller_tier && seller.seller_tier !== 'unverified')
  const rating = seller.seller_rating != null ? Number(seller.seller_rating) : null
  const reviews = seller.total_reviews ?? 0
  const sales = seller.total_sales ?? 0
  const tier = seller.seller_tier ?? 'unverified'
  const since = memberSince(seller.created_at)

  return (
    <div
      className={cn(
        'rounded-xl border border-border-subtle bg-bg-overlay/60 transition-colors',
        compact ? 'mt-2 p-2.5' : 'mt-3 p-3 sm:p-3.5',
      )}
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <Link
          href={`/shop/${seller.username}`}
          aria-label={`Visit @${seller.username}'s shop`}
          className="shrink-0"
        >
          {seller.avatar_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={seller.avatar_url}
              alt=""
              className={cn(
                'rounded-full object-cover ring-1 ring-border-subtle transition-transform hover:scale-105',
                compact ? 'h-9 w-9' : 'h-11 w-11',
              )}
            />
          ) : (
            <span
              aria-hidden
              className={cn(
                'flex items-center justify-center rounded-full bg-bg-raised font-bold text-text-primary ring-1 ring-border-subtle',
                compact ? 'h-9 w-9 text-sm' : 'h-11 w-11 text-base',
              )}
            >
              {initial}
            </span>
          )}
        </Link>

        {/* Identity + stats */}
        <div className="min-w-0 flex-1">
          <Link
            href={`/shop/${seller.username}`}
            className="group flex items-center gap-1.5 text-text-primary transition-colors hover:text-lime-text"
          >
            <span className={cn('truncate font-bold', compact ? 'text-[13px]' : 'text-[14px] sm:text-[15px]')}>
              {displayName}
            </span>
            {isVerified && (
              <span
                aria-label="Verified seller"
                title={`Verified ${TIER_LABEL[tier] ?? 'seller'}`}
                className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-lime-tint-bg text-lime-text"
              >
                <Check className="h-2.5 w-2.5" strokeWidth={3} />
              </span>
            )}
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-text-tertiary opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100 group-hover:text-lime-text" />
          </Link>
          {/* Inline stat row — rating · reviews · sales */}
          <div className={cn(
            'mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-text-tertiary',
            compact ? 'text-[11px]' : 'text-[12px]',
          )}>
            {rating != null && (
              <span className="inline-flex items-center gap-1">
                <Star className="h-3 w-3 fill-lime text-lime" />
                <span className="font-semibold tabular-nums text-text-primary">
                  {rating.toFixed(1)}{rating <= 5 ? '' : '%'}
                </span>
              </span>
            )}
            {reviews > 0 && (
              <>
                {rating != null && <span aria-hidden>·</span>}
                <span><span className="font-semibold tabular-nums text-text-secondary">{fmtCount(reviews)}</span> review{reviews === 1 ? '' : 's'}</span>
              </>
            )}
            {sales > 0 && (
              <>
                <span aria-hidden>·</span>
                <span><span className="font-semibold tabular-nums text-text-secondary">{fmtCount(sales)}</span> sold</span>
              </>
            )}
          </div>
        </div>

        {/* Expand toggle (non-compact only) */}
        {!compact && (since || tier !== 'unverified') && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={expanded ? 'Hide seller details' : 'Show seller details'}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border-subtle text-text-tertiary transition-colors hover:border-border-default hover:text-text-primary"
          >
            <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-90')} />
          </button>
        )}
      </div>

      {/* Expanded body — tier badge, member since, shop link */}
      {!compact && expanded && (
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border-subtle pt-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Tier</div>
            <div className="mt-0.5 text-[13px] font-semibold text-text-primary">
              {TIER_LABEL[tier] ?? 'Unverified'}
            </div>
          </div>
          {since && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Member since</div>
              <div className="mt-0.5 text-[13px] font-semibold text-text-primary">{since}</div>
            </div>
          )}
          <Link
            href={`/shop/${seller.username}`}
            className="col-span-2 inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-border-subtle bg-bg-raised text-[12px] font-semibold text-text-secondary transition-colors hover:border-lime-tint-border hover:bg-lime-tint-bg/30 hover:text-lime-text"
          >
            View full shop
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}
    </div>
  )
}

function StepBar({ step, onJump }: { step: 1 | 2; onJump: (n: 1 | 2) => void }) {
  // V19/P24/P7.q — 2Game-style horizontal stepper. 3 nodes (Review,
  // Payment, Confirmation). Circles with the step number sit on a
  // connecting line; active is filled lime, done is lime with check,
  // future is outlined. Label sits under each node.
  const STEPS = [
    { n: 1, label: 'Review Order' },
    { n: 2, label: 'Payment' },
    { n: 3, label: 'Confirmation' },
  ] as const
  return (
    <nav aria-label="Checkout progress" className="mb-8">
      <ol className="mx-auto flex w-full max-w-2xl items-center">
        {STEPS.map((s, i) => {
          const done = step > s.n
          const active = step === s.n
          const clickable = done && s.n < 3
          const isLast = i === STEPS.length - 1
          return (
            <li key={s.n} className="flex flex-1 items-start">
              <div className="flex flex-1 flex-col items-center">
                <button
                  type="button"
                  disabled={!clickable}
                  onClick={() => clickable && onJump(s.n as 1 | 2)}
                  aria-current={active ? 'step' : undefined}
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-[14px] font-bold transition-colors sm:h-10 sm:w-10',
                    active && 'border-lime bg-lime text-text-inverse',
                    done && 'border-lime bg-lime text-text-inverse',
                    !active && !done && 'border-border-default bg-bg-raised text-text-tertiary',
                    clickable && 'cursor-pointer hover:scale-105',
                  )}
                >
                  {done ? <Check className="h-4 w-4" strokeWidth={3} /> : s.n}
                </button>
                <span
                  className={cn(
                    'mt-2 text-center text-[12px] font-semibold sm:text-[13px]',
                    active && 'text-text-primary',
                    done && 'text-text-secondary',
                    !active && !done && 'text-text-tertiary',
                  )}
                >
                  {s.label}
                </span>
              </div>
              {!isLast && (
                <div
                  aria-hidden
                  className={cn(
                    'mt-[18px] h-0.5 flex-1 sm:mt-[20px]',
                    done ? 'bg-lime' : 'bg-border-default',
                  )}
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

// ─── SubCard ─────────────────────────────────────────────────────────────────

// V19/P24/P7.s — SubCard is now `Section`: tighter padding (p-4
// instead of p-4 sm:p-5), tighter title block (mb-3, no big divider
// — header sits directly above content with breathing room). Border
// stays subtle. Used across the entire checkout body.
function SubCard({
  title, right, children,
}: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border-subtle bg-bg-raised p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[14px] font-semibold text-text-primary">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  )
}

// ─── VaultShieldRow ──────────────────────────────────────────────────────────
//
// V19/P24/P7.s — Collapsed-by-default VaultShield tier picker.
// Shows the current tier as a slim row with an Upgrade chip; expands
// to the 3-tier comparison only when the buyer asks for it. Replaces
// the SubCard + 3-column grid that ate ~280px of vertical space.
function VaultShieldRow({
  tiers,
  value,
  onChange,
  subtotal,
}: {
  tiers: TierConfig[]
  value: string
  onChange: (id: any) => void
  subtotal: number
}) {
  const [open, setOpen] = useState(false)
  const current = tiers.find((t) => t.id === value) ?? tiers[0]
  const Icon = current.icon
  return (
    <section className="rounded-xl border border-border-subtle bg-bg-raised">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-bg-raised-hover"
        aria-expanded={open}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <Icon className={cn('h-4 w-4 shrink-0', tierIconClass(current.accent))} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[13.5px] font-semibold text-text-primary">
                VaultShield {current.name}
              </span>
              <span className="rounded-full bg-lime-tint-bg px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-lime-text">
                {current.feeRate === 0 ? 'Included' : `+${current.feeRate}%`}
              </span>
            </div>
            <div className="text-[11.5px] text-text-tertiary">{current.warranty}</div>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-lime-text">
          {open ? 'Hide' : 'Compare'}
          <ChevronDown
            className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')}
          />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 gap-2 border-t border-border-subtle p-3 sm:grid-cols-3">
              {tiers.map((tier) => {
                const TierIcon = tier.icon
                const selected = value === tier.id
                return (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => onChange(tier.id)}
                    aria-pressed={selected}
                    className={cn(
                      'flex flex-col gap-1.5 rounded-lg border p-2.5 text-left transition-colors',
                      selected
                        ? 'border-lime bg-lime-tint-bg/40'
                        : 'border-border-subtle bg-bg-inset/40 hover:border-border-default',
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <TierIcon className={cn('h-3.5 w-3.5', tierIconClass(tier.accent))} />
                      <span className="text-[12.5px] font-semibold text-text-primary">
                        {tier.name}
                      </span>
                      {selected && (
                        <CheckCircle2 className="ml-auto h-3.5 w-3.5 text-lime-text" />
                      )}
                    </div>
                    <div className="text-[12px] font-semibold tabular-nums text-text-primary">
                      {tier.feeRate === 0
                        ? 'Free'
                        : `+$${((subtotal * tier.feeRate) / 100).toFixed(2)}`}
                    </div>
                    <p className="text-[11px] leading-snug text-text-tertiary">
                      {tier.warranty}
                    </p>
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

// ─── ProductHeroCard ─────────────────────────────────────────────────────────
//
// V19/P24/P7.q — 2Game-inspired single-product hero card. One large
// row: art on the left, game eyebrow + product title + qty stepper
// in the middle, line subtotal on the right. SellerCard slots in at
// the bottom of the card so the buyer sees reputation + listing in
// one cohesive surface.
function ProductHeroCard({
  listing,
  bundleSummary,
  quantity,
  setQuantity,
  maxQty,
  subtotal,
}: {
  listing: any
  bundleSummary: { name: string; iconUrl: string | null } | null | undefined
  quantity: number
  setQuantity: (n: number) => void
  maxQty: number
  subtotal: number
}) {
  const isBundle = !!bundleSummary
  const title = bundleSummary?.name || listing.title
  const imageSrc =
    bundleSummary?.iconUrl ||
    listing.images?.[0] ||
    listing.game?.image_url ||
    '/placeholder-game.jpg'
  const showStepper =
    isBundle || (!listing.is_unlimited && listing.quantity > 1)

  return (
    <section className="overflow-hidden rounded-xl border border-border-subtle bg-bg-raised">
      <div className="border-b border-border-subtle p-4">
        <h2 className="mb-3 text-[14px] font-semibold text-text-primary">
          Your Cart
        </h2>
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageSrc}
            alt={title}
            className={cn(
              'h-20 w-20 shrink-0 rounded-lg ring-1 ring-border-subtle',
              isBundle
                ? 'bg-bg-overlay object-contain p-1.5'
                : 'object-cover',
            )}
          />
          <div className="min-w-0 flex-1">
            <div className="mb-0.5 flex items-center gap-1.5 text-[12px] text-text-tertiary">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={listing.game?.image_url || '/placeholder-game.jpg'}
                alt=""
                className="h-3.5 w-3.5 rounded object-cover"
              />
              <span>{listing.game?.name}</span>
            </div>
            <p className="line-clamp-2 text-[15px] font-bold leading-tight text-text-primary">
              {title}
            </p>
            <p className="mt-1 text-[12px] text-text-tertiary">
              {fmtUnitPrice(listing.price)} per {isBundle ? 'bundle' : 'unit'}
            </p>

            {showStepper && (
              <div className="mt-2.5 inline-flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-tertiary">
                  Qty
                </span>
                <div className="inline-flex h-8 items-center overflow-hidden rounded-lg border border-border-default bg-bg-overlay">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                    aria-label="Decrease quantity"
                    className="flex h-full w-7 items-center justify-center text-text-secondary transition-colors hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span aria-hidden className="h-4 w-px bg-border-subtle" />
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => {
                      const n = parseInt(e.target.value || '1', 10)
                      if (Number.isFinite(n)) {
                        setQuantity(Math.min(maxQty, Math.max(1, n)))
                      }
                    }}
                    onFocus={(e) => e.currentTarget.select()}
                    min={1}
                    max={maxQty}
                    aria-label="Quantity"
                    inputMode="numeric"
                    className="h-full w-10 border-0 bg-transparent text-center text-[13px] font-semibold tabular-nums text-text-primary outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <span aria-hidden className="h-4 w-px bg-border-subtle" />
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.min(maxQty, quantity + 1))}
                    disabled={quantity >= maxQty}
                    aria-label="Increase quantity"
                    className="flex h-full w-7 items-center justify-center text-text-secondary transition-colors hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[20px] font-black tabular-nums leading-none text-text-primary">
              ${subtotal.toFixed(2)}
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-wider text-text-tertiary">
              USD
            </p>
          </div>
        </div>
      </div>

      <div className="p-4">
        <SellerCard seller={listing.seller} compact />
      </div>
    </section>
  )
}

// ─── Order summary sidebar ───────────────────────────────────────────────────

interface SummaryProps {
  listing: any
  quantity: number
  /** V19/P24/P7.p — When present, the buyer can adjust qty directly
   *  from the summary (bundle listings only). Removes the duplicate
   *  "Your order" tile on the left so the form area has more room. */
  setQuantity?: (n: number) => void
  maxQty?: number
  subtotal: number
  platformFeeRate: number
  platformFee: number
  paymentProcessingFee: number
  selectedTier: TierConfig
  tierFeeAmount: number
  promoDiscount: number
  appliedCode: string | undefined
  promoResult: PromoValidationResult | null
  walletAmount: number
  total: number
  user: any
  walletBalance: number
  useWallet: boolean
  setUseWallet: (v: boolean) => void
  /** V19/P24/P7.u — Drop Credits wallet (cashback ledger). DC value
   *  shown as integer credits; 1 DC = $0.01 of order credit. */
  dropCreditsBalance: number
  useDropCredits: boolean
  setUseDropCredits: (v: boolean) => void
  /** Selected payment method (for the dynamic Pay With button). */
  paymentMethod: PaymentMethodId
  /** Bundle-aware: bundle name + icon for the preview tile. */
  bundleSummary?: { name: string; iconUrl: string | null } | null
  /** V19/P24/P7.z — Promo input wiring. */
  promoInput: string
  setPromoInput: (v: string) => void
  handleApplyPromo: () => void
  handleRemovePromo: () => void
  promoValidating: boolean
}

function OrderSummary(p: SummaryProps) {
  // V19/P24/P7.u — Recommended-Seller-style summary: rounded card,
  // horizontal grey dividers between every row, generous vertical
  // padding, no inner section chrome. Dynamic "Pay with {method}"
  // CTA. Drop Credits + Account Balance toggle rows. Cashback line
  // sits BELOW the CTA, not in the fee breakdown.
  //
  // V19/P24/P7.dd — Discount Code starts collapsed behind a "Have a
  // discount code?" button (industry standard — G2A, Eldorado,
  // GameBoost, Stripe Checkout all do this). Buyers without a code
  // never see the input.
  const [discountOpen, setDiscountOpen] = useState(false)
  const isBundle = !!p.bundleSummary
  const previewTitle = p.bundleSummary?.name || p.listing.title
  const previewImage =
    p.bundleSummary?.iconUrl ||
    p.listing.images?.[0] ||
    p.listing.game?.image_url ||
    '/placeholder-game.jpg'

  // 1 DC = $0.01 redemption
  const dcDollarValue = (p.dropCreditsBalance ?? 0) * 0.01
  // Cashback earned on THIS order: 2% of subtotal, in DC (so $X * 100 * 0.02)
  const dcEarned = Math.round(p.subtotal * 100 * 0.02)

  const methodInfo = paymentMethodLabel(p.paymentMethod)

  return (
    // V19/P24/P7.v — No card chrome. Content flows on the page.
    <div className="flex flex-col">
      <div className="pb-4">
        <h2 className="text-[20px] font-bold text-text-primary">Your Order</h2>
      </div>

      {/* V19/P24/P7.y — Product preview row: GAME logo on the left
          (Fortnite, R6, etc.), bundle/listing name as the title, and
          a small currency-section indicator (Coins icon) beside the
          game name to mark this as a Currency category purchase. */}
      <div className="flex items-center gap-3 py-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={p.listing.game?.image_url || '/placeholder-game.jpg'}
          alt={p.listing.game?.name || ''}
          className="h-12 w-12 shrink-0 rounded-lg object-cover ring-1 ring-border-subtle"
        />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 text-[16px] font-bold text-text-primary">
            {p.quantity}× · {previewTitle}
          </p>
          <p className="mt-1 line-clamp-1 inline-flex items-center gap-1.5 text-[14px] font-semibold">
            <Coins
              aria-label="Currency"
              className="h-4 w-4 text-lime-text"
            />
            <span className="text-text-primary">{p.listing.game?.name}</span>
          </p>
        </div>
        <div className="shrink-0 text-right text-[16px] font-bold tabular-nums text-text-primary">
          ${p.subtotal.toFixed(2)}
        </div>
      </div>

      {/* V19/P24/P7.dd — Discount Code is collapsed by default. Shows
          as a "Have a discount code?" trigger; click expands the
          input + apply button. When applied, swaps to a confirmation
          chip with a remove (×) button. */}
      {p.appliedCode ? (
        <div className="mt-5 flex items-center justify-between gap-2 rounded-xl border border-lime-tint-border bg-lime-tint-bg/30 px-3.5 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-lime-text" />
            <div className="min-w-0">
              <span className="font-mono text-[13px] font-bold tracking-widest text-lime-text">
                {p.appliedCode}
              </span>
              <p className="text-[11px] text-text-secondary">
                {p.promoResult?.description}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={p.handleRemovePromo}
            aria-label="Remove discount code"
            className="rounded p-1 text-text-tertiary transition-colors hover:bg-bg-raised-hover hover:text-text-primary"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : !discountOpen ? (
        <button
          type="button"
          onClick={() => setDiscountOpen(true)}
          className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-text-secondary transition-colors hover:text-text-primary"
        >
          <Tag className="h-3.5 w-3.5" />
          Have a discount code?
        </button>
      ) : (
        // V19/P24/P7.ff — Clean rounded-md field matching the user's
        // 1st reference: thinner border, no lime focus glow, dark
        // outlined Apply button sits flush at the right edge.
        <div className="mt-5 flex items-center gap-2">
          <input
            type="text"
            autoFocus
            value={p.promoInput}
            onChange={(e) => p.setPromoInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                p.handleApplyPromo()
              }
              if (e.key === 'Escape') {
                setDiscountOpen(false)
              }
            }}
            placeholder="Discount Code"
            className="h-10 flex-1 rounded-md border border-border-default bg-transparent px-3.5 text-[13.5px] text-text-primary placeholder:text-text-tertiary focus:border-border-strong focus:outline-none"
          />
          <button
            type="button"
            onClick={p.handleApplyPromo}
            disabled={!p.promoInput.trim() || p.promoValidating}
            className="h-10 rounded-md border border-border-default bg-bg-raised px-4 text-[13px] font-semibold text-text-primary transition-colors hover:bg-bg-raised-hover disabled:cursor-not-allowed disabled:text-text-disabled"
          >
            {p.promoValidating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              'Apply'
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              p.setPromoInput('')
              setDiscountOpen(false)
            }}
            aria-label="Cancel"
            className="rounded p-1 text-text-tertiary transition-colors hover:bg-bg-raised-hover hover:text-text-primary"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* 3) Fee block — single divider above, no inner dividers */}
      <div className="mt-5 space-y-3 border-t border-border-subtle pt-5">
        <SummaryRow
          label="Subtotal"
          value={`$${p.subtotal.toFixed(2)}`}
        />
        <SummaryRow
          label="Marketplace Fee"
          tooltip={`${p.platformFeeRate.toFixed(1)}% of subtotal`}
          value={`+$${p.platformFee.toFixed(2)}`}
        />
        <SummaryRow
          label="Processor Fee"
          tooltip="3.9% payment processor fee"
          value="+3.9%"
        />

        {p.selectedTier.feeRate > 0 && (
          <SummaryRow
            label={`VaultShield ${p.selectedTier.name}`}
            value={`+$${p.tierFeeAmount.toFixed(2)}`}
            valueClass="text-lime-text"
          />
        )}

        {p.promoDiscount > 0 && (
          <SummaryRow
            label={p.appliedCode ?? 'Promo'}
            icon={<Tag className="h-3.5 w-3.5 text-success" />}
            value={`−$${p.promoDiscount.toFixed(2)}`}
            valueClass="text-success"
          />
        )}

        {/* Drop Credits row (with toggle if balance > 0; otherwise read-only) */}
        <WalletToggleRow
          label="Drop Credits"
          sublabel={`${(p.dropCreditsBalance ?? 0).toLocaleString()} DC available`}
          active={p.useDropCredits}
          onToggle={() => p.setUseDropCredits(!p.useDropCredits)}
          disabled={(p.dropCreditsBalance ?? 0) === 0}
          icon={
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/assets/dropcredits.svg"
              alt=""
              className="h-5 w-5 shrink-0"
            />
          }
          value={`$${dcDollarValue.toFixed(2)}`}
        />

        {/* Account Balance row */}
        <WalletToggleRow
          label="Account Balance"
          sublabel={`$${(p.walletBalance ?? 0).toFixed(2)} available`}
          active={p.useWallet}
          onToggle={() => p.setUseWallet(!p.useWallet)}
          disabled={(p.walletBalance ?? 0) === 0}
          icon={<Wallet className="h-5 w-5 shrink-0 text-success" />}
          value={`$${(p.walletBalance ?? 0).toFixed(2)}`}
        />
      </div>

      {/* 4) Total — single divider above */}
      <div className="mt-5 flex items-baseline justify-between border-t border-border-subtle pt-5">
        <span className="text-[16px] font-bold text-text-primary">Total</span>
        <span className="text-[26px] font-black tabular-nums leading-none text-text-primary">
          ${p.total.toFixed(2)}
        </span>
      </div>

      {/* 10) Pay with [Method] — dynamic */}
      <button
        type="submit"
        form="checkout-form"
        disabled={methodInfo.disabled}
        className={cn(
          'flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-bold tracking-wide transition-all',
          methodInfo.disabled
            ? 'cursor-not-allowed bg-bg-raised-hover text-text-disabled'
            : 'bg-lime text-text-inverse shadow-elevated hover:bg-lime-hover hover:shadow-glow',
        )}
      >
        {methodInfo.disabled ? (
          <>Coming soon — pick Card</>
        ) : (
          <>
            Pay with {methodInfo.label}
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>

      {/* V19/P24/P7.ii — Bumped contrast: text-secondary (was text-
          tertiary), 13px (was 11px), text-balance for centered
          wrap. The consent line is legally important so it can't
          fade into the background. */}
      <p className="mt-4 text-balance text-center text-[13px] leading-relaxed text-text-secondary">
        By clicking{' '}
        <span className="font-semibold text-text-primary">Pay</span> you agree
        to our{' '}
        <a
          href="/terms"
          target="_blank"
          className="font-semibold text-lime-text underline underline-offset-2 hover:text-lime"
        >
          Terms
        </a>{' '}
        and{' '}
        <a
          href="/refund-policy"
          target="_blank"
          className="font-semibold text-lime-text underline underline-offset-2 hover:text-lime"
        >
          Refund Policy
        </a>
        . Payment is held in{' '}
        <span className="font-semibold text-text-primary">VaultShield™</span>{' '}
        escrow until delivery is confirmed.
      </p>

      {/* 11) Cashback line — below CTA, with DC icon */}
      {p.subtotal > 0 && dcEarned > 0 && (
        <div className="mt-3 flex items-center justify-center gap-2 text-[13px] text-text-secondary">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/dropcredits.svg" alt="" className="h-4 w-4" />
          You’ll earn{' '}
          <span className="font-bold text-lime-text">+{dcEarned} DC</span>{' '}
          cashback on this order
        </div>
      )}

      {/* 12) SSL trust line */}
      <p className="mt-2 flex items-center justify-center gap-2 text-center text-[13px] text-text-secondary">
        <ShieldCheck className="h-4 w-4 text-lime-text" />
        Payment is 256-bit SSL encrypted. We’ve got you covered.
      </p>
    </div>
  )
}

/* ── Summary helpers ───────────────────────────────────────────── */

function SummaryRow({
  label,
  value,
  icon,
  valueClass,
  tooltip,
}: {
  label: string
  value: string
  icon?: React.ReactNode
  valueClass?: string
  tooltip?: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-[14px]">
      <span className="inline-flex items-center gap-1.5 text-text-secondary">
        {icon}
        {label}
        {tooltip && (
          <span
            title={tooltip}
            className="inline-flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full bg-bg-overlay text-[9px] font-bold text-text-tertiary"
            aria-label={tooltip}
          >
            ?
          </span>
        )}
      </span>
      <span className={cn('tabular-nums text-text-primary', valueClass)}>
        {value}
      </span>
    </div>
  )
}

// V19/P24/P7.w — Wallet row matches the flat fee-row layout (no inner
// divider). Icon + label on the left, balance on the right, toggle
// pill on the far right. When disabled, the toggle still renders but
// is greyed out and unclickable.
function WalletToggleRow({
  label,
  sublabel,
  active,
  onToggle,
  disabled,
  icon,
  value,
}: {
  label: string
  sublabel: string
  active: boolean
  onToggle: () => void
  disabled?: boolean
  icon: React.ReactNode
  value: string
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onToggle()}
      disabled={disabled}
      className={cn(
        'flex w-full items-center justify-between gap-3 text-left text-[14px] transition-colors',
        disabled && 'opacity-60',
      )}
    >
      <span className="inline-flex items-center gap-2 text-text-secondary">
        {icon}
        <span>
          {label}{' '}
          <span className="text-text-tertiary">({sublabel.replace(' available', '')})</span>
        </span>
      </span>
      <span className="tabular-nums text-text-primary">{value}</span>
    </button>
  )
}

/**
 * V19/P24/P7.u — Map paymentMethod → CTA label + brand icon. Used
 * by the Pay With button on the right-side summary. Coming-soon
 * methods return `disabled: true` so the button locks out and
 * shows a "Coming soon — pick Card" label.
 */
function paymentMethodLabel(method: PaymentMethodId): {
  label: string
  Icon: (p: { className?: string }) => JSX.Element
  disabled: boolean
} {
  switch (method) {
    case 'card':
      return { label: 'Card', Icon: CardIcon, disabled: false }
    case 'apple_pay':
      return { label: 'Apple Pay', Icon: ApplePayIcon, disabled: true }
    case 'google_pay':
      return { label: 'Google Pay', Icon: GooglePayIcon, disabled: true }
    case 'paypal':
      return { label: 'PayPal', Icon: PayPalIcon, disabled: true }
    case 'paysafe':
      return { label: 'Paysafe', Icon: PaysafeIcon, disabled: true }
    case 'crypto':
      return { label: 'Crypto', Icon: CryptoIcon, disabled: true }
    case 'klarna':
      return { label: 'Klarna', Icon: KlarnaIcon, disabled: true }
  }
}

// ─── CheckoutForm (outer) ────────────────────────────────────────────────────

interface CheckoutFormProps {
  listing: any
  user: any
  /** V14j — Quantity pre-filled from the deep-link (e.g. ?qty=500 from
   *  the currency-page Buy now). Clamped to the listing's stock + min. */
  initialQty?: number
  /**
   * V19/P24/P7.l — Bundle currency summary resolved from the game's
   * currency_config. When present, the Your Order tile swaps to the
   * bundle name + icon and labels the price "per bundle" instead of
   * the auto-generated listing title + "per unit".
   */
  bundleSummary?: { name: string; iconUrl: string | null } | null
}

export function CheckoutForm({ listing, user, initialQty, bundleSummary }: CheckoutFormProps) {
  // V19/P24/P7.t — Single-screen checkout. The internal 2-step state
  // is kept for the existing Stripe / payment-intent wiring but the
  // user always lands on step 2 (the new GameBoost-style split
  // screen) and never sees the old step 1 review screen.
  const [step, setStep] = useState<1 | 2>(2)
  // V14j — Seed quantity from URL hint, clamped to [min, available].
  // V19/P24/P7.n — Bundle listings always have an effective min of 1
  // (each bundle is an atomic unit). Legacy bundle rows may still
  // carry an old min_quantity=100 from the flexible flow; ignore it.
  const seedQty = (() => {
    if (!initialQty) return 1
    const min = bundleSummary
      ? 1
      : Math.max(1, listing.min_quantity ?? 1)
    const max = Math.max(min, listing.quantity ?? min)
    return Math.min(max, Math.max(min, initialQty))
  })()
  const [quantity, setQuantity] = useState(seedQty)
  const [vaultshieldTier, setVaultshieldTier] = useState<VaultShieldTier>('standard')
  const [platformFeeRate, setPlatformFeeRate] = useState<number>(9.9)
  const [, setTierFee] = useState<number>(0)
  const [loading, setLoading] = useState(false)

  const [promoInput, setPromoInput] = useState('')
  const [promoValidating, setPromoValidating] = useState(false)
  const [promoResult, setPromoResult] = useState<PromoValidationResult | null>(null)
  const promoDiscount = promoResult?.valid ? (promoResult.discountAmount ?? 0) : 0
  const promoCodeId = promoResult?.valid ? promoResult.promoCodeId : undefined
  const appliedCode = promoResult?.valid ? promoResult.code : undefined

  // V19/P24/P7.u — Two wallets:
  //   • Account Balance: refunds / cash credits the buyer earned from
  //     cancelled orders. Real $ value, applied 1:1.
  //   • Drop Credits (DC): cashback earned from prior purchases. 1 DC
  //     = $0.01 of order credit. Display + toggle here; the real
  //     redemption ledger lives server-side (wired later).
  const [walletBalance, setWalletBalance] = useState<number>(0)
  const [useWallet, setUseWallet] = useState(false)
  const [dropCreditsBalance, setDropCreditsBalance] = useState<number>(0)
  const [useDropCredits, setUseDropCredits] = useState(false)
  // V19/P24/P7.t — Lifted out of PaymentForm so OrderSummary can
  // render a dynamic "Pay with {method}" button + icon.
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodId>('card')

  const subtotal = listing.price * quantity
  const platformFee = subtotal * (platformFeeRate / 100)
  const paymentProcessingFee = subtotal * 0.035
  const selectedTier = TIERS.find((t) => t.id === vaultshieldTier)!
  const tierFeeAmount = subtotal * (selectedTier.feeRate / 100)
  const totalBeforeWallet = subtotal + platformFee + paymentProcessingFee + tierFeeAmount - promoDiscount
  const walletAmount = useWallet ? Math.min(walletBalance, totalBeforeWallet) : 0
  const total = Math.max(totalBeforeWallet - walletAmount, 0)

  // Fetch wallet balance once (auth users only).
  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      const result = await getWalletBalance()
      if (!cancelled && result.success && result.balance) {
        setWalletBalance(result.balance.available_balance)
      }
    })()
    return () => { cancelled = true }
  }, [user])

  // V23 — No payment-intent pre-creation. The CoinGate flow creates the order
  // + charge at submit time (createCheckout), with all amounts computed
  // server-side. The displayed platformFeeRate uses the default estimate; the
  // authoritative amount is computed server-side when the buyer pays.

  const handleApplyPromo = async () => {
    if (!promoInput.trim()) return
    setPromoValidating(true)
    const result = await validatePromoCode(promoInput, subtotal)
    setPromoResult(result)
    setPromoValidating(false)
    if (result.valid) toast.success(`Promo applied: ${result.description}`)
    else toast.error(result.error || 'Invalid promo code')
  }
  const handleRemovePromo = () => { setPromoInput(''); setPromoResult(null) }

  // V14j — Cap raised so currency listings (Robux, V-Bucks) can be bought in
  // bulk. Was hard-capped at 10 which made checkout reject 500-Robux orders.
  const maxQty = Math.max(1, listing.quantity || 1)

  const summaryProps: SummaryProps = {
    listing, quantity, subtotal, platformFeeRate, platformFee,
    paymentProcessingFee, selectedTier, tierFeeAmount, promoDiscount,
    appliedCode, promoResult, walletAmount, total, user, walletBalance,
    useWallet, setUseWallet,
    dropCreditsBalance, useDropCredits, setUseDropCredits,
    paymentMethod,
    promoInput, setPromoInput, handleApplyPromo, handleRemovePromo,
    promoValidating,
    // V19/P24/P7.p — Bundle path: the summary owns the qty stepper +
    // bundle preview, so the left-side "Your order" tile disappears.
    bundleSummary,
    setQuantity: bundleSummary ? setQuantity : undefined,
    maxQty: bundleSummary ? maxQty : undefined,
  }

  return (
    <>
      {/* V19/P24/P7.t — Single split-screen checkout. Left = payment
          method picker (vertical tiles with brand icons). Right =
          Your Order (product preview + pricing + Pay Now). The
          stepper is gone — buyers see everything at once. */}

      {/* V19/P24/P7.bb — Full-bleed 50/50 split. Each half is
          edge-to-edge of the viewport; bg-fill extends to the screen
          edge with a hard 1px divider down the middle. Inner content
          is centered with max-w on the inner div. */}
      <div className="grid min-h-[calc(100vh-3.5rem-9rem)] lg:grid-cols-2">
      {/* ── LEFT: Payment methods ─────────────────────────────────────── */}
      <div className="bg-bg-base px-5 py-10 sm:px-8 lg:py-14">
        <div className="mx-auto w-full max-w-[560px]">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-3"
            >
              {/* V19/P24/P7.q — 2Game-style product hero card.
                  Single, large, dominant. Replaces the prior "Your
                  order" SubCard. Bundle vs non-bundle:
                    • Bundle: bundle name + bundle icon, qty stepper
                      inline (always meaningful since bundles are
                      atomic units the buyer can multiply).
                    • Non-bundle: listing title + listing image, qty
                      stepper only when stock > 1. */}
              <ProductHeroCard
                listing={listing}
                bundleSummary={bundleSummary}
                quantity={quantity}
                setQuantity={setQuantity}
                maxQty={maxQty}
                subtotal={subtotal}
              />

              {/* V19/P24/P7.s — VaultShield collapsed by default. 95%
                  of buyers stay on Standard, so the 3-tier comparison
                  is hidden behind a disclosure. */}
              <VaultShieldRow
                tiers={TIERS}
                value={vaultshieldTier}
                onChange={setVaultshieldTier}
                subtotal={subtotal}
              />

              {/* V19/P24/P7.s — Promo as a single combined pill row,
                  no big wrapper card. Matches 2Game's checkout style. */}
              {appliedCode ? (
                <section className="rounded-xl border border-lime-tint-border bg-lime-tint-bg/40 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-lime-text" />
                      <div className="min-w-0">
                        <span className="font-mono text-[13px] font-bold tracking-widest text-lime-text">
                          {appliedCode}
                        </span>
                        <p className="text-[11px] text-text-secondary">
                          {promoResult?.description}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemovePromo}
                      className="rounded p-1 text-text-tertiary transition-colors hover:bg-bg-raised-hover hover:text-text-primary"
                      aria-label="Remove promo code"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </section>
              ) : (
                <section className="rounded-xl border border-border-subtle bg-bg-raised p-3">
                  <div className="flex items-center gap-2">
                    <Tag className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
                    <input
                      type="text"
                      value={promoInput}
                      onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === 'Enter' && handleApplyPromo()}
                      placeholder="Promo code"
                      className="h-9 flex-1 rounded-md border-0 bg-transparent px-1 font-mono text-[13px] uppercase tracking-widest text-text-primary placeholder:font-sans placeholder:tracking-normal placeholder:text-text-tertiary focus:outline-none"
                    />
                    <Button
                      type="button"
                      onClick={handleApplyPromo}
                      disabled={!promoInput.trim() || promoValidating}
                      className="h-9 rounded-md bg-lime px-3.5 text-[12.5px] font-bold text-text-inverse hover:bg-lime-hover"
                    >
                      {promoValidating ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        'Apply'
                      )}
                    </Button>
                  </div>
                </section>
              )}

              {/* Continue */}
              <Button
                type="button"
                onClick={() => { setStep(2); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold uppercase tracking-wider bg-lime text-text-inverse shadow-elevated hover:bg-lime-hover hover:shadow-glow sm:h-14 sm:text-base"
              >
                <CreditCard className="h-5 w-5" />
                Continue to payment
                <ChevronRight className="h-4 w-4" />
              </Button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-3"
            >
              {/* V23 — CoinGate hosted-redirect checkout (replaces Stripe
                  Elements). The buyer pays crypto on CoinGate's page and is
                  returned to /orders/[id]. The charge amount is computed
                  server-side in createCheckout — never trusted from here. */}
              <CryptoPayPanel
                listingId={listing.id}
                quantity={quantity}
                promoDiscount={promoDiscount}
                walletAmount={walletAmount}
                total={total}
              />
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </div>

      {/* ── RIGHT: Your Order. Full-bleed bg-bg-raised + hard left
          divider; inner content capped at 560px for readability. */}
      <div className="relative bg-bg-raised px-5 py-10 sm:px-8 lg:border-l lg:border-border-default lg:py-14">
        <div className="mx-auto w-full max-w-[560px]">
          <OrderSummary {...summaryProps} />
        </div>
      </div>
      </div>
    </>
  )
}


// ─── CryptoPayPanel (CoinGate hosted-redirect checkout) ─────────────────────
// V23 — Replaces the Stripe Elements PaymentForm. Renders the guest/login
// choice + a "Pay with crypto" button that POSTs to createCheckout and, on
// success, redirects the buyer to CoinGate's hosted payment page (or straight
// to the order if fully covered by wallet credit). All amounts are computed
// server-side; nothing here is trusted as money.
function CryptoPayPanel({
  listingId,
  quantity,
  promoDiscount,
  walletAmount,
  total,
}: {
  listingId: string
  quantity: number
  promoDiscount: number
  walletAmount: number
  total: number
}) {
  const router = useRouter()
  const [isProcessing, setIsProcessing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handlePay = async () => {
    setIsProcessing(true)
    setErrorMessage(null)
    try {
      const result = await createCheckout({ listingId, quantity, promoDiscount, walletAmount })
      if (!result.success) {
        setErrorMessage(result.error || 'Checkout failed')
        toast.error(result.error || 'Checkout failed')
        setIsProcessing(false)
        return
      }
      if (result.fullyPaidByWallet && result.orderId) {
        toast.success('Paid from wallet — redirecting to your order…')
        router.push(`/orders/${result.orderId}`)
        return
      }
      if (result.checkoutUrl) {
        // Hand off to CoinGate's hosted page; the buyer returns to /orders/[id].
        window.location.href = result.checkoutUrl
        return
      }
      setErrorMessage('No checkout URL returned')
      setIsProcessing(false)
    } catch (err: any) {
      setErrorMessage(err?.message || 'An unexpected error occurred')
      toast.error(err?.message || 'An unexpected error occurred')
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-3">
      <SubCard title="Pay with crypto">
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-xl border border-border-subtle bg-bg-overlay p-3">
            <Coins className="mt-0.5 h-4 w-4 shrink-0 text-lime-text" />
            <p className="text-xs text-text-secondary">
              You&apos;ll be taken to our payment partner to complete your crypto payment securely.
              Funds are held in SafeDrop escrow until you confirm delivery.
            </p>
          </div>

          <Button
            type="button"
            onClick={handlePay}
            disabled={isProcessing}
            className={cn(
              'flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold uppercase tracking-wider sm:h-14 sm:text-base',
              isProcessing
                ? 'cursor-not-allowed bg-bg-raised text-text-disabled'
                : 'bg-lime text-text-inverse shadow-elevated hover:bg-lime-hover hover:shadow-glow',
            )}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Redirecting to payment…
              </>
            ) : (
              <>
                <Coins className="h-5 w-5" />
                Pay {total > 0 ? `$${total.toFixed(2)}` : ''} with crypto
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>

          <p className="text-center text-[11px] text-text-tertiary">
            By paying, you agree to the Terms of Use and acknowledge the Refund &amp; Dispute Policy.
          </p>
        </div>
      </SubCard>

      <AnimatePresence>
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex items-start gap-3 rounded-2xl border border-error/40 bg-error-bg p-4"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-error" />
            <div>
              <p className="text-sm font-semibold text-error">Payment error</p>
              <p className="mt-0.5 text-sm text-text-secondary">{errorMessage}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
