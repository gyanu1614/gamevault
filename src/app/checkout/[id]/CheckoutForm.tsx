'use client'

/**
 * Checkout — "Ivory Ledger" rebuild (design_handoff_checkout Option 1a).
 *
 * Trust-first checkout: 64px navbar strip, then the marketplace's dark
 * surface with a two-column grid — Payment method list (crypto expanded
 * with Coin + Network dropdowns, amber network warning, Pay Now) on the
 * left, the compact white order-summary card (item, seller chips,
 * discount code, itemised fees, SafeDrop line) on the right. Mobile:
 * single column (summary card first) + sticky bottom Pay bar.
 *
 * All money logic preserved from the previous checkout: quantity comes
 * clamped from the ?qty deep-link, promo codes (validatePromoCode),
 * wallet Store Credit toggle, itemised buyer fee (the marketplace fee from
 * lib/fees; the PROCESSING fee per method is the database's quote, handed in
 * as `methods` by the page from the same eligibleMethods() call
 * createCheckout uses — checkout B3), DC cashback, and submit via
 * createCheckout (amounts recomputed server-authoritatively). The
 * chosen network rides to the payment page as ?net= so its coin tab
 * preselects.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from '@/components/navigation/AppLink'
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
  Smartphone,
  Tag,
  TriangleAlert,
  X,
} from 'lucide-react'

import { createCheckout, quoteCheckoutMethods } from '@/lib/actions/checkout'
import type { ClientMethod } from '@/lib/payments/eligibility'
import { orderMethodsForRegion, regionForCountry } from '@/lib/payments/regions'
import { countryName, flagEmoji } from '@/lib/geo/countries'
import { Combobox, type ComboboxOption } from '@/components/ui/combobox'
import { clampCheckoutQty } from './qty'
import { TILE_SLOT, markSize, methodIdForRow, toRow, walletRows, type LocalMethodRow, type MethodIcon } from './_method-ui'
import { useWalletAvailability } from './_wallets'
import { PANEL_CLASS, PANEL_STYLE, ROW_CHECKED_CLASS, ROW_CLASS, ROW_IDLE_CLASS, TILE_CLASS, rowStyle } from './_surfaces'
import { BuyerRating, CheckoutFooter, TRUST_BLUE, TrustList, TrustSeals } from './_trust'
import type { SiteRating } from '@/lib/reviews/site-rating'
import { lowestFeeMethodId } from '@/lib/payments/lowest-fee'
import { getAvatarUrl } from '@/lib/utils/avatar'
import { validatePromoCode, type PromoValidationResult } from '@/lib/actions/promo'
import { getMyWalletBalance } from '@/lib/actions/wallet-ledger'
import { cn } from '@/lib/utils'
import { useCoarsePointer } from '@/hooks/use-coarse-pointer'
import { SERVICE_FEE_LABEL } from '@/lib/fees'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { SilverIcon } from '@/components/ui/silver-icon'
import { CheckoutNavbar } from '../_components/CheckoutNavbar'
import { VerifiedBadge } from '@/components/seller/VerifiedBadge'
import { sellerStatText } from '@/lib/seller/stat-line'
import { track } from '@/lib/analytics/client'
import { DeliveryMethodInfo } from '@/components/marketplace/DeliveryMethodInfo'
import type { CurrencyDeliveryMethod } from '@/lib/types/category-configs'

// ─── Ivory Ledger tokens (design_handoff_checkout Option 1a) ────────────────
const T = {
  // Dark surfaces — the marketplace theme (src/styles/tokens.css): page
  // ground, raised card, input well, hover; glass = the listing page's card.
  page: '#16171B',
  ivory: '#1D1E23',
  ivory2: '#191A1F',
  row: '#24252B',
  glass: '#1D1E23',
  ink: '#E9EDF2',
  ink2: '#9AA6B3',
  dis: '#6C7684',
  forest: '#2A7A50',
  forest2: '#33935F',
  accentText: '#56B87F',
  lime: '#A3E635',
  limeTint: 'rgba(86,184,127,0.14)',
  success: '#3FD986',
  line: 'rgba(255,255,255,0.14)',
  lineSubtle: 'rgba(255,255,255,0.08)',
  disLine: 'rgba(255,255,255,0.22)',
  amberTx: '#FFB23E',
  amberIc: '#FFB23E',
  amberBg: 'rgba(255,178,62,0.12)',
  amberLn: 'rgba(255,178,62,0.35)',
  nav: '#16171B',
}

/** The country picker's "Other Country" value (no geo rails: crypto only). */
const OTHER_COUNTRY = 'other'

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

