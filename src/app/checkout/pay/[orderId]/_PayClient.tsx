'use client'

/**
 * PayClient — "The Ledger Receipt" (design_handoff_crypto_payment_page,
 * option 1a). Payment presented as a living document:
 *
 *   · left  — Payment Ledger rail: each event becomes a timestamped line
 *             (Invoice Created → Rate Locked → live entry → ghosts), the
 *             live entry pulses and swaps through the six states;
 *   · center— receipt card: order row, dashed dividers, QR with a lime
 *             scan line, Send Exactly + address copy chips, network chip,
 *             rate-lock timer, warning callout, mono receipt footer;
 *             Confirmed stamps the receipt PAID;
 *   · right — SafeDrop assurance + help/legal links.
 *
 * Mobile: live status card first, then the receipt, then a condensed
 * footer line. Library parts per the house rule: qr-code-styling, sonner,
 * Framer Motion, canvas-confetti, vaul, Radix, lucide.
 *
 * Display-only state machine — the verified webhook is the sole authority
 * for marking the order paid:
 *   waiting → seen (instant chain-watch, tx id shown) → confirming → paid
 *   waiting → partial (live remaining due) · waiting/partial → expired
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Drawer } from 'vaul'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import { ArrowLeft, Check, Copy, Loader2, Lock, RefreshCw, ShieldCheck, Zap } from 'lucide-react'
import { getPaymentPageStatus } from '@/lib/actions/payment-page'
import { retryOrderPayment } from '@/lib/actions/checkout'
import { CheckoutNavbar } from '../../_components/CheckoutNavbar'

export interface PayMethod {
  id: string
  label: string
  short: string
  icon: string | null
  network: string | null
  networkWarning: string | null
  address: string
  paymentLink: string | null
  due: string
  totalPaid: string
  rate: string | null
}

type ViewState = 'waiting' | 'seen' | 'confirming' | 'paid' | 'partial' | 'expired' | 'unreachable'

const POLL_MS = 4000

// ─── Ledger Receipt tokens (handoff README) ─────────────────────────
const L = {
  ivory: '#FAFAF7',
  white: '#FFFFFF',
  line: '#E4E5DE',
  line2: '#F3F3ED',
  dash: '#DDDBD1',
  conn: '#D8D6CC',
  ink: '#1A1D19',
  muted: '#5B6157',
  faint: '#8A8E84',
  ghost: '#A9ACA1',
  forest: '#14432A',
  lime: '#A3E635',
  limePale: '#EAF7D8',
  warnBg: '#FDF6DB',
  warnLn: '#EED9A0',
  warnTx: '#7A5A11',
  blue: '#1D6FD8',
  blueLn: '#BFD7F4',
  blueBg: '#EAF1FC',
  tether: '#26A17B',
}

function fmtCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

function fmtTime(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleTimeString('en-GB', { hour12: false })
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
  return `${tx.slice(0, 4)}…${tx.slice(-4)}`
}

async function copyText(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.success(`${label} Copied`)
    return true
  } catch {
    toast.error('Copy Failed — Select The Text Manually')
    return false
  }
}

// ─── Small pieces ───────────────────────────────────────────────────

function CopyChip({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        if (await copyText(value, label)) {
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }
      }}
      className="inline-flex h-[30px] shrink-0 items-center gap-1.5 rounded-md border bg-white px-2.5 text-[11.5px] font-semibold transition-colors hover:border-[#14432A66]"
      style={{ borderColor: L.line, color: L.ink }}
    >
      {copied ? (
        <>
          <Check className="h-3 w-3" style={{ color: L.forest }} strokeWidth={2.5} /> Copied
        </>
      ) : (
        <>
          <Copy className="h-3 w-3 opacity-50" /> Copy
        </>
      )}
    </button>
  )
}

/** qr-code-styling — rounded modules, coin logo center, lime scan line
 *  sweeping while we wait (stops once payment is seen). */
