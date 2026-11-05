/**
 * The wallet's two lists, read in the browser with the session client when their
 * tab opens. The balance and withdrawals come from the server page instead.
 */
import { createClient } from '@/lib/supabase/client'
import { chunk, fetchAllRows } from '@/lib/db/fetch-all'
import { orderItemImage, orderItemTitle, type CurrencyTitleConfig } from '@/lib/orders/display-title'
import { withOwnOrderFields } from '@/lib/orders/own-fields'
import { lifetimeSpentOf, saleRowAmounts } from '@/lib/wallet/wallet-rows'

export interface PurchaseTransaction {
  id: string
  amount: number
  platformFee: number
  netAmount: number
  status: 'completed' | 'processing' | 'pending' | 'failed'
  title: string
  orderId: string
  orderNumber?: string
  createdAt: string
  gameName?: string
  gameEmoji?: string
  gameImageUrl?: string | null
  listingImageUrl?: string | null
  categoryName?: string
}

// ── Fetch buyer purchase history ───────────────────────────────────────────────

export async function fetchPurchases(userId: string) {
  const supabase = createClient()

  // Paged: one PostgREST response stops at 1000 rows, silently.
  const { data: rawOrders, error } = await fetchAllRows<any>((from, to) =>
    supabase
      .from('orders')
      .select(`
        id,
        order_number,
        total_amount,
        status,
        created_at,
        quantity,
        listing:listing_id (
          title,
          images,
          game_id,
          bundle_id,
          game:game_id (name, emoji, image_url),
          category:game_categories!listings_game_category_id_fkey (name, type)
        )
      `)
      .eq('buyer_id', userId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to),
  )

  if (error) {
    console.error('[Wallet] Failed to fetch purchases:', error)
    throw error
  }

  const orders = (rawOrders || []) as any[]
  const currencyCfgs = await currencyConfigsFor(supabase, orders)

  const transactions: PurchaseTransaction[] = orders.map(order => {
    const listing = order.listing as any
    const item = itemOf(order, currencyCfgs)
    return {
      id: order.id,
      amount: order.total_amount || 0,
      // The buyer's row shows what THEY paid. platform_fee / seller_payout are
      // the seller's commission and payout, not the buyer's business.
      platformFee: 0,
      netAmount: 0,
      status: order.status as any,
      title: item.title,
      orderId: order.id,
      orderNumber: order.order_number,
      createdAt: order.created_at,
      gameName: listing?.game?.name,
      gameEmoji: listing?.game?.emoji,
      gameImageUrl: listing?.game?.image_url,
      listingImageUrl: item.image,
      categoryName: listing?.category?.name,
    }
  }) as any

  const lifetimeSpent = lifetimeSpentOf(orders)

  return { transactions, lifetimeSpent }
}

// ── Fetch seller sales history (with game/category) ───────────────────────────

export interface SaleTransaction {
  id: string
  orderId: string
  orderNumber: string
  buyerUsername: string
  amount: number
  platformFee: number
  netAmount: number
  status: string
  createdAt: string
  listingTitle: string
  gameName?: string
  gameEmoji?: string
  gameImageUrl?: string | null
  listingImageUrl?: string | null
  categoryName?: string
}

