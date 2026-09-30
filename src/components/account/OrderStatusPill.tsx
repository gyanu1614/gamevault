/**
 * The one status pill for order rows (orders lists, dashboards). Labels come
 * from orderListStatus (owner, 2026-09-28: plain statuses, no dispute
 * outcome badges); colours are the ones approved for the orders list.
 */

import { AlertCircle, CheckCircle2, Clock, PackageCheck, Truck, Undo2, XCircle } from 'lucide-react'
import { orderListStatus, type ListStatusKey } from '@/lib/orders/list-status'
import { cn } from '@/lib/utils'

export const ORDER_STATUS_STYLE: Record<ListStatusKey, { cls: string; Icon: typeof Clock }> = {
  awaiting_payment: { cls: 'bg-warning-bg text-warning border-[color-mix(in_srgb,var(--color-warning)_40%,transparent)]', Icon: Clock },
  delivering: { cls: 'bg-blue-500/10 text-blue-400 border-blue-500/30', Icon: Truck },
  delivered: { cls: 'bg-success-bg text-success border-[color-mix(in_srgb,var(--color-success)_30%,transparent)]', Icon: PackageCheck },
  disputed: { cls: 'bg-error-bg text-error border-[color-mix(in_srgb,var(--color-error)_40%,transparent)]', Icon: AlertCircle },
  completed: { cls: 'bg-success-bg text-success border-[color-mix(in_srgb,var(--color-success)_30%,transparent)]', Icon: CheckCircle2 },
  refunded: { cls: 'bg-gray-500/10 text-text-secondary border-gray-500/30', Icon: Undo2 },
  cancelled: { cls: 'bg-gray-500/10 text-text-secondary border-gray-500/30', Icon: XCircle },
}

export function OrderStatusPill({ status, className }: { status: string | null | undefined; className?: string }) {
  const { key, label } = orderListStatus(status)
  const { cls, Icon } = ORDER_STATUS_STYLE[key]
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 text-[12px] font-semibold',
        cls,
        className,
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {label}
    </span>
  )
}
