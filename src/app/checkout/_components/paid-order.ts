/**
 * Server loader for the Order Paid view: the buyer's OWN order, summarised
 * for display. Null when the order is missing or belongs to someone else.
 * Session client (RLS + an explicit buyer check).
 */
import 'server-only'

import type { PaidOrderSummary } from './OrderPaidView'

export async function loadPaidOrderSummary(supabase: any, orderId: string, userId: string): Promise<PaidOrderSummary | null> {
  const { data: order } = (await supabase
    .from('orders')
    .select('id, order_number, buyer_id, status, quantity, total_amount, listing_id, listing:listing_id ( title, images, delivery_time, delivery_method, game:game_id ( name, slug, image_url ), seller:seller_id ( shop_name, username ) )')
    .eq('id', orderId)
    .maybeSingle()) as any
  if (!order || order.buyer_id !== userId) return null
  return {
    id: order.id,
    orderNumber: order.order_number ?? null,
    status: order.status,
    total: Number(order.total_amount) || 0,
    quantity: Number(order.quantity) || 1,
    title: order.listing?.title ?? 'Your order',
    image: order.listing?.images?.[0] ?? order.listing?.game?.image_url ?? null,
    gameName: order.listing?.game?.name ?? null,
    gameSlug: order.listing?.game?.slug ?? null,
    sellerName: order.listing?.seller?.shop_name || order.listing?.seller?.username || null,
    deliveryTime: order.listing?.delivery_time ?? null,
    instantDelivery: order.listing?.delivery_method === 'instant',
    listingId: order.listing_id,
  }
}
