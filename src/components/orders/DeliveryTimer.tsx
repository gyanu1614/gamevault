'use client'

/**
 * DeliveryTimer — clean digit-block style (inspired by Eldorado)
 *
 * Timer starts the moment the buyer pays — seller cannot control when it begins.
 */

import { useEffect, useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import { CheckCircle2, Zap, AlertTriangle } from 'lucide-react'

// ── Parse delivery_time string → milliseconds ─────────────────────────────────

export function parseDeliveryTimeMs(deliveryTime?: string | null): number {
  if (!deliveryTime) return 0
  const t = deliveryTime.toLowerCase().trim()
  if (t === '20min' || t === '20 minutes' || t === '20 mins') return 20 * 60 * 1000
  if (t === '1hr' || t === '1 hour' || t === '0-1 hours')    return 60 * 60 * 1000
  if (t === '3hr' || t === '3 hours')                        return 3 * 60 * 60 * 1000
  if (t === '6hr' || t === '6 hours' || t === '1-6 hours')   return 6 * 60 * 60 * 1000
  if (t === '12hr' || t === '12 hours' || t === '6-12 hours') return 12 * 60 * 60 * 1000
  if (t === '24hr' || t === '1 day' || t === '12-24 hours' || t === '1-24 hours') return 24 * 60 * 60 * 1000
  if (t === '1-3 days' || t === '3 days')                    return 3 * 24 * 60 * 60 * 1000
  const rangeMatch = t.match(/(\d+)\s*-\s*(\d+)\s*hour/)
  if (rangeMatch) return parseInt(rangeMatch[2]) * 60 * 60 * 1000
  return 0
}

// ── Digit block ───────────────────────────────────────────────────────────────

function DigitBlock({ value, label, color }: { value: number; label: string; color: string }) {
  const str = String(value).padStart(2, '0')
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={cn(
        'flex items-center justify-center rounded-lg border w-[44px] h-[36px] font-mono font-bold text-lg tabular-nums leading-none',
        color
      )}>
        {str}
      </div>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-text-disabled">{label}</span>
    </div>
  )
}

