/**
 * Order timeline: what ACTUALLY happened to an order, in time order, then
 * what is still to come.
 *
 * Every "done" step comes from a real timestamp on the order or its dispute
 * (never inferred from a later step): an order the seller never started
 * shows "Waiting For Seller", not "Delivery Started". Steps that have not
 * happened yet follow as "upcoming" (or one "current" step when the order
 * is waiting on someone).
 */

export type TimelineIcon =
  | 'placed'
  | 'waiting'
  | 'started'
  | 'delivered'
  | 'disputed'
  | 'resolved'
  | 'completed'
  | 'refunded'
  | 'cancelled'

export type TimelineTone = 'lime' | 'amber' | 'red' | 'blue'

export interface TimelineStep {
  key: string
  icon: TimelineIcon
  title: string
  detail: string
  at: string | null
  state: 'done' | 'current' | 'upcoming'
  tone: TimelineTone
}

export interface TimelineInput {
  status: string
  created_at: string
  paid_at?: string | null
  delivering_at?: string | null
  delivered_at?: string | null
  disputed_at?: string | null
  completed_at?: string | null
  cancelled_at?: string | null
  updated_at?: string | null
  dispute?: {
    reason?: string | null
    /** Resolved disputes only. */
    resolvedAt?: string | null
    resolvedBy?: 'buyer' | 'seller' | 'admin' | null
    favoredParty?: 'buyer' | 'seller' | 'neutral' | null
  } | null
}

const REASON_LABEL: Record<string, string> = {
  item_not_received: 'Item not received',
  not_as_described: 'Not as described',
  wrong_item: 'Wrong item',
  partial_delivery: 'Partial delivery',
  quality_issue: 'Quality issue',
  account_issue: 'Account issue',
  unauthorized_transaction: 'Unauthorized transaction',
  seller_unresponsive: 'Seller unresponsive',
  other: 'Other issue',
}

function resolvedDetail(d: NonNullable<TimelineInput['dispute']>): string {
  if (d.resolvedBy === 'buyer') return 'Closed by the buyer: order received'
  const by = d.resolvedBy === 'seller' ? 'By the seller' : 'By DropMarket'
  if (d.favoredParty === 'buyer') return `${by}: refunded to the buyer`
  if (d.favoredParty === 'neutral') return `${by}: partial refund`
  return `${by}: in the seller's favour`
}

export function buildOrderTimeline(o: TimelineInput): TimelineStep[] {
  const done: TimelineStep[] = []
  const status = o.status
  const d = o.dispute ?? null

  if (status === 'pending') {
    return [
      { key: 'placed', icon: 'placed', title: 'Awaiting Payment', detail: 'Complete your payment to start this order', at: o.created_at, state: 'current', tone: 'amber' },
      { key: 'delivered', icon: 'delivered', title: 'Delivery', detail: 'The seller delivers your order', at: null, state: 'upcoming', tone: 'lime' },
      { key: 'completed', icon: 'completed', title: 'Order Completed', detail: 'Confirm and the order is complete', at: null, state: 'upcoming', tone: 'lime' },
    ]
  }

  // Cancelled before payment: nothing else happened.
  if (status === 'cancelled' && !o.paid_at) {
    return [
      { key: 'placed', icon: 'placed', title: 'Order Placed', detail: 'Waiting for payment', at: o.created_at, state: 'done', tone: 'lime' },
      { key: 'cancelled', icon: 'cancelled', title: 'Order Cancelled', detail: 'No payment arrived, nothing was charged', at: o.cancelled_at ?? o.updated_at ?? null, state: 'done', tone: 'red' },
    ]
  }

  const placedAt = o.paid_at ?? o.created_at
  done.push({ key: 'placed', icon: 'placed', title: 'Order Placed', detail: 'Paid and covered by SafeDrop Protection', at: placedAt, state: 'done', tone: 'lime' })

  if (o.delivering_at) {
    done.push({ key: 'started', icon: 'started', title: 'Delivery Started', detail: 'The seller started working on the order', at: o.delivering_at, state: 'done', tone: 'lime' })
  } else if (
    status !== 'paid' &&
    o.disputed_at &&
    (!o.delivered_at || Date.parse(o.disputed_at) < Date.parse(o.delivered_at))
  ) {
    // Disputed before the seller ever responded.
    done.push({ key: 'waiting', icon: 'waiting', title: 'Waiting For Seller', detail: 'The seller had not started when the dispute was opened', at: placedAt, state: 'done', tone: 'amber' })
  }

  if (o.delivered_at) {
    done.push({ key: 'delivered', icon: 'delivered', title: 'Marked As Delivered', detail: 'The seller marked the order delivered', at: o.delivered_at, state: 'done', tone: 'lime' })
  }
  if (o.disputed_at) {
    const reason = d?.reason ? REASON_LABEL[d.reason] ?? null : null
    done.push({ key: 'disputed', icon: 'disputed', title: 'Order Disputed', detail: reason ? `Reason: ${reason}` : 'Payout paused while it is sorted out', at: o.disputed_at, state: 'done', tone: 'red' })
  }
  if (d?.resolvedAt) {
    done.push({ key: 'resolved', icon: 'resolved', title: 'Dispute Resolved', detail: resolvedDetail(d), at: d.resolvedAt, state: 'done', tone: 'blue' })
  }
  if (status === 'completed' && o.completed_at) {
    done.push({ key: 'completed', icon: 'completed', title: 'Order Completed', detail: 'The seller has been paid', at: o.completed_at, state: 'done', tone: 'lime' })
  } else if (status === 'refunded') {
    done.push({ key: 'refunded', icon: 'refunded', title: 'Order Refunded', detail: 'Refunded to the buyer’s DropMarket wallet', at: d?.resolvedAt ?? o.completed_at ?? o.updated_at ?? null, state: 'done', tone: 'blue' })
  } else if (status === 'cancelled') {
    done.push({ key: 'cancelled', icon: 'cancelled', title: 'Order Cancelled', detail: 'The payment was returned to the buyer', at: o.cancelled_at ?? o.updated_at ?? null, state: 'done', tone: 'red' })
  }

  // Oldest first. A post-completion dispute sorts after "Order Completed".
  const t = (s: TimelineStep) => (s.at ? Date.parse(s.at) : 0)
  done.sort((a, b) => t(a) - t(b))

  // What is still to come.
  const next: TimelineStep[] = []
  if (status === 'paid') {
    next.push({ key: 'waiting', icon: 'waiting', title: 'Waiting For Seller', detail: 'The seller will start your delivery soon', at: null, state: 'current', tone: 'amber' })
  }
  if (status === 'paid' || status === 'delivering') {
    next.push({ key: 'delivered', icon: 'delivered', title: 'Marked As Delivered', detail: 'The seller marks the order delivered', at: null, state: 'upcoming', tone: 'lime' })
  }
  if (status === 'paid' || status === 'delivering' || status === 'delivered') {
    next.push({ key: 'completed', icon: 'completed', title: 'Order Completed', detail: 'When the buyer confirms, or when the protection window closes', at: null, state: 'upcoming', tone: 'lime' })
  }
  if (status === 'disputed' && !d?.resolvedAt) {
    if (!o.delivered_at) {
      next.push({ key: 'delivered', icon: 'delivered', title: 'Marked As Delivered', detail: 'The seller can still deliver the order', at: null, state: 'upcoming', tone: 'lime' })
    }
    next.push({ key: 'resolved', icon: 'resolved', title: 'Dispute Resolved', detail: 'When the buyer confirms receipt, or DropMarket decides', at: null, state: 'current', tone: 'amber' })
  }

  return [...done, ...next]
}
