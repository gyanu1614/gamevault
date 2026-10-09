/**
 * The navbar's Live Orders reads buying and selling orders in ONE request
 * (newest first) and splits them here. Buyers keep their unpaid 'pending'
 * orders; sellers never see 'pending' (they can't act before payment).
 */
const PER_SIDE = 5

export function splitActiveOrders<T extends { buyer_id?: string | null; seller_id?: string | null; status?: string | null }>(
  rows: readonly T[],
  userId: string,
): { buying: T[]; selling: T[] } {
  const buying: T[] = []
  const selling: T[] = []
  for (const r of rows) {
    if (r.buyer_id === userId) {
      if (buying.length < PER_SIDE) buying.push(r)
    } else if (r.seller_id === userId && r.status !== 'pending') {
      if (selling.length < PER_SIDE) selling.push(r)
    }
  }
  return { buying, selling }
}
