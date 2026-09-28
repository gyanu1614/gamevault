'use server'

/**
 * P6.2 — Admin Analytics Dashboard
 *
 * Queries run as the admin's session client (RLS is_admin()); every exported
 * function first calls requireAdmin() so only admins can invoke them.
 * Sums walk every row through fetchAllRows (PostgREST caps one response at
 * 1000 rows); counts are bounded GETs. Day / month boundaries are UTC.
 */

import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/actions/admin-permissions'
import { fetchAllRows } from '@/lib/db/fetch-all'
import { utcPeriods } from '@/lib/admin/periods'
import {
  COLLECTED_ORDER_STATUSES,
  FINISHED_DISPUTE_STATUSES,
  OPEN_DISPUTE_STATUSES,
} from '@/lib/admin/status-sets'

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000

const num = (v: unknown) => Number(v) || 0

async function countOf(q: PromiseLike<{ count: number | null; error: unknown }>): Promise<number> {
  const { count, error } = await q
  if (error) throw error
  return count ?? 0
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DailyPoint { date: string; value: number }

export interface AnalyticsData {
  // Revenue — collected orders only (COLLECTED_ORDER_STATUSES)
  platformRevenueTotal: number      // all-time buyer fees + seller fee
  platformRevenueMtd: number        // month-to-date
  platformRevenuePrevMonth: number  // for % change
  gmvTotal: number                  // gross merchandise value
  gmvMtd: number
  // Orders
  ordersTotal: number
  ordersMtd: number
  ordersPrevMonth: number
  ordersCompleted: number
  ordersDisputed: number
  ordersRefunded: number
  ordersGuest: number
  avgOrderValue: number
  // Users
  usersTotal: number
  usersNewMtd: number
  usersNewPrevMonth: number
  sellersActive: number
  buyersTotal: number
  // Listings
  listingsActive: number
  listingsTotal: number
  listingsNewMtd: number
  // Promos
  promoUsages: number
  promoTotalDiscount: number
  // Disputes
  disputesOpen: number              // OPEN_DISPUTE_STATUSES
  disputesResolved: number          // FINISHED_DISPUTE_STATUSES (resolved_* + closed)
  // Charts
  dailyRevenue: DailyPoint[]   // last 30 days platform revenue
  dailyOrders: DailyPoint[]    // last 30 days collected-order count
  // Top sellers
  topSellers: { username: string; totalSales: number; lifetimeEarnings: number }[]
}

// ── Main analytics fetch ──────────────────────────────────────────────────────

export async function getAnalyticsData(): Promise<{
  success: boolean
  data?: AnalyticsData
  error?: string
}> {
  // Outside the try: requireAdmin redirects (throws NEXT_REDIRECT) for a
  // non-admin, and the catch below must not swallow that.
  await requireAdmin()
  try {
    const supabase = await createClient()
    // Fees / promo are private order columns a session client cannot select
    // (orders column grant): those reads use the service role, after
    // requireAdmin above.
    const service = createServiceRoleClient()

    const { todayStart, monthStart, prevMonthStart } = utcPeriods()
    const mtdStart   = monthStart.toISOString()
    const prevMStart = prevMonthStart.toISOString()

    // ── One round: both paged walks + every count, concurrently ─────────────
    const orderCount = () => supabase.from('orders').select('id', { count: 'exact' }).limit(1)
    const profileCount = () => supabase.from('profiles').select('id', { count: 'exact' }).limit(1)
    const listingCount = () => supabase.from('listings').select('id', { count: 'exact' }).limit(1)
    const disputeCount = () => supabase.from('disputes').select('id', { count: 'exact' }).limit(1)
    const [
      collectedWalk,
      promoWalk,
      [
        ordersTotal, ordersMtd, ordersPrevMonth, ordersCompleted, ordersDisputed, ordersRefunded, ordersGuest,
        usersTotal, usersNewMtd, usersNewPrevMonth, sellersActive, buyersTotal,
        listingsTotal, listingsActive, listingsNewMtd,
        promoUsages, disputesOpen, disputesResolved,
      ],
    ] = await Promise.all([
      // Every collected order (revenue, GMV, charts). seller_payout /
      // platform_fee / payment_processing_fee are private order columns the
      // session client cannot select: service role, after requireAdmin.
      fetchAllRows<any>((from, to) =>
        service
          .from('orders')
          .select('id, status, created_at, total_amount, subtotal, seller_payout, platform_fee, payment_processing_fee, vaultshield_tier_fee')
          .in('status', COLLECTED_ORDER_STATUSES)
          .order('id', { ascending: true })
          .range(from, to) as any,
      ),
      fetchAllRows<any>((from, to) =>
        supabase
          .from('promo_code_usages')
          .select('id, discount_amount')
          .order('id', { ascending: true })
          .range(from, to) as any,
      ),
      // Counts: bounded GETs, never head:true.
      Promise.all([
        countOf(orderCount()),
        countOf(orderCount().gte('created_at', mtdStart)),
        countOf(orderCount().gte('created_at', prevMStart).lt('created_at', mtdStart)),
        countOf(orderCount().eq('status', 'completed')),
        countOf(orderCount().eq('status', 'disputed')),
        countOf(orderCount().eq('status', 'refunded')),
        countOf(orderCount().eq('is_guest_order', true)),
        countOf(profileCount()),
        countOf(profileCount().gte('created_at', mtdStart)),
        countOf(profileCount().gte('created_at', prevMStart).lt('created_at', mtdStart)),
        countOf(profileCount().eq('role', 'seller')),
        countOf(profileCount().eq('role', 'buyer')),
        countOf(listingCount()),
        countOf(listingCount().eq('status', 'active')),
        countOf(listingCount().gte('created_at', mtdStart)),
        countOf(supabase.from('promo_code_usages').select('id', { count: 'exact' }).limit(1)),
        countOf(disputeCount().in('status', OPEN_DISPUTE_STATUSES)),
        countOf(disputeCount().in('status', FINISHED_DISPUTE_STATUSES)),
      ]),
    ])
    if (collectedWalk.error) throw collectedWalk.error
    if (promoWalk.error) throw promoWalk.error
    const orders: any[] = collectedWalk.data ?? []

    // ── Revenue ──────────────────────────────────────────────────────────────
    // What DropMarket charged on the order: the buyer's fees (platform_fee =
    // marketplace fee, the method's processing fee, the legacy tier fee) plus
    // the seller fee, which is not a column: subtotal − seller_payout.
    const platformFeeFor = (o: any) =>
      num(o.platform_fee) + num(o.payment_processing_fee) + num(o.vaultshield_tier_fee)
      + (num(o.subtotal) - num(o.seller_payout))

    const at      = (o: any) => new Date(o.created_at).getTime()
    const isMtd   = (o: any) => at(o) >= monthStart.getTime()
    const isPrevM = (o: any) => at(o) >= prevMonthStart.getTime() && at(o) < monthStart.getTime()

    const platformRevenueTotal   = orders.reduce((s, o) => s + platformFeeFor(o), 0)
    const platformRevenueMtd     = orders.filter(isMtd).reduce((s, o) => s + platformFeeFor(o), 0)
    const platformRevenuePrevMonth = orders.filter(isPrevM).reduce((s, o) => s + platformFeeFor(o), 0)
    const gmvTotal               = orders.reduce((s, o) => s + num(o.total_amount), 0)
    const gmvMtd                 = orders.filter(isMtd).reduce((s, o) => s + num(o.total_amount), 0)
    const completedAmounts       = orders.filter(o => o.status === 'completed').map(o => num(o.total_amount))
    const avgOrderValue          = completedAmounts.length
      ? completedAmounts.reduce((s, v) => s + v, 0) / completedAmounts.length
      : 0

    // ── Promos ───────────────────────────────────────────────────────────────
    const promoTotalDiscount = (promoWalk.data ?? []).reduce((s: number, r: any) => s + num(r.discount_amount), 0)

    // ── Daily charts (last 30 UTC days, collected orders) ────────────────────
    const dailyRevMap: Record<string, number> = {}
    const dailyOrdMap: Record<string, number> = {}
    for (let i = 29; i >= 0; i--) {
      const key = new Date(todayStart.getTime() - i * DAY_MS).toISOString().slice(0, 10)
      dailyRevMap[key] = 0
      dailyOrdMap[key] = 0
    }
    for (const o of orders) {
      const key = new Date(o.created_at).toISOString().slice(0, 10)
      if (dailyRevMap[key] !== undefined) {
        dailyRevMap[key] += platformFeeFor(o)
        dailyOrdMap[key] += 1
      }
    }
    const dailyRevenue = Object.entries(dailyRevMap).map(([date, value]) => ({ date, value }))
    const dailyOrders  = Object.entries(dailyOrdMap).map(([date, value]) => ({ date, value }))

    // ── Top sellers ───────────────────────────────────────────────────────────
    const { data: topRaw } = await supabase
      .from('profiles')
      .select('username, total_sales, lifetime_earnings')
      .eq('role', 'seller')
      .order('lifetime_earnings', { ascending: false })
      .limit(5)

    const topSellers = ((topRaw as any[] | null) ?? []).map(s => ({
      username:         s.username ?? '—',
      totalSales:       s.total_sales ?? 0,
      lifetimeEarnings: s.lifetime_earnings ?? 0,
    }))

    return {
      success: true,
      data: {
        platformRevenueTotal,
        platformRevenueMtd,
        platformRevenuePrevMonth,
        gmvTotal,
        gmvMtd,
        ordersTotal,
        ordersMtd,
        ordersPrevMonth,
        ordersCompleted,
        ordersDisputed,
        ordersRefunded,
        ordersGuest,
        avgOrderValue,
        usersTotal,
        usersNewMtd,
        usersNewPrevMonth,
        sellersActive,
        buyersTotal,
        listingsActive,
        listingsTotal,
        listingsNewMtd,
        promoUsages,
        promoTotalDiscount,
        disputesOpen,
        disputesResolved,
        dailyRevenue,
        dailyOrders,
        topSellers,
      },
    }
  } catch (err: any) {
    console.error('[analytics] getAnalyticsData error:', err)
    return { success: false, error: err.message || 'Failed to load analytics' }
  }
}
