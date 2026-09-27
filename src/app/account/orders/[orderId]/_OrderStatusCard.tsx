/**
 * OrderStatusCard — phone-only status surface.
 *
 * Below sm the header's two pills (order status + SafeDrop/escrow) are
 * replaced by this one card: a tone icon, the status title, when the
 * order reached that status, and one plain line on what it means for the
 * viewer. Display only: it reads the same order fields the pills did and
 * triggers nothing.
 */

import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  PackageCheck,
  RefreshCw,
  Truck,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import { OrderCard } from './_OrderCard'
import { cn } from '@/lib/utils'

type Role = 'buyer' | 'seller' | 'admin'
type Tone = 'green' | 'lime' | 'amber' | 'red' | 'blue' | 'orange'

interface OrderStatusCardProps {
  role: Role
  status: string
  /** A dispute on this order has a recorded resolution. */
  disputeResolved?: boolean
  order: {
    created_at: string
    paid_at?: string | null
    delivering_at?: string | null
    delivered_at?: string | null
    disputed_at?: string | null
    completed_at?: string | null
    cancelled_at?: string | null
    updated_at?: string | null
  }
  /** When the dispute was resolved (dispute_resolutions.created_at). */
  disputeResolvedAt?: string | null
  className?: string
}

interface StatusCopy {
  Icon: LucideIcon
  tone: Tone
  title: string
  /** Per-role message; `all` is the fallback. */
  message: Partial<Record<Role | 'all', string>>
}

const COPY: Record<string, StatusCopy> = {
  pending: {
    Icon: Clock,
    tone: 'amber',
    title: 'Awaiting Payment',
    message: { all: 'Complete your payment to start this order.' },
  },
  paid: {
    Icon: Clock,
    tone: 'amber',
    title: 'Waiting For Seller',
    message: {
      buyer: 'Payment confirmed. The seller will start your delivery soon.',
      seller: 'Payment confirmed. Message the buyer to start delivery.',
      all: 'Payment confirmed. The seller has not started yet.',
    },
  },
  delivering: {
    Icon: Truck,
    tone: 'amber',
    title: 'Delivery In Progress',
    message: {
      buyer: 'The seller is working on your order.',
      seller: 'Deliver the order, then mark it as delivered.',
      all: 'The seller is working on the order.',
    },
  },
  delivered: {
    Icon: PackageCheck,
    tone: 'lime',
    title: 'Order Delivered',
    message: {
      buyer: 'Check your order, then confirm you received it.',
      seller: 'Waiting for the buyer to confirm they received it.',
      all: 'Waiting for the buyer to confirm.',
    },
  },
  completed: {
    Icon: CheckCircle2,
    tone: 'green',
    title: 'Order Completed',
    message: {
      buyer: 'Order is complete. The seller has been paid.',
      seller: 'Order is complete. Funds have been added to your wallet.',
      all: 'Order is complete. The seller has been paid.',
    },
  },
  disputed: {
    Icon: AlertTriangle,
    tone: 'red',
    title: 'Order Disputed',
    message: {
      buyer: 'A DropMarket admin is reviewing. Keep talking to the seller in chat.',
      seller: 'Payout is paused. Talk to the buyer in chat to sort it out.',
      all: 'Awaiting a decision.',
    },
  },
  resolved: {
    Icon: CheckCircle2,
    tone: 'green',
    title: 'Dispute Resolved',
    message: { all: 'This dispute has been resolved.' },
  },
  refunded: {
    Icon: RefreshCw,
    tone: 'blue',
    title: 'Order Refunded',
    message: {
      buyer: 'Your refund is in your DropMarket wallet.',
      seller: 'The buyer was refunded. No payout for this order.',
      all: 'The buyer was refunded.',
    },
  },
  cancelled: {
    Icon: XCircle,
    tone: 'orange',
    title: 'Order Cancelled',
    message: {
      buyer: 'No payment arrived in time, so nothing was charged.',
      seller: 'This order was cancelled before payment.',
      all: 'This order was cancelled before payment.',
    },
  },
}

const TONE: Record<Tone, { tile: string; title: string }> = {
  green:  { tile: 'bg-green-400/[0.12] text-green-400',   title: 'text-green-400' },
  lime:   { tile: 'bg-lime/[0.14] text-lime-text',        title: 'text-lime-text' },
  amber:  { tile: 'bg-amber/[0.12] text-amber',           title: 'text-amber' },
  red:    { tile: 'bg-red-400/[0.12] text-red-400',       title: 'text-red-400' },
  blue:   { tile: 'bg-blue-400/[0.12] text-blue-400',     title: 'text-blue-400' },
  orange: { tile: 'bg-orange-400/[0.12] text-orange-400', title: 'text-orange-400' },
}

function statusTime(
  status: string,
  o: OrderStatusCardProps['order'],
  disputeResolvedAt: string | null | undefined,
): string | null {
  switch (status) {
    case 'pending':    return o.created_at
    case 'paid':       return o.paid_at ?? o.created_at
    case 'delivering': return o.delivering_at ?? o.paid_at ?? null
    case 'delivered':  return o.delivered_at ?? null
    case 'completed':  return o.completed_at ?? null
    case 'disputed':   return o.disputed_at ?? null
    case 'resolved':   return disputeResolvedAt ?? null
    case 'cancelled':  return o.cancelled_at ?? null
    case 'refunded':   return o.updated_at ?? null
    default:           return null
  }
}

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export function OrderStatusCard({
  role,
  status,
  disputeResolved,
  order,
  disputeResolvedAt,
  className,
}: OrderStatusCardProps) {
  // Same rule the header pill uses: a disputed order with a recorded
  // resolution reads as resolved.
  const effective = status === 'disputed' && disputeResolved ? 'resolved' : status
  const copy = COPY[effective]
  if (!copy) return null
  const tone = TONE[copy.tone]
  const when = statusTime(effective, order, disputeResolvedAt)
  const message = copy.message[role] ?? copy.message.all

  return (
    <OrderCard className={cn('flex items-start gap-3 px-5 py-4', className)} padded={false}>
      <span className={cn('grid h-10 w-10 flex-shrink-0 place-items-center rounded-[10px]', tone.tile)}>
        <copy.Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <div className={cn('text-[15px] font-bold', tone.title)}>{copy.title}</div>
        {when && (
          <div className="mt-1 text-[12px] font-medium tabular-nums text-text-tertiary">
            {fmtWhen(when)}
          </div>
        )}
        {message && (
          <p className="mt-1.5 text-[13px] leading-snug text-text-secondary">{message}</p>
        )}
      </div>
    </OrderCard>
  )
}
