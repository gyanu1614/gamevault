import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Merge the CALLER's own private order fields into rows it already read.
 *
 * A session client cannot select the private `orders` columns (see
 * src/lib/orders/columns.ts); each party reads its own through an
 * auth.uid()-scoped RPC that returns nothing for an order the caller is not
 * that party on:
 *   · seller → seller_payout, seller_commission_pct, platform_fee, platform_fee_rate
 *   · buyer  → checkout_url, payment_provider, wallet_amount_used, promo_discount,
 *              payment_processing_fee, buyer_fee_pct, buyer_fee_amount, buyer_fee_method
 *
 * Throws on an RPC error: a page that silently showed a 0 payout would be
 * worse than one that fails.
 */

export type OrderParty = 'seller' | 'buyer'

// Only .rpc is used — any session client (server, browser) fits.
type Client = Pick<SupabaseClient<any, any, any, any, any>, 'rpc'>

const RPC: Record<OrderParty, string> = {
  seller: 'orders_seller_private',
  buyer: 'orders_buyer_private',
}

// PostgREST caps an RPC's result at max_rows (1000).
const CHUNK = 500

export async function withOwnOrderFields<T extends { id: string }>(
  client: Client,
  party: OrderParty,
  rows: T[],
): Promise<Array<T & Record<string, unknown>>> {
  if (rows.length === 0) return rows
  const ids = Array.from(new Set(rows.map((r) => r.id)))
  const own = new Map<string, Record<string, unknown>>()
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data, error } = await (client.rpc as any)(RPC[party], { p_order_ids: ids.slice(i, i + CHUNK) })
    if (error) throw new Error(`${RPC[party]}: ${error.message}`)
    for (const { id, ...fields } of (data ?? []) as Array<{ id: string } & Record<string, unknown>>) own.set(id, fields)
  }
  return rows.map((r) => ({ ...r, ...(own.get(r.id) ?? {}) }))
}
