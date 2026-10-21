/**
 * Seller and buyer order lists, one party's columns each.
 *
 * Part of the browser seller API, split out of lib/api/seller-compatible.ts
 * (2026-10-20, files under ~400 lines). Import from '@/lib/api/seller-compatible'.
 */
import { supabase } from './client'
import { orderNumberSearchPattern } from '@/lib/orders/order-number'
import { fetchAllRows } from '@/lib/db/fetch-all'
import { withOwnOrderFields } from '@/lib/orders/own-fields'
import type { OrderStatus, Order } from './types'

// =====================================================
// ORDERS API
// =====================================================

// Order columns each party's browser receives. The database grants a session
// client only the shared columns (src/lib/orders/columns.ts) — '*' or a
// private column is refused — so the seller's own payout is merged in
// through withOwnOrderFields, never selected.
const ORDER_SHARED_COLUMNS =
  'id, order_number, buyer_id, seller_id, listing_id, quantity, unit_price, subtotal, total_amount, status, escrow_status, currency, created_at, updated_at, paid_at, delivering_at, delivered_at, completed_at, cancelled_at, disputed_at'
const SELLER_ORDER_COLUMNS = `${ORDER_SHARED_COLUMNS}, delivery_details`
const BUYER_ORDER_COLUMNS = `${ORDER_SHARED_COLUMNS}, delivery_details`

export const ordersApi = {
  /**
   * Get all orders for the current seller
   */
  async getAll(filters?: {
    status?: OrderStatus
    search?: string
  }): Promise<Order[]> {
    // CRITICAL: Get current user and filter by seller_id
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Paged: one PostgREST response stops at 1000 rows, silently.
    const build = () => {
      let query = supabase
        .from('orders')
        .select(`
          ${SELLER_ORDER_COLUMNS},
          listing:listing_id (
            id,
            title,
            game_id,
            game_category_id,
            bundle_id,
            images,
            game:games!listings_game_id_fkey (
              id,
              name,
              slug,
              image_url
            ),
            category:game_categories!listings_game_category_id_fkey (
              id,
              name,
              slug,
              type
            )
          ),
          buyer:buyer_id (
            id,
            username,
            avatar_url,
            shop_name,
            shop_slug
          )
        `)
        .eq('seller_id', user.id)  // CRITICAL: Only show current seller's orders
        // Workstream E — hide unpaid 'pending' orders from the seller's Sold
        // Orders. An order the seller can't act on (payment not confirmed) must
        // not appear in their list; it becomes visible the moment the webhook
        // flips it to 'paid'. 'cancelled' is likewise hidden: it only ever means
        // an order that was NEVER paid (timed out / abandoned — paid orders that
        // come back are 'refunded'), so the seller was never involved.
        .neq('status', 'pending')
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false })

      if (filters?.status) {
        query = query.eq('status', filters.status)
      }
      if (filters?.search && filters.search.trim()) {
        query = query.ilike('order_number_search', orderNumberSearchPattern(filters.search))
      }
      return query
    }
    const { data, error } = await fetchAllRows<any>((from, to) =>
      build().order('id', { ascending: false }).range(from, to),
    )

    if (error) throw error
    return withOwnOrderFields(supabase, 'seller', data || []) as Promise<Order[]>
  },

  /**
   * Get a single order by ID
   */
  async getById(id: string): Promise<Order | null> {
    // CRITICAL: Verify ownership
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('orders')
      .select(`
        ${SELLER_ORDER_COLUMNS},
        listing:listing_id (
          id,
          title,
          game_id,
          images
        ),
        buyer:buyer_id (
          id,
          username,
          avatar_url
        )
      `)
      .eq('id', id)
      .eq('seller_id', user.id)  // CRITICAL: Only allow access to own orders
      .single()

    if (error) throw error
    const [own] = await withOwnOrderFields(supabase, 'seller', [data as any])
    return own as Order
  },

  // Order status changes only through the server actions / RPCs
  // (order_mark_delivered, order_confirm_receipt, …). The browser-side
  // updateStatus / deliver writes that lived here were blocked by the
  // orders guard trigger and had no callers.
}

// =====================================================
// BUYER ORDERS API
// =====================================================

export const buyerOrdersApi = {
  /**
   * Get all orders for the current buyer
   */
  async getAll(filters?: {
    status?: OrderStatus
    search?: string
  }): Promise<Order[]> {
    // Get current user and filter by buyer_id
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Paged: one PostgREST response stops at 1000 rows, silently.
    const build = () => {
      let query = supabase
        .from('orders')
        .select(`
          ${BUYER_ORDER_COLUMNS},
          listing:listing_id (
            id,
            title,
            game_id,
            game_category_id,
            bundle_id,
            images,
            delivery_method,
            delivery_time,
            game:games!listings_game_id_fkey (
              id,
              name,
              slug,
              image_url
            ),
            category:game_categories!listings_game_category_id_fkey (
              id,
              name,
              slug,
              type
            )
          ),
          seller:seller_id (
            id,
            username,
            avatar_url,
            seller_tier,
            shop_name,
            shop_slug
          )
        `)
        .eq('buyer_id', user.id)  // Filter by buyer_id instead of seller_id
        // 'cancelled' only ever means never-paid (abandoned checkout timed out or
        // the buyer cancelled before paying) — dead weight in the list, so it's
        // hidden. Genuinely refunded orders carry status 'refunded' and stay.
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false })

      if (filters?.status) {
        query = query.eq('status', filters.status)
      }
      if (filters?.search && filters.search.trim()) {
        query = query.ilike('order_number_search', orderNumberSearchPattern(filters.search))
      }
      return query
    }
    const { data, error } = await fetchAllRows<any>((from, to) =>
      build().order('id', { ascending: false }).range(from, to),
    )

    if (error) throw error
    return data || []
  },

  /**
   * Get a single order by ID (buyer perspective)
   */
  async getById(id: string): Promise<Order | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('orders')
      .select(`
        ${BUYER_ORDER_COLUMNS},
        listing:listing_id (
          id,
          title,
          game_id,
          game_category_id,
          images,
          delivery_method,
          delivery_time
        ),
        seller:seller_id (
          id,
          username,
          avatar_url,
          seller_tier
        )
      `)
      .eq('id', id)
      .eq('buyer_id', user.id)  // Only allow access to own purchases
      .single()

    if (error) throw error
    return data
  },
}
