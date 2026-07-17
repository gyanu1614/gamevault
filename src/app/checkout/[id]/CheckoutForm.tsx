'use client'

/**
 * Checkout — V80 handoff rebuild.
 *
 * Recreates the design_handoff_checkout prototype (2a desktop / 2b
 * mobile) 1:1 in our stack: one centered card shell (radial slate,
 * 26px radius) with its own header (glossy D emblem + wordmark + SSL
 * pill), a "Pay with" method list on the left (horizontal chips on
 * mobile), the "Your order" panel on the right with the loot-llama
 * bleeding off its edge, the blue SafeDrop trust panel with the 3D
 * shield watermark + protection <details>, and the payment marquee strip.
 *
 * Handoff lime (#c6f24e / #a9d24a) is mapped onto our tokens
 * (#C6FF3D / #ABE52B) — alphas as rgba(198,255,61,…) literals since
 * custom tokens don't compile /alpha suffixes. All payment + order
 * logic preserved verbatim; amounts stay server-authoritative
 * (createCheckout).
 *
 * Kept from the previous checkout per the handoff brief ("that style
 * + our existing components"): qty stepper, SafeDrop tier selector,
 * promo code flow, wallet/credit application, SellerPeek dialog +
 * header account dropdown. Assets live at public/assets/checkout/ (drop-in
 * replaceable: shield-3d.png, lock.png, llama.png, dm-coin.png).
 */

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import {
  Shield, Star, Award, Check, Loader2, AlertCircle, Lock, CheckCircle2,
  Tag, X, ChevronDown, ChevronRight, ShieldCheck, Info,
} from 'lucide-react'

import { createCheckout } from '@/lib/actions/checkout'
import { getAvatarUrl } from '@/lib/utils/avatar'
import { validatePromoCode, type PromoValidationResult } from '@/lib/actions/promo'
import { getWalletBalance } from '@/lib/actions/wallet'
import type { SafeDropTier } from '@/lib/utils/safedrop-tiers'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { SilverIcon } from '@/components/ui/silver-icon'
import { cn } from '@/lib/utils'
import { buyerFee, MARKETPLACE_FEE_LABEL, PROCESSING_FEE_LABEL, WARRANTY_ENABLED } from '@/lib/fees'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

// V14l — Smart price formatter. For currency listings ($0.0045/unit) the
// per-unit price would round to "$0.00" at 2 decimals — confusing the
// buyer. Auto-extend to 4 decimals when needed. Subtotals/totals stay at
// 2 decimals since they're always at least a few cents.
function fmtUnitPrice(n: number): string {
  if (n === 0) return '$0.00'
  if (Math.abs(n) < 0.01) return `$${n.toFixed(4)}`
  return `$${n.toFixed(2)}`
}

// ─── Tier config ─────────────────────────────────────────────────────────────

interface TierConfig {
  id: SafeDropTier
  name: string
  feeRate: number
  warranty: string
  icon: React.ElementType
  badge?: string
  features: string[]
}

const TIERS: TierConfig[] = [
  {
    id: 'standard',
    name: 'Standard',
    feeRate: 0,
    warranty: 'Standard protection',
    icon: Shield,
    features: [
      'Full category protection window',
      'Seller paid only after delivery',
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
    features: [
      'Everything in Enhanced',
      '30-day extended warranty',
      '24/7 VIP support',
      'Full refund guarantee',
    ],
  },
]

// ─── Payment methods (handoff order; only crypto is live today) ─────────────

type PayMethod = 'card' | 'apple' | 'google' | 'paysafe' | 'crypto' | 'skrill'

const METHODS: Array<{
  id: PayMethod
  title: string
  chip: string
  sub?: string
  soon?: boolean
}> = [
  { id: 'card', title: 'Debit / Credit cards', chip: 'Cards', sub: 'All major cards accepted', soon: true },
  { id: 'apple', title: 'Apple Pay', chip: ' Pay', soon: true },
  { id: 'google', title: 'Google Pay', chip: 'G Pay', soon: true },
  { id: 'paysafe', title: 'Paysafe Card', chip: 'Paysafe', sub: 'Prepaid card for online payments', soon: true },
  { id: 'crypto', title: 'Crypto', chip: 'Crypto', sub: 'BTC · ETH · USDT · USDC +more' },
  { id: 'skrill', title: 'Skrill', chip: 'Skrill', sub: 'Neteller · Rapid Transfer', soon: true },
]

// CSS brand marks per the prototype (official SVGs can drop in later).
function BrandTile({ id, mini }: { id: PayMethod; mini?: boolean }) {
  if (id === 'card') {
    return mini ? (
      <span className="flex h-[15px] w-[22px] flex-none items-center justify-center rounded-[3px] bg-[#1a1f2e] text-[6px] font-extrabold text-[#f7b600]">VISA</span>
    ) : (
      <span className="flex flex-none gap-[3px]">
        <span className="flex h-[18px] w-[26px] items-center justify-center rounded-[4px] bg-[#1a1f2e] text-[7px] font-extrabold text-[#f7b600]">VISA</span>
        <span className="h-[18px] w-5 rounded-[4px] bg-[linear-gradient(90deg,#eb001b,#f79e1b)]" />
      </span>
    )
  }
  const box = mini ? 'h-4 w-4 rounded-[5px] text-[10px]' : 'h-[30px] w-[30px] rounded-[5px] text-[15px]'
  if (id === 'apple') return <span className={cn(box, 'flex flex-none items-center justify-center bg-black text-white')}>{''}</span>
  if (id === 'google') return <span className={cn(box, 'flex-none [background:conic-gradient(from_0deg,#ea4335,#fbbc05,#34a853,#4285f4,#ea4335)]')} />
  if (id === 'paysafe') return <span className={cn(box, 'flex flex-none items-center justify-center bg-[#5b3cc4] text-white')}><Lock className={mini ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5'} /></span>
  if (id === 'crypto') return <span className={cn(box, 'flex flex-none items-center justify-center bg-[linear-gradient(135deg,#f7931a,#ffb64d)] font-extrabold text-white')}>₿</span>
  return <span className={cn(box, 'flex flex-none items-center justify-center bg-[#7b1e5b] font-extrabold text-white', mini ? 'text-[6px]' : 'text-[8px]')}>Skrill</span>
}

// ─── Fee row + ⓘ badge ──────────────────────────────────────────────────────

// Mobile-audit — Info dot that works on touch. Hover still shows the
// Radix Tooltip (desktop unchanged); tap/click toggles a Popover with
// the same text so phones + tablets can reach fee/method explanations.
// The 15px dot keeps its visual size but gets a ~37px hit area via
// padding + negative margin.
function InfoDot({ text }: { text: string }) {
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={text}
              onClick={(e) => e.stopPropagation()}
              className="relative -m-[11px] inline-flex flex-none cursor-help items-center justify-center p-[11px]"
            >
              <span aria-hidden className="inline-flex h-[15px] w-[15px] items-center justify-center rounded-full bg-[#232838] text-[9px] text-[#7b8398]">
                ?
              </span>
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[240px] text-[12px] leading-snug">
          {text}
        </TooltipContent>
      </Tooltip>
      <PopoverContent side="top" onOpenAutoFocus={(e) => e.preventDefault()} className="max-w-[240px]">
        {text}
      </PopoverContent>
    </Popover>
  )
}

function FeeRow({
  label,
  value,
  tooltip,
  icon,
  valueClass,
  extra,
}: {
  label: string
  value: string
  tooltip?: string
  icon?: React.ReactNode
  valueClass?: string
  extra?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="inline-flex min-w-0 items-center gap-2">
        {icon}
        <span className="truncate">{label}</span>
        {tooltip && <InfoDot text={tooltip} />}
        {extra}
      </span>
      <span className={cn('flex-none tabular-nums text-[#eef1f6]', valueClass)}>{value}</span>
    </div>
  )
}

// Mini switch used by the Store credit fee row.
function MiniSwitch({ on, disabled, onToggle, label }: { on: boolean; disabled?: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        // before:-inset-2.5 — invisible halo extends the 18x32 visual to a
        // ~38x52 touch target (>=36px floor) without changing the layout.
        'relative h-[18px] w-[32px] flex-none rounded-full transition-colors before:absolute before:-inset-2.5 disabled:cursor-not-allowed disabled:opacity-50',
        on ? 'bg-lime' : 'bg-[#333950]',
      )}
    >
      <span className={cn('absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white transition-all', on ? 'left-[16px]' : 'left-[2px]')} />
    </button>
  )
}

