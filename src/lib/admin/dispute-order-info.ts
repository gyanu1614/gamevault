import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Order number, listing title and game for a set of disputed orders.
 *
 * disputes has no FK to orders — the order id is disputes.transaction_id — so
 * PostgREST can't embed `orders` in a disputes select (PGRST200). Resolve it
 * with one lookup instead. Reads only shared orders columns. Throws on a
 * query error so the caller reports it rather than showing blank rows.
 */
export interface DisputeOrderInfo {
  orderNumber: string | null
  listingTitle: string | null
  gameName: string | null
  gameIcon: string | null
}

export async function fetchDisputeOrderInfo(
  supabase: SupabaseClient<any, any, any, any, any>,
  orderIds: ReadonlyArray<string | null | undefined>,
): Promise<Map<string, DisputeOrderInfo>> {
  const ids = Array.from(new Set(orderIds.filter((id): id is string => Boolean(id))))
  const byOrder = new Map<string, DisputeOrderInfo>()
  if (ids.length === 0) return byOrder

  const { data, error } = await supabase
    .from('orders')
    .select(`
      id,
      order_number,
      listing:listing_id (
        title,
        game:game_id (
          name,
          image_url
        )
      )
    `)
    .in('id', ids)
  if (error) throw new Error(`orders lookup: ${error.message}`)

  for (const order of (data ?? []) as any[]) {
    byOrder.set(order.id, {
      orderNumber: order.order_number ?? null,
      listingTitle: order.listing?.title ?? null,
      gameName: order.listing?.game?.name ?? null,
      gameIcon: order.listing?.game?.image_url ?? null,
    })
  }
  return byOrder
}
