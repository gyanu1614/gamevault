'use client'

/**
 * PayClient: the native BTCPay payment page (2026-10 revamp).
 *
 *   · main column: amount to send (the hero, with copy), the expiry chip,
 *     the QR, the deposit address with copy + network chip, Open In Wallet,
 *     a one-line network note, then "safe to close" + Cancel Order;
 *   · side column: order summary (item, order number, money rows) and the
 *     payment status timeline, then SafeDrop + help/policy links.
 * Phone: one column, amount + QR first, status next, then the summary.
 *
 * Display-only state machine; the verified webhook is the sole authority
 * for marking the order paid:
 *   waiting → seen (instant chain-watch, tx id shown) → confirming → paid
 *   waiting → partial (live remaining due) · waiting/partial → expired
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from '@/components/navigation/AppLink'
import { Drawer } from 'vaul'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { toast } from 'sonner'
import { ArrowClockwiseIcon } from '@phosphor-icons/react/dist/csr/ArrowClockwise'
import { CheckIcon } from '@phosphor-icons/react/dist/csr/Check'
import { CheckCircleIcon } from '@phosphor-icons/react/dist/csr/CheckCircle'
import { CircleNotchIcon } from '@phosphor-icons/react/dist/csr/CircleNotch'
import { ClockIcon } from '@phosphor-icons/react/dist/csr/Clock'
import { CopyIcon } from '@phosphor-icons/react/dist/csr/Copy'
import { InfoIcon } from '@phosphor-icons/react/dist/csr/Info'
import { ShieldCheckIcon } from '@phosphor-icons/react/dist/csr/ShieldCheck'
import { WalletIcon } from '@phosphor-icons/react/dist/csr/Wallet'
import { WarningCircleIcon } from '@phosphor-icons/react/dist/csr/WarningCircle'
import { getPaymentPageStatus } from '@/lib/actions/payment-page'
import { retryOrderPayment } from '@/lib/actions/checkout'
import { cancelOrder } from '@/lib/actions/orders'
import { MARKET_CARD } from '@/lib/ui/surfaces'
import { accountBtn } from '@/components/account/AccountSurface'
import { cn } from '@/lib/utils'
import { CheckoutNavbar } from '../../_components/CheckoutNavbar'
import { nextPollDelayMs, countdownShouldContinue, POLL_BASE_MS } from './poll-policy'
import { qrPayload, walletDeepLink } from './qr'
import { PaymentQr } from './_PaymentQr'

export interface PayMethod {
  id: string
  label: string
  short: string
  icon: string | null
  network: string | null
  /** Human chain name for prose ("TRON", "Polygon"); null when unproven. */
  networkName: string | null
  /** Confirmation-time clause, lowercase ("usually under a minute"). */
  confirmEta: string | null
  networkWarning: string | null
  address: string
  paymentLink: string | null
  due: string
  totalPaid: string
  rate: string | null
}

/** Order money rows, built on the server from the buyer's own fields.
 *  itemPrice/serviceFee are null when they could not be read. */
export interface PaySummary {
  itemPrice: number | null
  quantity: number
  serviceFee: number | null
  promoDiscount: number
  storeCredit: number
  total: number
}

type ViewState = 'waiting' | 'seen' | 'confirming' | 'paid' | 'partial' | 'expired' | 'unreachable'

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring'

function fmtCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

function fmtTime(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
  } catch {
    return ''
  }
}

/** Trim a crypto decimal string for display (drop trailing zeros, keep ≤8 dp). */
function fmtCrypto(v: string | undefined): string {
  if (!v) return ''
  const n = Number(v)
  if (!Number.isFinite(n)) return v
  return n.toFixed(8).replace(/\.?0+$/, '')
}

function shortTx(tx?: string | null): string {
  if (!tx) return ''
  return `${tx.slice(0, 6)}…${tx.slice(-4)}`
}

/** execCommand fallback for insecure contexts (http over LAN IP, older
 *  webviews) where navigator.clipboard is unavailable. */
function legacyCopy(value: string): boolean {
  try {
    const ta = document.createElement('textarea')
    ta.value = value
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    ta.setSelectionRange(0, value.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

/** Copy to the clipboard. Inline buttons show their own "Copied"; a toast
 *  only when asked (or on failure). */
async function copyText(value: string, label: string, opts: { toast?: boolean } = {}) {
  const ok = async () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value)
      return true
    }
    return legacyCopy(value)
  }
  let done = false
  try {
    done = await ok()
  } catch {
    done = legacyCopy(value)
  }
  if (done) {
    if (opts.toast) toast.success(`${label} Copied`)
    return true
  }
  toast.error('Copy Failed. Select The Text Manually')
  return false
}

