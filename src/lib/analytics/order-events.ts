/**
 * Server funnel events for a paid order (growth point 1), built from the
 * order the payment notifier already loaded:
 *
 *   order_paid         → the buyer's funnel end (with the creator/promo code)
 *   seller_first_sale  → the seller funnel end, when this is their only paid order
 *
 * Runs after the order is confirmed (paid_at stamped), on the one applied
 * CHARGE_CONFIRMED transition, so each fires once. Reads are best-effort:
 * a failed read drops the extra detail, never the sale and never the payment.
 */
import type { AnalyticsEvent } from './events'

type AnyClient = { from: (table: string) => any }

export interface PaidOrder {
  id: string
  buyer_id: string
  seller_id: string
  total_amount: number | null
  gameSlug: string | null
  promoCodeId: string | null
}

export interface ServerEvent {
  event: AnalyticsEvent
  distinctId: string
  props: Record<string, string | number | null>
}

async function promoCode(client: AnyClient, id: string | null): Promise<string | null> {
  if (!id) return null
  try {
    const { data } = await client.from('promo_codes').select('code').eq('id', id).maybeSingle()
    return typeof data?.code === 'string' ? data.code.toUpperCase() : null
  } catch {
    return null
  }
}

/** True only when the read succeeds and shows exactly this one paid order. */
async function isFirstSale(client: AnyClient, sellerId: string): Promise<boolean> {
  try {
    // Two rows answer "only one?" — never a HEAD count on this path.
    const { data } = await client
      .from('orders')
      .select('id')
      .eq('seller_id', sellerId)
      .not('paid_at', 'is', null)
      .limit(2)
    return Array.isArray(data) && data.length === 1
  } catch {
    return false
  }
}

export async function orderPaidEvents(client: AnyClient, order: PaidOrder): Promise<ServerEvent[]> {
  const sale = { order_id: order.id, total_usd: Number(order.total_amount ?? 0), game: order.gameSlug }
  const [code, first] = await Promise.all([promoCode(client, order.promoCodeId), isFirstSale(client, order.seller_id)])
  const events: ServerEvent[] = [{ event: 'order_paid', distinctId: order.buyer_id, props: { ...sale, promo_code: code } }]
  if (first) events.push({ event: 'seller_first_sale', distinctId: order.seller_id, props: sale })
  return events
}
