'use client'

/**
 * Checkout — "Ivory Ledger" rebuild (design_handoff_checkout Option 1a).
 *
 * Trust-first checkout: dark 64px navbar strip, then an ivory (#FAFAF7)
 * surface with a two-column grid — Payment method list (crypto expanded
 * with Coin + Network dropdowns, amber network warning, Pay Now) on the
 * left, the compact white order-summary card (item, seller chips,
 * discount code, itemised fees, SafeDrop line) on the right. Mobile:
 * single column (summary card first) + sticky bottom Pay bar.
 *
 * All money logic preserved from the previous checkout: quantity comes
 * clamped from the ?qty deep-link, promo codes (validatePromoCode),
 * wallet Store Credit toggle, itemised buyer fee (lib/fees is the one
 * source, mirrored server-side), DC cashback, and submit via
 * createCheckout (amounts recomputed server-authoritatively). The
 * chosen network rides to the payment page as ?net= so its coin tab
 * preselects.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import Image from 'next/image'
import * as Select from '@radix-ui/react-select'
import * as Dropdown from '@radix-ui/react-dropdown-menu'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  ChevronDown,
  Info,
  Loader2,
  Lock,
  Gem,
  LogOut,
  Medal,
  Package,
  Settings,
  Landmark,
  ShieldCheck,
  Smartphone,
  Store,
  Barcode,
  Tag,
  TriangleAlert,
  Undo2,
  Wallet,
  X,
} from 'lucide-react'

import { createCheckout } from '@/lib/actions/checkout'
import { getAvatarUrl } from '@/lib/utils/avatar'
import { validatePromoCode, type PromoValidationResult } from '@/lib/actions/promo'
import { getWalletBalance } from '@/lib/actions/wallet'
import { cn } from '@/lib/utils'
import { buyerFee, MARKETPLACE_FEE_LABEL, PROCESSING_FEE_LABEL } from '@/lib/fees'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { CheckoutNavbar } from '../_components/CheckoutNavbar'

// ─── Ivory Ledger tokens (design_handoff_checkout Option 1a) ────────────────
const T = {
  ivory: '#FAFAF7',
  ivory2: '#F3F3ED',
  row: '#FCFCFA',
  ink: '#1A1D19',
  ink2: '#5B6157',
  dis: '#9AA096',
  forest: '#14432A',
  forest2: '#1B5E3A',
  lime: '#A3E635',
  limeTint: '#EDFBD3',
  success: '#3F7D22',
  line: '#E4E5DE',
  disLine: '#D5D7CE',
  amberTx: '#8A4308',
  amberIc: '#B45309',
  amberBg: '#FBF3E6',
  amberLn: '#EBD9BC',
  nav: '#141714',
}

function fmtUnitPrice(n: number): string {
  if (n === 0) return '$0.00'
  if (Math.abs(n) < 0.01) return `$${n.toFixed(4)}`
  return `$${n.toFixed(2)}`
}

/** Prettify raw delivery-time values: "30min" → "30 Min", "1h" → "1 Hr",
 *  "instant" → "Instant". Defensive — unknown formats just get Title Case. */
