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
  CreditCard,
  LogOut,
  Medal,
  Package,
  Settings,
  Landmark,
  LifeBuoy,
  QrCode,
  ShieldCheck,
  Smartphone,
  Store,
  Barcode,
  Zap,
  Tag,
  TriangleAlert,
  Undo2,
  Wallet,
  X,
} from 'lucide-react'

import { createCheckout } from '@/lib/actions/checkout'
import {
  payssionSelectorMethods,
  type PayssionMethodMeta,
} from '@/lib/payments/providers/payssion/methods'
import { getAvatarUrl } from '@/lib/utils/avatar'
import { validatePromoCode, type PromoValidationResult } from '@/lib/actions/promo'
import { getMyWalletBalance } from '@/lib/actions/wallet-ledger'
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
  { value: 'trc20', label: 'TRON · TRC20', fee: '$0.50' },
  { value: 'polygon', label: 'Polygon', fee: '$0.01' },
  { value: 'ethereum', label: 'Ethereum', fee: '$2+' },
]

// ─── Small pieces ───────────────────────────────────────────────────────────

/** Light dropdown per the handoff: 1px #E4E5DE border, radius 6, ivory bg. */
function LightSelect({
  value,
  onChange,
  options,
  ariaLabel,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string; icon?: string; hint?: string; disabled?: boolean }>
  ariaLabel: string
  placeholder?: string
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
          {selected ? (
            <span className="truncate">{selected.label}</span>
          ) : (
            <span className="truncate" style={{ color: T.ink2 }}>
              {placeholder ?? 'Select'}
            </span>
          )}
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

/** A — quiet inline trust signals (no chrome; they live in the trust
 *  band's header row). */
function TrustChips() {
  const item = 'inline-flex items-center gap-1.5 whitespace-nowrap text-[11.5px] font-semibold'
  const ic = { color: T.forest } as const
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      <span className={item} style={{ color: T.ink }}>
        <ShieldCheck className="h-3.5 w-3.5 shrink-0" style={ic} /> SafeDrop Guarantee
      </span>
      <span className={item} style={{ color: T.ink }}>
        <BadgeCheck className="h-3.5 w-3.5 shrink-0" style={ic} /> ID-Verified Sellers
      </span>
      <Link
        href="/refunds"
        className={`${item} underline-offset-2 transition-colors hover:underline`}
        style={{ color: T.ink }}
      >
        <Undo2 className="h-3.5 w-3.5 shrink-0" style={ic} /> Refund Policy
      </Link>
    </div>
  )
}

/** C — thin full-width checkout footer: company identity, payment
 *  security line, support + legal links. Edge-to-edge with a top hairline;
 *  content aligns to the checkout container. */
function CompanyStrip() {
  const link = 'transition-colors hover:text-[#14432A]'
  return (
    <footer className="border-t bg-white" style={{ borderColor: T.line }}>
      <div className="mx-auto flex w-full max-w-[1120px] flex-col items-center justify-between gap-2.5 px-4 py-4 sm:px-10 lg:flex-row lg:py-3.5">
        <div className="flex flex-col items-center gap-2 lg:flex-row lg:gap-6">
          <span className="flex items-center gap-2 text-[11.5px]" style={{ color: T.ink2 }}>
            <Landmark className="h-4 w-4 shrink-0" style={{ color: T.forest }} />
            <span>
              <b className="font-semibold" style={{ color: T.ink }}>DropMarket Ltd</b>
              <span className="hidden sm:inline"> · Registered In The United Kingdom · Company No. 17309867</span>
              <span className="sm:hidden"> · Registered In The UK</span>
            </span>
          </span>
          <span className="flex items-center gap-2 text-[11.5px]" style={{ color: T.ink2 }}>
            <Lock className="h-4 w-4 shrink-0" style={{ color: T.forest }} />
            <span>
              Secured By <b className="font-semibold" style={{ color: T.ink }}>DropMarket Payments</b>
            </span>
          </span>
        </div>
        <nav className="flex items-center gap-4 text-[11.5px] font-medium" style={{ color: T.ink2 }}>
          <Link href="/support" className={`${link} flex items-center gap-1.5`}>
            <LifeBuoy className="h-3.5 w-3.5" style={{ color: T.forest }} />
            Support
          </Link>
          <span aria-hidden className="h-3 w-px" style={{ background: T.line }} />
          <Link href="/terms" className={link}>Terms</Link>
          <Link href="/refunds" className={link}>Refunds</Link>
          <Link href="/privacy" className={link}>Privacy</Link>
        </nav>
      </div>
      {/* clearance for the mobile sticky pay bar */}
      <div className="h-20 lg:hidden" />
    </footer>
  )
}