function StyledQr({ data, logo, scanning }: { data: string; logo: string | null; scanning: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const qrRef = useRef<any>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { default: QRCodeStyling } = await import('qr-code-styling')
      if (cancelled || !ref.current) return
      const options = {
        width: 180,
        height: 180,
        type: 'svg' as const,
        data,
        margin: 4,
        image: logo ?? undefined,
        dotsOptions: { type: 'rounded' as const, color: L.ink },
        cornersSquareOptions: { type: 'extra-rounded' as const, color: L.forest },
        backgroundOptions: { color: '#FFFFFF' },
        imageOptions: { margin: 5, imageSize: 0.32, hideBackgroundDots: true },
        qrOptions: { errorCorrectionLevel: 'Q' as const },
      }
      if (!qrRef.current) {
        qrRef.current = new QRCodeStyling(options)
        ref.current.innerHTML = ''
        qrRef.current.append(ref.current)
      } else {
        qrRef.current.update(options)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [data, logo])

  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-md border bg-white p-2"
      style={{ borderColor: L.line }}
      aria-label="Payment QR Code"
    >
      <div ref={ref} />
      {scanning && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-x-2 h-[2px] rounded-full"
          style={{
            background: `linear-gradient(90deg, transparent, ${L.lime}, transparent)`,
          }}
          animate={{ top: ['6%', '88%', '6%'] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
    </div>
  )
}

// ─── Step indicator ─────────────────────────────────────────────────

const STEPS = ['Amount', 'Pay', 'Confirming', 'Done'] as const

function StepIndicator({ view }: { view: ViewState }) {
  const current =
    view === 'paid' ? 3 : view === 'seen' || view === 'confirming' ? 2 : 1
  return (
    <div className="flex items-center justify-center gap-2 text-[12.5px]" style={{ color: L.muted }}>
      {STEPS.map((label, i) => (
        <span key={label} className="flex items-center gap-2">
          {i > 0 && <span className="h-px w-[22px]" style={{ background: L.conn }} />}
          {i < current ? (
            <span className="flex items-center gap-1 font-semibold" style={{ color: L.forest }}>
              <Check className="h-3 w-3" strokeWidth={3} />
              {label}
            </span>
          ) : i === current ? (
            <span
              className="rounded-md px-3 py-[3px] font-semibold text-white"
              style={{ background: L.forest }}
            >
              {label}
            </span>
          ) : (
            <span>{label}</span>
          )}
        </span>
      ))}
    </div>
  )
}

// ─── Ledger rail pieces ─────────────────────────────────────────────

function LedgerDone({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="relative pl-[22px] pb-4">
      <span
        className="absolute left-0 top-[3px] h-2 w-2 rounded-full"
        style={{ background: L.forest }}
      />
      <span
        className="absolute left-[3.5px] top-[14px] bottom-0 w-px"
        style={{ background: L.line2 }}
      />
      <p className="text-[12.5px] font-semibold leading-tight" style={{ color: L.ink }}>
        {title}
      </p>
      {meta && (
        <p className="mt-0.5 font-mono text-[11px]" style={{ color: L.faint }}>
          {meta}
        </p>
      )}
    </div>
  )
}

function LedgerGhost({ title, last = false }: { title: string; last?: boolean }) {
  return (
    <div className="relative pl-[22px] pb-4" style={last ? { paddingBottom: 0 } : undefined}>
      <span
        className="absolute left-0 top-[3px] h-2 w-2 rounded-full bg-white"
        style={{ boxShadow: `inset 0 0 0 1.5px ${L.conn}` }}
      />
      {!last && (
        <span
          className="absolute left-[3.5px] top-[14px] bottom-0 w-px"
          style={{ background: L.line2 }}
        />
      )}
      <p className="text-[12.5px] font-medium leading-tight" style={{ color: L.ghost }}>
        {title}
      </p>
    </div>
  )
}

/** The pulsing live entry — content swaps per state. */
function LedgerLive({
  view,
  dueDisplay,
  short,
  seenTx,
  onCopyRemaining,
  remainingClock,
}: {
  view: ViewState
  dueDisplay: string
  short: string
  seenTx: string | null
  onCopyRemaining: () => void
  remainingClock: string
}) {
  const dotColor = view === 'seen' ? L.blue : L.forest
  return (
    <div className="relative pl-[22px] pb-4">
      <motion.span
        className="absolute left-[-1px] top-[2px] h-[10px] w-[10px] rounded-full"
        style={{ background: dotColor }}
        animate={{ boxShadow: ['0 0 0 0 rgba(163,230,53,0.55)', '0 0 0 12px rgba(163,230,53,0)'] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
      />
      <span
        className="absolute left-[3.5px] top-[16px] bottom-0 w-px"
        style={{ background: L.line2 }}
      />
      <AnimatePresence mode="wait" initial={false}>
        {view === 'seen' ? (
          <motion.div key="seen" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <p className="flex items-center gap-1.5 text-[13px] font-bold" style={{ color: L.blue }}>
              <Zap className="h-3.5 w-3.5" /> Payment Seen On Network
            </p>
            <p className="mt-1 text-[11.5px] leading-snug" style={{ color: L.muted }}>
              {dueDisplay} {short} spotted — your money is on its way. Confirming now.
            </p>
            {seenTx && (
              <p className="mt-1 font-mono text-[11px]" style={{ color: L.faint }}>
                tx {seenTx}
              </p>
            )}
          </motion.div>
        ) : view === 'confirming' ? (
          <motion.div key="confirming" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <p className="text-[13px] font-bold" style={{ color: L.forest }}>
              Confirming Your Payment
            </p>
            <div className="mt-1.5 h-[6px] w-full overflow-hidden rounded-full" style={{ background: L.line2 }}>
              <motion.div
                className="h-full w-[40%] rounded-full"
                style={{ background: L.forest }}
                animate={{ x: ['-100%', '250%'] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>
            <p className="mt-1.5 text-[11.5px] leading-snug" style={{ color: L.muted }}>
              Usually under a minute on TRON. Your funds are safe either way.
            </p>
          </motion.div>
        ) : view === 'partial' ? (
          <motion.div key="partial" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <p className="text-[13px] font-bold" style={{ color: L.warnTx }}>
              Partial Payment Received
            </p>
            <p className="mt-1 text-[11.5px] leading-snug" style={{ color: L.muted }}>
              Exchange fees often cause this — nothing is lost. Send the remaining{' '}
              <b style={{ color: L.ink }}>
                {dueDisplay} {short}
              </b>{' '}
              to the same address.
            </p>
            <button
              type="button"
              onClick={onCopyRemaining}
              className="mt-2 inline-flex h-[28px] items-center gap-1.5 rounded-md border bg-white px-2.5 text-[11.5px] font-semibold"
              style={{ borderColor: L.warnLn, color: L.warnTx }}
            >
              <Copy className="h-3 w-3" /> Copy {dueDisplay} {short}
            </button>
            <p className="mt-1.5 font-mono text-[11px]" style={{ color: L.faint }} suppressHydrationWarning>
              Rate still locked · {remainingClock}
            </p>
          </motion.div>
        ) : (
          <motion.div key="waiting" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <p className="text-[13px] font-bold" style={{ color: L.forest }}>
              Waiting For Your Payment
            </p>
            <p className="mt-1 text-[11.5px] leading-snug" style={{ color: L.muted }}>
              Watching the TRON network — updates here within seconds of your send.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function HelpDrawer({ trigger }: { trigger: React.ReactNode }) {
  return (
    <Drawer.Root>
      <Drawer.Trigger asChild>{trigger}</Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Drawer.Content
          className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[520px] rounded-t-lg p-6 pb-9"
          style={{ background: L.ivory, color: L.ink }}
        >
          <div className="mx-auto mb-4 h-1.5 w-10 rounded-full" style={{ background: L.line }} />
          <Drawer.Title className="text-[15px] font-extrabold">Payment Help</Drawer.Title>
          <div className="mt-3 space-y-3 text-[12.5px] leading-relaxed" style={{ color: L.muted }}>
            <p>
              <b style={{ color: L.ink }}>How long does it take?</b> Crypto payments are usually
              detected within seconds of sending and confirmed within a few minutes.
            </p>
            <p>
              <b style={{ color: L.ink }}>Sent slightly too little?</b> Exchange withdrawal fees can
              shave the amount — this page shows the small remainder to send.
            </p>
            <p>
              <b style={{ color: L.ink }}>Invoice expired after you paid?</b> Don’t worry — payments
              are never lost. Contact us and we’ll sort it right away.
            </p>
            <a
              href="mailto:support@dropmarket.gg"
              className="inline-flex h-[42px] items-center rounded-md px-4 text-[13px] font-bold text-white"
              style={{ background: L.forest }}
            >
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
  listingTitle,
  itemImage,
  gameName,
  totalAmount,
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
  listingTitle: string
  itemImage: string | null
  gameName: string | null
  totalAmount: number
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
  const stamps = useRef<Record<string, string>>({})
  const confettiFired = useRef(false)

  const selected = useMemo(
    () => methods.find((m) => m.id === selectedId) ?? methods[0],
    [methods, selectedId]
  )
  const live = selected ? liveDue[selected.id] : undefined
  const dueDisplay = fmtCrypto(live?.due ?? selected?.due)
  const sym = currency.toUpperCase() === 'EUR' ? '€' : '$'
  const rateLine = selected?.rate
    ? `1 ${selected.short} = ${sym}${Number(selected.rate).toFixed(2)}`
    : null

  const stamp = (key: string) => {
    if (!stamps.current[key]) stamps.current[key] = new Date().toISOString()
    return stamps.current[key]
  }

  // ── Countdown ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!expiresAt || !(view === 'waiting' || view === 'seen' || view === 'partial')) return
    const t = setInterval(() => {
      const left = new Date(expiresAt).getTime() - Date.now()
      setRemainingMs(left)
      if (left <= 0)
        setView((v) => (v === 'waiting' || v === 'seen' || v === 'partial' ? 'expired' : v))
    }, 1000)
    return () => clearInterval(t)
  }, [expiresAt, view])

  // ── Status poll (webhook truth + chain-watch sugar) ───────────────
  useEffect(() => {
    if (view === 'paid') return
    const t = setInterval(async () => {
      const res = await getPaymentPageStatus(orderId)
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
    }, POLL_MS)
    return () => clearInterval(t)
  }, [orderId, router, view])

  // ── Confirmed celebration ─────────────────────────────────────────
  useEffect(() => {
    if (view !== 'paid' || confettiFired.current) return
    confettiFired.current = true
    ;(async () => {
      const { default: confetti } = await import('canvas-confetti')
      confetti({
        particleCount: 110,
        spread: 75,
        origin: { y: 0.45 },
        colors: [L.lime, '#1B5E3A', '#ffffff', L.forest],
      })
    })()
  }, [view])

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

  const openInWallet = useCallback(async () => {
    const link = selected?.paymentLink
    const coarse =
      typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
    if (link && coarse) {
      window.location.href = link
      return
    }
    // Desktop fallback (per handoff): copy the address instead.
    if (selected) {
      await copyText(selected.address, 'Address')
      toast.info('Open your wallet app on your phone and paste the address.')
    }
  }, [selected])

  const scanning = view === 'waiting'
  const seenAtMeta = stamps.current.seen ? `· ${fmtTime(stamps.current.seen)}` : ''

  // ── Ledger rail (shared desktop rail / mobile status card) ────────
  const ledgerRail = (
    <div>
      <p
        className="mb-4 text-[11px] font-bold uppercase tracking-[0.08em]"
        style={{ color: L.faint }}
      >
        Payment Ledger
      </p>
      <LedgerDone title="Invoice Created" meta={fmtTime(createdAt)} />
      <LedgerDone title="Rate Locked" meta={rateLine ? `${rateLine} · ${fmtTime(createdAt)}` : fmtTime(createdAt)} />
      {(view === 'confirming' || view === 'paid') && (
        <LedgerDone title="Payment Seen On Network" meta={`${seenTx ? `tx ${shortTx(seenTx)} ` : ''}${seenAtMeta}`.trim()} />
      )}
      {view === 'paid' ? (
        <div className="relative pl-[22px]">
          <motion.span
            initial={{ scale: 0.5 }}
            animate={{ scale: [0.5, 1.12, 1] }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="absolute left-[-4px] top-0 grid h-4 w-4 place-items-center rounded-full"
            style={{ background: L.forest }}
          >
            <Check className="h-2.5 w-2.5" style={{ color: L.lime }} strokeWidth={4} />
          </motion.span>
          <p className="text-[13px] font-extrabold" style={{ color: L.forest }}>
            Payment Confirmed
          </p>
          <p className="mt-1 text-[11.5px] leading-snug" style={{ color: L.muted }}>
            {listingTitle} is on its way to your inventory. Receipt emailed.
          </p>
        </div>
      ) : view === 'expired' || view === 'unreachable' ? (
        <div className="relative pl-[22px]">
          <span className="absolute left-0 top-[3px] h-2 w-2 rounded-full" style={{ background: L.ghost }} />
          <p className="text-[13px] font-bold" style={{ color: L.ink }}>
            {view === 'unreachable' ? 'Payment Service Unreachable' : 'Invoice Expired'}
          </p>
          <p className="mt-1 text-[11.5px] leading-snug" style={{ color: L.muted }}>
            {view === 'unreachable'
              ? 'We couldn’t reach the payment server. Nothing was charged.'
              : 'No charge was made and nothing was lost. Rates move, so we start fresh.'}
          </p>
        </div>
      ) : (
        <>
          <LedgerLive
            view={view}
            dueDisplay={dueDisplay}
            short={selected?.short ?? ''}
            seenTx={seenTx ? shortTx(seenTx) : null}
            onCopyRemaining={() => void copyText(dueDisplay, 'Remaining Amount')}
            remainingClock={fmtCountdown(remainingMs)}
          />
          {view !== 'seen' && <LedgerGhost title="Payment Seen On Network" />}
          <LedgerGhost title="Confirmed" last />
        </>
      )}
    </div>
  )

  return (
    <div className="min-h-screen" style={{ background: L.ivory }}>
      <CheckoutNavbar user={user} buyerProfile={buyerProfile} />

      <div className="mx-auto w-full max-w-[1120px] px-4 pb-10 pt-8 sm:px-10">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              aria-label="Go Back"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-md border bg-white/60 backdrop-blur-sm transition-colors hover:bg-white"
              style={{ borderColor: L.line, color: L.ink }}
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <Lock className="h-[18px] w-[18px]" style={{ color: L.forest }} />
            <span className="text-[20px] font-bold sm:text-[24px]" style={{ color: L.ink }}>
              Complete Your Payment
            </span>
          </span>
          <span
            className="hidden items-center gap-1.5 rounded-md border bg-white px-2.5 py-1.5 text-[12px] font-semibold tracking-[0.01em] sm:flex sm:text-[12.5px]"
            style={{ borderColor: L.line, color: L.ink }}
          >
            <ShieldCheck className="h-4 w-4" style={{ color: L.forest }} />
            256-Bit SSL Secure
          </span>
        </div>

        <div className="mt-6">
          <StepIndicator view={view} />
        </div>

        <div className="mt-5 flex flex-col gap-3 lg:grid lg:justify-center lg:gap-7 lg:[grid-template-columns:280px_minmax(0,1fr)_260px]">
          {/* ── Mobile: live status card first ── */}
          <div
            className="rounded-lg border bg-white p-4 lg:hidden"
            style={{
              borderColor:
                view === 'seen' ? L.blueLn : view === 'partial' ? L.warnLn : view === 'paid' ? L.lime : L.line,
            }}
          >
            {ledgerRail}
          </div>

          {/* ── Column 1: ledger rail (desktop) ── */}
          <div className="hidden lg:block">
            <div
              className="rounded-lg border bg-white p-[18px]"
              style={{
                borderColor:
                  view === 'seen' ? L.blueLn : view === 'partial' ? L.warnLn : view === 'paid' ? L.lime : L.line,
              }}
            >
              {ledgerRail}
            </div>
            <div className="mt-3 rounded-lg border bg-white px-[18px] py-3.5" style={{ borderColor: L.line }}>
              <p className="text-[12px] leading-relaxed" style={{ color: L.muted }}>
                <b style={{ color: L.forest }}>Safe To Close This Page.</b> We keep watching —
                you’ll get an email the moment it confirms.
              </p>
            </div>
          </div>

          {/* ── Column 2: receipt card ── */}
          <div className="relative rounded-lg border bg-white px-5 py-5 sm:px-7 sm:py-6" style={{ borderColor: view === 'paid' ? L.lime : L.line }}>
            {/* PAID stamp */}
            <AnimatePresence>
              {view === 'paid' && (
                <motion.div
                  initial={{ opacity: 0, scale: 1.4, rotate: 8 }}
                  animate={{ opacity: 1, scale: 1, rotate: 8 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  className="pointer-events-none absolute right-6 top-5 z-10 rounded-md px-3 py-1 text-[18px] font-extrabold tracking-[0.12em]"
                  style={{
                    border: `2.5px solid ${L.forest}`,
                    color: L.forest,
                    background: 'rgba(163,230,53,0.18)',
                  }}
                >
                  PAID
                </motion.div>
              )}
            </AnimatePresence>

            {/* Order row */}
            <div className="flex items-center gap-3.5">
              {itemImage && (
                <Image
                  src={itemImage}
                  alt={listingTitle}
                  width={52}
                  height={52}
                  unoptimized
                  className="h-[52px] w-[52px] shrink-0 rounded-md object-cover"
                  style={{ background: L.line2 }}
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold" style={{ color: L.ink }}>
                  {listingTitle}
                </p>
                <p className="mt-0.5 font-mono text-[12px]" style={{ color: L.faint }}>
                  {orderNumber ? `Order #${orderNumber}` : gameName ?? ''}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[11px]" style={{ color: L.faint }}>
                  Amount Due
                </p>
                <p className="text-[16px] font-bold" style={{ color: L.ink }}>
                  {sym}
                  {invoiceAmount.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="my-4 border-t border-dashed" style={{ borderColor: L.dash }} />

            {view === 'expired' || view === 'unreachable' ? (
              /* ── Expired / unreachable panel ── */
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <p className="text-[15px] font-bold" style={{ color: L.ink }}>
                  {view === 'unreachable' ? 'Payment Service Unreachable' : 'Invoice Expired'}
                </p>
                <p className="max-w-[340px] text-[12.5px] leading-relaxed" style={{ color: L.muted }}>
                  {view === 'unreachable'
                    ? 'We couldn’t reach the payment server. Nothing was charged — try again in a moment.'
                    : 'No charge was made and nothing was lost. Rates move, so we start fresh.'}
                </p>
                <button
                  type="button"
                  onClick={() => void freshInvoice()}
                  disabled={retrying}
                  className="inline-flex h-[44px] items-center gap-2 rounded-md px-5 text-[13.5px] font-semibold text-white transition-[filter] hover:brightness-110 disabled:opacity-70"
                  style={{ background: L.forest }}
                >
                  {retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  {view === 'unreachable' ? 'Try Again' : 'Get A Fresh Invoice'}
                </button>
                <Link href="/support" className="text-[12px] underline" style={{ color: L.muted }}>
                  Already sent? Contact support
                </Link>
              </div>
            ) : selected ? (
              <>
                {/* Payment row */}
                <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
                  <StyledQr
                    data={selected.paymentLink || selected.address}
                    logo={selected.icon}
                    scanning={scanning}
                  />
                  <div className="flex w-full min-w-0 flex-1 flex-col gap-3">
                    <div>
                      <p className="text-[11px]" style={{ color: L.faint }}>
                        Send Exactly
                      </p>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <p className="text-[24px] font-extrabold leading-none" style={{ color: L.ink }}>
                          {dueDisplay} {selected.short}
                        </p>
                        <CopyChip value={dueDisplay} label="Amount" />
                      </div>
                    </div>
                    <div>
                      <p className="text-[11px]" style={{ color: L.faint }}>
                        To This TRON Address
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <code
                          className="min-w-0 flex-1 break-all rounded-md border px-2.5 py-2 font-mono text-[12px] leading-snug"
                          style={{ borderColor: L.line, background: L.ivory, color: L.ink }}
                        >
                          {selected.address}
                        </code>
                        <CopyChip value={selected.address} label="Address" />
                      </div>
                    </div>
                    {view === 'paid' ? (
                      <button
                        type="button"
                        onClick={() => router.replace(`/account/orders/${orderId}?paid=1`)}
                        className="h-[42px] w-full rounded-md text-[13.5px] font-semibold text-white transition-[filter] hover:brightness-110"
                        style={{ background: L.forest }}
                      >
                        View Your Item
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void openInWallet()}
                        className="h-[42px] w-full rounded-md text-[13.5px] font-semibold text-white transition-[filter] hover:brightness-110"
                        style={{ background: L.forest }}
                      >
                        Open In Wallet App
                      </button>
                    )}
                  </div>
                </div>

                {/* Meta row */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-md border bg-white px-2.5 py-1 text-[12px] font-semibold"
                    style={{ borderColor: L.line, color: L.ink }}
                  >
                    <span
                      className="inline-block h-3.5 w-3.5 rounded-full text-center text-[9px] font-extrabold leading-[14px] text-white"
                      style={{ background: L.tether }}
                    >
                      ₮
                    </span>
                    {selected.label} on {selected.network ?? 'TRON · TRC20'}
                  </span>
                  {(view === 'waiting' || view === 'seen' || view === 'partial') && (
                    <span className="text-[12px]" style={{ color: L.muted }}>
                      Rate Locked · Expires In{' '}
                      <b className="font-mono" style={{ color: L.forest }} suppressHydrationWarning>
                        {fmtCountdown(remainingMs)}
                      </b>
                    </span>
                  )}
                </div>

                {/* Warning callout */}
                {view !== 'paid' && (
                  <div
                    className="mt-3.5 rounded-md border px-3.5 py-2.5 text-[12px] leading-[1.5]"
                    style={{ background: L.warnBg, borderColor: L.warnLn, color: L.warnTx }}
                  >
                    <b>Send Only {selected.short} On {selected.network ?? 'TRON (TRC20)'}.</b> Funds
                    sent on any other network cannot be recovered.
                  </div>
                )}
              </>
            ) : null}

            {/* Receipt footer */}
            <div className="mt-4 border-t border-dashed pt-3" style={{ borderColor: L.dash }}>
              <div className="flex items-center justify-between font-mono text-[11px]" style={{ color: L.ghost }}>
                <span>{orderNumber ? `#${orderNumber}` : orderId.slice(0, 8)}</span>
                <span>{selected ? `${selected.short}-${(selected.network ?? '').replace(/[^A-Z0-9]/gi, '')}` : ''}</span>
                <span>
                  {sym}
                  {invoiceAmount.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* ── Column 3: assurance (desktop) ── */}
          <div className="hidden lg:block">
            <div className="rounded-lg border bg-white p-[18px]" style={{ borderColor: L.line }}>
              <div className="flex items-center gap-2.5">
                <span
                  className="grid h-5 w-5 place-items-center rounded-md"
                  style={{ background: L.limePale }}
                >
                  <Check className="h-3 w-3" style={{ color: L.forest }} strokeWidth={3} />
                </span>
                <p className="text-[13px] font-bold" style={{ color: L.forest }}>
                  SafeDrop Buyer Protection
                </p>
              </div>
              <p className="mt-2 text-[12px] leading-relaxed" style={{ color: L.muted }}>
                Item guaranteed or full refund — released to your inventory only after your payment
                confirms.
              </p>
            </div>
            <div className="mt-3 flex flex-col gap-2 rounded-lg border bg-white p-[18px]" style={{ borderColor: L.line }}>
              <HelpDrawer
                trigger={
                  <button type="button" className="text-left text-[12.5px] font-semibold hover:underline" style={{ color: L.forest }}>
                    Need Help?
                  </button>
                }
              />
              <Link href="/terms" className="text-[12.5px] hover:underline" style={{ color: L.forest }}>
                Terms
              </Link>
              <Link href="/refunds" className="text-[12.5px] hover:underline" style={{ color: L.forest }}>
                Refund Policy
              </Link>
            </div>
          </div>

          {/* ── Mobile footer line ── */}
          <p className="pb-2 text-center text-[11.5px] lg:hidden" style={{ color: L.muted }}>
            <Check className="mr-1 inline h-3 w-3" style={{ color: L.forest }} strokeWidth={3} />
            SafeDrop Protected ·{' '}
            <HelpDrawer
              trigger={
                <button type="button" className="font-semibold" style={{ color: L.forest }}>
                  Need Help?
                </button>
              }
            />{' '}
            ·{' '}
            <Link href="/terms" style={{ color: L.forest }}>
              Terms
            </Link>{' '}
            ·{' '}
            <Link href="/refunds" style={{ color: L.forest }}>
              Refunds
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
