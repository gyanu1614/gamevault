'use client'

import { cn } from '@/lib/utils'
import { Package, CheckCircle2, AlertTriangle, XCircle, RefreshCw, Check, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import DisputeResolutionCard from '@/components/admin/disputes/DisputeResolutionCard'

interface OrderProgressBarProps {
  status: string
  order?: {
    created_at?: string
    delivering_at?: string
    delivered_at?: string
    completed_at?: string
    cancelled_at?: string
    disputed_at?: string
    auto_release_at?: string
    escrow_status?: string
  }
  disputeResolution?: {
    status?: string
    favored_party: 'buyer' | 'seller' | 'neutral'
    resolution_type: string
    refund_amount?: number
    resolved_at: string
    resolution_notes?: string
    buyer_username?: string
    seller_username?: string
  } | null
}

function fmtTs(ts?: string) {
  if (!ts) return null
  return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Inline countdown hook — null means "not yet calculated"
function useCountdown(targetDate?: string | null) {
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    if (!targetDate) return
    const calc = () => {
      const diff = Math.max(0, new Date(targetDate).getTime() - Date.now())
      setRemaining(diff)
    }
    calc()
    const id = setInterval(calc, 1000)
    return () => clearInterval(id)
  }, [targetDate])

  const h = Math.floor((remaining ?? 0) / 3600000)
  const m = Math.floor(((remaining ?? 0) % 3600000) / 60000)
  const s = Math.floor(((remaining ?? 0) % 60000) / 1000)
  return { h, m, s, total: remaining }
}