// Payssion local methods come FROM THE PROVIDER REGISTRY (methods.ts) —
// pm_ids, labels, region chips, display order and country tags all live
// there. This map only adds what the registry shouldn't know: the icon and
// the buyer-facing note. Adding a method later = registry entry + one line
// here (a missing line still renders, with the fallback icon/note).
type PayMethodId = 'crypto' | (string & {})
const METHOD_UI: Record<string, { Icon: typeof Smartphone; points: string[]; logo?: string }> = {
  pix_br: {
    logo: '/payments/pix_br.svg',
    Icon: Zap,
    points: ['Scan the QR with your bank app', 'Payment confirms instantly'],
  },
  gcash_ph: {
    logo: '/payments/gcash_ph.svg',
    Icon: Smartphone,
    points: ['Approve the payment in GCash', 'Payment confirms instantly'],
  },
  maya_ph: {
    logo: '/payments/maya_ph.svg',
    Icon: Smartphone,
    points: ['Approve the payment in Maya', 'Payment confirms instantly'],
  },
  qr_ph: {
    logo: '/payments/qr_ph.svg',
    Icon: QrCode,
    points: ['Scan with any PH bank or wallet app', 'Payment confirms instantly'],
  },
  qris_id: {
    logo: '/payments/qris_id.svg',
    Icon: QrCode,
    points: ['Scan with GoPay, OVO, DANA & more', 'Payment confirms instantly'],
  },
  oxxo_mx: {
    logo: '/payments/oxxo_mx.svg',
    Icon: Store,
    points: ['Pay cash at any OXXO store', 'Voucher valid 48 hours', 'Clears within a day'],
  },
  spei_mx: {
    Icon: Landmark,
    points: ['Transfer from your bank app', 'Usually clears in minutes'],
  },
  boleto_br: {
    Icon: Barcode,
    points: ['Pay the slip via bank app or in person', 'Valid 48 hours', 'Clears in 1 to 2 business days'],
  },
  pse_co: {
    Icon: Landmark,
    points: ['Approve in your bank portal', 'Payment confirms instantly'],
  },
  webpay_cl: {
    Icon: Landmark,
    points: ['Approve on the WebPay page', 'Payment confirms instantly'],
  },
}
const FALLBACK_UI = {
  Icon: Landmark,
  points: ['Redirects to a secure payment page', 'Order starts once payment confirms'],
}

interface LocalMethodRow {
  id: string
  label: string
  region: string
  /** Real brand mark (public/payments/*.svg); Icon is the fallback. */
  logo?: string
  /** Emoji flag for the region chip: country flag, or 🌍 for multi-country. */
  flag: string
  countries: string[]
  Icon: typeof Smartphone
  points: string[]
}

/** ISO-3166 alpha-2 → emoji flag (regional-indicator pair). */
function ccFlag(cc: string): string {
  if (!/^[A-Za-z]{2}$/.test(cc)) return '🌍'
  return String.fromCodePoint(
    ...[...cc.toUpperCase()].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65)
  )
}

/** ISO code → English country name (Intl built-in; falls back to the code). */
const regionNames =
  typeof Intl !== 'undefined' && 'DisplayNames' in Intl
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : null
function countryName(cc: string): string {
  try {
    return regionNames?.of(cc.toUpperCase()) ?? cc.toUpperCase()
  } catch {
    return cc.toUpperCase()
  }
}

