/**
 * Order list status groups (real statuses only:
 * pending|paid|delivering|delivered|disputed|completed|cancelled|refunded).
 *
 *  - in_progress: not finished and not in dispute — awaiting payment, waiting
 *    on the seller, being delivered, or delivered and awaiting the buyer's
 *    confirmation ('delivered' is NOT completed).
 *  - completed: completed.
 *  - disputed: disputed.
 *  - closed: refunded or cancelled.
 */

export type OrderStatusGroup = 'in_progress' | 'completed' | 'disputed' | 'closed'

const GROUPS: Record<OrderStatusGroup, readonly string[]> = {
  in_progress: ['pending', 'paid', 'delivering', 'delivered'],
  completed: ['completed'],
  disputed: ['disputed'],
  closed: ['refunded', 'cancelled'],
}

export function inStatusGroup(status: string, group: OrderStatusGroup | 'all'): boolean {
  return group === 'all' || GROUPS[group].includes(status)
}

export function countByStatusGroup(statuses: string[]): Record<OrderStatusGroup | 'all', number> {
  const out = { all: statuses.length, in_progress: 0, completed: 0, disputed: 0, closed: 0 }
  for (const s of statuses) {
    for (const g of Object.keys(GROUPS) as OrderStatusGroup[]) if (GROUPS[g].includes(s)) out[g] += 1
  }
  return out
}
