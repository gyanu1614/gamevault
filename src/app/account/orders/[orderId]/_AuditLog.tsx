'use client'

/**
 * AuditLog — the order timeline.
 *
 * Steps come from buildOrderTimeline (src/lib/orders/timeline.ts): only what
 * actually happened, from real timestamps, in time order, then what is still
 * to come. sm+ is a horizontal stepper; phones get a vertical rail that
 * shows the first four steps and folds the rest behind "Show Full Timeline".
 */

import { useState } from 'react'
import {
  ShoppingBag,
  Clock,
  Truck,
  PackageCheck,
  AlertTriangle,
  Shield,
  CheckCircle2,
  RefreshCw,
  XCircle,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react'
import { OrderCard } from './_OrderCard'
import { cn } from '@/lib/utils'
import {
  buildOrderTimeline,
  type TimelineIcon,
  type TimelineStep,
  type TimelineTone,
} from '@/lib/orders/timeline'

interface AuditLogProps {
  order: {
    status: string
    created_at: string
    paid_at?: string | null
    delivering_at?: string | null
    delivered_at?: string | null
    completed_at?: string | null
    disputed_at?: string | null
    cancelled_at?: string | null
    updated_at?: string | null
  }
  disputeResolution?: {
    favored_party: 'buyer' | 'seller' | 'neutral'
    resolved_at?: string | null
    resolved_by_role?: 'buyer' | 'seller' | 'admin'
  } | null
  /** Latest dispute (open or closed) — its reason labels the Disputed step. */
  latestDispute?: { reason: string | null } | null
}

const ICONS: Record<TimelineIcon, LucideIcon> = {
  placed: ShoppingBag,
  waiting: Clock,
  started: Truck,
  delivered: PackageCheck,
  disputed: AlertTriangle,
  resolved: Shield,
  completed: CheckCircle2,
  refunded: RefreshCw,
  cancelled: XCircle,
}

const TONE: Record<TimelineTone, string> = {
  lime: 'bg-lime text-text-inverse',
  amber: 'bg-warning text-text-inverse',
  blue: 'bg-blue-400 text-text-inverse',
  red: 'bg-red-400 text-text-inverse',
}

/** Rows shown on a phone before "Show Full Timeline". */
const PHONE_ROWS = 4

function fmtAbsolute(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

/** Filled for done/current, hollow for what is still to come. */
function Node({ step, size = 'h-9 w-9' }: { step: TimelineStep; size?: string }) {
  const Icon = ICONS[step.icon]
  return (
    <span
      className={cn(
        'relative z-10 grid flex-shrink-0 place-items-center rounded-full',
        size,
        step.state === 'upcoming' ? 'bg-bg-overlay text-text-tertiary' : TONE[step.tone],
        step.state === 'current' && 'ring-4 ring-[rgba(255,178,62,0.2)]',
      )}
    >
      <Icon className="h-[18px] w-[18px]" aria-hidden />
    </span>
  )
}

export function AuditLog({ order, disputeResolution, latestDispute }: AuditLogProps) {
  const [expanded, setExpanded] = useState(false)

  const steps = buildOrderTimeline({
    ...order,
    dispute:
      order.disputed_at || disputeResolution
        ? {
            reason: latestDispute?.reason ?? null,
            resolvedAt: disputeResolution?.resolved_at ?? null,
            resolvedBy: disputeResolution?.resolved_by_role ?? null,
            favoredParty: disputeResolution?.favored_party ?? null,
          }
        : null,
  })

  const foldable = steps.length > PHONE_ROWS
  const phoneSteps = foldable && !expanded ? steps.slice(0, PHONE_ROWS) : steps

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
        <h2 className="text-[15px] font-bold tracking-tight text-text-primary">Order Timeline</h2>
      </div>

      {/* ── sm+: horizontal stepper ─────────────────────────────── */}
      <div className="hidden sm:block">
        <div
          className="grid items-start gap-x-2"
          style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
        >
          {steps.map((s, i) => {
            const isDone = s.state !== 'upcoming'
            const nextDone = i < steps.length - 1 && steps[i + 1].state !== 'upcoming'
            return (
              <div key={`${s.key}-${i}`} className="relative flex flex-col items-center text-center">
                <div
                  className={cn(
                    'mb-2.5 min-h-[16px] text-[12.5px] font-bold tracking-tight',
                    isDone ? 'text-text-primary' : 'text-text-tertiary',
                  )}
                >
                  {s.title}
                </div>
                <div className="relative flex w-full items-center justify-center">
                  {i > 0 && (
                    <span
                      aria-hidden
                      className={cn(
                        'absolute right-1/2 top-1/2 h-[3px] w-full -translate-y-1/2',
                        isDone ? 'bg-lime' : 'bg-border-subtle',
                      )}
                    />
                  )}
                  {i < steps.length - 1 && (
                    <span
                      aria-hidden
                      className={cn(
                        'absolute left-1/2 top-1/2 h-[3px] w-full -translate-y-1/2',
                        nextDone ? 'bg-lime' : 'bg-border-subtle',
                      )}
                    />
                  )}
                  <Node step={s} />
                </div>
                <div className="mt-2.5 px-1">
                  <div
                    className={cn(
                      'text-[12px] leading-[1.35]',
                      isDone ? 'text-text-secondary' : 'text-text-tertiary',
                    )}
                  >
                    {s.detail}
                  </div>
                  {s.state === 'done' && s.at && (
                    <div className="mt-0.5 text-[11px] tabular-nums text-text-tertiary">{fmtAbsolute(s.at)}</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Phone: vertical rail, first four rows then a fold ─────── */}
      <ol className="relative sm:hidden">
        {phoneSteps.map((s, i) => {
          const isDone = s.state !== 'upcoming'
          const isLastShown = i === phoneSteps.length - 1
          const nextDone = i < steps.length - 1 && steps[i + 1].state !== 'upcoming'
          return (
            <li key={`${s.key}-${i}`} className="relative flex gap-3.5 pb-5 last:pb-0">
              {!isLastShown && (
                <span
                  aria-hidden
                  className={cn(
                    'absolute left-[17px] top-9 h-[calc(100%-1.25rem)] w-[3px]',
                    nextDone ? 'bg-lime' : 'bg-border-subtle',
                  )}
                />
              )}
              <Node step={s} />
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span
                    className={cn(
                      'text-[14px] font-semibold',
                      isDone ? 'text-text-primary' : 'text-text-tertiary',
                    )}
                  >
                    {s.title}
                  </span>
                  {s.state === 'done' && s.at && (
                    <span className="text-[11.5px] tabular-nums text-text-tertiary">{fmtAbsolute(s.at)}</span>
                  )}
                </div>
                <p
                  className={cn(
                    'mt-0.5 text-[12.5px] leading-[1.5]',
                    isDone ? 'text-text-secondary' : 'text-text-tertiary',
                  )}
                >
                  {s.detail}
                </p>
              </div>
            </li>
          )
        })}
      </ol>
      {foldable && (
        <div className="mt-3 flex justify-center border-t border-border-subtle pt-2 sm:hidden">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="inline-flex min-h-[44px] items-center gap-1.5 px-3 text-[13px] font-semibold text-text-secondary active:opacity-70"
          >
            {expanded ? 'Show Less' : `Show Full Timeline (${steps.length})`}
            <ChevronDown
              aria-hidden
              className={cn('h-4 w-4 transition-transform duration-200', expanded && 'rotate-180')}
            />
          </button>
        </div>
      )}
    </OrderCard>
  )
}