function toRow(m: PayssionMethodMeta): LocalMethodRow {
  const ui = METHOD_UI[m.pmId] ?? FALLBACK_UI
  return {
    id: m.pmId,
    label: m.label,
    region: m.coverage,
    logo: ui.logo,
    flag: m.countries.length === 1 ? ccFlag(m.countries[0]) : '🌍',
    countries: m.countries,
    Icon: ui.Icon,
    points: ui.points,
  }
}

// ─── CheckoutForm ───────────────────────────────────────────────────────────

interface CheckoutFormProps {
  listing: any
  user: any
  buyerProfile?: { username: string | null; avatar_url: string | null } | null
  sellerReviews?: any[]
  initialQty?: number
  bundleSummary?: { name: string; iconUrl: string | null } | null
  /** ISO-3166 alpha-2 from the Vercel geo header; null/undefined → show all. */
  buyerCountry?: string | null
}

export function CheckoutForm({ listing, user, buyerProfile, sellerReviews = [], initialQty, bundleSummary, buyerCountry }: CheckoutFormProps) {
  const router = useRouter()

  // Tabbed selector: Crypto | E-Wallet | Card (soon). Local methods live in
  // the E-Wallet tab, filtered by a country pin that defaults to the buyer's
  // geo country (G2A pattern). Rows and countries derive from the provider
  // registry, so new methods surface automatically.
  const allLocalRows = payssionSelectorMethods().map(toRow)
  const geoCc = (buyerCountry ?? '').trim().toUpperCase()
  const geoValid = /^[A-Z]{2}$/.test(geoCc)
  // Country options: every country with a method (registry order) + the
  // buyer's own geo country even at 0 methods (honest empty state beats a
  // silently wrong pin).
  const localCountries: Array<{ cc: string; count: number }> = []
  for (const row of allLocalRows) {
    for (const cc of row.countries) {
      const hit = localCountries.find((c) => c.cc === cc)
      if (hit) hit.count += 1
      else localCountries.push({ cc, count: 1 })
    }
  }
  if (geoValid && !localCountries.some((c) => c.cc === geoCc)) {
    localCountries.unshift({ cc: geoCc, count: 0 })
  }
  const [payCategory, setPayCategory] = useState<'crypto' | 'ewallet'>('crypto')
  // '' = no country chosen yet (unknown geo) — the tab shows a chooser
  // prompt instead of dumping every method.
  const [walletCountry, setWalletCountry] = useState<string>(geoValid ? geoCc : '')

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
  const walletRows =
    walletCountry === ''
      ? []
      : allLocalRows.filter(
          // The selected method never disappears when the country filter
          // changes — the buyer's active choice must stay visible.
          (r) => r.countries.includes(walletCountry) || r.id === payMethod
        )

  // Switching tabs keeps payMethod coherent: Crypto tab pays with crypto;
  // the E-Wallet tab auto-selects its first visible method.
  const selectCategory = (cat: 'crypto' | 'ewallet') => {
    setPayCategory(cat)
    if (cat === 'crypto') {
      setPayMethod('crypto')
    } else if (payMethod === 'crypto' && walletRows.length > 0) {
      setPayMethod(walletRows[0].id)
    }
  }
  // Coin + network selection (within the crypto card).
  // No coin preselected — the network chooser stays closed until a pick.
  const [coin, setCoin] = useState<Coin | null>(null)
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

  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      // Ledger-backed balance (wallet_balances is archived); matches the
      // server-side debit in createCheckout.
      const result = await getMyWalletBalance()
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
  // Crypto needs a coin picked before Pay makes sense.
  const payDisabled = paying || (payMethod === 'crypto' && !coin)
  const handlePay = async () => {
    if (payMethod === 'crypto' && !coin) return
    setPaying(true)
    setPayError(null)
    // Provider-hosted methods open in a NEW tab so DropMarket never
    // disappears (some cashier pages — GCash — have no back/cancel at all).
    // The tab must be claimed HERE, synchronously with the click, or popup
    // blockers kill it; it shows a holding line until the charge exists.
    let payTab: Window | null = null
    if (payMethod !== 'crypto') {
      payTab = window.open('', '_blank')
      try {
        payTab?.document.write(
          '<title>Secure Payment</title><p style="font-family:system-ui;padding:24px;color:#1A1D19">Opening your secure payment page…</p>'
        )
      } catch {}
    }
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
        payTab?.close()
        setPayError(result.error || 'Checkout failed')
        toast.error(result.error || 'Checkout failed')
        setPaying(false)
        return
      }
      if (result.fullyPaidByWallet && result.orderId) {
        payTab?.close()
        toast.success('Paid From Wallet — redirecting to your order…')
        router.push(`/orders/${result.orderId}`)
        return
      }
      if (result.checkoutUrl) {
        if (payMethod !== 'crypto') {
          if (payTab) {
            // Payment in the new tab; THIS tab parks on the order page,
            // which carries Resume Payment / Cancel Order / the countdown —
            // the buyer's way back no matter what the cashier page allows.
            payTab.location.href = result.checkoutUrl
            if (result.orderId) router.push(`/account/orders/${result.orderId}`)
            setPaying(false)
            return
          }
          // Popup blocked → same-tab redirect (old behavior).
          window.location.href = result.checkoutUrl
          return
        }
        // Carry the chosen network so the payment page preselects its tab.
        const sep = result.checkoutUrl.includes('?') ? '&' : '?'
        window.location.href = `${result.checkoutUrl}${sep}coin=${coin}&net=${network}`
        return
      }
      payTab?.close()
      setPayError('No checkout URL returned')
      setPaying(false)
    } catch (err: any) {
      payTab?.close()
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
  // Every seller is KYC-verified; the blue badge keys purely on is_verified.
  const isVerifiedSeller = !!seller.is_verified
  const positivePct = reviewCount > 0 ? Math.min(100, (Number(seller.seller_rating ?? 0) / 5) * 100) : null
  const deliveryTime = listing.delivery_time || 'Instant'

  const selectedNet = NETWORKS.find((n) => n.value === network)!

  // ── Shared blocks (desktop + mobile) ──────────────────────────────

  const payButton = (extraClass = '') => (
    <button
      type="button"
      onClick={() => void handlePay()}
      disabled={payDisabled}
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
    <div className="rounded-lg bg-white p-4" style={{ boxShadow: `inset 0 0 0 1.5px ${T.line}` }}>
      <div className="mb-2.5 flex items-center gap-2">
        <p className="text-[15px] font-bold" style={{ color: T.ink }}>
          Choose Coin
        </p>
        <span
          className="rounded-md px-[7px] py-[3px] text-[11px] font-semibold"
          style={{ background: T.limeTint, color: T.forest }}
        >
          No Fees
        </span>
      </div>
      {/* Coin tiles — USDT opens a network chooser below; BTC is pick-and-pay. */}
      <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Coin">
        {COINS.map((c) => {
          const selected = coin === c.value
          return (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setCoin(c.value)}
              className="flex items-center gap-2.5 rounded-md px-3.5 py-3 text-left transition-[box-shadow,transform] active:scale-[0.98]"
              style={{
                boxShadow: `inset 0 0 0 1.5px ${selected ? T.forest : T.line}`,
                background: selected ? T.ivory : '#FFFFFF',
              }}
            >
              <Image src={c.icon} alt="" width={22} height={22} unoptimized />
              <span className="text-[14px] font-semibold" style={{ color: T.ink }}>
                {c.label}
              </span>
              {selected && <Check className="ml-auto h-4 w-4 shrink-0" style={{ color: T.forest }} />}
            </button>
          )
        })}
      </div>
      {/* Network + send-warning stay closed until a coin is picked. */}
      <AnimatePresence initial={false}>
        {coin && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="mt-4">
              <p className="mb-2.5 flex items-center gap-1.5 text-[15px] font-bold" style={{ color: T.ink }}>
                {coin === 'btc' ? 'Network' : 'Choose Network'}
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
                    Est. Fee $1+
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
                    hint: n.soon ? 'Soon' : `Est. Fee ${n.fee}`,
                    disabled: n.soon,
                  }))}
                />
              )}
            </div>
            <div className="mt-3">
              <Callout variant="warning">
                {coin === 'btc'
                  ? 'Only send Bitcoin on the Bitcoin network — funds sent on other networks cannot be recovered.'
                  : 'Only send the selected coin on the selected network — funds sent on other networks cannot be recovered.'}
              </Callout>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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

  const renderLocalRow = (m: LocalMethodRow) => {
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
          {m.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={m.logo} alt="" className="h-5 w-auto max-w-[84px] shrink-0 object-contain" />
          ) : (
            <m.Icon className="h-[18px] w-[18px] shrink-0" style={{ color: T.forest }} />
          )}
          <span className="text-[15px] font-semibold" style={{ color: T.ink }}>
            {m.label}
          </span>
          {/* Region chip only when it ADDS info — i.e. the row's country
              differs from the selector (a kept selection after a country
              switch). Same-country chips just repeat the pin. */}
          {!m.countries.includes(walletCountry) && (
            <span
              className="ml-auto rounded-md px-[7px] py-[3px] text-[11px] font-semibold"
              style={{ background: '#EFEFEA', color: '#6B7166' }}
            >
              {m.flag} {m.region}
            </span>
          )}
        </button>
        {checked && (
          <div className="border-t px-4 pb-3.5 pt-3" style={{ borderColor: T.line }}>
            <ul className="flex flex-col gap-1.5">
              {m.points.map((pt) => (
                <li key={pt} className="flex items-center gap-2 text-[12.5px]" style={{ color: T.ink2 }}>
                  <Check className="h-3.5 w-3.5 shrink-0" style={{ color: T.forest }} />
                  {pt}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

  // ── Category tab bar: Crypto | E-Wallet | Card (soon) ─────────────
  const categoryTab = (cat: 'crypto' | 'ewallet', icon: React.ReactNode, label: string) => {
    const active = payCategory === cat
    return (
      <button
        type="button"
        role="tab"
        aria-selected={active}
        onClick={() => selectCategory(cat)}
        className="flex h-11 items-center justify-center gap-2 rounded-md text-[13.5px] font-semibold transition-colors active:scale-[0.98]"
        style={
          active
            ? { background: T.forest, color: '#FFFFFF' }
            : { background: '#FFFFFF', color: T.ink, boxShadow: `inset 0 0 0 1.5px ${T.line}` }
        }
      >
        {icon}
        {label}
      </button>
    )
  }

  /** Small tinted circle behind a stroke icon — lifts it off the pill. */
  const tabIconChip = (Icon: typeof Wallet, active: boolean, disabled = false) => (
    <span
      className="grid h-6 w-6 shrink-0 place-items-center rounded-full"
      style={{
        background: active ? 'rgba(255,255,255,0.16)' : disabled ? '#EFEFEA' : T.ivory2,
      }}
    >
      <Icon className="h-3.5 w-3.5" />
    </span>
  )

  const walletCountryMeta = localCountries.find((c) => c.cc === walletCountry)

  const paymentList = (
    <div className="flex flex-col gap-3">
      <div role="tablist" aria-label="Payment Type" className="grid grid-cols-3 gap-2">
        {categoryTab(
          'crypto',
          // Real coin marks, overlapped — instantly readable as crypto.
          <span className="flex shrink-0 -space-x-1.5">
            <Image
              src="/crypto/btc.svg"
              alt=""
              width={18}
              height={18}
              unoptimized
              className="rounded-full ring-2"
              style={{ ['--tw-ring-color' as string]: payCategory === 'crypto' ? T.forest : '#FFFFFF' }}
            />
            <Image
              src="/crypto/usdt.svg"
              alt=""
              width={18}
              height={18}
              unoptimized
              className="rounded-full ring-2"
              style={{ ['--tw-ring-color' as string]: payCategory === 'crypto' ? T.forest : '#FFFFFF' }}
            />
          </span>,
          'Crypto'
        )}
        {categoryTab('ewallet', tabIconChip(Wallet, payCategory === 'ewallet'), 'E-Wallet')}
        {/* Cards ship with the card acquirer — greyed, not clickable. */}
        <button
          type="button"
          role="tab"
          aria-selected={false}
          disabled
          className="flex h-11 cursor-not-allowed items-center justify-center gap-2 rounded-md text-[13.5px] font-medium"
          style={{ background: T.row, color: T.dis, boxShadow: `inset 0 0 0 1.5px ${T.disLine}` }}
        >
          {tabIconChip(CreditCard, false, true)}
          Card
          <span
            className="rounded-md px-[6px] py-[2px] text-[10.5px] font-semibold"
            style={{ background: '#EFEFEA', color: '#8A9086' }}
          >
            Soon
          </span>
        </button>
      </div>

      {payCategory === 'crypto' && cryptoBody}

      {payCategory === 'ewallet' && (
        <div className="flex flex-col gap-3">
          {/* Country pin — only the chosen country's methods ever render. */}
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <span className="text-[12px] font-semibold" style={{ color: T.ink2 }}>
              {walletCountry === '' ? 'Choose Your Country' : 'Paying From Another Country?'}
            </span>
            <div className="w-[210px] shrink-0 max-[420px]:w-full">
              <LightSelect
                ariaLabel="Country"
                placeholder="🌍 Select Country"
                value={walletCountry}
                onChange={(v) => {
                  setWalletCountry(v)
                  // Picking a country on this tab means "pay locally" — line
                  // up its first method unless the current pick still fits.
                  const rows = allLocalRows.filter((r) => r.countries.includes(v))
                  if (!rows.some((r) => r.id === payMethod)) {
                    if (rows.length > 0) setPayMethod(rows[0].id)
                    else setPayMethod('crypto')
                  }
                }}
                options={localCountries.map((c) => ({
                  value: c.cc,
                  label: `${ccFlag(c.cc)} ${countryName(c.cc)}`,
                  hint: `${c.count}`,
                }))}
              />
            </div>
          </div>

          {walletCountry === '' ? (
            /* No geo signal — ask, don't dump the whole catalog. */
            <div
              className="rounded-lg border px-5 py-6 text-center"
              style={{ background: T.row, borderColor: T.line }}
            >
              <p className="text-[14px] font-semibold" style={{ color: T.ink }}>
                Local Methods Are Country-Specific
              </p>
              <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: T.ink2 }}>
                Choose your country above to see the wallets and bank options available to you.
              </p>
            </div>
          ) : walletRows.length > 0 ? (
            <div className="flex flex-col gap-3" role="radiogroup" aria-label="Payment Method">
              <AnimatePresence initial={false} mode="popLayout">
                {walletRows.map((m) => (
                  <motion.div
                    key={m.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.16, ease: 'easeOut' }}
                  >
                    {renderLocalRow(m)}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            /* No local rails for this country yet — point at crypto. */
            <div
              className="rounded-lg border px-5 py-6 text-center"
              style={{ background: T.row, borderColor: T.line }}
            >
              <p className="text-[14px] font-semibold" style={{ color: T.ink }}>
                No Local Methods for {walletCountryMeta ? ccFlag(walletCountryMeta.cc) : '🌍'}{' '}
                {walletCountryMeta ? countryName(walletCountryMeta.cc) : 'Your Region'} Yet
              </p>
              <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: T.ink2 }}>
                Crypto works everywhere, with no processing fees. Or pick another country above.
              </p>
              <button
                type="button"
                onClick={() => selectCategory('crypto')}
                className="mt-3 rounded-md px-4 py-2 text-[13px] font-semibold text-white transition-colors"
                style={{ background: T.forest }}
                onMouseEnter={(e) => (e.currentTarget.style.background = T.forest2)}
                onMouseLeave={(e) => (e.currentTarget.style.background = T.forest)}
              >
                Pay With Crypto
              </button>
            </div>
          )}
        </div>
      )}
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
          <p className="line-clamp-2 text-[15px] font-semibold leading-snug" style={{ color: T.ink }}>
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
      </div>

    </div>
  )

  return (
    <div className="min-h-screen" style={{ background: T.ivory }}>
      <CheckoutNavbar user={user} buyerProfile={buyerProfile} />

      <div className="mx-auto w-full max-w-[1120px] px-4 pb-10 pt-8 sm:px-10 lg:pb-14">
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
            {/* Trust signals at the moment of commitment; the legal line
                shrinks to quiet microcopy underneath. */}
            <div className="mt-5 flex justify-center">
              <TrustChips />
            </div>
            <p
              className="mt-3 hidden text-center text-[11px] leading-relaxed lg:block"
              style={{ color: T.dis }}
            >
              By paying you agree to our{' '}
              <Link
                href="/terms"
                className="underline underline-offset-2 transition-colors hover:text-[#14432A]"
                style={{ color: T.ink2 }}
              >
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link
                href="/refunds"
                className="underline underline-offset-2 transition-colors hover:text-[#14432A]"
                style={{ color: T.ink2 }}
              >
                Refund Policy
              </Link>
            </p>

          </div>

          {/* Desktop: summary column */}
          <div className="hidden lg:block">{summaryCard()}</div>
        </div>

        {/* Trust hero band — centered title above, then a full-width strip:
            mirrored sky art behind everything under one smooth ivory wash,
            strong at the left, opening to color at the right. */}
        <p className="mb-4 mt-10 text-center text-[18px] font-semibold" style={{ color: T.ink }}>
          How Your Order Works
        </p>
        <div
          className="relative overflow-hidden rounded-md px-5 py-5 sm:px-8 sm:py-6"
          style={{ background: T.ivory2, boxShadow: `inset 0 0 0 1.5px ${T.line}` }}
        >
          {/* Full-bleed art (mirrored so the sky, not the cliff, sits
              behind the content) under one smooth left-to-right ivory wash:
              strong where text lives, fading to vivid art at the right. */}
          <Image
            src="/checkout/trust-hero.jpg"
            alt=""
            aria-hidden
            fill
            unoptimized
            className="pointer-events-none -scale-x-100 select-none object-cover object-[50%_10%]"
          />
          <div
            aria-hidden
            className="absolute inset-0 hidden sm:block"
            style={{
              background:
                'linear-gradient(90deg, rgba(250,250,247,0.93) 0%, rgba(250,250,247,0.87) 50%, rgba(250,250,247,0.68) 82%, rgba(250,250,247,0.35) 100%)',
            }}
          />
          {/* Phones: rows span the full width, so the wash is uniform. */}
          <div
            aria-hidden
            className="absolute inset-0 sm:hidden"
            style={{ background: 'rgba(250,250,247,0.9)' }}
          />
          <div className="relative">
            <ol className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-x-10 sm:gap-y-5 lg:grid-cols-4 lg:gap-x-7">
              {[
                {
                  Icon: CreditCard,
                  title: 'Choose Payment Method',
                  sub: 'Every payment is encryption-protected.',
                },
                {
                  Icon: Package,
                  title: 'Wait for Delivery',
                  sub: 'Your seller preps the order. Chat live anytime.',
                },
                {
                  Icon: BadgeCheck,
                  title: 'Order Delivered',
                  sub: 'Check your items and confirm delivery.',
                },
                {
                  Icon: Undo2,
                  title: 'Item Not Received?',
                  sub: '100% refund, guaranteed.',
                },
              ].map((step) => (
                <li key={step.title} className="flex items-start gap-2.5">
                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-white"
                    style={{ boxShadow: `inset 0 0 0 1.5px ${T.line}` }}
                  >
                    <step.Icon className="h-4 w-4" style={{ color: T.forest }} />
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold leading-snug" style={{ color: T.ink }}>
                      {step.title}
                    </p>
                    <p className="mt-0.5 text-[11.5px] leading-snug" style={{ color: T.ink2 }}>
                      {step.sub}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>

      </div>

      <CompanyStrip />

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
