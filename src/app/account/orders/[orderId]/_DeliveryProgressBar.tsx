'use client'

/**
 * DeliveryProgressBar — V21/P2
 *
 * Single continuous bar replacing the old 4-phase timeline. Reads the
 * delivery window from props (started_at + sla_seconds) and ticks live
 * via requestAnimationFrame, so the knob position and remaining label
 * update in real time without server round-trips.
 *
 * Color tiers:
 * - on track   (>33% remaining): lime fill, lime knob glow
 * - running low (<33%, >0):       amber fill, amber knob glow
 * - overdue    (0):               red fill, red knob, faint red border on card
 */

import { useEffect, useState } from 'react'
import { Flag, CheckCircle2, AlertTriangle } from 'lucide-react'
import { OrderCard } from './_OrderCard'
import { cn } from '@/lib/utils'

interface DeliveryProgressBarProps {
  /** ISO timestamp when the seller started/began the SLA clock. */
  startedAt: string | Date
  /** Seller's SLA in seconds (from listing.delivery_time). */
  slaSeconds: number
  /** "Placed at" label timestamp — separate from started_at, this is order placement. */
  placedAtLabel: string
  /** Whether to show the bar (suppress for delivered/completed). */
  visible?: boolean
}

function formatRemaining(secs: number): string {
  if (secs <= 0) return ''
  const m = Math.floor(secs / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const rem = m % 60
  if (rem === 0) return `${h}h`
  return `${h}h ${rem}m`
}

function formatOverdue(secs: number): string {
  const over = Math.abs(secs)
  const m = Math.floor(over / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  return `${h}h`
}

export function DeliveryProgressBar({
  startedAt,
  slaSeconds,
  placedAtLabel,
  visible = true,
}: DeliveryProgressBarProps) {
  const startMs = typeof startedAt === 'string' ? Date.parse(startedAt) : startedAt.getTime()
  const slaMs = slaSeconds * 1000
  const endMs = startMs + slaMs

  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!visible) return
    let raf = 0
    const tick = () => {
      setNow(Date.now())
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [visible])

  if (!visible) return null

  const elapsedMs = Math.max(0, now - startMs)
  const remainingMs = endMs - now
  const remainingSec = Math.floor(remainingMs / 1000)
  const fractionElapsed = Math.min(1, Math.max(0, elapsedMs / slaMs))
  const fractionRemaining = 1 - fractionElapsed

  const isOverdue = remainingMs <= 0
  const isRunningLow = !isOverdue && fractionRemaining < 0.33

  const tier: 'on-track' | 'low' | 'overdue' = isOverdue
    ? 'overdue'
    : isRunningLow
    ? 'low'
    : 'on-track'

  const fillPct = isOverdue ? 100 : fractionElapsed * 100

  const TIER_VISUALS = {
    'on-track': {
      fill: 'linear-gradient(90deg,#86d600,#C6FF3D)',
      knobBg: '#C6FF3D',
      labelClass: 'text-lime-text',
      borderTint: '',
      label: `Expected in ${formatRemaining(remainingSec)}`,
    },
    low: {
      fill: 'linear-gradient(90deg,#d6a800,#FFC24B)',
      knobBg: '#FFC24B',
      labelClass: 'text-amber',
      borderTint: '',
      label: `Soon — ${formatRemaining(remainingSec)} left`,
    },
    overdue: {
      fill: 'linear-gradient(90deg,#c4504a,#FF6B6B)',
      knobBg: '#FF6B6B',
      labelClass: 'text-red-400',
      borderTint: 'border-red-400/30',
      label: `Overdue by ${formatOverdue(remainingSec)}`,
    },
  } as const

  const v = TIER_VISUALS[tier]

  return (
    <OrderCard className={cn('p-4', v.borderTint)} padded={false}>
      <div className="mb-2.5 flex items-center justify-between gap-4">
        <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-text-secondary">
          <Flag className="h-3 w-3 text-text-tertiary" aria-hidden />
          Placed · {placedAtLabel}
        </span>
        <span
          className={cn('inline-flex items-center gap-1.5 text-[12px] font-semibold', v.labelClass)}
          aria-live="polite"
        >
          {tier === 'overdue' && <AlertTriangle className="h-3 w-3" aria-hidden />}
          {v.label}
        </span>
        <span className="inline-flex items-center gap-1.5 text-[11.5px] text-text-tertiary">
          Delivered
          <CheckCircle2 className="h-3 w-3" aria-hidden />
        </span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full transition-[width] duration-150"
          style={{ width: `${fillPct}%`, background: v.fill }}
        />
      </div>
    </OrderCard>
  )
}
