/**
 * DeliveredInRow — slim row that takes the delivery timer's place once
 * the seller has delivered: how long delivery took (from payment to the
 * delivered mark) and when it happened. Display only.
 */

import { PackageCheck } from 'lucide-react'
import { OrderCard } from './_OrderCard'
import { cn } from '@/lib/utils'

function fmtDuration(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60000))
  if (totalMin < 1) return 'Under A Minute'
  if (totalMin < 60) return `${totalMin}m`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h < 24) return m ? `${h}h ${m}m` : `${h}h`
  const d = Math.floor(h / 24)
  const rh = h % 24
  return rh ? `${d}d ${rh}h` : `${d}d`
}

export function DeliveredInRow({
  startedAt,
  deliveredAt,
  className,
}: {
  /** When the seller's clock started (payment confirmed). */
  startedAt: string
  deliveredAt: string
  className?: string
}) {
  const startMs = Date.parse(startedAt)
  const endMs = Date.parse(deliveredAt)
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null
  const when = new Date(endMs).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  return (
    <OrderCard className={cn('flex items-center justify-between gap-3 px-5 py-3', className)} padded={false}>
      <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-text-primary">
        <PackageCheck className="h-4 w-4 text-lime-text" aria-hidden />
        Delivered In {fmtDuration(endMs - startMs)}
      </span>
      <span className="text-[12px] tabular-nums text-text-tertiary">{when}</span>
    </OrderCard>
  )
}
