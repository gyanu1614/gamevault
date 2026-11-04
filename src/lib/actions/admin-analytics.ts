'use server'

/**
 * P6.2 — Admin Analytics Dashboard
 *
 * Every number comes from one cached database call shared with the dashboard
 * (lib/admin/overview-stats), after a role check. Day / month boundaries are UTC.
 */

import { requireRole } from '@/lib/actions/admin-permissions'
import { getAdminOverviewStats } from '@/lib/admin/overview-stats'

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
  // Outside the try: the check redirects (throws NEXT_REDIRECT) for a non-admin,
  // and the catch below must not swallow that. Money numbers: the money roles,
  // the same ones the sidebar shows this page to.
  await requireRole(['admin', 'super_admin'])
  try {
    // One cached call for every number (lib/admin/overview-stats). Was 18 counts
    // plus a walk of every collected order and every promo usage.
    const overview = await getAdminOverviewStats()
    const { orders, profiles, listings, promos, disputes } = overview

    const platformRevenueTotal = orders.charged_total
    const platformRevenueMtd = orders.charged_month
    const platformRevenuePrevMonth = orders.charged_prev_month
    const gmvTotal = orders.revenue_total
    const gmvMtd = orders.revenue_month
    const ordersTotal = orders.total
    const ordersMtd = orders.month
    const ordersPrevMonth = orders.prev_month
    const ordersCompleted = orders.completed
    const ordersDisputed = orders.disputed
    const ordersRefunded = orders.refunded
    const ordersGuest = orders.guest
    const avgOrderValue = orders.avg_completed_value
    const usersTotal = profiles.total
    const usersNewMtd = profiles.month
    const usersNewPrevMonth = profiles.prev_month
    const sellersActive = profiles.sellers
    // Distinct buyers with a collected order. It counted profiles.role = 'buyer',
    // a role that does not exist, so it was always 0.
    const buyersTotal = orders.distinct_buyers
    const listingsActive = listings.active
    const listingsTotal = listings.total
    const listingsNewMtd = listings.month
    const promoUsages = promos.usages
    const promoTotalDiscount = promos.total_discount
    const disputesOpen = disputes.open_all
    const disputesResolved = disputes.finished
    const dailyRevenue = overview.daily.map((d) => ({ date: d.date, value: d.revenue }))
    const dailyOrders = overview.daily.map((d) => ({ date: d.date, value: d.orders }))
    const topSellers = overview.top_sellers.map((s) => ({
      username: s.username ?? '—',
      totalSales: s.total_sales ?? 0,
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