// ─── Small pieces ───────────────────────────────────────────────────

function CopyButton({
  value,
  label,
  className,
}: {
  value: string
  label: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => clearTimeout(timer.current), [])
  return (
    <button
      type="button"
      onClick={async () => {
        if (await copyText(value, label)) {
          setCopied(true)
          clearTimeout(timer.current)
          timer.current = setTimeout(() => setCopied(false), 1600)
        }
      }}
      aria-label={copied ? `${label} Copied` : `Copy ${label}`}
      className={cn(accountBtn.secondary, 'h-10 min-w-[92px]', FOCUS, className)}
    >
      {copied ? (
        <CheckIcon className="h-4 w-4 text-lime-text" weight="bold" aria-hidden />
      ) : (
        <CopyIcon className="h-4 w-4 text-text-secondary" aria-hidden />
      )}
      <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
    </button>
  )
}

function ExpiryChip({ remainingMs }: { remainingMs: number }) {
  const low = remainingMs < 60_000
  return (
    <span
      role="timer"
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-white/[0.06] px-3 text-[13px] font-medium tabular-nums',
        low ? 'text-warning' : 'text-text-secondary'
      )}
    >
      <ClockIcon className="h-4 w-4" aria-hidden />
      <span suppressHydrationWarning>Expires In {fmtCountdown(remainingMs)}</span>
    </span>
  )
}