// ─── CheckoutForm ────────────────────────────────────────────────────────────

interface CheckoutFormProps {
  listing: any
  user: any
  /** V73 — buyer's profile row (username + avatar) for the identity strip. */
  buyerProfile?: { username: string | null; avatar_url: string | null } | null
  /** V75 — seller's last 5 reviews for the in-checkout seller peek. */
  sellerReviews?: any[]
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

export function CheckoutForm({ listing, user, buyerProfile, sellerReviews = [], initialQty, bundleSummary }: CheckoutFormProps) {
  const router = useRouter()

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
  // P11 — Quantity is chosen on the item page (?qty= deep-link); the
  // checkout shows it read-only.
  const [quantity] = useState(seedQty)
  const [safedropTier, setSafedropTier] = useState<SafeDropTier>('standard')

  // Crypto is the only live processor (CoinGate); the rest render per
  // the handoff but stay disabled with a Soon chip until wired.
  const [method, setMethod] = useState<PayMethod>('crypto')

  const [promoInput, setPromoInput] = useState('')
  const [promoValidating, setPromoValidating] = useState(false)
  const [promoResult, setPromoResult] = useState<PromoValidationResult | null>(null)
  const promoDiscount = promoResult?.valid ? (promoResult.discountAmount ?? 0) : 0
  const appliedCode = promoResult?.valid ? promoResult.code : undefined

  // V19/P24/P7.u — Two wallets:
  //   • Account Balance: refunds / cash credits the buyer earned from
  //     cancelled orders. Real $ value, applied 1:1 ("Store credit").
  //   • Drop Credits (DC): cashback earned from prior purchases. 1 DC
  //     = $0.01 of order credit. Display + toggle here; the real
  //     redemption ledger lives server-side (wired later).
  const [walletBalance, setWalletBalance] = useState<number>(0)
  const [useWallet, setUseWallet] = useState(false)
  const [dropCreditsBalance] = useState<number>(0)
  const [useDropCredits, setUseDropCredits] = useState(false)

  const subtotal = listing.price * quantity
  // Single buyer fee per the fee spec (5% processing + 2% marketplace),
  // mirrored server-side in createCheckout — lib/fees is the one source.
  const fee = buyerFee(subtotal)
  const selectedTier = TIERS.find((t) => t.id === safedropTier)!
  const tierFeeAmount = WARRANTY_ENABLED ? subtotal * (selectedTier.feeRate / 100) : 0
  const totalBeforeWallet = subtotal + fee.amount + tierFeeAmount - promoDiscount
  const walletAmount = useWallet ? Math.min(walletBalance, totalBeforeWallet) : 0
  const total = Math.max(totalBeforeWallet - walletAmount, 0)

  // Cashback earned on THIS order: 2% of subtotal, in DC.
  const dcEarned = Math.round(subtotal * 100 * 0.02)

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
  // server-side. The displayed fee uses lib/fees; the authoritative amount
  // is recomputed server-side from the same module when the buyer pays.

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


  // P10 — Dropdown open state (warranty / trust / discount). Animated
  // via grid-template-rows 0fr→1fr (works everywhere; the native
  // <details> + ::details-content approach didn't interpolate reliably).
  const [warrantyOpen, setWarrantyOpen] = useState(false)
  const [trustOpen, setTrustOpen] = useState(false)
  const [codeOpen, setCodeOpen] = useState(false)
  const [descOpen, setDescOpen] = useState(false)
  // P13 — Description teaser: measure whether the text exceeds the
  // 2-line collapsed window; only then show the fade + expand chevron.
  const descRef = useRef<HTMLParagraphElement | null>(null)
  const [descOverflow, setDescOverflow] = useState(false)
  useEffect(() => {
    const el = descRef.current
    if (el) setDescOverflow(el.scrollHeight > 66)
  }, [listing.description])
  const [acctOpen, setAcctOpen] = useState(false)

  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)
  const handlePay = async () => {
    setPaying(true)
    setPayError(null)
    try {
      const result = await createCheckout({
        listingId: listing.id,
        quantity,
        promoDiscount,
        walletAmount,
      })
      if (!result.success) {
        setPayError(result.error || 'Checkout failed')
        toast.error(result.error || 'Checkout failed')
        setPaying(false)
        return
      }
      if (result.fullyPaidByWallet && result.orderId) {
        toast.success('Paid from wallet — redirecting to your order…')
        router.push(`/orders/${result.orderId}`)
        return
      }
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl
        return
      }
      setPayError('No checkout URL returned')
      setPaying(false)
    } catch (err: any) {
      setPayError(err?.message || 'An unexpected error occurred')
      toast.error(err?.message || 'An unexpected error occurred')
      setPaying(false)
    }
  }

  const isBundle = !!bundleSummary
  const title = bundleSummary?.name || listing.title
  const imageSrc =
    bundleSummary?.iconUrl ||
    listing.images?.[0] ||
    listing.game?.image_url ||
    '/placeholder-game.jpg'

  return (
    // P1/P3 — Site-aligned container (max-w-7xl, same gutters as every
    // other page), sitting directly under the global navbar. The handoff's
    // outer card shell is gone: sections float on the page canvas.
    <div className="mx-auto w-full max-w-7xl px-4 pb-2 pt-5 sm:px-6 sm:pb-4 sm:pt-7 lg:px-8">
        {/* P5 — Checkout-own header: no navbar on this page. Brand goes
            home; the secure badge balances it on the right. */}
        <div className="mb-8 flex items-center justify-between sm:mb-10">
          <Link href="/" className="inline-flex items-center gap-2.5 transition-opacity hover:opacity-85">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-lime text-[15px] font-black text-text-inverse">
              D
            </span>
            <span className="text-[17px] font-black tracking-tight text-white">DropMarket</span>
          </Link>
          <div className="flex items-center gap-4 sm:gap-5">
            <span className="flex items-center gap-2 text-[12.5px] font-bold text-lime-text">
              <ShieldCheck className="h-4 w-4" />
              <span className="hidden sm:inline">256-bit SSL secure</span>
              <span className="sm:hidden">Secure</span>
            </span>

            {user ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setAcctOpen((v) => !v)}
                  aria-expanded={acctOpen}
                  aria-label="Your account"
                  className="block rounded-md ring-1 ring-white/[0.12] transition-all hover:ring-[rgba(198,255,61,0.4)]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getAvatarUrl(buyerProfile?.avatar_url, buyerProfile?.username || user.email || 'user')}
                    alt=""
                    className="h-9 w-9 rounded-md object-cover"
                  />
                </button>

                {acctOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setAcctOpen(false)} />
                    {/* Navbar-style dropdown: solid panel, gap below the
                        trigger, CSS entry animation. */}
                    <div className="absolute right-0 top-full z-50 mt-3 w-[300px] overflow-hidden rounded-lg border border-white/[0.08] bg-[#17171F] shadow-[0_24px_60px_-24px_rgba(0,0,0,0.8)] animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200">
                      <div className="relative border-b border-white/[0.07] bg-[linear-gradient(to_bottom,rgba(255,255,255,0.04),transparent)] p-4">
                        <div className="flex items-center gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={getAvatarUrl(buyerProfile?.avatar_url, buyerProfile?.username || user.email || 'user')}
                            alt=""
                            className="h-10 w-10 rounded-md object-cover ring-1 ring-white/[0.09]"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[14px] font-extrabold text-white">
                              {buyerProfile?.username || 'Your Account'}
                            </div>
                            <div className="mt-0.5 text-[12px] text-[#7b8398]">
                              Member since{' '}
                              {new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                            </div>
                          </div>
                          <span className="inline-flex flex-none items-center gap-1 text-[12px] font-extrabold text-success">
                            <Check className="h-3.5 w-3.5" />
                            Signed In
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2.5 p-4">
                        <div className="flex items-center justify-between gap-3 rounded-md border border-white/[0.07] bg-[#0d1017] px-3 py-2.5">
                          <span className="text-[12px] font-bold uppercase tracking-wider text-[#7b8398]">Email</span>
                          <span className="truncate text-[12.5px] font-bold text-white">{user.email}</span>
                        </div>
                        <p className="text-center text-[12px] leading-relaxed text-[#7b8398]">
                          Order confirmation and delivery updates go to this profile and email.
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <Link href="/login" className="text-[12.5px] font-bold text-white transition-colors hover:text-lime-text">
                Sign In
              </Link>
            )}
          </div>
        </div>

        {/* Page heading above the grid so the method list and the order
            panel top-align underneath it. 3D icon slot renders through
            SilverIcon — drop the real icon at public/icons/checkout/protection.png. */}
        <div className="mb-6 hidden items-center gap-2.5 sm:flex">
          <SilverIcon src="/icons/checkout/cart.svg" className="h-8 w-8" />
          <h2 className="text-[23px] font-extrabold tracking-[-0.4px] text-white">Secure Checkout</h2>
        </div>

        {/* ═══ Body grid: pay-with left · order panel right ═══ */}
        <div className="grid gap-6 sm:gap-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start xl:grid-cols-[minmax(0,1fr)_420px] xl:gap-10">

          {/* ── LEFT: Pay with + SafeDrop protection ── */}
          <div className="order-2 min-w-0 lg:order-1">
            {/* Mobile: eyebrow + horizontal chip scroller (2b) */}
            <div className="sm:hidden">
              <div className="mx-0.5 mb-2 text-[12px] font-bold tracking-[1px] text-[#7b8398]">PAY WITH</div>
              <div className="mb-1 flex gap-2 overflow-x-auto pb-2">
                {/* Live methods lead the scroller so the selected chip is
                    visible without scrolling (2b leads with the selection). */}
                {[...METHODS].sort((a, b) => (a.soon ? 1 : 0) - (b.soon ? 1 : 0)).map((m) => {
                  const on = method === m.id
                  return (
                    <button
                      key={m.id}
                      type="button"
                      disabled={m.soon}
                      onClick={() => setMethod(m.id)}
                      className={cn(
                        // min-h-[44px] — primary payment selector on <sm,
                        // so the chips meet the 44px touch-target floor.
                        'flex min-h-[44px] flex-none items-center gap-[7px] rounded-md border px-[13px] py-2 transition-all',
                        on
                          ? 'border-white/[0.16] bg-[#1a2030] shadow-[0_8px_18px_-10px_rgba(0,0,0,0.6)]'
                          : 'border-white/[0.07] bg-[#12151e]',
                        m.soon && 'opacity-50',
                      )}
                    >
                      <BrandTile id={m.id} mini />
                      <span className={cn('text-[12px] font-bold', on ? 'text-white' : 'text-[#a5adbe]')}>{m.chip}</span>
                      {m.soon && <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#7b8398]">Soon</span>}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Desktop: method rows */}
            <div className="hidden flex-col gap-2 sm:flex">
              {METHODS.map((m) => {
                const on = method === m.id
                return (
                  // div[role=button] (not <button>) so the InfoDot popover
                  // trigger inside stays valid, reachable markup — a nested
                  // real <button> inside a disabled <button> never receives
                  // taps, which made the method sub-info unreachable on
                  // touch (768/1024 tablets see these rows).
                  <div
                    key={m.id}
                    role="button"
                    tabIndex={m.soon ? -1 : 0}
                    aria-disabled={m.soon || undefined}
                    aria-pressed={on}
                    onClick={() => { if (!m.soon) setMethod(m.id) }}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) return
                      if (!m.soon && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault()
                        setMethod(m.id)
                      }
                    }}
                    className={cn(
                      'flex items-center gap-3 rounded-md border border-white/[0.06] bg-[#12151e] px-3.5 py-2.5 text-left transition-colors duration-150',
                      m.soon
                        ? 'cursor-not-allowed opacity-55'
                        : 'cursor-pointer hover:border-white/[0.12] hover:bg-[#1a1f2b]',
                    )}
                  >
                    <BrandTile id={m.id} />
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="truncate text-[14px] font-bold text-white">{m.title}</span>
                      {m.sub && <InfoDot text={m.sub} />}
                      {m.soon && (
                        <span className="rounded border border-[rgba(251,191,36,0.3)] bg-[rgba(251,191,36,0.08)] px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-warning">
                          Soon
                        </span>
                      )}
                    </span>
                    {on ? (
                      <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full bg-lime">
                        <Check className="h-3 w-3 text-[#0c0e14]" strokeWidth={4} />
                      </span>
                    ) : (
                      <span className="h-[22px] w-[22px] flex-none rounded-full border-2 border-[#363c4c]" />
                    )}
                  </div>
                )
              })}
            </div>

            {/* P9 — SafeDrop Additional Warranty: lime-glass premium
                dropdown; picking a tier drives the real fee math
                (safedropTier → tierFeeAmount → Order Details row).
                Feature-flagged OFF until warranty payout caps are
                configured (fee spec §4 — strictly opt-in when live). */}
            {WARRANTY_ENABLED && (
            <div className="group relative mt-8 overflow-hidden rounded-lg border border-[rgba(198,255,61,0.12)] backdrop-blur-md transition-all duration-300 [background:radial-gradient(140%_160%_at_88%_8%,rgba(198,255,61,0.06),rgba(198,255,61,0.02)_45%,rgba(13,15,10,0.92)_82%)] shadow-[0_18px_44px_-20px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.05)] hover:-translate-y-0.5 hover:border-white/[0.16] hover:shadow-[0_26px_56px_-22px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.07)] sm:mt-10">
              <span aria-hidden className="pointer-events-none absolute inset-0 hidden select-none sm:block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/assets/checkout/warranty-hero.png"
                  alt=""
                  className="absolute -right-20 top-1 w-[420px] max-w-none opacity-40 [filter:brightness(0.6)_saturate(0.85)]"
                />
                <span className="absolute inset-0 bg-[linear-gradient(to_right,rgba(12,16,7,0.97)_36%,rgba(12,16,7,0.62)_64%,rgba(12,16,7,0.22)_100%)]" />
                <span className="absolute inset-0 bg-[radial-gradient(130%_150%_at_78%_18%,transparent_30%,rgba(12,16,7,0.82)_100%)]" />
              </span>
              {/* grey hover wash — deliberately no lime glow */}
              <span aria-hidden className="pointer-events-none absolute inset-0 bg-white/[0.04] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

              <button
                type="button"
                onClick={() => setWarrantyOpen((v) => !v)}
                aria-expanded={warrantyOpen}
                className="relative z-[1] flex w-full cursor-pointer items-center gap-3.5 p-4 text-left sm:p-5"
              >
                <SilverIcon src="/icons/checkout/protection.png" className="h-9 w-9" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-bold text-white">SafeDrop Additional Warranty</span>
                  <span className="mt-0.5 block text-[12px] text-[#a5adbe]">Extend buyer protection up to 30 days</span>
                </span>
                <span className="hidden flex-none items-center rounded-md border border-[rgba(198,255,61,0.3)] bg-[#1d2610] px-2.5 py-1 text-[12px] font-bold tabular-nums text-lime-text sm:flex">
                  {selectedTier.name} · {selectedTier.feeRate === 0 ? 'Free' : `+$${tierFeeAmount.toFixed(2)}`}
                </span>
                <ChevronDown className={cn('h-4 w-4 flex-none text-[#9aa3b6] transition-transform duration-300', warrantyOpen && 'rotate-180')} />
              </button>

              {/* Pinned selected tier — always visible so the collapsed
                  panel reads the current choice; clicking it (or the
                  header) opens the other options like a select. */}
              <div className="relative z-[1] px-4 pb-4 sm:px-5 sm:pb-5">
                <button
                  type="button"
                  onClick={() => setWarrantyOpen((v) => !v)}
                  aria-expanded={warrantyOpen}
                  className="relative flex w-full items-center gap-3 overflow-hidden rounded-md border-2 border-border-strong bg-[rgba(26,26,35,0.7)] px-3.5 py-3 text-left shadow-[0_10px_24px_-10px_rgba(0,0,0,0.65)] backdrop-blur-md transition-all duration-200"
                >
                  <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.06),transparent)]" />
                  <span className="grid h-9 w-9 flex-none place-items-center rounded-md border border-white/[0.08] bg-white/[0.05]">
                    <selectedTier.icon className="h-4 w-4 text-[#a5adbe]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-[13.5px] font-extrabold text-white">
                      {selectedTier.name}
                      {selectedTier.badge && (
                        <span className="rounded bg-lime px-1.5 py-px text-[10px] font-black uppercase tracking-[0.08em] text-[#12200a]">
                          Popular
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] text-[#9aa3b6]">
                      {selectedTier.warranty} · {selectedTier.features[2]}
                    </span>
                  </span>
                  <span className="flex-none text-[13px] font-extrabold tabular-nums text-white">
                    {selectedTier.feeRate === 0 ? 'Free' : `+$${tierFeeAmount.toFixed(2)}`}
                  </span>
                  <span className="flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full bg-lime">
                    <Check className="h-2.5 w-2.5 text-[#0c0e14]" strokeWidth={4} />
                  </span>
                </button>

                <AnimatePresence initial={false}>
                  {warrantyOpen && (
                    <motion.div
                      key="warranty-options"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.28, ease: 'easeOut' }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2.5 flex flex-col gap-2.5">
                        {TIERS.filter((t) => t.id !== safedropTier).map((tier) => {
                          const TierIcon = tier.icon
                          const fee = tier.feeRate === 0 ? 'Free' : `+$${((subtotal * tier.feeRate) / 100).toFixed(2)}`
                          return (
                            <button
                              key={tier.id}
                              type="button"
                              onClick={() => {
                                setSafedropTier(tier.id)
                                setWarrantyOpen(false)
                              }}
                              className="relative flex w-full items-center gap-3 overflow-hidden rounded-md border-2 border-border-default bg-[rgba(20,20,27,0.56)] px-3.5 py-3 text-left backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:bg-[rgba(26,26,35,0.70)] hover:shadow-[0_10px_22px_-10px_rgba(0,0,0,0.6)]"
                            >
                              <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.06),transparent)]" />
                              <span className="grid h-9 w-9 flex-none place-items-center rounded-md border border-white/[0.08] bg-white/[0.05]">
                                <TierIcon className="h-4 w-4 text-[#a5adbe]" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-2 text-[13.5px] font-extrabold text-white">
                                  {tier.name}
                                  {tier.badge && (
                                    <span className="rounded bg-lime px-1.5 py-px text-[10px] font-black uppercase tracking-[0.08em] text-[#12200a]">
                                      Popular
                                    </span>
                                  )}
                                </span>
                                <span className="mt-0.5 block truncate text-[12px] text-[#9aa3b6]">
                                  {tier.warranty} · {tier.features[2]}
                                </span>
                              </span>
                              <span className="flex-none text-[13px] font-extrabold tabular-nums text-white">{fee}</span>
                              <span className="h-[18px] w-[18px] flex-none rounded-full border-2 border-[#3d4436]" />
                            </button>
                          )
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
            )}

            {/* Trust panel

            {/* Trust panel — sized for the column. Watermark = the user's
                premium locker render (public/assets/checkout/secure-hero.png). */}
            <div className="relative mt-5 overflow-hidden rounded-lg border border-[rgba(120,175,255,0.24)] p-4 [background:radial-gradient(140%_160%_at_90%_10%,rgba(96,165,255,0.2),rgba(96,165,255,0.05)_42%,#0b1220_80%)] sm:mt-6 sm:p-5">
              {/* P8 — Proper hero-style bg (per tokens.css --hero-scrim /
                  --hero-vignette, adapted to the panel's blue): big shield
                  half-cut off the top-right, scrim keeps the text zone
                  dark, vignette seals the edges. */}
              <span aria-hidden className="pointer-events-none absolute inset-0 hidden select-none sm:block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/assets/checkout/secure-hero.png"
                  alt=""
                  className="absolute -bottom-24 -right-14 w-[300px] max-w-none rotate-[8deg] [filter:brightness(0.55)_saturate(0.8)] opacity-30"
                />
                <span className="absolute inset-0 bg-[linear-gradient(to_right,rgba(11,18,32,0.95)_32%,rgba(11,18,32,0.55)_60%,rgba(11,18,32,0.16)_100%)]" />
                <span className="absolute inset-0 bg-[radial-gradient(130%_150%_at_82%_78%,transparent_26%,rgba(11,18,32,0.85)_100%)]" />
              </span>
              {/* mobile keeps the quiet corner mark */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/assets/checkout/secure-hero.png"
                alt=""
                aria-hidden
                className="pointer-events-none absolute -bottom-6 -right-6 w-[110px] select-none opacity-10 sm:hidden"
              />
              <div className="relative">
                {/* Whole panel toggles the explainer (same behaviour as the
                    warranty dropdown): header + pill both live in <summary>. */}
                <div>
                  <div
                    role="button"
                    tabIndex={0}
                    aria-expanded={trustOpen}
                    onClick={() => setTrustOpen((v) => !v)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setTrustOpen((v) => !v)
                      }
                    }}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center gap-3.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/assets/checkout/shield-3d.png"
                        alt="SafeDrop"
                        className="h-[38px] w-[38px] flex-none select-none object-contain drop-shadow-[0_6px_14px_rgba(96,165,255,0.4)] sm:h-12 sm:w-12"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="hidden text-[15px] font-bold text-white sm:block">Safe &amp; Secure Payment</div>
                        <div className="hidden text-[12.5px] leading-snug text-[#9aa3b6] sm:mt-0.5 sm:block">
                          Every order is covered by{' '}
                          <Link href="/safedrop" onClick={(e) => e.stopPropagation()} className="text-[#88bbff] transition-colors hover:text-white">SafeDrop</Link>
                          {' '}Buyer Protection &amp; our{' '}
                          <Link href="/refund-policy" onClick={(e) => e.stopPropagation()} className="text-[#88bbff] transition-colors hover:text-white">Refund Policy</Link>
                        </div>
                        <div className="text-[12px] leading-[1.4] text-[#a5adbe] sm:hidden">
                          <span className="font-bold text-white">Safe &amp; Secure.</span> Covered by{' '}
                          <Link href="/safedrop" onClick={(e) => e.stopPropagation()} className="text-[#88bbff]">SafeDrop</Link> — get what you ordered, or your money back.
                        </div>
                      </div>
                      <span className="hidden flex-none items-center gap-2 sm:flex">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/assets/checkout/lock.png" alt="" aria-hidden className="h-7 w-7 select-none object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.35)]" />
                        <span className="text-[13px] font-extrabold text-[#f1d98d]">Money-Back</span>
                      </span>
                    </div>

                    <div className="mt-3 flex items-center gap-2 rounded-md border border-white/[0.09] bg-white/[0.05] px-3 py-[9px] text-[12px] font-semibold text-[#dbe2ee] transition-colors hover:bg-white/[0.08] sm:mt-4 sm:px-3.5 sm:py-2.5 sm:text-[12.5px]">
                      <Info className="h-[15px] w-[15px] flex-none text-[#88bbff]" />
                      How your order is protected
                      <ChevronDown className={cn('ml-auto h-4 w-4 flex-none text-[#9aa3b6] transition-transform duration-300', trustOpen && 'rotate-180')} />
                    </div>
                  </div>

                  <AnimatePresence initial={false}>
                    {trustOpen && (
                      <motion.div
                        key="trust-body"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.28, ease: 'easeOut' }}
                        className="overflow-hidden"
                      >
                        <div className="mt-4 flex flex-col gap-3.5">
                    {[
                      ['You pay at checkout', 'Your order is covered by SafeDrop Buyer Protection from the moment you pay.'],
                      ['Seller is notified', 'The seller receives your order and is prompted to deliver it.'],
                      ['Seller delivers', 'Your item or in-game currency is delivered to your account.'],
                      ['You confirm delivery', 'Check everything is right, then confirm delivery in your account.'],
                    ].map(([t, d], i) => (
                      <div key={t} className="flex items-start gap-3">
                        <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-white/[0.16] bg-white/[0.05] text-[12px] font-bold text-[#9aa3b6]">
                          {i + 1}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[13px] font-bold text-white">{t}</span>
                          <span className="mt-0.5 block text-[12px] text-[#9aa3b6]">{d}</span>
                        </span>
                      </div>
                    ))}
                    <div className="flex items-start gap-3">
                      <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-white/[0.16] bg-white/[0.05] text-[12px] font-bold text-[#9aa3b6]">
                        ✓
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[13px] font-bold text-lime-text">Seller gets paid — or you get a refund</span>
                        <span className="mt-0.5 block text-[12px] text-[#9aa3b6]">
                          The seller is paid out only after you confirm delivery. Not delivered or not as described? Full refund.
                        </span>
                      </span>
                    </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>

          {/* ── RIGHT: one Order Details card — item · seller · money · pay ── */}
          <div className="order-1 flex flex-col gap-5 sm:gap-6 lg:order-2 lg:sticky lg:top-6">
            <div className="relative overflow-hidden rounded-lg border border-white/[0.08] bg-[linear-gradient(180deg,#151a26,#0f131d)] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.4)] sm:p-5">
              {/* Llama watermark — oversized, peeking from the top-right
                  and slightly tilted, clipped by the card. */}
              {/* Llama hero bg — scrim keeps the money zone dark, the
                  vignette leaves one bright spot at the top-right so it
                  reads like the site's hero backdrops. */}
              <span aria-hidden className="pointer-events-none absolute inset-0 hidden select-none sm:block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/assets/checkout/llama.png"
                  alt=""
                  className="absolute -right-32 -top-20 w-[400px] max-w-none rotate-[-12deg] opacity-50 [filter:brightness(0.6)_saturate(0.7)]"
                />
                <span className="absolute inset-0 bg-[linear-gradient(to_right,rgba(16,20,30,0.96)_32%,rgba(16,20,30,0.6)_58%,rgba(16,20,30,0.2)_100%)]" />
                <span className="absolute inset-0 bg-[radial-gradient(130%_150%_at_82%_14%,transparent_26%,rgba(14,18,27,0.88)_100%)]" />
              </span>
              <div className="relative">
                <div className="flex items-center gap-2.5">
                  <SilverIcon src="/icons/checkout/receipt.svg" className="h-6 w-6" />
                  <h3 className="text-[16px] font-extrabold text-white">Order Details</h3>
                </div>

                <div className="my-3 h-px bg-white/[0.07]" />

                {/* Item — photo · name · qty · description */}
                <div className="flex items-start gap-3">
                  <span
                    className="relative h-14 w-14 flex-none overflow-hidden rounded-md border border-white/[0.09]"
                    style={{
                      background: 'linear-gradient(180deg,#2b3242,#10131b)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,.3), inset 0 -9px 16px rgba(0,0,0,.42), 0 6px 16px rgba(0,0,0,.45)',
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageSrc}
                      alt={title}
                      className={cn('h-full w-full', isBundle ? 'object-contain p-1.5' : 'object-cover')}
                    />
                    <span aria-hidden className="pointer-events-none absolute inset-0 rounded-md bg-[linear-gradient(180deg,rgba(255,255,255,0.24),transparent_44%)]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 block text-[15.5px] font-bold leading-snug text-white">
                      {quantity > 1 && <span className="text-lime-text">{quantity}× </span>}
                      {title}
                    </span>
                    <span className="mt-1.5 inline-flex min-w-0 items-center gap-1.5 text-[13px] font-semibold text-[#a5adbe]">
                      {listing.game?.image_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={listing.game.image_url} alt="" aria-hidden className="h-4 w-4 flex-none rounded-sm object-cover" />
                      )}
                      <span className="truncate">{listing.game?.name}</span>
                    </span>
                  </span>
                </div>

                {/* Seller — label left, floating profile right */}
                {listing.seller && (
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-[13px] font-medium text-[#a5adbe] sm:text-[13.5px]">Seller</span>
                    <SellerPeek seller={listing.seller} reviews={sellerReviews} />
                  </div>
                )}

                {/* Description — half-open: ~2 lines visible, faded tail +
                    chevron only when there's more to read */}
                {listing.description?.trim() && (
                  <div className="mt-2.5">
                    <button
                      type="button"
                      onClick={() => descOverflow && setDescOpen((v) => !v)}
                      aria-expanded={descOpen}
                      className={cn(
                        'flex w-full items-center gap-[9px] py-0.5 text-left text-[13px] font-semibold text-[#a5adbe] transition-colors',
                        descOverflow ? 'cursor-pointer hover:text-white' : 'cursor-default',
                      )}
                    >
                      Description
                      {descOverflow && (
                        <ChevronDown className={cn('ml-auto h-[15px] w-[15px] flex-none text-[#7b8398] transition-transform duration-300', descOpen && 'rotate-180')} />
                      )}
                    </button>
                    <div
                      className={cn(
                        'overflow-hidden transition-[max-height] duration-300 ease-out',
                        !descOpen && descOverflow && '[mask-image:linear-gradient(to_bottom,black_42%,rgba(0,0,0,0.3)_78%,transparent_100%)]',
                      )}
                      // Open cap comes from the measured scrollHeight (not a
                      // fixed 600px) so long descriptions are never silently
                      // clipped at 360px width; the px value keeps the 300ms
                      // max-height transition animating both ways.
                      style={{ maxHeight: descOpen ? `${(descRef.current?.scrollHeight ?? 9999) + 12}px` : '64px' }}
                    >
                      <p ref={descRef} className="mt-1 whitespace-pre-line text-[12.5px] leading-relaxed text-[#8d95a8]">
                        {listing.description}
                      </p>
                    </div>
                  </div>
                )}

                <div className="my-3 h-px bg-white/[0.07]" />

              {!appliedCode && (
                <>
                  <button
                    type="button"
                    onClick={() => setCodeOpen((v) => !v)}
                    aria-expanded={codeOpen}
                    className="flex w-full cursor-pointer items-center gap-[9px] py-0.5 text-left text-[13px] font-semibold text-[#a5adbe] transition-colors hover:text-white"
                  >
                    <Tag className="h-[15px] w-[15px] flex-none text-[#7b8398]" />
                    Have a discount code?
                    <ChevronDown className={cn('ml-auto h-[15px] w-[15px] flex-none text-[#7b8398] transition-transform duration-300', codeOpen && 'rotate-180')} />
                  </button>
                  <AnimatePresence initial={false}>
                    {codeOpen && (
                      <motion.div
                        key="code-body"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.28, ease: 'easeOut' }}
                        className="overflow-hidden"
                      >
                        <div className="mt-3 flex gap-2 pb-1">
                      <span className="flex h-9 min-w-0 flex-1 items-center gap-[9px] rounded-md border border-white/[0.1] bg-[#0d1017] px-3 transition-colors focus-within:border-[rgba(198,255,61,0.45)]">
                        <Tag className="h-[15px] w-[15px] flex-none text-[#7b8398]" />
                        <input
                          value={promoInput}
                          onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              handleApplyPromo()
                            }
                          }}
                          placeholder="Discount code"
                          className="h-full min-w-0 flex-1 border-0 bg-transparent text-[12.5px] font-medium uppercase tracking-[0.06em] text-[#eef1f6] outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-[#6d7488]"
                        />
                      </span>
                      <button
                        type="button"
                        onClick={handleApplyPromo}
                        disabled={!promoInput.trim() || promoValidating}
                        className="inline-flex h-9 flex-none items-center rounded-md border border-[rgba(198,255,61,0.38)] bg-[rgba(198,255,61,0.12)] px-4 text-[12px] font-bold text-lime-text transition-all duration-200 hover:border-transparent hover:bg-lime hover:text-[#12200a] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[rgba(198,255,61,0.38)] disabled:hover:bg-[rgba(198,255,61,0.12)] disabled:hover:text-lime-text"
                      >
                        {promoValidating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Apply'}
                      </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="my-4 h-px bg-white/[0.07]" />
                </>
              )}

              {/* Fee list */}
              <div className="flex flex-col gap-3 text-[13px] font-medium text-[#a5adbe] sm:text-[13.5px]">
                <FeeRow
                  label="Subtotal"
                  extra={
                    quantity > 1 ? (
                      <span className="tabular-nums text-[12px] text-[#6d7488]">
                        {fmtUnitPrice(listing.price)} × {quantity}
                      </span>
                    ) : undefined
                  }
                  value={`$${subtotal.toFixed(2)}`}
                />
                {/* Buyer fee, itemised as two lines (marketplace 2% +
                    processing 5%) — both always included in the displayed
                    total (DMCCA). */}
                <FeeRow
                  label={MARKETPLACE_FEE_LABEL}
                  tooltip={`${fee.marketplacePct}% — keeps every order covered by SafeDrop Buyer Protection.`}
                  value={`+$${fee.marketplaceAmount.toFixed(2)}`}
                />
                <FeeRow
                  label={PROCESSING_FEE_LABEL}
                  tooltip={`${fee.processingPct}% — card and crypto payment processing. Always included in the total you see.`}
                  value={`+$${fee.processingAmount.toFixed(2)}`}
                />
                {selectedTier.feeRate > 0 && (
                  <FeeRow label={`SafeDrop ${selectedTier.name}`} value={`+$${tierFeeAmount.toFixed(2)}`} valueClass="text-lime-text" />
                )}
                {appliedCode && (
                  <FeeRow
                    label={`Code ${appliedCode}`}
                    value={`−$${promoDiscount.toFixed(2)}`}
                    valueClass="text-success"
                    extra={
                      <button
                        type="button"
                        onClick={handleRemovePromo}
                        aria-label="Remove discount code"
                        // p-3/-m-2.5 — same 16px layout footprint, ~36px hit
                        // area so the X isn't fat-fingered next to the value.
                        className="-m-2.5 rounded p-3 text-[#7b8398] transition-colors hover:bg-white/10 hover:text-white"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    }
                  />
                )}
                <FeeRow
                  label="Store credit"
                  icon={
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src="/assets/checkout/dm-coin.png" alt="" aria-hidden className="h-5 w-5 flex-none select-none object-contain" />
                  }
                  extra={
                    walletBalance > 0 ? (
                      <MiniSwitch on={useWallet} onToggle={() => setUseWallet(!useWallet)} label="Apply store credit" />
                    ) : undefined
                  }
                  value={useWallet && walletAmount > 0 ? `−$${walletAmount.toFixed(2)}` : `$${walletBalance.toFixed(2)}`}
                  valueClass={useWallet && walletAmount > 0 ? 'text-success' : undefined}
                />
                {dropCreditsBalance > 0 && (
                  <FeeRow
                    label="Drop Credits"
                    icon={
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src="/assets/checkout/dm-coin.png" alt="" aria-hidden className="h-5 w-5 flex-none select-none object-contain" />
                    }
                    extra={<MiniSwitch on={useDropCredits} onToggle={() => setUseDropCredits(!useDropCredits)} label="Apply Drop Credits" />}
                    value={`${dropCreditsBalance.toLocaleString()} DC`}
                  />
                )}
              </div>

              <div className="my-4 h-px bg-white/[0.07]" />

              {/* Total + DC earn line */}
              <div className="mb-4 flex items-end justify-between">
                <span>
                  <span className="block text-[18px] font-extrabold text-white">Total</span>
                  {dcEarned > 0 && (
                    <span className="mt-[3px] flex items-center gap-1.5 text-[12px] font-medium text-lime-text">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/assets/checkout/dm-coin.png" alt="" aria-hidden className="h-[18px] w-[18px] select-none object-contain" />
                      +{dcEarned} DC earned
                    </span>
                  )}
                </span>
                <span className="text-[26px] font-extrabold tracking-[-0.5px] tabular-nums text-white">${total.toFixed(2)}</span>
              </div>

              {/* Pay Now — grey default, muted-lime fill on hover */}
              <button
                type="button"
                onClick={handlePay}
                disabled={paying}
                className={cn(
                  'flex h-11 w-full items-center justify-center gap-2 rounded-md text-[15px] font-extrabold transition-all duration-200',
                  paying
                    ? 'cursor-not-allowed border border-white/[0.08] bg-[#12151e] text-[#7b8398]'
                    : 'bg-lime text-[#12200a] shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_8px_24px_-8px_rgba(198,255,61,0.45)] hover:bg-lime-hover hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_10px_28px_-8px_rgba(198,255,61,0.55)] active:scale-[0.99]',
                )}
              >
                {paying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Redirecting to payment…
                  </>
                ) : (
                  <>
                    <span aria-hidden className="text-[18px] font-extrabold leading-none">₿</span>
                    Pay Now
                  </>
                )}
              </button>

              {payError && (
                <div className="mt-3 flex items-start gap-2 rounded-md border border-error/40 bg-error-bg p-3 animate-in fade-in-0 slide-in-from-top-1 duration-200">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-error" />
                  <p className="text-[12px] leading-relaxed text-text-secondary">{payError}</p>
                </div>
              )}

              <p className="mt-3.5 flex items-center justify-center gap-2 text-[12px] text-[#8d95a8]">
                <Lock className="h-3.5 w-3.5 flex-none text-[#a5adbe]" />
                <span>
                  <span className="font-bold text-[#dbe2ee]">256-bit SSL</span> Encrypted payment. You&apos;re safe.
                </span>
              </p>
              <p className="mt-1.5 flex items-start justify-center gap-2 text-center text-[12px] leading-relaxed text-[#8d95a8]">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 flex-none text-lime-text" />
                <span>
                  Covered by <span className="font-bold text-[#dbe2ee]">SafeDrop</span> — full refund if not delivered or not as described.
                </span>
              </p>
              <p className="mt-1.5 text-center text-[12px] leading-relaxed text-[#7b8398]">
                By clicking Pay Now you agree to our{' '}
                <a href="/terms" target="_blank" className="text-[#88bbff] transition-colors hover:text-white">Terms</a> and{' '}
                <a href="/refund-policy" target="_blank" className="text-[#88bbff] transition-colors hover:text-white">Refund Policy</a>.
              </p>

              </div>
            </div>
          </div>
        </div>
    </div>
  )
}

