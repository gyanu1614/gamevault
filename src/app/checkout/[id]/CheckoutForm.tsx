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
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements, PaymentElement, useStripe, useElements,
} from '@stripe/react-stripe-js'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import Link from 'next/link'
import {
  Shield, Star, Award, Check, Loader2, AlertCircle, Lock, CheckCircle2,
  Tag, X, ChevronRight, ChevronLeft, Zap, CreditCard, ShieldCheck, Wallet,
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

import { createPaymentIntent } from '@/lib/actions/stripe-payment'
import { createOrder } from '@/lib/actions/orders'
import { validatePromoCode, type PromoValidationResult } from '@/lib/actions/promo'
import { getWalletBalance } from '@/lib/actions/wallet'
import type { VaultShieldTier } from '@/lib/utils/vaultshield-tiers'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

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
  const STEPS = [
    { n: 1, label: 'Review order' },
    { n: 2, label: 'Payment' },
  ] as const
  const pct = (step / STEPS.length) * 100
  return (
    <nav aria-label="Checkout progress" className="mb-5">
      <ol className="mb-3 flex items-center justify-between gap-1 sm:gap-2">
        {STEPS.map((s) => {
          const done = step > s.n
          const active = step === s.n
          const clickable = done
          return (
            <li key={s.n} className="min-w-0 flex-1">
              <button
                type="button"
                disabled={!clickable && !active}
                onClick={() => clickable && onJump(s.n)}
                className={cn(
                  'group flex w-full items-center justify-center gap-1.5 rounded-md px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors sm:gap-2 sm:px-3 sm:text-xs',
                  active && 'text-lime-text',
                  done && 'cursor-pointer text-text-secondary hover:bg-bg-raised-hover hover:text-text-primary',
                  !active && !done && 'cursor-default text-text-disabled',
                )}
                aria-current={active ? 'step' : undefined}
              >
                <span
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold sm:h-5 sm:w-5 sm:text-[10px]',
                    active && 'bg-lime text-text-inverse',
                    done && 'bg-success text-text-inverse',
                    !active && !done && 'border border-border-default text-text-tertiary',
                  )}
                >
                  {done ? <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3" strokeWidth={3} /> : s.n}
                </span>
                <span className="truncate">{s.label}</span>
              </button>
            </li>
          )
        })}
      </ol>
      <div className="relative h-1 w-full overflow-hidden rounded-full bg-bg-raised-hover">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-lime"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </nav>
  )
}

// ─── SubCard ─────────────────────────────────────────────────────────────────

function SubCard({
  title, right, children,
}: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-bg-overlay p-4 sm:p-5">
      <div className="mb-5 flex items-center justify-between border-b border-border-subtle pb-1.5 sm:mb-6 sm:pb-2">
        <h2 className="text-base font-bold text-text-primary">{title}</h2>
        {right}
      </div>
      {children}
    </div>
  )
}

// ─── Order summary sidebar ───────────────────────────────────────────────────

interface SummaryProps {
  listing: any
  quantity: number
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
}