/** One calm inline status line under the amount (seen / partial). */
function StatusNote({
  tone,
  icon,
  children,
}: {
  tone: 'live' | 'warn'
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="mt-4 flex items-start gap-2.5 text-[14px] leading-relaxed text-text-primary">
      <span className={cn('mt-[3px] shrink-0', tone === 'live' ? 'text-lime-text' : 'text-warning')}>{icon}</span>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

/** Confirming / paid / expired / unreachable: the main column's state screen. */
function StatePanel({
  icon,
  title,
  children,
  action,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="px-5 py-8 sm:px-8 sm:py-10">
      <span className="grid h-11 w-11 place-items-center rounded-full bg-white/[0.06]">{icon}</span>
      <h2 className="mt-5 text-[20px] font-semibold leading-tight tracking-[-0.01em] text-text-primary sm:text-[22px]">
        {title}
      </h2>
      <div className="mt-2 max-w-[52ch] text-[14px] leading-relaxed text-text-secondary">{children}</div>
      {action && <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">{action}</div>}
    </div>
  )
}

function SummaryRow({
  label,
  children,
  strong,
}: {
  label: React.ReactNode
  children: React.ReactNode
  strong?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-white/[0.07] py-3 first:border-t-0">
      <span className={cn('text-[13.5px]', strong ? 'font-semibold text-text-primary' : 'text-text-secondary')}>
        {label}
      </span>
      <span
        className={cn(
          'tabular-nums text-text-primary',
          strong ? 'text-[16px] font-semibold' : 'text-[13.5px] font-medium'
        )}
      >
        {children}
      </span>
    </div>
  )
}

// ─── Status timeline ────────────────────────────────────────────────

type StepState = 'done' | 'current' | 'upcoming'

function StepDot({ state, warn, reduce }: { state: StepState; warn?: boolean; reduce: boolean }) {
  if (state === 'done') {
    return (
      <span className="grid h-4 w-4 place-items-center rounded-full bg-white/[0.10]">
        <CheckIcon className="h-2.5 w-2.5 text-text-primary" weight="bold" aria-hidden />
      </span>
    )
  }
  if (state === 'current') {
    const color = warn ? 'bg-warning' : 'bg-lime-text'
    return (
      <span className="relative grid h-4 w-4 place-items-center">
        {!reduce && (
          <motion.span
            aria-hidden
            className={cn('absolute inset-0 rounded-full', color)}
            initial={{ opacity: 0.35, scale: 0.6 }}
            animate={{ opacity: 0, scale: 1.6 }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
        <span className={cn('relative h-2 w-2 rounded-full', color)} />
      </span>
    )
  }
  return (
    <span className="grid h-4 w-4 place-items-center">
      <span className="h-2 w-2 rounded-full bg-white/[0.14]" />
    </span>
  )
}

function StatusTimeline({
  view,
  createdAt,
  seenAt,
  confirmedAt,
  seenTx,
  networkName,
  confirmEta,
}: {
  view: ViewState
  createdAt: string | null
  seenAt: string | null
  confirmedAt: string | null
  seenTx: string | null
  networkName: string | null
  confirmEta: string | null
}) {
  const reduce = useReducedMotion() ?? false

  if (view === 'expired' || view === 'unreachable') {
    return (
      <ol aria-label="Payment Status" className="space-y-4">
        <li className="flex gap-3">
          <StepDot state="done" reduce={reduce} />
          <div className="-mt-0.5 flex min-w-0 flex-1 justify-between gap-3 text-[13.5px]">
            <span className="text-text-secondary">Invoice Created</span>
            <span className="tabular-nums text-text-tertiary">{fmtTime(createdAt)}</span>
          </div>
        </li>
        <li className="flex gap-3" aria-current="step">
          <span className="grid h-4 w-4 place-items-center">
            <span className="h-2 w-2 rounded-full bg-text-tertiary" />
          </span>
          <div className="-mt-0.5 min-w-0 flex-1">
            <p className="text-[13.5px] font-semibold text-text-primary">
              {view === 'unreachable' ? 'Payment Service Unreachable' : 'Invoice Expired'}
            </p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-text-tertiary">Nothing was charged.</p>
          </div>
        </li>
      </ol>
    )
  }

  const current = view === 'paid' ? 4 : view === 'confirming' ? 3 : view === 'seen' ? 2 : 1
  const steps: Array<{ label: string; meta?: string; note?: string; warn?: boolean }> = [
    { label: 'Invoice Created', meta: fmtTime(createdAt) },
    view === 'partial'
      ? {
          label: 'Partial Payment Received',
          note: 'Send the remaining amount to the same address.',
          warn: true,
        }
      : {
          label: current > 1 ? 'Payment Sent' : 'Waiting For Payment',
          note: networkName
            ? `Watching the ${networkName} network. Your payment shows up here seconds after you send it.`
            : 'Watching the network. Your payment shows up here seconds after you send it.',
        },
    {
      label: 'Seen On Network',
      meta: current > 2 ? fmtTime(seenAt) : undefined,
      note: seenTx ? `Tx ${shortTx(seenTx)}` : 'Confirming now.',
    },
    {
      label: view === 'confirming' ? 'Confirming' : 'Confirmed',
      meta: view === 'paid' ? fmtTime(confirmedAt) : undefined,
      note: confirmEta
        ? `${confirmEta.charAt(0).toUpperCase()}${confirmEta.slice(1)}${networkName ? ` on ${networkName}` : ''}.`
        : 'Usually just a few minutes.',
    },
  ]

  return (
    <ol aria-label="Payment Status">
      {steps.map((s, i) => {
        const state: StepState = i < current ? 'done' : i === current ? 'current' : 'upcoming'
        const last = i === steps.length - 1
        return (
          <li key={i} className="relative flex gap-3 pb-4 last:pb-0" aria-current={state === 'current' ? 'step' : undefined}>
            {!last && <span aria-hidden className="absolute bottom-0 left-[7.5px] top-5 w-px bg-white/[0.08]" />}
            <StepDot state={state} warn={s.warn} reduce={reduce} />
            <div className="-mt-0.5 min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <span
                  className={cn(
                    'text-[13.5px]',
                    state === 'current' && 'font-semibold text-text-primary',
                    state === 'done' && 'text-text-secondary',
                    state === 'upcoming' && 'text-text-tertiary'
                  )}
                >
                  {s.label}
                </span>
                {s.meta && state === 'done' && (
                  <span className="shrink-0 text-[12.5px] tabular-nums text-text-tertiary">{s.meta}</span>
                )}
              </div>
              {state === 'current' && s.note && (
                <p className="mt-0.5 text-[13px] leading-relaxed text-text-tertiary">{s.note}</p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function HelpDrawer({ trigger }: { trigger: React.ReactNode }) {
  return (
    <Drawer.Root>
      <Drawer.Trigger asChild>{trigger}</Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Drawer.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[520px] rounded-t-lg bg-bg-raised p-6 pb-9 text-text-primary"
        >
          <div className="mx-auto mb-5 h-1.5 w-10 rounded-full bg-white/[0.14]" />
          <Drawer.Title className="text-[16px] font-semibold">Payment Help</Drawer.Title>
          <div className="mt-4 space-y-4 text-[14px] leading-relaxed text-text-secondary">
            <p>
              <span className="font-semibold text-text-primary">How long does it take?</span> Crypto payments
              are usually detected within seconds of sending and confirmed within a few minutes.
            </p>
            <p>
              <span className="font-semibold text-text-primary">Sent slightly too little?</span> Exchange
              withdrawal fees can shave the amount. This page shows the small remainder to send.
            </p>
            <p>
              <span className="font-semibold text-text-primary">Invoice expired after you paid?</span> Payments
              are never lost. Contact us and we’ll sort it right away.
            </p>
            <a href="mailto:support@dropmarket.gg" className={cn(accountBtn.primary, 'h-11 px-5', FOCUS)}>
              Contact Support
            </a>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

// ─── Main component ─────────────────────────────────────────────────

export default function PayClient({
  orderId,
  orderNumber,
  listingId,
  listingTitle,
  itemImage,
  gameName,
  summary,
  currency,
  invoiceAmount,
  initialInvoiceStatus,
  expiresAt,
  createdAt,
  methods,
  initialMethodId,
  user,
  buyerProfile,
}: {
  orderId: string
  orderNumber: string | null
  listingId: string | null
  listingTitle: string
  itemImage: string | null
  gameName: string | null
  summary: PaySummary
  currency: string
  invoiceAmount: number
  initialInvoiceStatus: string
  expiresAt: string | null
  createdAt: string | null
  methods: PayMethod[]
  initialMethodId?: string | null
  user?: { email?: string | null } | null
  buyerProfile?: { username: string | null; avatar_url: string | null } | null
}) {
  const router = useRouter()
  const reduce = useReducedMotion() ?? false

  const initialView: ViewState =
    initialInvoiceStatus === 'Processing'
      ? 'confirming'
      : initialInvoiceStatus === 'New'
        ? 'waiting'
        : initialInvoiceStatus === 'Unreachable'
          ? 'unreachable'
          : 'expired'

  const [view, setView] = useState<ViewState>(initialView)
  const [selectedId] = useState(initialMethodId ?? methods[0]?.id ?? '')
  const [liveDue, setLiveDue] = useState<Record<string, { due?: string; totalPaid?: string }>>({})
  const [seenTx, setSeenTx] = useState<string | null>(null)
  const [remainingMs, setRemainingMs] = useState(() =>
    expiresAt ? new Date(expiresAt).getTime() - Date.now() : 0
  )
  const [retrying, setRetrying] = useState(false)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const stamps = useRef<Record<string, string>>({})

  const selected = useMemo(
    () => methods.find((m) => m.id === selectedId) ?? methods[0],
    [methods, selectedId]
  )
  const live = selected ? liveDue[selected.id] : undefined
  const dueDisplay = fmtCrypto(live?.due ?? selected?.due)
  const sym = currency.toUpperCase() === 'EUR' ? '€' : '$'
  const money = (n: number) => `${sym}${n.toFixed(2)}`
  const rateLine = selected?.rate
    ? `1 ${selected.short} = ${sym}${Number(selected.rate).toFixed(2)}`
    : null

  const stamp = (key: string) => {
    if (!stamps.current[key]) stamps.current[key] = new Date().toISOString()
    return stamps.current[key]
  }

  // ── Countdown ─────────────────────────────────────────────────────
  // PAY-019: stops at zero (the view flips to expired once) instead of
  // ticking negative seconds every second for as long as the tab is open.
  useEffect(() => {
    if (!expiresAt || !(view === 'waiting' || view === 'seen' || view === 'partial')) return
    const t = setInterval(() => {
      const left = new Date(expiresAt).getTime() - Date.now()
      setRemainingMs(left)
      if (!countdownShouldContinue(left)) {
        clearInterval(t)
        setView((v) => (v === 'waiting' || v === 'seen' || v === 'partial' ? 'expired' : v))
      }
    }, 1000)
    return () => clearInterval(t)
  }, [expiresAt, view])

  // ── Status poll (webhook truth + chain-watch sugar) ───────────────
  // PAY-019: a setTimeout chain (never two calls in flight), base rate while
  // a payment can land, ×2 backoff to 60 s in expired / unreachable, and
  // nothing at all once paid. Schedule in poll-policy.ts.
  useEffect(() => {
    if (view === 'paid') return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let delay = nextPollDelayMs(view, POLL_BASE_MS) ?? POLL_BASE_MS
    const schedule = () => {
      timer = setTimeout(tick, delay)
    }
    const tick = async () => {
      if (cancelled) return
      let res
      try {
        res = await getPaymentPageStatus(orderId)
      } catch {
        res = { success: false } as Awaited<ReturnType<typeof getPaymentPageStatus>>
      }
      if (cancelled) return
      const next = nextPollDelayMs(view, delay)
      if (next === null) return
      delay = next
      schedule()
      if (!res.success) return
      if (res.orderStatus && res.orderStatus !== 'pending') {
        stamp('confirmed')
        setView('paid')
        setTimeout(() => router.replace(`/account/orders/${orderId}?paid=1`), 3200)
        return
      }
      if (res.methods?.length) {
        setLiveDue((prev) => {
          const next = { ...prev }
          for (const m of res.methods!) next[m.paymentMethodId] = { due: m.due, totalPaid: m.totalPaid }
          return next
        })
      }
      if (res.seenTxId) setSeenTx(res.seenTxId)

      const partiallyPaid = (res.methods ?? []).some((m) => Number(m.totalPaid ?? 0) > 0)
      switch (res.invoiceStatus) {
        case 'Processing':
          stamp('seen')
          setView('confirming')
          break
        case 'Expired':
        case 'Invalid':
          setView((v) => (v === 'confirming' ? v : 'expired'))
          break
        case 'New':
          setView((v) => {
            if (v === 'confirming') return v
            if (partiallyPaid) return 'partial'
            if (res.seenOnNetwork) {
              stamp('seen')
              return 'seen'
            }
            return v === 'unreachable' ? 'waiting' : v
          })
          break
      }
    }
    schedule()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [orderId, router, view])

  const freshInvoice = useCallback(async () => {
    setRetrying(true)
    const res = await retryOrderPayment(orderId)
    if (res.success && res.fullyPaidByWallet) {
      router.replace(`/account/orders/${orderId}?paid=1`)
      return
    }
    router.refresh()
    setRetrying(false)
    setView('waiting')
  }, [orderId, router])

  // Cancel = "no order ever happened": the order flips to cancelled (hidden
  // from the orders list), wallet credit returns, and the buyer lands back on
  // the checkout page, the exact pre-order state.
  const handleCancelOrder = useCallback(async () => {
    setCancelling(true)
    try {
      const res = await cancelOrder(orderId)
      if (res.success) {
        toast.success('Order Cancelled. Nothing was charged.')
        router.replace(listingId ? `/checkout/${listingId}` : '/')
        return
      }
      toast.error(res.error || 'Could not cancel. Please try again.')
      setCancelling(false)
      setConfirmingCancel(false)
    } catch {
      toast.error('Could not cancel. Please try again.')
      setCancelling(false)
      setConfirmingCancel(false)
    }
  }, [orderId, listingId, router])

  const openInWallet = useCallback(async () => {
    const link = selected ? walletDeepLink(selected) : null
    const coarse =
      typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
    if (link && coarse) {
      window.location.href = link
      return
    }
    // Desktop fallback: copy the address instead.
    if (selected) {
      if (await copyText(selected.address, 'Address', { toast: true })) {
        toast.info('Open your wallet app on your phone and paste the address.')
      }
    }
  }, [selected])

  const livePay = view === 'waiting' || view === 'seen' || view === 'partial'
  const phase: 'pay' | 'confirming' | 'paid' | 'expired' | 'unreachable' =
    livePay ? 'pay' : view
  const canCancel = view === 'waiting' || view === 'unreachable'
  const netChip = selected?.network ?? selected?.networkName ?? null
  const payingWith = selected
    ? selected.networkName && !selected.label.includes(selected.networkName)
      ? `Pay with ${selected.label} on ${selected.networkName}`
      : `Pay with ${selected.label}`
    : null
  const announce =
    view === 'paid'
      ? 'Payment confirmed.'
      : view === 'confirming'
        ? 'Payment received. Confirming.'
        : view === 'seen'
          ? 'Payment seen on the network.'
          : view === 'partial'
            ? `Partial payment received. ${dueDisplay} ${selected?.short ?? ''} remaining.`
            : view === 'expired'
              ? 'Invoice expired.'
              : view === 'unreachable'
                ? 'Payment service unreachable.'
                : ''

  const fade = {
    initial: reduce ? false : { opacity: 0 },
    animate: { opacity: 1 },
    exit: reduce ? { opacity: 1 } : { opacity: 0 },
    transition: { duration: reduce ? 0 : 0.18, ease: 'easeOut' },
  } as const

  // ── Main column bodies ────────────────────────────────────────────
  const payBody = selected ? (
    <>
      {/* Amount: the hero */}
      <div className="p-5 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <p className="text-[13.5px] font-medium text-text-secondary">
            {view === 'partial' ? 'Remaining To Send' : 'Send Exactly'}
          </p>
          {expiresAt && <ExpiryChip remainingMs={remainingMs} />}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-3">
          <p className="min-w-0 text-text-primary">
            <span className="select-all break-all text-[34px] font-bold leading-[1.05] tracking-[-0.02em] tabular-nums sm:text-[40px]">
              {dueDisplay}
            </span>{' '}
            <span className="text-[18px] font-semibold text-text-secondary sm:text-[20px]">{selected.short}</span>
          </p>
          <CopyButton value={dueDisplay} label="Amount" />
        </div>
        <p className="mt-2 text-[13px] tabular-nums text-text-tertiary">
          {money(invoiceAmount)}
          {rateLine ? ` · Rate locked at ${rateLine}` : ''}
        </p>

        {view === 'seen' && (
          <StatusNote tone="live" icon={<CheckCircleIcon className="h-4 w-4" weight="fill" aria-hidden />}>
            Payment seen on the network. Confirming now.
          </StatusNote>
        )}
        {view === 'partial' && (
          <StatusNote tone="warn" icon={<WarningCircleIcon className="h-4 w-4" weight="fill" aria-hidden />}>
            Partial payment received. Send the remaining{' '}
            <span className="font-semibold tabular-nums">
              {dueDisplay} {selected.short}
            </span>{' '}
            to the same address. Exchange fees often cause this, nothing is lost.
          </StatusNote>
        )}
      </div>

      {/* QR + address */}
      <div className="grid grid-cols-1 gap-6 border-t border-white/[0.07] p-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-8 sm:p-8">
        <div className="justify-self-center sm:justify-self-start">
          <PaymentQr
            payload={qrPayload(selected)}
            logo={selected.icon}
            label={`QR code to pay ${dueDisplay} ${selected.short}${selected.networkName ? ` on ${selected.networkName}` : ''}`}
          />
        </div>
        <div className="flex min-w-0 flex-col">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13.5px] font-medium text-text-secondary">{selected.short} Address</p>
            {netChip && (
              <span className="inline-flex h-6 items-center rounded-full bg-white/[0.06] px-2.5 text-[12px] font-medium text-text-secondary">
                {netChip}
              </span>
            )}
          </div>
          <p className="mt-2 select-all break-all font-mono text-[14px] leading-relaxed text-text-primary sm:text-[15px]">
            {selected.address}
          </p>
          <div className="mt-4 grid grid-cols-1 gap-2.5 sm:flex sm:flex-wrap">
            <CopyButton value={selected.address} label="Address" className="w-full sm:w-auto" />
            <button
              type="button"
              onClick={() => void openInWallet()}
              className={cn(accountBtn.primary, 'h-10 w-full sm:w-auto', FOCUS)}
            >
              <WalletIcon className="h-4 w-4" aria-hidden />
              Open In Wallet
            </button>
          </div>
          {selected.networkWarning && (
            <p className="mt-5 flex items-start gap-2 text-[13px] leading-relaxed text-text-secondary sm:mt-auto sm:pt-5">
              <InfoIcon className="mt-[2px] h-4 w-4 shrink-0 text-text-tertiary" aria-hidden />
              <span>{selected.networkWarning}</span>
            </p>
          )}
        </div>
      </div>
    </>
  ) : (
    <StatePanel
      icon={<WarningCircleIcon className="h-5 w-5 text-text-secondary" aria-hidden />}
      title="Payment Details Unavailable"
      action={
        <button type="button" onClick={() => router.refresh()} className={cn(accountBtn.secondary, 'h-11 px-5', FOCUS)}>
          <ArrowClockwiseIcon className="h-4 w-4" aria-hidden />
          Reload
        </button>
      }
    >
      We couldn’t load the payment address. Nothing was charged.
    </StatePanel>
  )

  const confirmingBody = (
    <StatePanel
      icon={<CircleNotchIcon className="h-5 w-5 text-lime-text motion-safe:animate-spin" aria-hidden />}
      title="Payment Received, Confirming"
    >
      {selected?.confirmEta
        ? `${selected.confirmEta.charAt(0).toUpperCase()}${selected.confirmEta.slice(1)}${selected.networkName ? ` on ${selected.networkName}` : ''}.`
        : 'Usually just a few minutes.'}{' '}
      Your funds are safe either way. You can close this page, we email you the moment it confirms.
    </StatePanel>
  )

  const paidBody = (
    <StatePanel
      icon={<CheckCircleIcon className="h-6 w-6 text-lime-text" weight="fill" aria-hidden />}
      title="Payment Confirmed"
      action={
        <>
          <button
            type="button"
            onClick={() => router.replace(`/account/orders/${orderId}?paid=1`)}
            className={cn(accountBtn.primary, 'h-11 px-5', FOCUS)}
          >
            View Your Item
          </button>
          <span className="text-[13px] text-text-tertiary">Taking you to your order…</span>
        </>
      }
    >
      {listingTitle} is on its way to your inventory. Receipt emailed.
    </StatePanel>
  )

  const retryBody = (
    <StatePanel
      icon={
        view === 'unreachable' ? (
          <WarningCircleIcon className="h-5 w-5 text-text-secondary" aria-hidden />
        ) : (
          <ClockIcon className="h-5 w-5 text-text-secondary" aria-hidden />
        )
      }
      title={view === 'unreachable' ? 'Payment Service Unreachable' : 'Invoice Expired'}
      action={
        <>
          <button
            type="button"
            onClick={() => void freshInvoice()}
            disabled={retrying}
            className={cn(accountBtn.primary, 'h-11 px-5', FOCUS)}
          >
            {retrying ? (
              <CircleNotchIcon className="h-4 w-4 motion-safe:animate-spin" aria-hidden />
            ) : (
              <ArrowClockwiseIcon className="h-4 w-4" aria-hidden />
            )}
            {view === 'unreachable' ? 'Try Again' : 'Get A Fresh Invoice'}
          </button>
          <Link
            href="/support"
            className={cn('rounded-sm text-[13.5px] text-text-secondary underline-offset-4 hover:text-text-primary hover:underline', FOCUS)}
          >
            Already Sent? Contact Support
          </Link>
        </>
      }
    >
      {view === 'unreachable'
        ? 'We couldn’t reach the payment server. Nothing was charged. Try again in a moment.'
        : 'No charge was made and nothing was lost. Rates move, so we start fresh.'}
    </StatePanel>
  )

  const body =
    phase === 'pay'
      ? payBody
      : phase === 'confirming'
        ? confirmingBody
        : phase === 'paid'
          ? paidBody
          : retryBody

  return (
    <div className="min-h-[100dvh] bg-bg-base">
      <CheckoutNavbar user={user} buyerProfile={buyerProfile} />

      <div className="mx-auto w-full max-w-[1080px] px-4 pb-16 pt-6 sm:px-6 sm:pt-10 lg:px-8">
        {/* No back button: leaving is a decision, and Cancel Order below
            the payment is the honest exit. */}
        <header>
          <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.015em] text-text-primary sm:text-[28px]">
            Complete Your Payment
          </h1>
          {payingWith && <p className="mt-1.5 text-[14px] text-text-secondary">{payingWith}</p>}
        </header>
        <p className="sr-only" aria-live="polite">
          {announce}
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:mt-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6">
          {/* ── Main column: payment ── */}
          <section aria-label="Payment" className={cn(MARKET_CARD, 'min-w-0 overflow-hidden rounded-lg')}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={phase} {...fade}>
                {body}
              </motion.div>
            </AnimatePresence>

            {(livePay || canCancel) && (
              <div className="flex flex-col gap-3 border-t border-white/[0.07] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
                {livePay ? (
                  <p className="text-[13px] leading-relaxed text-text-tertiary">
                    Safe to close this page. We keep watching and email you the moment it confirms.
                  </p>
                ) : (
                  <span />
                )}
                {canCancel &&
                  (!confirmingCancel ? (
                    <button
                      type="button"
                      onClick={() => setConfirmingCancel(true)}
                      className={cn(
                        '-mx-2 self-start rounded-md px-2 py-1.5 text-[13.5px] font-medium text-text-secondary transition-colors hover:text-error sm:self-auto',
                        FOCUS
                      )}
                    >
                      Cancel Order
                    </button>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="text-[13.5px] text-text-secondary">
                        Cancel this order? Nothing has been charged.
                      </span>
                      <button
                        type="button"
                        onClick={() => setConfirmingCancel(false)}
                        disabled={cancelling}
                        className={cn(accountBtn.secondary, 'h-10', FOCUS)}
                      >
                        Keep Waiting
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleCancelOrder()}
                        disabled={cancelling}
                        className={cn(accountBtn.danger, 'h-10', FOCUS)}
                      >
                        {cancelling && <CircleNotchIcon className="h-4 w-4 motion-safe:animate-spin" aria-hidden />}
                        Yes, Cancel It
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </section>

          {/* ── Side column: status + summary + policy ── */}
          <aside className="flex min-w-0 flex-col gap-4" aria-label="Order">
            <section aria-label="Payment Status" className={cn(MARKET_CARD, 'order-1 rounded-lg p-5 lg:order-2')}>
              <h2 className="mb-4 text-[14px] font-semibold text-text-primary">Payment Status</h2>
              <StatusTimeline
                view={view}
                createdAt={createdAt}
                seenAt={stamps.current.seen ?? null}
                confirmedAt={stamps.current.confirmed ?? null}
                seenTx={seenTx}
                networkName={selected?.networkName ?? null}
                confirmEta={selected?.confirmEta ?? null}
              />
            </section>

            <section aria-label="Order Summary" className={cn(MARKET_CARD, 'order-2 rounded-lg p-5 lg:order-1')}>
              <div className="flex items-start gap-3.5">
                {itemImage ? (
                  <Image
                    src={itemImage}
                    alt=""
                    width={52}
                    height={52}
                    unoptimized
                    className="h-[52px] w-[52px] shrink-0 rounded-md bg-white/[0.04] object-cover"
                  />
                ) : (
                  <span aria-hidden className="h-[52px] w-[52px] shrink-0 rounded-md bg-white/[0.04]" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-[14px] font-semibold leading-snug text-text-primary">
                    {listingTitle}
                  </p>
                  {gameName && <p className="mt-0.5 truncate text-[13px] text-text-secondary">{gameName}</p>}
                  {orderNumber && (
                    <p className="mt-0.5 select-all text-[12.5px] tabular-nums text-text-tertiary">
                      Order {orderNumber}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-4 border-t border-white/[0.07] pt-1">
                {summary.itemPrice != null && (
                  <SummaryRow label={summary.quantity > 1 ? `Item Price × ${summary.quantity}` : 'Item Price'}>
                    {money(summary.itemPrice)}
                  </SummaryRow>
                )}
                {summary.serviceFee != null && summary.serviceFee > 0 && (
                  <SummaryRow label="Service Fee">{money(summary.serviceFee)}</SummaryRow>
                )}
                {summary.promoDiscount > 0 && (
                  <SummaryRow label="Discount">−{money(summary.promoDiscount)}</SummaryRow>
                )}
                {summary.storeCredit > 0 && (
                  <SummaryRow label="Store Credit">−{money(summary.storeCredit)}</SummaryRow>
                )}
                <SummaryRow label="Total" strong>
                  {money(invoiceAmount)}
                </SummaryRow>
              </div>
            </section>

            <div className="order-3 px-1 pt-1">
              <p className="flex items-start gap-2 text-[13px] leading-relaxed text-text-secondary">
                <ShieldCheckIcon className="mt-[2px] h-4 w-4 shrink-0 text-text-tertiary" aria-hidden />
                <span>
                  Covered by <span className="font-medium text-text-primary">SafeDrop Protection</span>. Item
                  guaranteed or full refund.
                </span>
              </p>
              <nav aria-label="Help And Policies" className="mt-3 flex flex-wrap gap-x-5 gap-y-2 pl-6 text-[13px]">
                <HelpDrawer
                  trigger={
                    <button
                      type="button"
                      className={cn('rounded-sm text-text-secondary underline-offset-4 hover:text-text-primary hover:underline', FOCUS)}
                    >
                      Payment Help
                    </button>
                  }
                />
                <Link
                  href="/terms"
                  className={cn('rounded-sm text-text-secondary underline-offset-4 hover:text-text-primary hover:underline', FOCUS)}
                >
                  Terms
                </Link>
                <Link
                  href="/refunds"
                  className={cn('rounded-sm text-text-secondary underline-offset-4 hover:text-text-primary hover:underline', FOCUS)}
                >
                  Refund Policy
                </Link>
              </nav>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
