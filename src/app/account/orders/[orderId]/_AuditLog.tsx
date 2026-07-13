'use client'

/**
 * AuditLog — V21/P7 (horizontal stepper)
 *
 * Horizontal order-progress tracker. Nodes sit along a single rail;
 * the rail fills lime up to the furthest-reached stage. Each node has
 * a title ABOVE and a sub-detail + timestamp BELOW, like a delivery
 * tracker.
 *
 * Stages are derived from the order row's status timestamps — no
 * separate events table, so the tracker always reflects the order's
 * real state. Branch outcomes (disputed / refunded / cancelled)
 * recolor the relevant node instead of adding a parallel track.
 *
 * On narrow viewports the stepper rotates to a vertical rail so the
 * labels don't crush — same data, responsive layout.
 */

import { OrderCard } from './_OrderCard'
import {
  ShoppingBag,
  Shield,
  Truck,
  PackageCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Tone = 'lime' | 'amber' | 'blue' | 'red'

interface Stage {
  key: string
  Icon: LucideIcon
  title: string
  detail: string
  /** Timestamp when this stage was reached; null = not reached yet. */
  at: string | null
  /** Reached stages paint their tone; unreached stay neutral grey. */
  tone: Tone
}

interface AuditLogProps {
  order: {
    status: string
    created_at: string
    delivery_started_at?: string | null
    delivered_at?: string | null
    completed_at?: string | null
    disputed_at?: string | null
    cancelled_at?: string | null
    refunded_at?: string | null
  }
  disputeResolution?: {
    favored_party: 'buyer' | 'seller' | 'neutral'
    resolved_at?: string | null
  } | null
}

const TONE: Record<Tone, { dot: string; glyph: string; text: string }> = {
  lime:  { dot: 'bg-lime',     glyph: 'text-text-inverse', text: 'text-lime-text' },
  amber: { dot: 'bg-amber',    glyph: 'text-text-inverse', text: 'text-amber' },
  blue:  { dot: 'bg-blue-400', glyph: 'text-text-inverse', text: 'text-blue-400' },
  red:   { dot: 'bg-red-400',  glyph: 'text-text-inverse', text: 'text-red-400' },
}

function fmtAbsolute(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export function AuditLog({ order, disputeResolution }: AuditLogProps) {
  // Build the happy-path stages first, then splice branch outcomes.
  const stages: Stage[] = [
    {
      key: 'created',
      Icon: ShoppingBag,
      title: 'Order Created',
      detail: 'Covered By SafeDrop™ Buyer Protection',
      at: order.created_at,
      tone: 'lime',
    },
    {
      key: 'delivering',
      Icon: Truck,
      title: 'Delivery Started',
      detail: 'Seller Preparing Order',
      at: order.delivery_started_at ?? null,
      tone: 'lime',
    },
    {
      key: 'delivered',
      Icon: PackageCheck,
      title: 'Delivered',
      detail: 'Protection Window Open',
      at: order.delivered_at ?? null,
      tone: 'lime',
    },
    {
      key: 'completed',
      Icon: CheckCircle2,
      title: 'Completed',
      detail: 'Seller Paid Out',
      at: order.completed_at ?? null,
      tone: 'lime',
    },
  ]

  // Branch outcomes replace the tail of the track. A disputed order
  // swaps "Completed" for a Dispute node (then a Resolved node if it
  // resolved). Refund / cancel swap in a terminal red/blue node.
  if (order.cancelled_at) {
    stages.splice(
      1,
      stages.length - 1,
      {
        key: 'cancelled',
        Icon: XCircle,
        title: 'Cancelled',
        detail: 'Order Was Cancelled',
        at: order.cancelled_at,
        tone: 'red',
      },
    )
  } else if (order.refunded_at) {
    stages.push({
      key: 'refunded',
      Icon: RefreshCw,
      title: 'Refunded',
      detail: 'Refund Issued To Buyer',
      at: order.refunded_at,
      tone: 'blue',
    })
  } else if (order.disputed_at) {
    // Insert dispute before "Completed".
    const completedIdx = stages.findIndex((s) => s.key === 'completed')
    const disputeNodes: Stage[] = [
      {
        key: 'disputed',
        Icon: AlertTriangle,
        title: 'Disputed',
        detail: 'Payout Paused — Under Review',
        at: order.disputed_at,
        tone: 'amber',
      },
    ]
    if (disputeResolution?.resolved_at) {
      const f = disputeResolution.favored_party
      disputeNodes.push({
        key: 'resolved',
        Icon: Shield,
        title: 'Resolved',
        detail:
          f === 'buyer'
            ? 'Ruled In Buyer’s Favor'
            : f === 'seller'
            ? 'Ruled In Seller’s Favor'
            : 'Neutral Outcome',
        at: disputeResolution.resolved_at,
        tone: 'blue',
      })
    }
    stages.splice(completedIdx, 1, ...disputeNodes)
  }

  // V21/P7 — Backfill reached state. A stage counts as reached if it
  // has its own timestamp OR any later stage was reached (you can't be
  // "Delivered" without having "Started" — even when the DB never
  // recorded delivery_started_at because Mark-As-Delivered fired before
  // the delivering flip). Walk right-to-left, carrying the flag back.
  const reached: boolean[] = new Array(stages.length).fill(false)
  let seenLater = false
  for (let i = stages.length - 1; i >= 0; i--) {
    if (stages[i].at) seenLater = true
    reached[i] = seenLater
  }

  return (
    <OrderCard className="px-5 pb-4 pt-4 sm:px-6">
      <div className="mb-4 flex items-center gap-2.5">
        <span
          aria-hidden
          className="h-5 w-5 [background:currentColor] text-lime-text"
          style={{
            maskImage: "url('/assets/order-icons/audit.svg')",
            WebkitMaskImage: "url('/assets/order-icons/audit.svg')",
            maskSize: 'contain',
            WebkitMaskSize: 'contain',
            maskRepeat: 'no-repeat',
            WebkitMaskRepeat: 'no-repeat',
          }}
        />
        <h2 className="text-[15px] font-bold tracking-tight text-text-primary">
          Order Timeline
        </h2>
      </div>

      {/* ── Desktop: horizontal stepper ─────────────────────────── */}
      <div className="hidden sm:block">
        <div
          className="grid items-start gap-x-2"
          style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }}
        >
          {stages.map((s, i) => {
            const isReached = reached[i]
            const tone = TONE[s.tone]
            const isLast = i === stages.length - 1
            const nextReached = i < stages.length - 1 && reached[i + 1]
            return (
              <div key={s.key} className="relative flex flex-col items-center text-center">
                {/* Title ABOVE the node */}
                <div
                  className={cn(
                    'mb-2.5 min-h-[16px] text-[12.5px] font-bold tracking-tight',
                    isReached ? 'text-text-primary' : 'text-text-tertiary',
                  )}
                >
                  {s.title}
                </div>

                {/* Node + connector row */}
                <div className="relative flex w-full items-center justify-center">
                  {/* Left half-connector (hidden on first) */}
                  {i > 0 && (
                    <span
                      aria-hidden
                      className={cn(
                        'absolute right-1/2 top-1/2 h-[3px] w-full -translate-y-1/2',
                        isReached ? 'bg-lime' : 'bg-border-subtle',
                      )}
                    />
                  )}
                  {/* Right half-connector (hidden on last) */}
                  {!isLast && (
                    <span
                      aria-hidden
                      className={cn(
                        'absolute left-1/2 top-1/2 h-[3px] w-full -translate-y-1/2',
                        nextReached ? 'bg-lime' : 'bg-border-subtle',
                      )}
                    />
                  )}
                  {/* Node — floating filled circle, no ring. */}
                  <span
                    className={cn(
                      'relative z-10 grid h-9 w-9 place-items-center rounded-full transition-colors',
                      isReached
                        ? `${tone.dot} ${tone.glyph}`
                        : 'bg-bg-overlay text-text-tertiary',
                    )}
                  >
                    <s.Icon className="h-[18px] w-[18px]" />
                  </span>
                </div>

                {/* Detail + timestamp BELOW the node */}
                <div className="mt-2.5 px-1">
                  <div
                    className={cn(
                      'text-[12px] leading-[1.35]',
                      isReached ? 'text-text-secondary' : 'text-text-tertiary',
                    )}
                  >
                    {s.detail}
                  </div>
                  {isReached && s.at && (
                    <div className="mt-0.5 text-[11px] tabular-nums text-text-tertiary">
                      {fmtAbsolute(s.at)}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Mobile: vertical rail ───────────────────────────────── */}
      <ol className="relative sm:hidden">
        {stages.map((s, i) => {
          const isReached = reached[i]
          const tone = TONE[s.tone]
          const isLast = i === stages.length - 1
          const nextReached = i < stages.length - 1 && reached[i + 1]
          return (
            <li key={s.key} className="relative flex gap-3.5 pb-5 last:pb-0">
              {!isLast && (
                <span
                  aria-hidden
                  className={cn(
                    'absolute left-[17px] top-9 h-[calc(100%-1.25rem)] w-[3px]',
                    nextReached ? 'bg-lime' : 'bg-border-subtle',
                  )}
                />
              )}
              <span
                className={cn(
                  'relative z-10 grid h-9 w-9 flex-shrink-0 place-items-center rounded-full',
                  isReached
                    ? `${tone.dot} ${tone.glyph}`
                    : 'bg-bg-overlay text-text-tertiary',
                )}
              >
                <s.Icon className="h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span
                    className={cn(
                      'text-[14px] font-semibold',
                      isReached ? 'text-text-primary' : 'text-text-tertiary',
                    )}
                  >
                    {s.title}
                  </span>
                  {isReached && s.at && (
                    <span className="text-[11.5px] tabular-nums text-text-tertiary">
                      {fmtAbsolute(s.at)}
                    </span>
                  )}
                </div>
                <p
                  className={cn(
                    'mt-0.5 text-[12.5px] leading-[1.5]',
                    isReached ? 'text-text-secondary' : 'text-text-tertiary',
                  )}
                >
                  {s.detail}
                </p>
              </div>
            </li>
          )
        })}
      </ol>
    </OrderCard>
  )
}