function fmtDelivery(raw: string): string {
  const m = raw.trim().match(/^(\d+)\s*(min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)$/i)
  if (m) {
    const n = Number(m[1])
    const u = m[2].toLowerCase()
    const base = u.startsWith('min') ? 'Min' : u.startsWith('h') ? 'Hour' : 'Day'
    return `${n} ${base}${n === 1 ? '' : 's'}`
  }
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

// ─── Coin / network choices ─────────────────────────────────────────────────

type Coin = 'usdt' | 'btc'
type Net = 'trc20' | 'polygon' | 'ethereum'

// BTC node synced 2026-09-05; live per the rail-certification tests.
const COINS: Array<{ value: Coin; label: string; icon: string; soon?: boolean }> = [
  { value: 'usdt', label: 'Tether USDT', icon: '/crypto/usdt.svg' },
  { value: 'btc', label: 'Bitcoin', icon: '/crypto/btc.svg' },
]

// Polygon/Ethereum flip to enabled once their USDt pools + RPC are
// configured in BTCPay (the payment page grows their tabs automatically).
const NETWORKS: Array<{ value: Net; label: string; fee: string; soon?: boolean }> = [
  { value: 'trc20', label: 'TRON · TRC20', fee: '~$0.50' },
  { value: 'polygon', label: 'Polygon', fee: '~$0.01' },
  { value: 'ethereum', label: 'Ethereum', fee: '$2+' },
]

// ─── Small pieces ───────────────────────────────────────────────────────────

/** Light dropdown per the handoff: 1px #E4E5DE border, radius 6, ivory bg. */
function LightSelect({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string; icon?: string; hint?: string; disabled?: boolean }>
  ariaLabel: string
}) {
  const selected = options.find((o) => o.value === value)
  return (
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger
        aria-label={ariaLabel}
        className="flex h-[42px] w-full items-center justify-between gap-2 rounded-md border px-3 text-[14px] font-medium outline-none transition-colors focus-visible:border-[#14432A]"
        style={{ borderColor: T.line, background: T.ivory, color: T.ink }}
      >
        <span className="flex min-w-0 items-center gap-2">
          {selected?.icon && <Image src={selected.icon} alt="" width={18} height={18} unoptimized />}
          <span className="truncate">{selected?.label}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {selected?.hint && (
            <span className="text-[11.5px] font-medium" style={{ color: T.ink2 }}>
              {selected.hint}
            </span>
          )}
          <ChevronDown className="h-4 w-4" style={{ color: T.ink2 }} />
        </span>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={4}
          className="z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border bg-white shadow-[0_10px_30px_-12px_rgba(0,0,0,0.18)]"
          style={{ borderColor: T.line }}
        >
          <Select.Viewport className="p-1">
            {options.map((o) => (
              <Select.Item
                key={o.value}
                value={o.value}
                disabled={o.disabled}
                className="flex cursor-pointer items-center justify-between gap-3 rounded px-2.5 py-2 text-[13.5px] font-medium outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-45 data-[highlighted]:bg-[#F3F3ED]"
                style={{ color: T.ink }}
              >
                <span className="flex items-center gap-2">
                  {o.icon && <Image src={o.icon} alt="" width={16} height={16} unoptimized />}
                  <Select.ItemText>{o.label}</Select.ItemText>
                </span>
                <span className="flex items-center gap-2">
                  {o.hint && (
                    <span className="text-[11.5px]" style={{ color: T.ink2 }}>
                      {o.hint}
                    </span>
                  )}
                  <Select.ItemIndicator>
                    <Check className="h-3.5 w-3.5" style={{ color: T.forest }} />
                  </Select.ItemIndicator>
                </span>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}

/** ⓘ dot for fee rows — light theme. Plain `text`, or a structured card
 *  (title + % badge + one crisp line) when `title` is given. */
function InfoDot({
  text,
  title,
  badge,
}: {
  text: string
  title?: string
  badge?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={title ?? text}
          className="group relative -m-[10px] inline-flex flex-none items-center justify-center p-[10px]"
        >
          <Info
            aria-hidden
            className="h-[14px] w-[14px] text-[#5B6157] transition-colors group-hover:text-[#1A1D19]"
          />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="rounded-md border bg-white p-0 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.2)]"
        style={{ borderColor: T.line }}
      >
        {title ? (
          <div className="px-3 py-2.5">
            <p className="flex items-center gap-2 text-[12.5px] font-bold" style={{ color: T.ink }}>
              {title}
              {badge && (
                <span
                  className="rounded px-1.5 py-[1px] text-[10.5px] font-bold"
                  style={{ background: T.limeTint, color: T.forest }}
                >
                  {badge}
                </span>
              )}
            </p>
            <p className="mt-1 max-w-[190px] text-[11.5px] leading-snug" style={{ color: T.ink2 }}>
              {text}
            </p>
          </div>
        ) : (
          <p className="max-w-[220px] px-3 py-2 text-[12px] leading-snug" style={{ color: T.ink }}>
            {text}
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  )
}

/** Store-credit mini switch (light). */
function MiniSwitch({ on, disabled, onToggle, label }: { on: boolean; disabled?: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className="relative h-[18px] w-[32px] flex-none rounded-full transition-colors before:absolute before:-inset-2.5 disabled:cursor-not-allowed disabled:opacity-50"
      style={{ background: on ? T.forest : T.disLine }}
    >
      <span
        className={cn('absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white transition-all', on ? 'left-[16px]' : 'left-[2px]')}
      />
    </button>
  )
}

/** GameBoost-style callout, adapted to the ivory surface: roomy padding,
 *  20px icon, border + text in one hue over a soft tint. */
function Callout({
  variant,
  children,
}: {
  variant: 'warning' | 'tip'
  children: React.ReactNode
}) {
  // Exact GameBoost (Mintlify) light-mode palette: yellow-50/200/800 and
  // green-50/200/800 — icon and text share one hue; 20px icon, 14px text,
  // px-5 py-4. Corners tightened to our 8px rectangular direction.
  const c =
    variant === 'warning'
      ? { bg: '#FEFCE8', border: '#FEF08A', text: '#854D0E' }
      : { bg: '#F0FDF4', border: '#BBF7D0', text: '#166534' }
  return (
    <div
      className="flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5"
      style={{ background: c.bg, borderColor: c.border }}
    >
      {variant === 'warning' ? (
        <TriangleAlert className="mt-[2px] h-[18px] w-[18px] shrink-0" style={{ color: c.text }} />
      ) : (
        <Check className="mt-[2px] h-[18px] w-[18px] shrink-0" style={{ color: c.text }} />
      )}
      <p className="text-[13px] leading-[1.5]" style={{ color: c.text }}>
        {children}
      </p>
    </div>
  )
}

/** Seller tier badge — a colored medal icon next to the name (tooltip
 *  carries the tier name). Unverified tiers render nothing. */
const TIER_STYLES: Record<string, { label: string; color: string; kind: 'medal' | 'gem' }> = {
  bronze: { label: 'Bronze Seller', color: '#CD7F32', kind: 'medal' },
  silver: { label: 'Silver Seller', color: '#9AA4AD', kind: 'medal' },
  gold: { label: 'Gold Seller', color: '#D5A419', kind: 'medal' },
  platinum: { label: 'Platinum Seller', color: '#6FA7B8', kind: 'medal' },
  diamond: { label: 'Diamond Seller', color: '#7C8BE0', kind: 'gem' },
}

function TierBadge({ tier }: { tier?: string | null }) {
  const t = tier ? TIER_STYLES[tier.toLowerCase()] : undefined
  if (!t) return null
  const Icon = t.kind === 'gem' ? Gem : Medal
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span aria-label={t.label} className="inline-flex">
          <Icon
            className="h-[16px] w-[16px] shrink-0"
            style={{ color: t.color, fill: `${t.color}33` }}
            strokeWidth={2.2}
          />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-[11.5px] font-semibold">
        {t.label}
      </TooltipContent>
    </Tooltip>
  )
}

/** A — trust chip row: honest claims only, shown at the moment of
 *  commitment (under Pay Now). */
function TrustChips() {
  const chip =
    'flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-md border bg-white px-1.5 py-[6px] text-[10.5px] font-semibold'
  const chipStyle = { borderColor: T.line, color: T.ink } as const
  const ic = { color: T.forest } as const
  return (
    <div className="mt-3 flex items-center gap-1.5">
      <span className={chip} style={chipStyle}>
        <ShieldCheck className="h-3 w-3 shrink-0" style={ic} /> SafeDrop Guarantee
      </span>
      <span className={chip} style={chipStyle}>
        <BadgeCheck className="h-3 w-3 shrink-0" style={ic} /> ID-Verified Sellers
      </span>
      <Link href="/refunds" className={`${chip} transition-colors hover:border-[#14432A66]`} style={chipStyle}>
        <Undo2 className="h-3 w-3 shrink-0" style={ic} /> Refund Policy
      </Link>
    </div>
  )
}

/** C — company footer strip: the quiet corporate signal. */
function CompanyStrip() {
  return (
    <div
      className="mt-8 flex flex-col items-center justify-between gap-3 rounded-lg border bg-white px-5 py-3.5 sm:flex-row"
      style={{ borderColor: T.line }}
    >
      <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-5">
        <span className="flex items-center gap-2 text-[11.5px] font-semibold" style={{ color: T.ink2 }}>
          <Landmark className="h-4 w-4" style={{ color: T.forest }} />
          <span>
            <b style={{ color: T.ink }}>DropMarket Ltd</b> · Registered In The United Kingdom
          </span>
        </span>
        <span className="flex items-center gap-2 text-[11.5px] font-semibold" style={{ color: T.ink2 }}>
          <Lock className="h-4 w-4" style={{ color: T.forest }} />
          <span>
            Secured By <b style={{ color: T.ink }}>DropMarket Payments</b>
          </span>
        </span>
      </div>
      <nav className="flex items-center gap-4 text-[11.5px] font-medium" style={{ color: T.ink2 }}>
        <Link href="/terms" className="transition-colors hover:text-[#14432A]">Terms</Link>
        <Link href="/refunds" className="transition-colors hover:text-[#14432A]">Refunds</Link>
        <Link href="/privacy" className="transition-colors hover:text-[#14432A]">Privacy</Link>
      </nav>
    </div>
  )
}

const SOON_METHODS = [
  { name: 'Debit / Credit Cards', badges: ['VISA', 'MC'] },
  { name: 'Apple Pay', badges: ['APPLE PAY'] },
  { name: 'Google Pay', badges: ['G PAY'] },
  { name: 'Skrill', badges: ['SKRILL'] },
]

// Payssion local methods LIVE on our app (probe-verified 2026-09-06). Adding
// a method later = enable it at Payssion + add a row here + in the provider's
// methods.ts registry.
type PayMethodId = 'crypto' | 'gcash_ph' | 'oxxo_mx' | 'boleto_br'
const LOCAL_METHODS: Array<{
  id: Exclude<PayMethodId, 'crypto'>
  label: string
  region: string
  Icon: typeof Smartphone
  note: string
}> = [
  {
    id: 'gcash_ph',
    label: 'GCash',
    region: 'Philippines',
    Icon: Smartphone,
    note: 'Pay with your GCash wallet — you’ll be redirected to a secure GCash page, and your order completes the moment the payment confirms.',
  },
  {
    id: 'oxxo_mx',
    label: 'OXXO',
    region: 'Mexico',
    Icon: Store,
    note: 'You’ll get a payment voucher to pay in cash at any OXXO store. Vouchers stay valid for 48 hours; your order completes when the payment clears (usually within a day). Any store credit you apply stays reserved until then.',
  },
  {
    id: 'boleto_br',
    label: 'Boleto',
    region: 'Brazil',
    Icon: Barcode,
    note: 'You’ll get a Boleto slip to pay via your bank app or in person. Slips stay valid for 48 hours; your order completes when the payment clears (1–2 business days). Any store credit you apply stays reserved until then.',
  },
]

// ─── CheckoutForm ───────────────────────────────────────────────────────────

interface CheckoutFormProps {
  listing: any
  user: any
  buyerProfile?: { username: string | null; avatar_url: string | null } | null
  sellerReviews?: any[]
  initialQty?: number
  bundleSummary?: { name: string; iconUrl: string | null } | null
}

export function CheckoutForm({ listing, user, buyerProfile, sellerReviews = [], initialQty, bundleSummary }: CheckoutFormProps) {
  const router = useRouter()

  // Quantity comes clamped from the ?qty deep-link (chosen on the item page).
  const seedQty = (() => {
    if (!initialQty) return 1
    const min = bundleSummary ? 1 : Math.max(1, listing.min_quantity ?? 1)
    const max = Math.max(min, listing.quantity ?? min)
    return Math.min(max, Math.max(min, initialQty))
  })()
  const [quantity] = useState(seedQty)

  // Payment method: crypto (expanded card) or a Payssion local method.
  const [payMethod, setPayMethod] = useState<PayMethodId>('crypto')
  // Coin + network selection (within the crypto card).
  const [coin, setCoin] = useState<Coin>('usdt')
  const [network, setNetwork] = useState<Net>('trc20')

  const [promoInput, setPromoInput] = useState('')
  const [promoValidating, setPromoValidating] = useState(false)
  const [promoResult, setPromoResult] = useState<PromoValidationResult | null>(null)
  const promoDiscount = promoResult?.valid ? (promoResult.discountAmount ?? 0) : 0

  const [codeOpen, setCodeOpen] = useState(false)
  const [walletBalance, setWalletBalance] = useState<number>(0)
  const [useWallet, setUseWallet] = useState(false)

  const subtotal = listing.price * quantity
  const fee = buyerFee(subtotal)
  const totalBeforeWallet = subtotal + fee.amount - promoDiscount
  const walletAmount = useWallet ? Math.min(walletBalance, totalBeforeWallet) : 0
  const total = Math.max(totalBeforeWallet - walletAmount, 0)
  const dcEarned = Math.round(subtotal * 100 * 0.02)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      const result = await getWalletBalance()
      if (!cancelled && result.success && result.balance) {
        setWalletBalance(result.balance.available_balance)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  // Provider-return with ?cancelled=1 (buyer backed out on the hosted page):
  // say so once, then clean the URL so refreshes don't re-toast.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    if (sp.get('cancelled') === '1') {
      toast.info('Payment Cancelled — no charge was made. Pick a method whenever you’re ready.')
      sp.delete('cancelled')
      const qs = sp.toString()
      window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''))
    }
  }, [])

  const handleApplyPromo = async () => {
    if (!promoInput.trim()) return
    setPromoValidating(true)
    const result = await validatePromoCode(promoInput, subtotal)
    setPromoResult(result)
    setPromoValidating(false)
    if (result.valid) toast.success(`Promo Applied: ${result.description}`)
    else toast.error(result.error || 'Invalid Promo Code')
  }
  const handleRemovePromo = () => {
    setPromoInput('')
    setPromoResult(null)
  }

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
        // Local methods route the charge to Payssion; crypto stays default.
        paymentMethodId: payMethod === 'crypto' ? undefined : payMethod,
      })
      if (!result.success) {
        setPayError(result.error || 'Checkout failed')
        toast.error(result.error || 'Checkout failed')
        setPaying(false)
        return
      }
      if (result.fullyPaidByWallet && result.orderId) {
        toast.success('Paid From Wallet — redirecting to your order…')
        router.push(`/orders/${result.orderId}`)
        return
      }
      if (result.checkoutUrl) {
        if (payMethod !== 'crypto') {
          // Payssion-hosted page — absolute URL, no tab params to carry.
          window.location.href = result.checkoutUrl
          return
        }
        // Carry the chosen network so the payment page preselects its tab.
        const sep = result.checkoutUrl.includes('?') ? '&' : '?'
        window.location.href = `${result.checkoutUrl}${sep}coin=${coin}&net=${network}`
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
    bundleSummary?.iconUrl || listing.images?.[0] || listing.game?.image_url || '/placeholder-game.jpg'

  const seller = listing.seller ?? {}
  const sellerName = seller.shop_name || seller.username || 'Seller'
  const reviewCount = Number(seller.total_reviews ?? 0)
  // Verified badge: the manual is_verified flag OR any tier above
  // 'unverified' — every listing seller has passed KYC, and tier bronze+
  // is the DB signal for that.
  const isVerifiedSeller =
    !!seller.is_verified || (!!seller.seller_tier && seller.seller_tier !== 'unverified')
  const positivePct = reviewCount > 0 ? Math.min(100, (Number(seller.seller_rating ?? 0) / 5) * 100) : null
  const deliveryTime = listing.delivery_time || 'Instant'

  const selectedNet = NETWORKS.find((n) => n.value === network)!

  // ── Shared blocks (desktop + mobile) ──────────────────────────────

  const payButton = (extraClass = '') => (
    <button
      type="button"
      onClick={() => void handlePay()}
      disabled={paying}
      className={cn(
        'flex h-12 w-full items-center justify-center gap-2 rounded-md text-[15px] font-semibold text-white transition-colors disabled:opacity-70',
        extraClass
      )}
      style={{ background: T.forest }}
      onMouseEnter={(e) => (e.currentTarget.style.background = T.forest2)}
      onMouseLeave={(e) => (e.currentTarget.style.background = T.forest)}
    >
      {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
      Pay Now · ${total.toFixed(2)}
    </button>
  )

  const cryptoBody = (
    <div className="border-t px-4 pb-4 pt-4" style={{ borderColor: T.line }}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1.5 text-[12px] font-semibold" style={{ color: T.ink2 }}>
            Coin
          </p>
          <LightSelect
            ariaLabel="Coin"
            value={coin}
            onChange={(v) => setCoin(v as Coin)}
            options={COINS.map((c) => ({
              value: c.value,
              label: c.label,
              icon: c.icon,
              hint: c.soon ? 'Soon' : undefined,
              disabled: c.soon,
            }))}
          />
        </div>
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: T.ink2 }}>
            Network
            <InfoDot text="Each network charges a small blockchain fee, paid by your wallet on top of the total shown here." />
          </p>
          {coin === 'btc' ? (
            // Bitcoin has exactly one network — show it fixed, no selector.
            <div
              className="flex h-[42px] w-full items-center justify-between gap-2 rounded-md border px-3 text-[14px] font-medium"
              style={{ borderColor: T.line, background: T.ivory2, color: T.ink }}
            >
              <span className="flex items-center gap-2">
                <Image src="/crypto/btc.svg" alt="" width={18} height={18} unoptimized />
                Bitcoin
              </span>
              <span className="text-[11.5px] font-medium" style={{ color: T.ink2 }}>
                Fee ~$1+
              </span>
            </div>
          ) : (
            <LightSelect
              ariaLabel="Network"
              value={network}
              onChange={(v) => setNetwork(v as Net)}
              options={NETWORKS.map((n) => ({
                value: n.value,
                label: n.label,
                hint: n.soon ? 'Soon' : `Fee ${n.fee}`,
                disabled: n.soon,
              }))}
            />
          )}
        </div>
      </div>
      <div className="mt-3">
        <Callout variant="warning">
          {coin === 'btc'
            ? 'Only send Bitcoin on the Bitcoin network — funds sent on other networks cannot be recovered.'
            : 'Only send the selected coin on the selected network — funds sent on other networks cannot be recovered.'}
        </Callout>
      </div>
    </div>
  )

  const radioDot = (checked: boolean) => (
    <span
      aria-hidden
      className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full"
      style={{ boxShadow: `inset 0 0 0 1.5px ${checked ? T.forest : T.disLine}` }}
    >
      {checked && <span className="h-[9px] w-[9px] rounded-full" style={{ background: T.forest }} />}
    </span>
  )

  const paymentList = (
    <div className="flex flex-col gap-3" role="radiogroup" aria-label="Payment Method">
      {/* Crypto — expands when selected */}
      <div
        className="rounded-lg bg-white"
        style={{
          boxShadow: `inset 0 0 0 1.5px ${payMethod === 'crypto' ? T.forest : T.line}`,
        }}
      >
        <button
          type="button"
          role="radio"
          aria-checked={payMethod === 'crypto'}
          onClick={() => setPayMethod('crypto')}
          className="flex w-full items-center gap-3 p-4 text-left"
        >
          {radioDot(payMethod === 'crypto')}
          <span className="text-[15px] font-semibold" style={{ color: T.ink }}>
            Crypto
          </span>
          {payMethod === 'crypto' && (
            <span
              className="rounded-md px-[7px] py-[3px] text-[11px] font-semibold"
              style={{ background: T.limeTint, color: T.forest }}
            >
              No Fees
            </span>
          )}
          <span
            className="rounded-md px-[7px] py-[3px] text-[11px] font-semibold text-white"
            style={{ background: T.forest }}
          >
            Most Popular
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            <Image src="/crypto/btc.svg" alt="Bitcoin" width={20} height={20} unoptimized />
            <Image src="/crypto/usdt.svg" alt="USDT" width={20} height={20} unoptimized />
          </span>
        </button>
        {payMethod === 'crypto' && cryptoBody}
      </div>

      {/* Payssion local methods — live, selectable */}
      {LOCAL_METHODS.map((m) => {
        const checked = payMethod === m.id
        return (
          <div
            key={m.id}
            className="rounded-lg bg-white"
            style={{ boxShadow: `inset 0 0 0 1.5px ${checked ? T.forest : T.line}` }}
          >
            <button
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => setPayMethod(m.id)}
              className="flex w-full items-center gap-3 p-4 text-left"
            >
              {radioDot(checked)}
              <m.Icon className="h-[18px] w-[18px] shrink-0" style={{ color: T.forest }} />
              <span className="text-[15px] font-semibold" style={{ color: T.ink }}>
                {m.label}
              </span>
              <span
                className="ml-auto rounded-md px-[7px] py-[3px] text-[11px] font-semibold"
                style={{ background: '#EFEFEA', color: '#6B7166' }}
              >
                {m.region}
              </span>
            </button>
            {checked && (
              <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: T.line }}>
                <p className="text-[12.5px] leading-relaxed" style={{ color: T.ink2 }}>
                  {m.note}
                </p>
              </div>
            )}
          </div>
        )
      })}

      {/* Disabled methods */}
      {SOON_METHODS.map((m) => (
        <div
          key={m.name}
          aria-disabled="true"
          className="flex items-center gap-3 rounded-lg border px-4 py-3.5"
          style={{ background: T.row, borderColor: T.line }}
        >
          <span
            className="h-[18px] w-[18px] shrink-0 rounded-full"
            style={{ boxShadow: `inset 0 0 0 1.5px ${T.disLine}` }}
          />
          <span className="text-[15px] font-medium" style={{ color: T.dis }}>
            {m.name}
          </span>
          <span
            className="rounded-md px-[7px] py-[3px] text-[11px] font-semibold"
            style={{ background: '#EFEFEA', color: '#8A9086' }}
          >
            Soon
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            {m.badges.map((b) => (
              <span
                key={b}
                className="rounded border bg-white px-1.5 py-[2px] text-[10px] font-bold tracking-[0.04em]"
                style={{ borderColor: T.line, color: T.dis }}
              >
                {b}
              </span>
            ))}
          </span>
        </div>
      ))}
    </div>
  )

  const summaryCard = (compact = false) => (
    <div className="rounded-lg border bg-white p-5" style={{ borderColor: T.line }}>
      {/* Item */}
      <div className="flex items-center gap-3.5">
        <Image
          src={imageSrc}
          alt={title}
          width={56}
          height={56}
          unoptimized
          className="h-14 w-14 shrink-0 rounded-lg object-cover"
          style={{ background: T.ivory2 }}
        />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold" style={{ color: T.ink }}>
            {title}
          </p>
          {(listing.game?.name || listing.category?.name) && (
            <p className="mt-0.5 truncate text-[12px]" style={{ color: T.ink2 }}>
              {listing.game?.name}
              {listing.game?.name && listing.category?.name && ' · '}
              {listing.category?.name}
            </p>
          )}
        </div>
      </div>

      {/* Spec rows — full card width */}
      <div className="mt-3 divide-y text-[12.5px]">
        <div className="flex items-center justify-between gap-4 py-[7px]" style={{ borderColor: '#EFEDE6' }}>
          <span style={{ color: T.ink2 }}>Delivery Time</span>
          <span className="font-medium" style={{ color: T.ink }}>
            {fmtDelivery(deliveryTime)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 py-[7px]" style={{ borderColor: '#EFEDE6' }}>
          <span style={{ color: T.ink2 }}>Quantity</span>
          <span className="font-medium" style={{ color: T.ink }}>
            {quantity.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Seller */}
      <div className="mt-4 flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={getAvatarUrl(seller.avatar_url, sellerName)}
          alt={sellerName}
          className="h-10 w-10 shrink-0 rounded-full object-cover"
          style={{ background: T.ivory2 }}
        />
        <div className="min-w-0">
          <span className="flex items-center gap-1.5 text-[14px] font-semibold" style={{ color: T.ink }}>
            <span className="truncate">{sellerName}</span>
            {isVerifiedSeller && (
              <BadgeCheck
                aria-label="Verified Seller"
                className="h-[17px] w-[17px] shrink-0"
                style={{ fill: '#1D9BF0', color: '#FFFFFF' }}
              />
            )}
            <TierBadge tier={seller.seller_tier} />
          </span>
          {(reviewCount > 0 || Number(seller.total_sales ?? 0) > 0) && (
            <p className="mt-0.5 flex items-center gap-2 text-[12px]" style={{ color: T.ink2 }}>
              {positivePct !== null && <span>{positivePct.toFixed(0)}% Rating</span>}
              {positivePct !== null && Number(seller.total_sales ?? 0) > 0 && (
                <span className="opacity-40">|</span>
              )}
              {Number(seller.total_sales ?? 0) > 0 && (
                <span>{Number(seller.total_sales).toLocaleString()} Sold</span>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Discount code — collapsed behind a toggle */}
      {!compact && (
        <div className="mt-4">
          {!promoResult?.valid && (
            <button
              type="button"
              onClick={() => setCodeOpen((v) => !v)}
              className="flex w-full items-center gap-2 text-[12.5px] font-semibold transition-opacity hover:opacity-75"
              style={{ color: T.forest2 }}
            >
              <Tag className="h-3.5 w-3.5" />
              Have A Discount Code?
              <ChevronDown
                className={cn('h-3.5 w-3.5 transition-transform', codeOpen && 'rotate-180')}
              />
            </button>
          )}
          <AnimatePresence initial={false}>
            {(codeOpen || promoResult?.valid) && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="overflow-hidden"
              >
                <div className={cn('flex gap-2', !promoResult?.valid && 'mt-2.5')}>
                  {promoResult?.valid ? (
            <div
              className="flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-[13px] font-semibold"
              style={{ background: T.limeTint, borderColor: T.line, color: T.forest }}
            >
              <span className="truncate">Code Applied: {promoResult.code}</span>
              <button type="button" onClick={handleRemovePromo} aria-label="Remove Code">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <>
              <input
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleApplyPromo()
                }}
                placeholder="Discount Code"
                className="h-[38px] min-w-0 flex-1 rounded-md border px-2.5 text-[13px] outline-none transition-colors focus:border-[#14432A]"
                style={{ borderColor: T.line, background: T.ivory, color: T.ink }}
              />
              <button
                type="button"
                onClick={() => void handleApplyPromo()}
                disabled={promoValidating}
                className="h-[38px] rounded-md border px-3.5 text-[13px] font-semibold transition-colors disabled:opacity-60"
                style={{ borderColor: T.forest, color: T.forest }}
              >
                {promoValidating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Apply'}
              </button>
            </>
          )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Money summary */}
      <div className="mt-4 flex flex-col gap-2 border-t pt-3.5 text-[14px]" style={{ borderColor: T.line }}>
        <Row label="Subtotal" value={`$${subtotal.toFixed(2)}`} />
        <Row
          label={MARKETPLACE_FEE_LABEL}
          value={`+$${fee.marketplaceAmount.toFixed(2)}`}
          infoTitle="Marketplace Fee"
          infoBadge={`${fee.marketplacePct}%`}
          info="Platform & buyer protection."
        />
        <Row
          label={PROCESSING_FEE_LABEL}
          value={`+$${fee.processingAmount.toFixed(2)}`}
          infoTitle="Processing Fee"
          infoBadge={`${fee.processingPct}%`}
          info="Covers payment processing."
        />
        {promoDiscount > 0 && (
          <Row label="Discount" value={`−$${promoDiscount.toFixed(2)}`} valueColor={T.forest2} />
        )}
        {walletBalance > 0 && (
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2" style={{ color: T.ink2 }}>
              Store Credit
              <InfoDot text={`You have $${walletBalance.toFixed(2)} store credit available.`} />
              <MiniSwitch
                on={useWallet}
                onToggle={() => setUseWallet((v) => !v)}
                label="Apply Store Credit"
              />
            </span>
            <span className="tabular-nums font-medium" style={{ color: useWallet ? T.forest2 : T.ink }}>
              −${walletAmount.toFixed(2)}
            </span>
          </div>
        )}
        <div
          className="mt-1 flex items-center justify-between gap-3 border-t pt-3"
          style={{ borderColor: T.line }}
        >
          <span className="text-[15px] font-semibold" style={{ color: T.ink }}>
            Total
          </span>
          <span className="text-[22px] font-bold tabular-nums tracking-tight" style={{ color: T.ink }}>
            ${total.toFixed(2)}
          </span>
        </div>
        {dcEarned > 0 && (
          <div className="flex justify-end">
            <span
              className="rounded-md px-2 py-[3px] text-[12px] font-semibold"
              style={{ background: T.limeTint, color: T.success }}
            >
              +{dcEarned} DC Earned
            </span>
          </div>
        )}
      </div>

      {/* SafeDrop line */}
      <div className="mt-3.5 flex items-center gap-2 border-t pt-3.5" style={{ borderColor: T.line }}>
        <ShieldCheck className="mt-[1px] h-[18px] w-[18px] shrink-0" style={{ color: T.forest }} />
        <div>
          <p className="text-[13.5px] font-semibold" style={{ color: T.ink }}>
            SafeDrop Protection
          </p>
          <p className="mt-0.5 text-[12.5px] font-medium leading-snug" style={{ color: T.ink }}>
            Get exactly what you ordered — or a 100% refund.
          </p>
          <p className="mt-0.5 text-[12px] leading-snug" style={{ color: T.ink2 }}>
            Every order is covered from purchase to delivery.
          </p>
        </div>
      </div>
      <TrustChips />
    </div>
  )

  return (
    <div className="min-h-screen" style={{ background: T.ivory }}>
      <CheckoutNavbar user={user} buyerProfile={buyerProfile} />

      <div className="mx-auto w-full max-w-[1120px] px-4 pb-24 pt-8 sm:px-10 lg:pb-[72px]">
        {/* Header row */}
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              aria-label="Go Back"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-md border bg-white/60 backdrop-blur-sm transition-colors hover:bg-white"
              style={{ borderColor: T.line, color: T.ink }}
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <Lock className="h-[18px] w-[18px] shrink-0" style={{ color: T.forest }} />
            {/* Phone: smaller + nowrap so the title never breaks into two
                lines beside the SSL chip. Desktop (sm:) unchanged. */}
            <span
              className="whitespace-nowrap text-[18px] font-bold sm:text-[24px]"
              style={{ color: T.ink }}
            >
              Secure Checkout
            </span>
          </span>
          <span
            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border bg-white px-2.5 py-1.5 text-[12px] font-semibold tracking-[0.01em] sm:text-[12.5px]"
            style={{ borderColor: T.line, color: T.ink }}
          >
            <ShieldCheck className="h-4 w-4" style={{ color: T.forest }} />
            {/* Phone: short label; desktop keeps the full one. */}
            <span className="sm:hidden">SSL Secure</span>
            <span className="hidden sm:inline">256-Bit SSL Secure</span>
          </span>
        </div>

        {/* Two columns (desktop) / stacked with summary first (mobile) */}
        <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_400px] lg:gap-8">
          {/* Mobile: summary card first */}
          <div className="lg:hidden">{summaryCard()}</div>

          <div>
            <p className="text-[18px] font-semibold" style={{ color: T.ink }}>
              Payment
            </p>
            <p className="mb-4 mt-1.5 text-[14px]" style={{ color: T.ink2 }}>
              All transactions are secure and encrypted.
            </p>
            {paymentList}
            {payError && (
              <p className="mt-3 text-[12.5px] font-medium text-red-600">{payError}</p>
            )}
            <div className="mt-5 hidden lg:block">{payButton()}</div>
            <p className="mt-2.5 hidden text-center text-[12px] lg:block" style={{ color: T.ink2 }}>
              By pressing Pay Now you agree to the{' '}
              <Link href="/terms" className="underline" style={{ color: T.forest2 }}>
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/refunds" className="underline" style={{ color: T.forest2 }}>
                Refund Policy
              </Link>
              .
            </p>
          </div>

          {/* Desktop: summary column */}
          <div className="hidden lg:block">{summaryCard()}</div>
        </div>

        <CompanyStrip />
      </div>

      {/* Mobile sticky pay bar. Bottom padding hugs the browser chrome:
          12px base, or the home-indicator inset when the browser bar sits
          on top (Chrome/top-bar Safari) and exposes the safe area. */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-white px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 lg:hidden"
        style={{ borderColor: T.line }}
      >
        {payButton()}
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  info,
  infoTitle,
  infoBadge,
  valueColor,
}: {
  label: string
  value: string
  info?: string
  infoTitle?: string
  infoBadge?: string
  valueColor?: string
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2" style={{ color: T.ink2 }}>
        {label}
        {info && <InfoDot text={info} title={infoTitle} badge={infoBadge} />}
      </span>
      <span className="tabular-nums font-medium" style={{ color: valueColor ?? T.ink }}>
        {value}
      </span>
    </div>
  )
}
