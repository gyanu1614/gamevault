'use client'

/**
 * PayClient — the interactive half of the native BTCPay payment page.
 *
 * Renders the per-coin address/QR/amount, counts down the invoice window and
 * polls getPaymentPageStatus. Display-only state machine:
 *   awaiting → confirming (Processing) → paid (order left 'pending' → redirect)
 *   awaiting → expired (Expired/Invalid, or the local countdown hits 0)
 * The verified webhook is the sole authority for marking the order paid; this
 * component only ever *reads*.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowUpRight,
  Check,
  CircleAlert,
  Clock,
  Copy,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import { getPaymentPageStatus } from '@/lib/actions/payment-page'
import { retryOrderPayment } from '@/lib/actions/checkout'

export interface PayMethod {
  id: string
  label: string
  short: string
  address: string
  paymentLink: string | null
  due: string
  totalPaid: string
  rate: string | null
  qrDataUrl: string
}

type ViewState = 'awaiting' | 'confirming' | 'paid' | 'expired' | 'unreachable'

const POLL_MS = 4000

function fmtCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

/** Fiat symbol for the order currency (USD is the platform default). */
function fiatSymbol(currency: string): string {
  const c = currency.toUpperCase()
  return c === 'USD' ? '$' : c === 'EUR' ? '€' : c === 'GBP' ? '£' : `${c} `
}

/** Trim a crypto decimal string for display (drop trailing zeros, keep ≤8 dp). */
function fmtCrypto(v: string | undefined): string {
  if (!v) return ''
  const n = Number(v)
  if (!Number.isFinite(n)) return v
  return n.toFixed(8).replace(/\.?0+$/, '')
}