/** Dropdown on the dark surface: hairline border, radius 6, well bg. */
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
        className="flex h-[42px] w-full items-center justify-between gap-2 rounded-md border px-3 text-[14px] font-medium outline-none transition-colors focus-visible:border-focus-border"
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
          className="z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border bg-[#24252B] shadow-[0_18px_44px_rgba(0,0,0,0.6)]"
          style={{ borderColor: T.line }}
        >
          <Select.Viewport className="p-1">
            {options.map((o) => (
              <Select.Item
                key={o.value}
                value={o.value}
                disabled={o.disabled}
                className="flex cursor-pointer items-center justify-between gap-3 rounded px-2.5 py-2 text-[13.5px] font-medium outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-45 data-[highlighted]:bg-white/[0.08]"
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
                    <Check className="h-3.5 w-3.5" style={{ color: T.accentText }} />
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
            className="h-[14px] w-[14px] text-[#9AA6B3] transition-colors group-hover:text-[#E9EDF2]"
          />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="p-0"
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
            <p className="mt-1 w-max max-w-[280px] text-[12px] leading-snug" style={{ color: T.ink2 }}>
              {text}
            </p>
          </div>
        ) : (
          <p className="max-w-[280px] px-3 py-2 text-[12px] leading-snug" style={{ color: T.ink }}>
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
      ? { bg: 'rgba(255,178,62,0.10)', border: 'rgba(255,178,62,0.35)', text: '#FFB23E' }
      : { bg: 'rgba(63,217,134,0.10)', border: 'rgba(63,217,134,0.35)', text: '#3FD986' }
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

// Local-method rows (icon, buyer notes, logo, flag) come from ./_method-ui.
type PayMethodId = 'crypto' | (string & {})

/** "+ $1.20 · 5%" — the tile / badge fee line (checkout B3). */

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
  /** Checkout B3: the methods this order can be paid with + each one's quoted
   *  fee, from eligibleMethods() on the server (the same call createCheckout
   *  refuses against). Hidden / over-cap methods are already absent. */
  methods: ClientMethod[]
  /** Currency delivery method the seller hands the order over with, or null. */
  deliveryMethod?: CurrencyDeliveryMethod | null
  /** Back from a provider page with this listing's order still unpaid
   *  (?order=<id> on the URL): say so above the methods. */
  unfinishedPayment?: boolean
  /** Real average of visible buyer reviews; null hides the rating card. */
  siteRating?: SiteRating | null
}

export function CheckoutForm({ listing, user, buyerProfile, sellerReviews = [], initialQty, bundleSummary, buyerCountry, methods, deliveryMethod = null, unfinishedPayment = false, siteRating = null }: CheckoutFormProps) {
  const router = useRouter()

  // Flat selector (checkout regions, 2026-09-26): the buyer's own-country
  // rails, or the region's when the country has none, then Cryptocurrency
  // last (first and only when nothing else fits). The country comes from
  // geo; "Paying from … · Change" under the list lets a buyer on a VPN or
  // abroad pick theirs (owner 2026-10-19). Rows derive from the provider
  // registry, so new methods surface automatically.
  // The quotes start as the page's (promo 0, store credit 0) and are
  // re-quoted by quoteCheckoutMethods when the promo, the store-credit
  // toggle or the quantity changes — the SQL quote is the only fee math.
  const [quotedMethods, setQuotedMethods] = useState<ClientMethod[]>(methods)
  // The Stripe card row: worldwide, first for every buyer (owner 2026-10-27),
  // with this device's wallet (Apple Pay or Google Pay) above it once mounted.
  const cardRows = quotedMethods.filter((m) => m.kind === 'card').map(toRow)
  const wallets = useWalletAvailability()
  const walletRowList = wallets ? walletRows(cardRows[0] ?? null, wallets) : []
  const stripeRows = [...walletRowList, ...cardRows]
  const allLocalRows = quotedMethods.filter((m) => m.kind === 'local').map(toRow)
  // The crypto row for the env-active provider; absent = crypto is not
  // payable for this order (no fee row / hidden) and its row is not shown.
  const cryptoMethod = quotedMethods.find((m) => m.kind === 'crypto') ?? null
  const walletQuote = quotedMethods.find((m) => m.kind === 'wallet')?.quote ?? null
  const geoCc = (buyerCountry ?? '').trim().toUpperCase()
  const geo = /^[A-Z]{2}$/.test(geoCc) ? geoCc : null
  const [country, setCountry] = useState<string | null>(geo)
  const { local: localRows, regional: regionalRows } = orderMethodsForRegion(allLocalRows, regionForCountry(country), country)
  const orderedRows = [...stripeRows, ...localRows, ...regionalRows]
  // "Lowest Fee" tag: the cheapest of the buyer's OWN-country methods for
  // this order — never a regional rail they can't use (a Vietnamese buyer is
  // not pointed at Indonesia's QRIS) and never crypto. Re-derived from the
  // live quotes on every render.
  const lowestFeeId = lowestFeeMethodId(localRows)
  const coarse = useCoarsePointer()
  // The countries worth picking: every country one of this order's local
  // rails lists (sorted by name), plus the buyer's own, then Other Country.
  const countryOptions = useMemo<ComboboxOption[]>(() => {
    const codes = new Set<string>()
    for (const m of quotedMethods) if (m.kind === 'local') for (const c of m.countries) codes.add(c)
    if (geo) codes.add(geo)
    const named = [...codes].map((cc) => ({ cc, name: countryName(cc) })).sort((a, b) => a.name.localeCompare(b.name))
    return [
      ...named.map(({ cc, name }) => ({ value: cc, label: `${flagEmoji(cc)}  ${name}`, keywords: [name] })),
      { value: OTHER_COUNTRY, label: '🌍  Other Country' },
    ]
  }, [quotedMethods, geo])

  // Quantity comes clamped from the ?qty deep-link (chosen on the item page)
  // — the same clamp the page quoted the buyer fee for.
  const [quantity] = useState(() => clampCheckoutQty(listing, initialQty, !!bundleSummary))

  // Payment method: NOTHING is picked until the buyer taps a row (owner
  // call 2026-09-28) — Pay Now stays disabled until then.
  const [payMethod, setPayMethod] = useState<PayMethodId | null>(null)
  const selectedRow = orderedRows.find((r) => r.id === payMethod) ?? null
  // Switching country re-orders the list; a pick that is no longer listed
  // is cleared (crypto is always listed, so it survives).
  const selectCountry = (v: string) => {
    const cc = v === OTHER_COUNTRY ? null : v
    setCountry(cc)
    const next = orderMethodsForRegion(allLocalRows, regionForCountry(cc), cc)
    const rows = [...stripeRows, ...next.local, ...next.regional]
    if (payMethod && payMethod !== 'crypto' && !rows.some((r) => r.id === payMethod)) setPayMethod(null)
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

  // Growth point 1 — buyer funnel step 3. Once per listing; later quantity
  // changes are the same checkout.
  useEffect(() => {
    track('checkout_started', { listing_id: listing.id, qty: quantity, game: listing.game?.slug ?? null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listing.id])
  // The service fee (marketplace + processing) is the database's quote for
  // the picked method, promo and store credit. When store credit covers the
  // whole order at the wallet row's quote (zero fee), the order is a 'wallet'
  // order and that quote applies — exactly the routing createCheckout
  // performs, so page and snapshot agree to the cent.
  const methodQuote =
    payMethod == null
      ? null
      : payMethod === 'crypto'
        ? cryptoMethod?.quote ?? null
        : [...stripeRows, ...allLocalRows].find((r) => r.id === payMethod)?.quote ?? null
  const walletBalanceCents = Math.round(walletBalance * 100)
  const walletCoversAll = useWallet && walletQuote != null && walletBalanceCents >= walletQuote.totalMinor
  const activeQuote = walletCoversAll ? walletQuote : methodQuote
  const serviceFee = (activeQuote?.serviceFeeMinor ?? 0) / 100
  const walletAmountCents = useWallet && activeQuote ? Math.max(activeQuote.totalMinor - activeQuote.chargeMinor, 0) : 0
  const walletAmount = walletAmountCents / 100
  const total = activeQuote
    ? Math.max(activeQuote.totalMinor - walletAmountCents, 0) / 100
    : Math.max(subtotal - promoDiscount, 0)

  // Re-quote when an input that changes the fee changes (the first render
  // already holds the page's quote). Debounced; a stale answer is dropped.
  const promoCodeForQuote = promoResult?.valid ? promoResult.code : undefined
  const quoteSeq = useRef(0)
  const firstQuote = useRef(true)
  useEffect(() => {
    if (firstQuote.current) {
      firstQuote.current = false
      return
    }
    const seq = ++quoteSeq.current
    const t = setTimeout(async () => {
      const r = await quoteCheckoutMethods({
        listingId: listing.id,
        quantity,
        promoCode: promoCodeForQuote,
        walletMinor: useWallet ? Math.round(walletBalance * 100) : 0,
      })
      if (seq !== quoteSeq.current) return
      if (r.success) setQuotedMethods(r.methods)
    }, 250)
    return () => clearTimeout(t)
  }, [listing.id, quantity, promoCodeForQuote, useWallet, walletBalance])

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
    if (result.valid) {
      toast.success(`Promo Applied: ${result.description}`)
      // Creator / coupon codes: which code, not who typed it.
      track('promo_code_applied', { code: result.code?.toUpperCase() ?? null, listing_id: listing.id })
    }
    else toast.error(result.error || 'Invalid Promo Code')
  }
  const handleRemovePromo = () => {
    setPromoInput('')
    setPromoResult(null)
  }

  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)
  // Crypto needs a coin picked before Pay makes sense.
  const payDisabled = paying || payMethod == null || (payMethod === 'crypto' && (!coin || !cryptoMethod)) || activeQuote == null
  // Same-tab pay (owner 2026-10-16): every exit from checkout is a FULL
  // navigation in this tab, so Back is plain browser history. Before leaving,
  // this entry's URL gets ?order=<id>: Back then lands on a checkout that
  // knows the order (Order Paid view, or a "not finished" note). A page the
  // browser restores from its back/forward cache reloads, so it never shows
  // a stale "Redirecting…" button.
  const leftRef = useRef(false)
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted && leftRef.current) window.location.reload()
    }
    window.addEventListener('pageshow', onShow)
    return () => window.removeEventListener('pageshow', onShow)
  }, [])
  const leaveFor = (orderId: string | undefined, url: string) => {
    if (orderId) {
      const sp = new URLSearchParams(window.location.search)
      sp.set('order', orderId)
      sp.delete('cancelled')
      window.history.replaceState(null, '', `${window.location.pathname}?${sp.toString()}`)
    }
    leftRef.current = true
    window.location.assign(url)
  }

  const handlePay = async () => {
    if (!payMethod) return
    if (payMethod === 'crypto' && !coin) return
    setPaying(true)
    setPayError(null)
    try {
      const result = await createCheckout({
        listingId: listing.id,
        quantity,
        // AUTH-003 — send the CODE; the server derives the discount.
        promoCode: promoResult?.valid ? promoResult.code : undefined,
        walletAmount,
        // Local methods route the charge to Payssion, the card row to
        // Stripe; crypto stays default.
        paymentMethodId: payMethod === 'crypto' ? undefined : methodIdForRow(payMethod),
      })
      if (!result.success) {
        // Paid on the provider page, Back, then Pay again before the webhook
        // landed: the server keeps that order; show it, never re-charge.
        if (result.alreadyPaid && result.orderId) {
          toast.success(result.error || 'You have already paid for this order.')
          leaveFor(result.orderId, `/checkout/paid/${result.orderId}`)
          return
        }
        // One message, by the Pay button (owner 2026-10-22: not a toast too).
        setPayError(result.error || 'Checkout failed')
        setPaying(false)
        return
      }
      // Growth point 1 — buyer funnel step 4 (step 5, order_paid, is sent by
      // the server once payment is confirmed). Beacon: a redirect follows.
      track(
        'checkout_submitted',
        { listing_id: listing.id, order_id: result.orderId ?? null, method: payMethod, subtotal_usd: subtotal, has_promo: !!promoResult?.valid },
        { beacon: true },
      )
      if (result.fullyPaidByWallet && result.orderId) {
        leaveFor(result.orderId, `/checkout/paid/${result.orderId}`)
        return
      }
      if (result.checkoutUrl) {
        if (payMethod !== 'crypto') {
          // The provider's page (Payssion, Stripe) in THIS tab; its return comes back
          // through /checkout/return → Order Paid.
          leaveFor(result.orderId, result.checkoutUrl)
          return
        }
        // Carry the chosen coin (and, for USDT, its network) so the payment
        // page preselects its tab. Bitcoin has no network choice: sending
        // net=trc20 (a TRON name) with it only confused the link.
        const sep = result.checkoutUrl.includes('?') ? '&' : '?'
        const params = coin === 'btc' ? 'coin=btc' : `coin=${coin}&net=${network}`
        leaveFor(result.orderId, `${result.checkoutUrl}${sep}${params}`)
        return
      }
      setPayError('No checkout URL returned')
      setPaying(false)
    } catch (err: any) {
      setPayError(err?.message || 'An unexpected error occurred')
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

  const payErrorNote = payError && (
    <p role="alert" className="flex items-start gap-1.5 text-[13px] font-medium leading-snug text-[#F87171]">
      <TriangleAlert className="mt-[1px] h-4 w-4 shrink-0" aria-hidden />
      <span>{payError}</span>
    </p>
  )

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

  // ── Crypto picker: coin tiles + network + warning, inside the crypto row ──
  const cryptoPicker = (
    <div>
      <p className="mb-2.5 text-[13.5px] font-semibold" style={{ color: T.ink }}>
        Choose Coin
      </p>
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
              // Same states as the payment rows (owner 2026-10-27): flat,
              // a step lighter on hover, a trust-blue edge when picked.
              className={cn(
                'flex min-h-[44px] items-center gap-2.5 rounded-md px-3.5 py-2 text-left transition-[background-color,box-shadow]',
                selected ? ROW_CHECKED_CLASS : ROW_IDLE_CLASS
              )}
              style={rowStyle(selected)}
            >
              <Image src={c.icon} alt="" width={20} height={20} unoptimized />
              <span className="text-[14px] font-medium" style={{ color: T.ink }}>
                {c.label}
              </span>
              {selected && <Check className="ml-auto h-4 w-4 shrink-0" style={{ color: TRUST_BLUE }} />}
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

  /** Left-hand radio: an empty ring, or the brand-green ring with a dot. */
  const radio = (checked: boolean) => (
    <span
      aria-hidden
      className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full transition-colors"
      style={{ boxShadow: `inset 0 0 0 2px ${checked ? TRUST_BLUE : 'rgba(233,237,242,0.85)'}` }}
    >
      {checked && <span className="h-2 w-2 rounded-full" style={{ background: TRUST_BLUE }} />}
    </span>
  )

  /** Row (owner 2026-10-21, Eldorado shape): radio, name and one line, the
   *  brand logo in a tile at the right. Flat and clean (owner 2026-10-27):
   *  hover a step lighter, the pick a trust-blue edge and a blue radio. */
  const rowClass = (checked: boolean) => cn(ROW_CLASS, checked ? ROW_CHECKED_CLASS : ROW_IDLE_CLASS)

  /** The brand mark in a tile at the right of the row (the row's icon when a
   *  method has no mark); every mark at one optical size inside the tile. */
  const logoTile = (children: React.ReactNode, key?: string) => (
    <span key={key} className={TILE_CLASS}>
      {children}
    </span>
  )
  /** The row's logo tiles: one per mark (card rails show Visa + Mastercard;
   *  phones keep the first two), or the row's icon when it has no mark. */
  const markTiles = (marks: LocalMethodRow['marks'], Icon: MethodIcon) => {
    if (marks.length === 0) return logoTile(<Icon className="h-5 w-5" strokeWidth={1.75} style={{ color: '#C9D1DA' }} />)
    return (
      <span className="flex shrink-0 gap-1.5">
        {marks.map((mark, i) => {
          const size = markSize(mark.aspect, TILE_SLOT)
          return (
            <span key={mark.logo} className={i >= 2 ? 'hidden sm:block' : undefined}>
              {logoTile(
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mark.logo} alt="" width={size.width} height={size.height} style={size} />
              )}
            </span>
          )
        })}
      </span>
    )
  }

  const rowButton = 'flex min-h-[48px] w-full items-center gap-3 rounded-lg px-3.5 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring'

  // Name only (owner 2026-10-21): the logo and the provider page say the rest.
  const rowText = (label: string, checked = false) => (
    <span
      className="min-w-0 flex-1 truncate text-[14px] font-medium tracking-[-0.005em]"
      style={{ color: checked ? '#FFFFFF' : T.ink }}
    >
      {label}
    </span>
  )

  const renderMethodRow = (m: LocalMethodRow) => {
    const checked = payMethod === m.id
    return (
      <div className={rowClass(checked)} style={rowStyle(checked)}>
        <button type="button" role="radio" aria-checked={checked} onClick={() => setPayMethod(m.id)} className={rowButton}>
          {radio(checked)}
          {rowText(m.label, checked)}
          {m.id === lowestFeeId && (
            <span className="shrink-0 text-[12px] font-semibold" style={{ color: TRUST_BLUE }}>
              Lowest Fee
            </span>
          )}
          {markTiles(m.marks, m.Icon)}
        </button>
      </div>
    )
  }

  // Crypto: always the last row; opens the coin picker when picked.
  const cryptoChecked = payMethod === 'crypto'
  const cryptoRow = cryptoMethod && (
    <div className={rowClass(cryptoChecked)} style={rowStyle(cryptoChecked)}>
      <button type="button" role="radio" aria-checked={cryptoChecked} onClick={() => setPayMethod('crypto')} className={rowButton}>
        {radio(cryptoChecked)}
        {rowText('Crypto', cryptoChecked)}
        <span className="flex shrink-0 gap-1.5">
          {COINS.map((c) =>
            logoTile(<Image src={c.icon} alt="" width={17} height={17} unoptimized />, c.value)
          )}
        </span>
      </button>
      {cryptoChecked && (
        <div className="border-t border-white/[0.08] px-4 pb-4 pt-3.5">
          {cryptoPicker}
        </div>
      )}
    </div>
  )

  // ── Country: one quiet line under the list (owner 2026-10-19). Most
  //    buyers never touch it; a wrong geo (VPN, travel) is one tap to fix.
  //    A searchable list on desktop, a bottom sheet on phones. ──
  const countryLine = (
    <p className="flex flex-wrap items-center gap-x-1.5 text-[13px]" style={{ color: T.ink2 }}>
      <span>Paying from</span>
      <span className="font-semibold" style={{ color: T.ink }}>
        {country ? `${flagEmoji(country)} ${countryName(country)}` : '🌍 Another Country'}
      </span>
      <span aria-hidden>·</span>
      <Combobox
        value={country ?? OTHER_COUNTRY}
        onChange={selectCountry}
        options={countryOptions}
        unsorted
        ariaLabel="Paying From"
        sheetOnTouch
        sheetTitle="Paying From"
        emptyText="No country matches."
        renderTrigger={() => (
          <button
            type="button"
            className="rounded font-semibold underline-offset-4 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            style={{ color: T.accentText }}
          >
            Change
          </button>
        )}
      />
    </p>
  )

  const rowMotion = {
    layout: true,
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -6 },
    transition: { duration: 0.16, ease: 'easeOut' as const },
  }

  const paymentList = (
    <div className="flex flex-col gap-3">
      {unfinishedPayment && (
        <Callout variant="warning">Your last payment wasn’t finished. Pick a method to try again.</Callout>
      )}
      {orderedRows.length === 0 && !cryptoMethod ? (
        <div className={cn(PANEL_CLASS, 'px-5 py-6 text-center')} style={PANEL_STYLE}>
          <p className="text-[14px] font-semibold" style={{ color: T.ink }}>
            No Payment Methods Available
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: T.ink2 }}>
            This order can’t be paid right now — please try again shortly.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2" role="radiogroup" aria-label="Payment Method">
          <AnimatePresence initial={false} mode="popLayout">
            {stripeRows.map((m) => (
              <motion.div key={m.id} {...rowMotion}>
                {renderMethodRow(m)}
              </motion.div>
            ))}
            {localRows.map((m) => (
              <motion.div key={m.id} {...rowMotion}>
                {renderMethodRow(m)}
              </motion.div>
            ))}
            {regionalRows.map((m) => (
              <motion.div key={m.id} {...rowMotion}>
                {renderMethodRow(m)}
              </motion.div>
            ))}
            {cryptoRow && (
              <motion.div key="crypto" {...rowMotion}>
                {cryptoRow}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
      {/* QR rails on a phone: the code is on this screen, so the camera can't
          scan it. Every SG/PH/ID/VN bank app scans from the photo gallery. */}
      {coarse && selectedRow?.qrPay && (
        <p className="flex items-start gap-2 rounded-md bg-[rgba(106,168,255,0.10)] px-3 py-2.5 text-[13px] leading-snug" style={{ color: '#C9DCFF' }}>
          <Smartphone className="mt-[1px] h-4 w-4 shrink-0" style={{ color: TRUST_BLUE }} aria-hidden />
          <span>On this phone? Screenshot the QR code on the next page, then scan it from your photos in your banking app.</span>
        </p>
      )}
    </div>
  )

  // ── Phones: one compact strip — thumbnail, title, game · category · qty,
  //    the seller's name, the price. Everything else lives under the list.
  const orderStrip = (
    <div className={cn(PANEL_CLASS, 'p-3.5')} style={PANEL_STYLE}>
      <p className="mb-2.5 text-[15px] font-semibold" style={{ color: T.ink }}>
        Your Order
      </p>
      <div className="flex items-start gap-3">
        <Image
          src={imageSrc}
          alt={title}
          width={52}
          height={52}
          unoptimized
          className="h-[52px] w-[52px] shrink-0 rounded-md object-cover"
          style={{ background: T.ivory2 }}
        />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[14px] font-semibold leading-snug" style={{ color: T.ink }}>
            {title}
          </p>
          <p className="mt-0.5 truncate text-[12px]" style={{ color: T.ink2 }}>
            {[listing.game?.name, listing.category?.name].filter(Boolean).join(' · ')}
            {(listing.game?.name || listing.category?.name) && ' · '}Quantity: x{quantity.toLocaleString()}
          </p>
          <p className="mt-0.5 flex items-center gap-1 truncate text-[12px]" style={{ color: T.ink2 }}>
            Seller <span className="font-semibold" style={{ color: T.ink }}>{sellerName}</span>
            {isVerifiedSeller && <BadgeCheck aria-label="Verified Seller" className="h-[14px] w-[14px] shrink-0" style={{ fill: '#1D9BF0', color: '#FFFFFF' }} />}
          </p>
        </div>
        <span className="shrink-0 text-[16px] font-bold tabular-nums" style={{ color: T.ink }}>
          ${subtotal.toFixed(2)}
        </span>
      </div>
    </div>
  )

  // ── Shared with the phone layout: the discount toggle and the money rows
  //    render inside the desktop card AND under the payment list on phones.
  const promoSection = (
        <div className="mt-4">
          {!promoResult?.valid && (
            <button
              type="button"
              onClick={() => setCodeOpen((v) => !v)}
              className="flex w-full items-center gap-2 text-[12.5px] font-semibold transition-opacity hover:opacity-75"
              style={{ color: T.ink }}
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
              style={{ background: T.limeTint, borderColor: 'rgba(86,184,127,0.35)', color: T.accentText }}
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
                className="h-[38px] min-w-0 flex-1 rounded-md border px-2.5 text-[13px] outline-none transition-colors focus:border-focus-border"
                style={{ borderColor: T.line, background: T.ivory, color: T.ink }}
              />
              <button
                type="button"
                onClick={() => void handleApplyPromo()}
                disabled={promoValidating}
                className="h-[38px] rounded-md border px-3.5 text-[13px] font-semibold transition-colors disabled:opacity-60"
                style={{ borderColor: T.accentText, color: T.accentText }}
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
  )

  const moneySummary = (
      <div className="mt-4 flex flex-col gap-2 border-t pt-3.5 text-[14px]" style={{ borderColor: T.line }}>
        <Row label="Subtotal" value={`$${subtotal.toFixed(2)}`} />
        <Row
          label={SERVICE_FEE_LABEL}
          value={`+$${serviceFee.toFixed(2)}`}
          infoTitle="Service Fee"
          info={
            walletCoversAll
              ? 'No service fee when you pay with store credit.'
              : 'Covers payment processing and SafeDrop Protection on every order.'
          }
        />
        {promoDiscount > 0 && (
          <Row label="Discount" value={`−$${promoDiscount.toFixed(2)}`} valueColor={T.success} />
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
            <span className="tabular-nums font-medium" style={{ color: useWallet ? T.success : T.ink }}>
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
  )

  const summaryCard = (compact = false) => (
    <div className={cn(PANEL_CLASS, 'p-5 xl:p-6')} style={PANEL_STYLE}>
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

      {/* At a glance (owner 2026-10-21): one hairline-divided strip, no
          boxes inside the card. */}
      <dl className="mt-3.5 grid grid-cols-3 divide-x divide-white/[0.08] rounded-md bg-white/[0.03] py-1.5">
        {[
          { k: 'Delivery', v: fmtDelivery(deliveryTime) },
          { k: 'Quantity', v: quantity.toLocaleString() },
          { k: 'Protection', v: 'Included' },
        ].map((x) => (
          <div key={x.k} className="min-w-0 px-3 text-center">
            <dt className="text-[11px] leading-tight" style={{ color: T.ink2 }}>{x.k}</dt>
            <dd className="truncate text-[12.5px] font-semibold leading-snug" style={{ color: T.ink }}>{x.v}</dd>
          </div>
        ))}
      </dl>
      {deliveryMethod && (
        <div className="mt-3 flex items-center justify-between gap-4 text-[12.5px]">
          <span style={{ color: T.ink2 }}>Delivery Method</span>
          <span className="inline-flex items-center gap-1 font-medium" style={{ color: T.ink }}>
            {deliveryMethod.label}
            <DeliveryMethodInfo label={deliveryMethod.label} description={deliveryMethod.description} />
          </span>
        </div>
      )}

      {/* Seller */}
      <div className="mt-4 flex items-center gap-3 border-t pt-4" style={{ borderColor: T.line }}>
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
            {isVerifiedSeller && <VerifiedBadge size={17} />}
          </span>
          {/* Shared seller rule: "100% Positive · 12 Reviews · 34 Sold · Gold",
              or "Verified Seller" before the first sale. */}
          <p className="mt-0.5 truncate text-[12px]" style={{ color: T.ink2 }}>
            {sellerStatText({
              ratingPercent: positivePct != null ? Math.round(positivePct) : null,
              reviews: reviewCount,
              sales: Number(seller.total_sales ?? 0),
              tier: seller.seller_tier,
            })}
          </p>
        </div>
      </div>

      {/* Discount code — collapsed behind a toggle */}
      {!compact && promoSection}

      {/* Money summary */}
      {moneySummary}

      {/* Desktop: the commitment lives with the numbers. Phones keep the
          sticky pay bar at the bottom of the screen. */}
      <div className="mt-4 hidden lg:block">
        {payButton()}
        {payErrorNote && <div className="mt-2.5">{payErrorNote}</div>}
        <p className="mt-3 text-center text-[11px] leading-relaxed" style={{ color: T.dis }}>
          By paying you agree to our{' '}
          <Link
            href="/terms"
            className="underline underline-offset-2 transition-colors hover:text-[#56B87F]"
            style={{ color: T.ink2 }}
          >
            Terms of Use
          </Link>{' '}
          and{' '}
          <Link
            href="/refunds"
            className="underline underline-offset-2 transition-colors hover:text-[#56B87F]"
            style={{ color: T.ink2 }}
          >
            Refund Policy
          </Link>
        </p>
      </div>
    </div>
  )

  return (
    // The faded homepage art sits behind the top (page.tsx wraps this in
    // HeroBackdrop, owner 2026-10-27), so the page itself paints nothing.
    <div className="relative min-h-screen">
      <CheckoutNavbar user={user} buyerProfile={buyerProfile} />

      {/* Same width and gutters as the item page (max-w-7xl), so the two
          pages line up; the order panel is wider than the item page's rail. */}
      <div className="relative mx-auto w-full max-w-7xl px-3 pb-10 pt-8 sm:px-6 sm:pt-10 lg:px-8 lg:pb-14">
        {/* Header row */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Go Back"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-md border bg-white/[0.04] transition-colors hover:bg-white/[0.08]"
            style={{ borderColor: T.line, color: T.ink }}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="whitespace-nowrap text-[20px] font-bold sm:text-[24px]" style={{ color: T.ink }}>
            Secure Checkout
          </h1>
        </div>

        {/* Two columns (desktop) / stacked with the order first (mobile) */}
        <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-8 xl:grid-cols-[minmax(0,1fr)_460px] xl:gap-10">
          {/* Phones: the compact order strip first */}
          <div className="lg:hidden">{orderStrip}</div>

          <div>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 className="text-[18px] font-bold" style={{ color: T.ink }}>
                Payment Method
              </h2>
              {countryLine}
            </div>
            {paymentList}
            {/* Phones: discount code + the money rows sit under the list,
                right above the sticky Pay Now bar. */}
            <div className={cn(PANEL_CLASS, 'mt-4 px-4 pb-4 pt-1 lg:hidden')} style={PANEL_STYLE}>
              {promoSection}
              {moneySummary}
            </div>
            {/* Security seals at the moment of commitment. */}
            <div className="mt-6">
              <TrustSeals />
            </div>
          </div>

          {/* Summary column: the order and Pay, then the rating and the
              reasons to trust it. Phones get the last two under the seals. */}
          <div className="flex flex-col gap-3.5">
            <div className="hidden lg:block">{summaryCard()}</div>
            <BuyerRating rating={siteRating} />
            <TrustList />
          </div>
        </div>

        <h2 className="mb-5 mt-16 text-center text-heading" style={{ color: T.ink }}>
          How Your Order Works
        </h2>
        <div className={cn(PANEL_CLASS, 'px-5 py-5 sm:px-8 sm:py-6')} style={PANEL_STYLE}>
          <ol className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-x-10 sm:gap-y-5 lg:grid-cols-4 lg:gap-x-7">
            {[
              {
                icon: '/icons/set/card.svg',
                title: 'Choose Payment Method',
                sub: 'Every payment is encryption-protected.',
              },
              {
                icon: '/icons/set/package.svg',
                title: 'Wait for Delivery',
                sub: 'Your seller preps the order. Chat live anytime.',
              },
              {
                icon: '/icons/set/verified.svg',
                title: 'Order Delivered',
                sub: 'Check your items and confirm delivery.',
              },
              {
                icon: '/icons/set/refund.svg',
                title: 'Item Not Received?',
                sub: '100% refund, guaranteed.',
              },
            ].map((step) => (
              <li key={step.title} className="flex items-start gap-3.5">
                <SilverIcon src={step.icon} alt="" className="h-10 w-10" />
                <div>
                  <p className="text-[14px] font-bold leading-snug" style={{ color: T.ink }}>
                    {step.title}
                  </p>
                  <p className="mt-1 text-[12.5px] leading-snug" style={{ color: '#B4BEC9' }}>
                    {step.sub}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <CheckoutFooter />

      {/* Mobile sticky pay bar. Bottom padding hugs the browser chrome:
          12px base, or the home-indicator inset when the browser bar sits
          on top (Chrome/top-bar Safari) and exposes the safe area. */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-[#1D1E23]/95 px-4 backdrop-blur-md pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 lg:hidden"
        style={{ borderColor: T.line }}
      >
        {/* Phones: the error sits right above the button the buyer just pressed. */}
        {payErrorNote && <div className="mb-2.5">{payErrorNote}</div>}
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