function OrderSummary(p: SummaryProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border-default bg-bg-raised">
      {/* Listing preview */}
      <div className="border-b border-border-subtle p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={p.listing.game?.image_url || '/placeholder-game.jpg'}
            alt={p.listing.game?.name || ''}
            className="h-5 w-5 shrink-0 rounded object-cover ring-1 ring-border-subtle"
          />
          <p className="text-xs text-text-secondary">{p.listing.game?.name}</p>
        </div>
        <div className="flex gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={p.listing.images?.[0] || '/placeholder-game.jpg'}
            alt={p.listing.title}
            className="h-14 w-14 shrink-0 rounded-lg object-cover ring-1 ring-border-subtle sm:h-16 sm:w-16"
          />
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm font-semibold leading-snug text-text-primary">{p.listing.title}</p>
            {p.quantity > 1 && (
              <p className="mt-1 text-xs text-text-tertiary">Qty: {p.quantity.toLocaleString('en-US')}</p>
            )}
          </div>
        </div>
        {/* V14n — Compact seller card in the right rail too, so the buyer
            sees reputation no matter which column they're scanning. */}
        <SellerCard seller={p.listing.seller} compact />
      </div>

      {/* Price breakdown */}
      <div className="space-y-2 p-4 text-sm sm:p-5">
        <div className="flex justify-between text-text-tertiary">
          <span>Subtotal</span>
          <span className="tabular-nums text-text-primary">${p.subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-text-tertiary">
          <span>Platform fee ({p.platformFeeRate.toFixed(1)}%)</span>
          <span className="tabular-nums">${p.platformFee.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-text-tertiary">
          <span>Processing (3.5%)</span>
          <span className="tabular-nums">${p.paymentProcessingFee.toFixed(2)}</span>
        </div>
        {p.selectedTier.feeRate > 0 && (
          <div className="flex justify-between text-lime-text">
            <span>VaultShield {p.selectedTier.name} (+{p.selectedTier.feeRate}%)</span>
            <span className="tabular-nums">+${p.tierFeeAmount.toFixed(2)}</span>
          </div>
        )}
        {p.promoDiscount > 0 && (
          <div className="flex justify-between text-success">
            <span className="inline-flex items-center gap-1"><Tag className="h-3 w-3" />{p.appliedCode}</span>
            <span className="tabular-nums">−${p.promoDiscount.toFixed(2)}</span>
          </div>
        )}
        {p.walletAmount > 0 && (
          <div className="flex justify-between text-success">
            <span className="inline-flex items-center gap-1"><Wallet className="h-3 w-3" />Wallet balance</span>
            <span className="tabular-nums">−${p.walletAmount.toFixed(2)}</span>
          </div>
        )}

        {/* Wallet toggle */}
        {p.user && (
          <div className="border-t border-border-subtle pt-3">
            <button
              type="button"
              onClick={() => p.walletBalance > 0 && p.setUseWallet(!p.useWallet)}
              disabled={p.walletBalance === 0}
              className={cn(
                'flex w-full items-center justify-between rounded-md border px-3 py-2.5 text-left transition-colors',
                p.walletBalance > 0
                  ? p.useWallet
                    ? 'border-success/40 bg-success-bg'
                    : 'border-border-default bg-bg-overlay hover:border-success/30'
                  : 'cursor-not-allowed border-border-subtle bg-bg-inset opacity-60',
              )}
            >
              <div className="flex items-center gap-2">
                <Wallet className={cn('h-4 w-4 shrink-0', p.walletBalance > 0 ? 'text-success' : 'text-text-disabled')} />
                <div>
                  <div className={cn('text-sm font-medium', p.walletBalance > 0 ? 'text-text-primary' : 'text-text-disabled')}>
                    Wallet: ${p.walletBalance.toFixed(2)}
                  </div>
                  <div className="text-[11px] text-text-tertiary">
                    {p.walletBalance > 0
                      ? p.useWallet
                        ? `Applying $${p.walletAmount.toFixed(2)}`
                        : 'Click to use balance'
                      : 'Earn cashback'}
                  </div>
                </div>
              </div>
              {p.walletBalance > 0 && (
                <div
                  className={cn(
                    'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
                    p.useWallet ? 'bg-success' : 'bg-bg-raised-hover',
                  )}
                  aria-hidden
                >
                  <span
                    className={cn(
                      'inline-block h-3.5 w-3.5 transform rounded-full bg-text-primary transition-transform',
                      p.useWallet ? 'translate-x-5' : 'translate-x-0.5',
                    )}
                  />
                </div>
              )}
            </button>
          </div>
        )}

        {/* Total */}
        <div className="flex items-center justify-between border-t border-border-subtle pt-3">
          <span className="text-sm font-semibold text-text-primary">Total</span>
          <span className="font-mono text-2xl font-bold tabular-nums text-text-primary">
            ${p.total.toFixed(2)}
          </span>
        </div>

        {/* Cashback */}
        <div className="flex items-center justify-between rounded-md border border-success/30 bg-success-bg px-3 py-2">
          <span className="text-[11px] text-success">Earn cashback</span>
          <span className="font-mono text-[11px] font-semibold tabular-nums text-success">
            +${(p.subtotal * 0.02).toFixed(2)}
          </span>
        </div>
      </div>

      {/* Active tier strip */}
      <div className={cn('flex items-center gap-2 border-t border-border-subtle px-4 py-2.5 sm:px-5', tierAccentClasses(p.selectedTier.accent, true))}>
        {(() => {
          const Icon = p.selectedTier.icon
          return <Icon className={cn('h-3.5 w-3.5', tierIconClass(p.selectedTier.accent))} />
        })()}
        <span className="text-[11px] text-text-secondary">
          VaultShield™ {p.selectedTier.name} · {p.selectedTier.warranty}
        </span>
      </div>

      {/* Trust badges */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border-subtle px-4 py-3 sm:px-5">
        <div className="inline-flex items-center gap-1 text-[10px] text-text-tertiary">
          <Lock className="h-3 w-3" /> SSL encrypted
        </div>
        <div className="inline-flex items-center gap-1 text-[10px] text-text-tertiary">
          <ShieldCheck className="h-3 w-3" /> Escrow protected
        </div>
        <div className="inline-flex items-center gap-1 text-[10px] text-text-tertiary">
          <Zap className="h-3 w-3" /> Instant delivery
        </div>
      </div>
    </div>
  )
}

// ─── CheckoutForm (outer) ────────────────────────────────────────────────────

interface CheckoutFormProps {
  listing: any
  user: any
  /** V14j — Quantity pre-filled from the deep-link (e.g. ?qty=500 from
   *  the currency-page Buy now). Clamped to the listing's stock + min. */
  initialQty?: number
}

export function CheckoutForm({ listing, user, initialQty }: CheckoutFormProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  // V14j — Seed quantity from URL hint, clamped to [min_quantity, available].
  const seedQty = (() => {
    if (!initialQty) return 1
    const min = Math.max(1, listing.min_quantity ?? 1)
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

  const [walletBalance, setWalletBalance] = useState<number>(0)
  const [useWallet, setUseWallet] = useState(false)

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

  // Re-init the PaymentIntent whenever the order shape changes.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setClientSecret(null)
      const result = await createPaymentIntent(
        listing.id,
        quantity,
        vaultshieldTier,
        promoDiscount,
        true,
        walletAmount,
      )
      if (cancelled) return
      if (result.success && result.clientSecret) {
        setClientSecret(result.clientSecret)
        if (result.platformFeeRate !== undefined) setPlatformFeeRate(result.platformFeeRate)
        if (result.tierFee !== undefined) setTierFee(result.tierFee)
      } else {
        toast.error(result.error || 'Failed to initialize checkout')
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [listing.id, quantity, vaultshieldTier, promoDiscount, walletAmount])

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

  const summaryProps: SummaryProps = {
    listing, quantity, subtotal, platformFeeRate, platformFee,
    paymentProcessingFee, selectedTier, tierFeeAmount, promoDiscount,
    appliedCode, promoResult, walletAmount, total, user, walletBalance,
    useWallet, setUseWallet,
  }

  // V14j — Cap raised so currency listings (Robux, V-Bucks) can be bought in
  // bulk. Was hard-capped at 10 which made checkout reject 500-Robux orders.
  const maxQty = Math.max(1, listing.quantity || 1)

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_380px]">
      {/* ── Left column ─────────────────────────────────────────────────── */}
      <div>
        <StepBar step={step} onJump={(n) => setStep(n)} />

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-5"
            >
              {/* Order preview */}
              <SubCard title="Your order">
                <div className="flex gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={listing.images?.[0] || '/placeholder-game.jpg'}
                    alt={listing.title}
                    className="h-20 w-20 shrink-0 rounded-lg object-cover ring-1 ring-border-subtle sm:h-24 sm:w-24"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-1.5 text-xs text-text-tertiary">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={listing.game?.image_url || '/placeholder-game.jpg'}
                        alt=""
                        className="h-4 w-4 rounded object-cover"
                      />
                      <span>{listing.game?.name}</span>
                    </div>
                    <p className="line-clamp-2 text-base font-bold leading-tight text-text-primary">{listing.title}</p>

                    {/* V15l — Quantity stepper moved here, under the title and
                        before the price column. Inline pill: minus / value /
                        plus. Only shown when stock is finite and > 1. */}
                    {!listing.is_unlimited && listing.quantity > 1 && (
                      <div className="mt-3 inline-flex items-center gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-tertiary">
                          Qty
                        </span>
                        <div className="inline-flex h-9 items-center overflow-hidden rounded-lg border border-border-default bg-bg-overlay">
                          <button
                            type="button"
                            onClick={() => setQuantity(Math.max(1, quantity - 1))}
                            disabled={quantity <= 1}
                            aria-label="Decrease quantity"
                            className="flex h-full w-8 items-center justify-center text-text-secondary transition-colors hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span aria-hidden className="h-5 w-px bg-border-subtle" />
                          <input
                            type="number"
                            value={quantity}
                            onChange={(e) => {
                              const n = parseInt(e.target.value || '1', 10)
                              if (Number.isFinite(n)) {
                                setQuantity(Math.min(maxQty, Math.max(1, n)))
                              }
                            }}
                            min={1}
                            max={maxQty}
                            aria-label="Quantity"
                            inputMode="numeric"
                            className="h-full w-12 border-0 bg-transparent text-center text-[14px] font-semibold tabular-nums text-text-primary outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          />
                          <span aria-hidden className="h-5 w-px bg-border-subtle" />
                          <button
                            type="button"
                            onClick={() => setQuantity(Math.min(maxQty, quantity + 1))}
                            disabled={quantity >= maxQty}
                            aria-label="Increase quantity"
                            className="flex h-full w-8 items-center justify-center text-text-secondary transition-colors hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <span className="text-[11px] text-text-tertiary">
                          max {maxQty.toLocaleString('en-US')}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    {/* V14l — Big total uses 2 decimals (always at least a
                        few cents). Per-unit caption uses smart formatter so
                        $0.0045/Robux shows as $0.0045, not $0.00. */}
                    <p className="text-2xl font-bold tabular-nums text-text-primary">${subtotal.toFixed(2)}</p>
                    <p className="text-[11px] text-text-tertiary">
                      {fmtUnitPrice(listing.price)} per unit
                    </p>
                  </div>
                </div>

                {/* V14n — Seller card surfaces reputation (rating, reviews,
                    sales) right next to the order so buyers have everything
                    they need to trust the purchase before paying. Expandable
                    for tier + member-since detail. */}
                <SellerCard seller={listing.seller} />
              </SubCard>

              {/* VaultShield tiers */}
              <SubCard title="VaultShield™ protection">
                <p className="-mt-2 mb-4 text-xs text-text-tertiary">
                  Choose your buyer protection level.
                </p>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  {TIERS.map((tier) => {
                    const Icon = tier.icon
                    const selected = vaultshieldTier === tier.id
                    return (
                      <button
                        key={tier.id}
                        type="button"
                        onClick={() => setVaultshieldTier(tier.id)}
                        className={cn(
                          'relative flex flex-col gap-2 rounded-xl border p-3 text-left transition-colors',
                          tierAccentClasses(tier.accent, selected),
                        )}
                        aria-pressed={selected}
                      >
                        {tier.badge && (
                          <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-lime px-2 py-0.5 text-[10px] font-bold text-text-inverse">
                            {tier.badge}
                          </span>
                        )}
                        <div className="flex items-center gap-1.5">
                          <Icon className={cn('h-4 w-4', tierIconClass(tier.accent))} />
                          <span className="text-sm font-semibold text-text-primary">{tier.name}</span>
                          {selected && <CheckCircle2 className={cn('ml-auto h-3.5 w-3.5', tierIconClass(tier.accent))} />}
                        </div>
                        <div>
                          <p className="font-mono text-sm font-bold text-text-primary">
                            {tier.feeRate === 0 ? 'Free' : `+${tier.feeRate}%`}
                          </p>
                          {tier.feeRate > 0 && (
                            <p className="font-mono text-[11px] text-text-tertiary">
                              +${(subtotal * tier.feeRate / 100).toFixed(2)}
                            </p>
                          )}
                        </div>
                        <p className="text-[11px] text-text-secondary">{tier.warranty}</p>
                        <AnimatePresence>
                          {selected && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden"
                            >
                              <ul className="space-y-1 text-[10px] leading-relaxed text-text-tertiary">
                                {tier.features.map((f) => (
                                  <li key={f} className="flex items-start gap-1">
                                    <Check className="mt-0.5 h-2.5 w-2.5 shrink-0 text-lime-text" strokeWidth={3} />
                                    {f}
                                  </li>
                                ))}
                              </ul>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </button>
                    )
                  })}
                </div>
              </SubCard>

              {/* Promo */}
              <SubCard
                title="Promo code"
                right={<Tag className="h-4 w-4 text-text-tertiary" />}
              >
                {appliedCode ? (
                  <div className="flex items-center justify-between rounded-md border border-lime-tint-border bg-lime-tint-bg px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-lime-text" />
                      <div>
                        <span className="font-mono text-sm font-bold tracking-widest text-lime-text">{appliedCode}</span>
                        <p className="text-[11px] text-text-secondary">{promoResult?.description}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemovePromo}
                      className="rounded p-1 text-text-tertiary transition-colors hover:bg-bg-raised-hover hover:text-text-primary"
                      aria-label="Remove promo code"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={promoInput}
                      onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === 'Enter' && handleApplyPromo()}
                      placeholder="Enter code"
                      className="h-10 flex-1 rounded-md border border-border-default bg-transparent px-3 text-sm font-mono uppercase tracking-widest text-text-primary placeholder:text-text-tertiary transition-colors focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime-tint-bg"
                    />
                    <Button
                      type="button"
                      onClick={handleApplyPromo}
                      disabled={!promoInput.trim() || promoValidating}
                      className="h-10 rounded-md bg-lime px-4 text-text-inverse font-semibold hover:bg-lime-hover"
                    >
                      {promoValidating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Apply'}
                    </Button>
                  </div>
                )}
              </SubCard>

              {/* Continue */}
              <Button
                type="button"
                onClick={() => { setStep(2); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                disabled={loading || !clientSecret}
                className={cn(
                  'flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold uppercase tracking-wider sm:h-14 sm:text-base',
                  loading || !clientSecret
                    ? 'cursor-not-allowed bg-bg-raised text-text-disabled'
                    : 'bg-lime text-text-inverse shadow-elevated hover:bg-lime-hover hover:shadow-glow',
                )}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Preparing checkout…
                  </>
                ) : (
                  <>
                    <CreditCard className="h-5 w-5" />
                    Continue to payment
                    <ChevronRight className="h-4 w-4" />
                  </>
                )}
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
              className="space-y-5"
            >
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-text-primary"
              >
                <ChevronLeft className="h-4 w-4" /> Back to review
              </button>

              {!loading && clientSecret ? (
                <Elements
                  stripe={stripePromise}
                  options={{
                    clientSecret,
                    appearance: {
                      theme: 'night',
                      variables: {
                        colorPrimary:    '#C6FF3D',
                        colorBackground: '#121218',
                        colorText:       '#FAFAFA',
                        colorDanger:     '#FF5C5C',
                        fontFamily:      'system-ui, sans-serif',
                        borderRadius:    '6px',
                        spacingUnit:     '4px',
                      },
                      rules: {
                        '.Input': {
                          border: '1px solid rgba(255,255,255,0.10)',
                          backgroundColor: 'rgba(255,255,255,0.02)',
                        },
                        '.Input:focus': {
                          border: '1px solid #C6FF3D',
                          boxShadow: '0 0 0 2px rgba(198,255,61,0.18)',
                        },
                      },
                    },
                  }}
                >
                  <PaymentForm
                    listing={listing}
                    user={user}
                    quantity={quantity}
                    total={total}
                    vaultshieldTier={vaultshieldTier}
                    promoCodeId={promoCodeId}
                    promoDiscount={promoDiscount}
                  />
                </Elements>
              ) : (
                <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-border-subtle bg-bg-overlay p-10">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-6 w-6 animate-spin text-lime-text" />
                    <p className="text-sm text-text-tertiary">Loading payment form…</p>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Right column / summary ──────────────────────────────────────── */}
      <div className="lg:sticky lg:top-32 self-start">
        <OrderSummary {...summaryProps} />
      </div>
    </div>
  )
}

// ─── PaymentForm (inner — inside Elements context) ──────────────────────────

function PaymentForm({
  listing, user, quantity, total, vaultshieldTier, promoCodeId, promoDiscount,
}: {
  listing: any
  user: any
  quantity: number
  total: number
  vaultshieldTier: VaultShieldTier
  promoCodeId?: string
  promoDiscount?: number
}) {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()

  const [isProcessing, setIsProcessing] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [escrowAccepted, setEscrowAccepted] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isGuestCheckout, setIsGuestCheckout] = useState(!user)
  const [guestEmail, setGuestEmail] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return
    if (!termsAccepted || !escrowAccepted) { toast.error('Please accept all required terms'); return }
    if (isGuestCheckout && !guestEmail) { toast.error('Please enter your email address'); return }
    if (isGuestCheckout && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
      toast.error('Please enter a valid email address'); return
    }

    setIsProcessing(true)
    setErrorMessage(null)

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
      })
      if (error) {
        setErrorMessage(error.message || 'Payment failed')
        toast.error(error.message || 'Payment failed')
        setIsProcessing(false)
        return
      }
      if (paymentIntent?.status === 'succeeded') {
        const orderResult = await createOrder({
          paymentIntentId: paymentIntent.id,
          listingId: listing.id,
          quantity,
          vaultshieldTier,
          isGuest: isGuestCheckout,
          guestEmail: isGuestCheckout ? guestEmail : undefined,
          promoCodeId,
          promoDiscount,
        })
        if (orderResult.success) {
          toast.success('Payment successful! Redirecting to your order…')
          router.push(`/orders/${orderResult.orderId}`)
        } else {
          setErrorMessage(orderResult.error || 'Failed to create order')
          toast.error(orderResult.error || 'Failed to create order')
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred')
      toast.error(err.message || 'An unexpected error occurred')
    } finally {
      setIsProcessing(false)
    }
  }

  const canSubmit =
    !!stripe && !isProcessing && termsAccepted && escrowAccepted &&
    (user || (isGuestCheckout && !!guestEmail))

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {!user && (
        <SubCard title="Checkout as">
          <div className="space-y-2">
            <label className={cn(
              'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors',
              isGuestCheckout ? 'border-lime-tint-border bg-lime-tint-bg' : 'border-border-subtle bg-bg-overlay hover:border-border-default',
            )}>
              <input
                type="radio"
                checked={isGuestCheckout}
                onChange={() => setIsGuestCheckout(true)}
                className="mt-1 h-4 w-4 accent-lime"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text-primary">Continue as guest</p>
                <p className="text-xs text-text-tertiary">Quick checkout with email only</p>
                <AnimatePresence>
                  {isGuestCheckout && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <input
                        type="email"
                        value={guestEmail}
                        onChange={(e) => setGuestEmail(e.target.value)}
                        placeholder="your@email.com"
                        required
                        className="mt-3 h-10 w-full rounded-md border border-border-default bg-transparent px-3 text-sm text-text-primary placeholder:text-text-tertiary transition-colors focus:border-lime focus:outline-none focus:ring-2 focus:ring-lime-tint-bg"
                      />
                      <p className="mt-1 text-[11px] text-text-tertiary">Order confirmation will be sent here</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </label>

            <label className={cn(
              'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors',
              !isGuestCheckout ? 'border-lime-tint-border bg-lime-tint-bg' : 'border-border-subtle bg-bg-overlay hover:border-border-default',
            )}>
              <input
                type="radio"
                checked={!isGuestCheckout}
                onChange={() => setIsGuestCheckout(false)}
                className="mt-1 h-4 w-4 accent-lime"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text-primary">Login to your account</p>
                <p className="text-xs text-text-tertiary">Access loyalty rewards & order history</p>
                <AnimatePresence>
                  {!isGuestCheckout && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <Button
                        type="button"
                        onClick={() => router.push('/login?redirect=' + encodeURIComponent(window.location.pathname))}
                        className="mt-3 h-9 rounded-md bg-lime px-3 text-text-inverse text-sm font-semibold hover:bg-lime-hover"
                      >
                        Go to login
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </label>
          </div>
        </SubCard>
      )}

      {/* Stripe element */}
      <SubCard title="Payment information" right={<CreditCard className="h-4 w-4 text-text-tertiary" />}>
        <PaymentElement />
      </SubCard>

      {/* Terms */}
      <SubCard title="Terms & agreements">
        <div className="space-y-2">
          <label className="flex cursor-pointer items-start gap-3 rounded-md p-2 transition-colors hover:bg-bg-raised-hover">
            <Checkbox
              checked={termsAccepted}
              onCheckedChange={(v) => setTermsAccepted(!!v)}
              className="mt-0.5"
            />
            <span className="text-sm text-text-secondary">
              I agree to the{' '}
              <a href="/terms" target="_blank" className="text-lime-text underline-offset-2 hover:underline">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="/refund-policy" target="_blank" className="text-lime-text underline-offset-2 hover:underline">
                Refund Policy
              </a>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-md p-2 transition-colors hover:bg-bg-raised-hover">
            <Checkbox
              checked={escrowAccepted}
              onCheckedChange={(v) => setEscrowAccepted(!!v)}
              className="mt-0.5"
            />
            <span className="text-sm text-text-secondary">
              I understand my payment is held in VaultShield™ escrow until delivery is confirmed.
            </span>
          </label>
        </div>
      </SubCard>

      {/* Error */}
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

      {/* Submit */}
      <Button
        type="submit"
        disabled={!canSubmit}
        className={cn(
          'flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold uppercase tracking-wider sm:h-14 sm:text-base',
          canSubmit
            ? 'bg-lime text-text-inverse shadow-elevated hover:bg-lime-hover hover:shadow-glow'
            : 'cursor-not-allowed bg-bg-raised text-text-disabled',
        )}
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Processing…
          </>
        ) : (
          <>
            <Lock className="h-5 w-5" />
            Complete purchase — ${total.toFixed(2)}
          </>
        )}
      </Button>

      <div className="flex items-center justify-center gap-1.5 text-[11px] text-text-tertiary">
        <Shield className="h-3 w-3" />
        Secured by Stripe · Protected by VaultShield™
      </div>
    </form>
  )
}