export default function OrderProgressBar({ status, order, disputeResolution }: OrderProgressBarProps) {
  // ── Terminal states ──────────────────────────────────────────────────────────

  // Dispute Resolved - show full resolution card
  if (disputeResolution) {
    // Determine status from favored_party if not explicitly provided
    let disputeStatus = disputeResolution.status
    if (!disputeStatus) {
      if (disputeResolution.favored_party === 'buyer') {
        disputeStatus = 'resolved_buyer_favor'
      } else if (disputeResolution.favored_party === 'seller') {
        disputeStatus = 'resolved_seller_favor'
      } else {
        disputeStatus = 'resolved_partial'
      }
    }

    return (
      <DisputeResolutionCard
        status={disputeStatus}
        resolutionType={disputeResolution.resolution_type}
        resolvedAmount={disputeResolution.refund_amount}
        resolutionNotes={disputeResolution.resolution_notes}
        resolvedAt={disputeResolution.resolved_at}
        currency="USD"
        buyerUsername={disputeResolution.buyer_username}
        sellerUsername={disputeResolution.seller_username}
      />
    )
  }

  if (status === 'disputed') {
    return (
      <div className="h-full rounded-lg border border-red-500/25 bg-red-500/[0.06] px-4 py-3 flex items-center">
        <div className="flex items-center gap-3 w-full">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-error/40 bg-error-bg flex-shrink-0">
            <AlertTriangle className="h-4 w-4 text-error" />
          </div>
          <div className="flex-1 space-y-0.5">
            <div className="text-xs font-bold uppercase tracking-[0.1em] text-error">Dispute Active</div>
            <div className="text-xs text-error/70">Support reviewing — response within 24-48h</div>
            <div className="text-xs text-error/70">Continue chatting. All messages monitored.</div>
          </div>
        </div>
      </div>
    )
  }
  if (status === 'refunded') {
    return (
      <div className="h-full rounded-lg border border-border-subtle bg-bg-overlay px-4 py-3 flex items-center">
        <div className="flex items-center gap-3 w-full">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-bg-overlay flex-shrink-0">
            <RefreshCw className="h-4 w-4 text-text-secondary" />
          </div>
          <div className="flex-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">Refunded</div>
            <div className="text-sm text-text-disabled mt-0.5">Payment returned to your original method</div>
          </div>
        </div>
      </div>
    )
  }
  if (status === 'cancelled') {
    return (
      <div className="h-full rounded-lg border border-blue-500/25 bg-blue-500/[0.06] px-4 py-3 flex items-center">
        <div className="flex items-center gap-3 w-full">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-500/10 flex-shrink-0">
            <XCircle className="h-4 w-4 text-blue-400" />
          </div>
          <div className="flex-1">
            <div className="text-xs font-bold uppercase tracking-[0.1em] text-blue-400">Order Cancelled</div>
            <div className="text-sm text-blue-400/50 mt-0.5">Full refund credited to your wallet</div>
          </div>
        </div>
      </div>
    )
  }

  // ── Normal flow: paid → delivering → delivered → completed ───────────────────
  const steps = [
    {
      key: 'delivering',
      label: status === 'pending' ? 'Awaiting Payment' : 'Preparing',
      icon: Package,
      ts: fmtTs(order?.delivering_at || order?.created_at),
      done: ['delivered', 'completed'].includes(status),
      active: status === 'pending' || status === 'paid' || status === 'delivering',
    },
    {
      key: 'delivered',
      label: 'Delivered',
      icon: CheckCircle2,
      ts: fmtTs(order?.delivered_at),
      done: status === 'completed',
      active: status === 'delivered',
    },
    {
      key: 'completed',
      label: 'Complete',
      icon: Sparkles,
      ts: fmtTs(order?.completed_at),
      done: false,
      active: status === 'completed',
    },
  ]

  const doneCnt = steps.filter(s => s.done).length
  const fillPct = (doneCnt / (steps.length - 1)) * 100

  // Show inline auto-release timer when delivered + escrow held
  const showTimer = status === 'delivered' && order?.escrow_status === 'held' && !!order?.auto_release_at

  return (
    <div className="h-full rounded-lg border border-border-subtle bg-white/[0.025] px-5 py-3 flex items-center">
      <div className="relative w-full">
        {/* Track bg */}
        <div className="absolute top-[17px] left-[calc(16.67%)] right-[calc(16.67%)] h-px bg-bg-raised-hover" />
        {/* Fill */}
        <div
          className="absolute top-[17px] left-[calc(16.67%)] h-px bg-lime transition-all duration-700"
          style={{ width: `calc(${fillPct}% * 0.667)` }}
        />

        {/* Steps */}
        <div className="relative flex justify-between">
          {steps.map((step) => {
            const Icon = step.icon
            const isDelivered = step.key === 'delivered'
            return (
              <div key={step.key} className="flex flex-col items-center gap-1.5" style={{ width: '33.33%' }}>
                {/* Node */}
                <div className={cn(
                  'relative flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-500',
                  step.done  && 'bg-lime border-lime shadow-sm shadow-lime/25',
                  step.active && !step.done && 'bg-lime/20 border-lime/60',
                  !step.done && !step.active && 'bg-transparent border-white/[0.1]',
                )}>
                  {step.active && !step.done && (
                    <span className="absolute inset-0 rounded-full bg-lime/20 animate-ping opacity-40" />
                  )}
                  {step.done ? (
                    <Check className="h-3.5 w-3.5 text-text-inverse" strokeWidth={3} />
                  ) : (
                    <Icon className={cn('h-4 w-4', step.active ? 'text-lime-text' : 'text-gray-700')} />
                  )}
                </div>

                {/* Label + timestamp */}
                <div className="text-center">
                  <div className={cn('text-xs font-semibold leading-tight',
                    (step.done || step.active) ? 'text-white' : 'text-text-disabled'
                  )}>
                    {step.label}
                  </div>
                  {step.ts && (step.done || step.active) && (
                    <div className="text-[10px] text-lime-text/60 mt-0.5 whitespace-nowrap">{step.ts}</div>
                  )}
                  {/* Inline auto-release countdown under Delivered node */}
                  {isDelivered && showTimer && (
                    <InlineCountdown autoReleaseAt={order!.auto_release_at!} />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function InlineCountdown({ autoReleaseAt }: { autoReleaseAt: string }) {
  const { h, m, s, total } = useCountdown(autoReleaseAt)
  const isUrgent = total !== null && total < 3600000

  useEffect(() => {
    // Don't reload - let real-time subscription handle escrow status updates
    // This prevents infinite refresh loops when auto_release_at is in the past
    // The page will update via the real-time order subscription in the parent component
  }, [total])

  // Still loading calculation
  if (total === null) return null

  if (total === 0) return <div className="text-[9px] text-text-tertiary mt-1">Completing…</div>

  return (
    <div className={cn(
      'mt-1.5 flex items-center gap-1 text-[9px] font-mono font-semibold tabular-nums',
      isUrgent ? 'text-error' : 'text-text-tertiary'
    )}>
      <span>auto-completes</span>
      <span className={cn('px-1 py-0.5 rounded border', isUrgent ? 'border-error/40 bg-error-bg text-error' : 'border-white/10 bg-bg-raised text-text-secondary')}>
        {String(h).padStart(2,'0')}:{String(m).padStart(2,'0')}:{String(s).padStart(2,'0')}
      </span>
    </div>
  )
}