export async function fetchSales(userId: string): Promise<SaleTransaction[]> {
  const supabase = createClient()

  const { data, error } = await fetchAllRows<any>((from, to) =>
    supabase
      .from('orders')
      .select(`
        id,
        order_number,
        subtotal,
        total_amount,
        status,
        created_at,
        quantity,
        buyer:public_profiles!orders_buyer_id_fkey(username),
        listing:listing_id (
          title,
          images,
          game_id,
          bundle_id,
          game:game_id (name, emoji, image_url),
          category:game_categories!listings_game_category_id_fkey (name, type)
        )
      `)
      .eq('seller_id', userId)
      // Every PAID sale, whatever happened next. (Was: 'processing' and
      // 'confirmed', which are not order statuses, and delivering / disputed /
      // refunded sales silently vanished.)
      .in('status', ['paid', 'delivering', 'delivered', 'disputed', 'completed', 'refunded'])
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to),
  )

  if (error) {
    console.error('[fetchSales] Error:', error)
    throw error
  }

  // seller_payout is the seller's private column: merged in, not selected.
  const rows = (await withOwnOrderFields(supabase, 'seller', (data || []) as any[])) as any[]

  // A partial refund completes the order but pays the seller less: what they
  // kept is dispute_resolutions.seller_payout_amount (latest resolved dispute).
  const kept = new Map<string, number>()
  const completedIds = rows.filter((o) => o.status === 'completed').map((o) => o.id)
  // 100 ids per request: a long .in() list overflows the URL.
  const partialRows = (
    await Promise.all(
      chunk(completedIds).map(async (ids) => {
        const { data: part } = await supabase
          .from('disputes')
          .select('transaction_id, resolved_at, resolution:dispute_resolutions(seller_payout_amount, resolution_type)')
          .in('transaction_id', ids)
          .eq('status', 'resolved_partial')
          .order('resolved_at', { ascending: true }) as any
        return (part ?? []) as any[]
      }),
    )
  ).flat()
  // Oldest first, so the latest resolution per order wins below.
  partialRows.sort((a, b) => String(a.resolved_at ?? '').localeCompare(String(b.resolved_at ?? '')))
  for (const d of partialRows) {
    const r = Array.isArray(d.resolution) ? d.resolution[0] : d.resolution
    if (r?.resolution_type === 'partial_refund' && r.seller_payout_amount != null) {
      kept.set(d.transaction_id, Number(r.seller_payout_amount))
    }
  }

  const currencyCfgs = await currencyConfigsFor(supabase, rows)
  return rows.map(order => {
    const { amount, platformFee, netAmount } = saleRowAmounts(order, kept.get(order.id))
    return {
    id: order.id,
    orderId: order.id,
    orderNumber: order.order_number || `#${order.id.slice(0, 8)}`,
    buyerUsername: order.buyer?.username || 'Unknown',
    amount,
    platformFee,
    netAmount,
    status: order.status,
    createdAt: order.created_at,
    listingTitle: itemOf(order, currencyCfgs).title,
    gameName: order.listing?.game?.name,
    gameEmoji: order.listing?.game?.emoji,
    gameImageUrl: order.listing?.game?.image_url,
    listingImageUrl: itemOf(order, currencyCfgs).image,
    categoryName: order.listing?.category?.name,
    }
  })
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Currency configs (name, icon, bundles) for the currency games in `orders`,
 *  so each row names what was sold ("50 Diamonds") like the order page. */
async function currencyConfigsFor(
  supabase: ReturnType<typeof createClient>,
  orders: any[],
): Promise<Record<string, CurrencyTitleConfig>> {
  const ids = Array.from(
    new Set(
      orders
        .filter((o) => o.listing?.category?.type === 'currency' && o.listing?.game_id)
        .map((o) => o.listing.game_id as string),
    ),
  )
  if (ids.length === 0) return {}
  const out: Record<string, CurrencyTitleConfig> = {}
  for (const part of chunk(ids)) {
    const { data } = await supabase
      .from('category_configs')
      .select('game_id, unit_label:config->>unit_label, quantity_granularity:config->>quantity_granularity, currency_icon_url:config->>currency_icon_url, bundles:config->bundles')
      .eq('category_type', 'currency')
      .in('game_id', part)
    for (const r of (data ?? []) as any[]) out[r.game_id] = r
  }
  return out
}

function itemOf(order: any, cfgs: Record<string, CurrencyTitleConfig>) {
  const listing = order.listing ?? {}
  const cfg = listing.game_id ? cfgs[listing.game_id] ?? null : null
  const categoryType = listing.category?.type ?? null
  return {
    title: orderItemTitle({
      listingTitle: listing.title ?? 'Game Item',
      quantity: order.quantity ?? 1,
      categoryType,
      currencyConfig: cfg,
      bundleId: listing.bundle_id ?? null,
    }),
    image: orderItemImage({
      categoryType,
      currencyConfig: cfg,
      bundleId: listing.bundle_id ?? null,
      listingImage: Array.isArray(listing.images) ? listing.images[0] ?? null : null,
    }),
  }
}