export default function PayClient({
  orderId,
  listingTitle,
  totalAmount,
  currency,
  invoiceAmount,
  initialInvoiceStatus,
  expiresAt,
  methods,
}: {
  orderId: string
  listingTitle: string
  totalAmount: number
  currency: string
  invoiceAmount: number
  initialInvoiceStatus: string
  expiresAt: string | null
  methods: PayMethod[]
}) {
  const router = useRouter()

  const initialView: ViewState =
    initialInvoiceStatus === 'Processing'
      ? 'confirming'
      : initialInvoiceStatus === 'New'
        ? 'awaiting'
        : initialInvoiceStatus === 'Unreachable'
          ? 'unreachable'
          : 'expired'

  const [view, setView] = useState<ViewState>(initialView)
  const [selectedId, setSelectedId] = useState(methods[0]?.id ?? '')
  const [liveDue, setLiveDue] = useState<Record<string, { due?: string; totalPaid?: string }>>({})
  const [remainingMs, setRemainingMs] = useState(() =>
    expiresAt ? new Date(expiresAt).getTime() - Date.now() : 0
  )
  const [copied, setCopied] = useState<'address' | 'amount' | null>(null)
  const [retrying, setRetrying] = useState(false)
  const viewRef = useRef(view)
  viewRef.current = view

  const selected = useMemo(
    () => methods.find((m) => m.id === selectedId) ?? methods[0],
    [methods, selectedId]
  )
  const live = selected ? liveDue[selected.id] : undefined
  const dueDisplay = fmtCrypto(live?.due ?? selected?.due)
  const partiallyPaid = Number(live?.totalPaid ?? selected?.totalPaid ?? 0) > 0

  // ── Countdown ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!expiresAt || view !== 'awaiting') return
    const t = setInterval(() => {
      const left = new Date(expiresAt).getTime() - Date.now()
      setRemainingMs(left)
      // Local expiry is a display hint; the poll confirms the real state.
      if (left <= 0) setView((v) => (v === 'awaiting' ? 'expired' : v))
    }, 1000)
    return () => clearInterval(t)
  }, [expiresAt, view])

  // ── Status poll ───────────────────────────────────────────────────
  useEffect(() => {
    if (view === 'paid') return
    const t = setInterval(async () => {
      const res = await getPaymentPageStatus(orderId)
      if (!res.success) return
      if (res.orderStatus && res.orderStatus !== 'pending') {
        setView('paid')
        setTimeout(() => router.replace(`/account/orders/${orderId}?paid=1`), 1200)
        return
      }
      if (res.methods?.length) {
        setLiveDue((prev) => {
          const next = { ...prev }
          for (const m of res.methods!) next[m.paymentMethodId] = { due: m.due, totalPaid: m.totalPaid }
          return next
        })
      }
      switch (res.invoiceStatus) {
        case 'Processing':
          setView('confirming')
          break
        case 'Expired':
        case 'Invalid':
          setView((v) => (v === 'confirming' ? v : 'expired'))
          break
        case 'New':
          setView((v) => (v === 'unreachable' ? 'awaiting' : v))
          break
      }
    }, POLL_MS)
    return () => clearInterval(t)
  }, [orderId, router, view])

  const copy = useCallback(async (what: 'address' | 'amount', text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(what)
      setTimeout(() => setCopied((c) => (c === what ? null : c)), 1600)
    } catch {
      // clipboard blocked — the text is selectable
    }
  }, [])

  const freshInvoice = useCallback(async () => {
    setRetrying(true)
    const res = await retryOrderPayment(orderId)
    if (res.success && res.fullyPaidByWallet) {
      router.replace(`/account/orders/${orderId}?paid=1`)
      return
    }
    // New invoice minted (or the old one is still valid) — re-render the
    // server page so address/QR/expiry reflect it.
    router.refresh()
    setRetrying(false)
    setView('awaiting')
  }, [orderId, router])

  const walletCredit = Math.max(0, totalAmount - invoiceAmount)

  return (
    <div className="flex min-h-[70vh] w-full items-center justify-center px-4 py-10">
      <div className="w-full max-w-[560px] rounded-xl border border-white/10 bg-white/[0.04] p-6 sm:p-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-lime-400/30 bg-lime-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-lime-300">
            <ShieldCheck className="h-3 w-3" />
            SafeDrop Protected
          </span>
          {view === 'awaiting' && expiresAt && (
            <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold tabular-nums text-white/60">
              <Clock className="h-3.5 w-3.5" />
              Expires In {fmtCountdown(remainingMs)}
            </span>
          )}
        </div>

        <h1 className="mt-4 text-[24px] font-bold tracking-tight text-white">
          {view === 'paid' ? 'Payment Confirmed' : 'Complete Your Payment'}
        </h1>

        {/* Order summary */}
        <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3">
          <p className="min-w-0 truncate text-[14px] font-semibold text-white">{listingTitle}</p>
          <div className="shrink-0 text-right">
            <p className="text-[15px] font-bold text-lime-300">
              {fiatSymbol(currency)}
              {invoiceAmount.toFixed(2)}{' '}
              <span className="text-[11px] font-medium text-white/40">{currency}</span>
            </p>
            {walletCredit > 0.004 && (
              <p className="text-[11px] text-white/45">
                −{fiatSymbol(currency)}
                {walletCredit.toFixed(2)} Wallet Credit Applied
              </p>
            )}
          </div>
        </div>

        {/* ── Body by state ── */}
        {view === 'paid' ? (
          <div className="mt-6 flex flex-col items-center gap-3 py-8 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full border border-lime-400/30 bg-lime-400/15">
              <Check className="h-7 w-7 text-lime-300" strokeWidth={2.5} />
            </span>
            <p className="text-[14px] text-white/70">
              Payment received — taking you to your order…
            </p>
          </div>
        ) : view === 'expired' || view === 'unreachable' ? (
          <div className="mt-6 flex flex-col items-center gap-4 py-6 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-amber-400/30 bg-amber-400/10">
              <CircleAlert className="h-6 w-6 text-amber-300" />
            </span>
            <div>
              <p className="text-[15px] font-semibold text-white">
                {view === 'unreachable' ? 'Payment Service Unreachable' : 'Invoice Expired'}
              </p>
              <p className="mx-auto mt-1 max-w-[380px] text-[13px] leading-relaxed text-white/55">
                {view === 'unreachable'
                  ? 'We couldn’t reach the payment server. Nothing was charged — try again in a moment.'
                  : 'The 30-minute payment window closed. No problem — get a fresh invoice at the current rate. If you already sent coins, they’ll be credited once we see them.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void freshInvoice()}
              disabled={retrying}
              className="inline-flex h-[46px] items-center gap-2 rounded-lg bg-lime-400 px-5 text-[14px] font-bold text-[#0F3320] transition-[filter] hover:brightness-110 disabled:opacity-70"
            >
              {retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {view === 'unreachable' ? 'Try Again' : 'Get A Fresh Invoice'}
            </button>
          </div>
        ) : (
          <>
            {/* Coin tabs */}
            {methods.length > 1 && (
              <div className="mt-5 flex gap-2">
                {methods.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedId(m.id)}
                    className={`h-[38px] rounded-lg border px-4 text-[13px] font-semibold transition-colors ${
                      m.id === selected?.id
                        ? 'border-lime-400/60 bg-lime-400/10 text-lime-300'
                        : 'border-white/15 bg-transparent text-white/60 hover:border-white/30 hover:text-white'
                    }`}
                  >
                    {m.short}
                  </button>
                ))}
              </div>
            )}

            {selected && (
              <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] p-5">
                <p className="text-[12.5px] font-medium text-white/60">
                  Send Exactly{' '}
                  <button
                    type="button"
                    onClick={() => void copy('amount', dueDisplay)}
                    className="inline-flex items-center gap-1 align-baseline font-bold text-white transition-colors hover:text-lime-300"
                    title="Copy Amount"
                  >
                    {dueDisplay} {selected.short}
                    {copied === 'amount' ? (
                      <Check className="h-3 w-3 text-lime-300" />
                    ) : (
                      <Copy className="h-3 w-3 opacity-60" />
                    )}
                  </button>{' '}
                  <span className="text-white/40">— {selected.label}, one transaction</span>
                </p>

                {partiallyPaid && (
                  <p className="mt-2 rounded-md border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-[12.5px] text-amber-200">
                    Partial Payment Received — send the remaining {dueDisplay} {selected.short} to
                    the same address.
                  </p>
                )}

                {/* QR */}
                <div className="mt-4 flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selected.qrDataUrl}
                    alt={`${selected.label} Payment QR`}
                    className="h-[220px] w-[220px] rounded-lg bg-white p-2"
                  />
                </div>

                {/* Address */}
                <div className="mt-4">
                  <p className="mb-1.5 text-[12px] font-medium uppercase tracking-wide text-white/45">
                    {selected.label} Address
                  </p>
                  <div className="flex items-stretch gap-2">
                    <code className="min-w-0 flex-1 select-all break-all rounded-lg border border-white/15 bg-black/30 px-3 py-2.5 font-mono text-[12.5px] leading-snug text-white/85">
                      {selected.address}
                    </code>
                    <button
                      type="button"
                      onClick={() => void copy('address', selected.address)}
                      className="inline-flex w-[44px] shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/[0.05] text-white/70 transition-colors hover:border-lime-400/50 hover:text-lime-300"
                      title="Copy Address"
                    >
                      {copied === 'address' ? (
                        <Check className="h-4 w-4 text-lime-300" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {selected.paymentLink && (
                  <a
                    href={selected.paymentLink}
                    className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-lime-300 transition-colors hover:text-lime-200"
                  >
                    Open In Wallet
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            )}

            {/* Status strip */}
            <div className="mt-4 flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
              {view === 'confirming' ? (
                <>
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-lime-300" />
                  <p className="text-[13px] text-white/75">
                    Payment Detected — waiting for network confirmation. This page updates on its
                    own; it’s safe to leave.
                  </p>
                </>
              ) : (
                <>
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime-400 opacity-60" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-lime-400" />
                  </span>
                  <p className="text-[13px] text-white/75">
                    Waiting For Payment — we’ll detect it automatically after you send.
                  </p>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