function Colon({ color }: { color: string }) {
  return <div className={cn('text-xs font-bold pb-4 select-none', color)}>:</div>
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface DeliveryTimerProps {
  deliveringAt?: string | null
  deliveredAt?: string | null
  deliveryTime?: string | null
  deliveryMethod?: string | null
  role: 'buyer' | 'seller'
  orderStatus: string
}

export default function DeliveryTimer({
  deliveringAt,
  deliveredAt,
  deliveryTime,
  deliveryMethod,
  role,
  orderStatus,
}: DeliveryTimerProps) {
  const deadlineMsRef = useRef<number>(0)
  const [now, setNow] = useState(() => Date.now())
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (deliveringAt) {
      const durationMs = parseDeliveryTimeMs(deliveryTime)
      deadlineMsRef.current = new Date(deliveringAt).getTime() + durationMs
    }
  }, [deliveringAt, deliveryTime])

  useEffect(() => {
    if (!deliveringAt || deliveredAt) return
    intervalRef.current = setInterval(() => setNow(Date.now()), 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [deliveringAt, deliveredAt])

  useEffect(() => {
    if ((deliveredAt || orderStatus === 'completed') && intervalRef.current) {
      clearInterval(intervalRef.current)
    }
  }, [deliveredAt, orderStatus])

  // ── Instant delivery ───────────────────────────────────────────────────────
  if (deliveryMethod === 'instant') {
    return (
      <div className="rounded-2xl border border-green-500/20 bg-green-500/[0.06] px-3.5 py-2.5 flex items-center w-fit">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-success/30 bg-success-bg">
            <Zap className="h-3.5 w-3.5 text-success" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-success">Instant Delivery</div>
            <div className="text-xs text-text-tertiary mt-0.5">Delivered automatically</div>
          </div>
        </div>
      </div>
    )
  }

  // ── Delivered — show actual time taken ─────────────────────────────────────
  if (deliveredAt && deliveringAt) {
    const takenMs = new Date(deliveredAt).getTime() - new Date(deliveringAt).getTime()
    const deadlineMs = parseDeliveryTimeMs(deliveryTime)
    const wasOnTime = deadlineMs === 0 || takenMs <= deadlineMs
    const totalSec = Math.floor(takenMs / 1000)
    const h = Math.floor(totalSec / 3600)
    const m = Math.floor((totalSec % 3600) / 60)
    const s = totalSec % 60

    // Calculate overdue time if late
    let overdueText = ''
    if (!wasOnTime && deadlineMs > 0) {
      const overdueMs = takenMs - deadlineMs
      const overdueSec = Math.floor(overdueMs / 1000)
      const overdueHours = Math.floor(overdueSec / 3600)
      const overdueMins = Math.floor((overdueSec % 3600) / 60)

      if (overdueHours > 0) {
        overdueText = `${overdueHours} hour${overdueHours > 1 ? 's' : ''} ${overdueMins} min${overdueMins !== 1 ? 's' : ''}`
      } else {
        overdueText = `${overdueMins} minute${overdueMins !== 1 ? 's' : ''}`
      }
    }

    return (
      <div className={cn(
        'h-full rounded-2xl border px-3.5 py-3.5 flex flex-col items-center justify-center gap-3',
        wasOnTime ? 'border-green-500/20 bg-green-500/[0.06]' : 'border-amber-500/20 bg-amber-500/[0.06]'
      )}>
        <div className="flex flex-col items-center gap-2 w-full">
          <div className={cn('flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.1em]', wasOnTime ? 'text-success' : 'text-amber-400')}>
            <CheckCircle2 className="h-3 w-3" />
            {wasOnTime ? 'Delivered On Time' : 'Delivered Late'}
          </div>
          <div className="flex items-end gap-1.5">
            <DigitBlock value={h} label="Hours" color={wasOnTime ? 'border-green-500/20 bg-green-500/[0.08] text-green-300' : 'border-amber-500/20 bg-amber-500/[0.08] text-amber-300'} />
            <Colon color={wasOnTime ? 'text-success/40' : 'text-amber-500/40'} />
            <DigitBlock value={m} label="Minutes" color={wasOnTime ? 'border-green-500/20 bg-green-500/[0.08] text-green-300' : 'border-amber-500/20 bg-amber-500/[0.08] text-amber-300'} />
            <Colon color={wasOnTime ? 'text-success/40' : 'text-amber-500/40'} />
            <DigitBlock value={s} label="Seconds" color={wasOnTime ? 'border-green-500/20 bg-green-500/[0.08] text-green-300' : 'border-amber-500/20 bg-amber-500/[0.08] text-amber-300'} />
          </div>
        </div>

        {/* Additional info sections */}
        <div className="w-full space-y-2.5 pt-2 border-t border-white/5">
          {/* Delivery window */}
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-text-tertiary">Expected time</span>
            <span className="text-text-secondary font-medium">{deliveryTime || 'N/A'}</span>
          </div>

          {/* Single status message */}
          <div className="text-center">
            <div className={cn(
              'text-xs font-semibold',
              wasOnTime ? 'text-success' : 'text-error'
            )}>
              {wasOnTime ? (
                'Delivered on time'
              ) : (
                `Delivered late by: ${overdueText}`
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── No start time / no delivery time ──────────────────────────────────────
  // Parse the delivery window to show as initial countdown value
  if (!deliveringAt || !deliveryTime) {
    const windowMs = parseDeliveryTimeMs(deliveryTime)
    const windowSec = Math.floor(windowMs / 1000)
    const wh = Math.floor(windowSec / 3600)
    const wm = Math.floor((windowSec % 3600) / 60)
    const ws = windowSec % 60
    return (
      <div className="h-full rounded-2xl border border-border-subtle bg-white/[0.025] px-4 py-3 flex flex-col items-center justify-center">
        <div className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary mb-2">
          {role === 'buyer' ? 'Delivery Timer' : 'Delivery Window'}
        </div>
        <div className="flex items-end gap-2">
          <DigitBlock value={wh} label="Hours"   color="border-border-subtle bg-bg-raised text-text-disabled" />
          <Colon color="text-white/10" />
          <DigitBlock value={wm} label="Minutes" color="border-border-subtle bg-bg-raised text-text-disabled" />
          <Colon color="text-white/10" />
          <DigitBlock value={ws} label="Seconds" color="border-border-subtle bg-bg-raised text-text-disabled" />
        </div>
        <div className="text-[10px] text-gray-700 mt-2">
          {deliveryTime ? 'Waiting for seller to start' : 'No time window set'}
        </div>
      </div>
    )
  }

  // ── Live countdown / overdue ──────────────────────────────────────────────
  const deadline = deadlineMsRef.current || (new Date(deliveringAt).getTime() + parseDeliveryTimeMs(deliveryTime))
  const diff = deadline - now
  const isOverdue = diff < 0
  const totalMs = parseDeliveryTimeMs(deliveryTime)
  const isWarning = !isOverdue && totalMs > 0 && diff < totalMs * 0.25

  const absDiff = Math.abs(diff)
  const totalSec = Math.floor(absDiff / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60

  const scheme = isOverdue
    ? {
        border: 'border-error/40',
        bg: 'bg-red-500/[0.06]',
        label: 'text-error',
        digit: 'border-error/40 bg-red-500/[0.08] text-error',
        colon: 'text-error/40',
        sub: 'text-error/50',
      }
    : isWarning
    ? {
        border: 'border-amber-500/20',
        bg: 'bg-amber-500/[0.06]',
        label: 'text-amber-400',
        digit: 'border-amber-500/20 bg-amber-500/[0.08] text-amber-300',
        colon: 'text-amber-500/40',
        sub: 'text-amber-400/50',
      }
    : {
        border: 'border-lime-tint-border',
        bg: 'bg-lime/[0.06]',
        label: 'text-lime-text',
        digit: 'border-lime-tint-border bg-lime/[0.08] text-text-inverse',
        colon: 'text-lime-text/40',
        sub: 'text-text-disabled',
      }

  const headerLabel = isOverdue
    ? (role === 'buyer' ? 'Delivery Overdue' : 'Past Deadline')
    : (role === 'buyer' ? 'Delivery Timer' : 'Delivery Deadline')

  const subLabel = isOverdue
    ? (role === 'buyer' ? 'Seller is working on it' : 'Deliver as soon as possible')
    : (role === 'buyer' ? 'Time remaining for delivery' : 'Deliver before timer runs out')

  return (
    <div className={cn('h-full rounded-2xl border px-4 py-3 flex flex-col items-center justify-center', scheme.border, scheme.bg)}>
      <div className="flex items-center gap-2 mb-2">
        <div className={cn('text-[10px] font-bold uppercase tracking-[0.1em]', scheme.label)}>
          {headerLabel}
        </div>
        {isOverdue && <AlertTriangle className="h-3.5 w-3.5 text-error" />}
        {!isOverdue && (
          <span className="relative flex h-1.5 w-1.5">
            <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-60', isWarning ? 'bg-amber-400' : 'bg-violet-400')} />
            <span className={cn('relative inline-flex rounded-full h-1.5 w-1.5', isWarning ? 'bg-amber-400' : 'bg-violet-400')} />
          </span>
        )}
      </div>

      <div className="flex items-end gap-2">
        <DigitBlock value={h} label="Hours"   color={scheme.digit} />
        <Colon color={scheme.colon} />
        <DigitBlock value={m} label="Minutes" color={scheme.digit} />
        <Colon color={scheme.colon} />
        <DigitBlock value={s} label="Seconds" color={scheme.digit} />
      </div>

      <div className={cn('text-[10px] mt-2', scheme.sub)}>
        {subLabel}
      </div>
    </div>
  )
}