// ─── SellerPeek ──────────────────────────────────────────────────────────
//
// V77 — Seller pill → in-checkout dialog with the seller's stats + last
// 5 reviews. Deliberately NO profile links: the buyer stays in checkout.
function SellerPeek({ seller, reviews }: { seller: any; reviews: any[] }) {
  const [open, setOpen] = useState(false)
  const name = seller.shop_name?.trim() || seller.username || 'Seller'
  const rating = seller.seller_rating != null ? Number(seller.seller_rating) : null
  const sales = seller.total_sales ?? 0
  const verified = !!seller.is_verified || (!!seller.seller_tier && seller.seller_tier !== 'unverified')
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        // min-h + py/-my — the seller row is the only path to reviews
        // pre-payment; pad it to a 44px tap target while keeping the
        // visual rhythm of the Order Details rows.
        className="group -my-2 inline-flex min-h-[44px] min-w-0 items-center gap-2 py-2 text-left"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={getAvatarUrl(seller.avatar_url, seller.username || 'seller')}
          alt=""
          className="h-6 w-6 flex-none rounded-md object-cover ring-1 ring-white/[0.12]"
        />
        <span className="max-w-[150px] truncate text-[13.5px] font-extrabold text-white transition-colors group-hover:text-lime-text">
          {name}
        </span>
        {verified && <CheckCircle2 className="h-3.5 w-3.5 flex-none fill-lime text-[#12200a]" />}
        <span className="inline-flex flex-none items-center gap-1 text-[12.5px] font-bold tabular-nums text-[#a5adbe]">
          <Star className="h-3 w-3 fill-lime text-lime" />
          {rating != null ? rating.toFixed(1) : '—'}
        </span>
        <ChevronRight className="h-4 w-4 flex-none text-[#7b8398] transition-transform group-hover:translate-x-0.5" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        {/* No overflow-hidden here — the dialog base's dvh cap +
            overflow-y-auto must stay in charge so short viewports can
            scroll the sheet instead of clipping the reviews list. */}
        <DialogContent className="max-w-[440px] gap-0 rounded-lg border-white/[0.08] bg-[#12151e] p-0">
          <DialogHeader className="relative border-b border-white/[0.07] bg-[linear-gradient(to_bottom,rgba(255,255,255,0.04),transparent)] p-5 pb-4 text-left">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getAvatarUrl(seller.avatar_url, seller.username || 'seller')}
                alt=""
                className="h-12 w-12 rounded-md object-cover ring-1 ring-white/[0.09]"
              />
              <div className="min-w-0 flex-1">
                <DialogTitle className="flex items-center gap-1.5 text-[16px] font-extrabold">
                  {name}
                  {verified && <CheckCircle2 className="h-4 w-4 fill-lime text-[#12200a]" />}
                </DialogTitle>
                <DialogDescription className="mt-1 flex items-center gap-2 text-[12px] text-[#7b8398]">
                  <span className="inline-flex items-center gap-1 font-bold tabular-nums text-[#a5adbe]">
                    <Star className="h-3 w-3 fill-lime text-lime" />
                    {rating != null ? rating.toFixed(1) : 'No rating yet'}
                  </span>
                  <span aria-hidden>·</span>
                  <span className="tabular-nums">{sales.toLocaleString()} sold</span>
                  {seller.seller_tier && seller.seller_tier !== 'unverified' && (
                    <>
                      <span aria-hidden>·</span>
                      <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#E8B368]">{seller.seller_tier}</span>
                    </>
                  )}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {/* Viewport-aware cap: on short screens the list yields to the
              header inside the dvh-capped sheet instead of fighting it. */}
          <div className="max-h-[min(380px,55dvh)] overflow-y-auto p-5 pt-4">
            <h4 className="mb-3 text-[12px] font-extrabold uppercase tracking-wider text-[#a5adbe]">
              Recent Reviews
            </h4>
            {reviews.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-[#7b8398]">
                No reviews yet — you&apos;d be one of the first.
              </p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {reviews.map((r) => (
                  <div key={r.id} className="rounded-md border border-white/[0.07] bg-[#0d1017] p-3">
                    <div className="flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={getAvatarUrl(r.buyer?.avatar_url, r.buyer?.username || 'buyer')}
                        alt=""
                        className="h-5 w-5 rounded-full object-cover"
                      />
                      <span className="text-[12.5px] font-bold text-white">{r.buyer?.username || 'Buyer'}</span>
                      <span className="ml-auto inline-flex items-center gap-0.5">
                        {Array.from({ length: 5 }, (_, i) => (
                          <Star
                            key={i}
                            className={cn('h-3 w-3', i < (Number(r.rating) || 0) ? 'fill-lime text-lime' : 'fill-[#2C3140] text-[#2C3140]')}
                          />
                        ))}
                      </span>
                    </div>
                    {r.comment && (
                      <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed text-[#a5adbe]">{r.comment}</p>
                    )}
                    <p className="mt-1.5 text-[12px] text-[#7b8398]">
                      {r.created_at ? new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
