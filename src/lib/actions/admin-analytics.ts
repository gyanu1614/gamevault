'use server'

/**
 * P6.2 — Admin Analytics Dashboard
 *
 * All queries run with the service-role client so RLS is bypassed.
 * Every exported function first calls requireAdmin() so only admins can invoke them.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/actions/admin-permissions'

// ── Helpers ───────────────────────────────────────────────────────────────────

function startOf(unit: 'day' | 'month' | 'week'): Date {
  const d = new Date()
  if (unit === 'day')   { d.setHours(0, 0, 0, 0) }
  if (unit === 'month') { d.setDate(1); d.setHours(0, 0, 0, 0) }
  if (unit === 'week')  { d.setDate(d.getDate() - d.getDay()); d.setHours(0, 0, 0, 0) }
  return d
}

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(0, 0, 0, 0)
  return d
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DailyPoint { date: string; value: number }

export interface AnalyticsData {
  // Revenue
  platformRevenueTotal: number      // all-time platform fee + tier fee
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
  disputesOpen: number
  disputesResolved: number
  // Charts
  dailyRevenue: DailyPoint[]   // last 30 days platform revenue
  dailyOrders: DailyPoint[]    // last 30 days order count
  // Top sellers
  topSellers: { username: string; totalSales: number; lifetimeEarnings: number }[]
}

// ── Main analytics fetch ──────────────────────────────────────────────────────

export async function getAnalyticsData(): Promise<{
  success: boolean
  data?: AnalyticsData
  error?: string
}> {
  try {
    await requireAdmin()
    const supabase = await createClient()

    const now        = new Date()
    const mtdStart   = startOf('month').toISOString()
    const prevMStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
    const prevMEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString()
    const d30Ago     = daysAgo(30).toISOString()

    // ── Revenue ──────────────────────────────────────────────────────────────
    const { data: allOrders } = await supabase
      .from('orders')
      .select('platform_fee, vaultshield_tier_fee, payment_processing_fee, total_amount, subtotal, status, created_at, is_guest_order, promo_discount')
      .in('status', ['paid', 'delivering', 'completed', 'disputed'])

    const orders = (allOrders as any[] | null) ?? []

    const platformFeeFor = (o: any) =>
      (o.platform_fee ?? 0) + (o.vaultshield_tier_fee ?? 0) + (o.payment_processing_fee ?? 0)

    const isMtd    = (o: any) => new Date(o.created_at) >= new Date(mtdStart)
    const isPrevM  = (o: any) => {
      const d = new Date(o.created_at)
      return d >= new Date(prevMStart) && d <= new Date(prevMEnd)
    }

    const platformRevenueTotal   = orders.reduce((s, o) => s + platformFeeFor(o), 0)
    const platformRevenueMtd     = orders.filter(isMtd).reduce((s, o) => s + platformFeeFor(o), 0)
    const platformRevenuePrevMonth = orders.filter(isPrevM).reduce((s, o) => s + platformFeeFor(o), 0)
    const gmvTotal               = orders.reduce((s, o) => s + (o.total_amount ?? 0), 0)
    const gmvMtd                 = orders.filter(isMtd).reduce((s, o) => s + (o.total_amount ?? 0), 0)

    // ── Orders ───────────────────────────────────────────────────────────────
    const { data: allOrdersFull } = await supabase
      .from('orders')
      .select('status, created_at, total_amount, is_guest_order')

    const allO = (allOrdersFull as any[] | null) ?? []
    const ordersTotal       = allO.length
    const ordersMtd         = allO.filter(isMtd).length
    const ordersPrevMonth   = allO.filter(isPrevM).length
    const ordersCompleted   = allO.filter(o => o.status === 'completed').length
    const ordersDisputed    = allO.filter(o => o.status === 'disputed').length
    const ordersRefunded    = allO.filter(o => o.status === 'refunded').length
    const ordersGuest       = allO.filter(o => o.is_guest_order).length
    const completedAmounts  = allO.filter(o => o.status === 'completed').map(o => o.total_amount ?? 0)
    const avgOrderValue     = completedAmounts.length
      ? completedAmounts.reduce((s, v) => s + v, 0) / completedAmounts.length
      : 0

    // ── Users ────────────────────────────────────────────────────────────────
    const { count: usersTotal }    = await supabase.from('profiles').select('id', { count: 'exact', head: true })
    const { count: usersNewMtd }   = await supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', mtdStart)
    const { count: usersNewPrevM } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', prevMStart).lte('created_at', prevMEnd)
    const { count: sellersActive } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'seller')
    const { count: buyersTotal }   = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'buyer')

    // ── Listings ─────────────────────────────────────────────────────────────
    const { count: listingsTotal }   = await supabase.from('listings').select('id', { count: 'exact', head: true })
    const { count: listingsActive }  = await supabase.from('listings').select('id', { count: 'exact', head: true }).eq('status', 'active')
    const { count: listingsNewMtd }  = await supabase.from('listings').select('id', { count: 'exact', head: true }).gte('created_at', mtdStart)

    // ── Promos ───────────────────────────────────────────────────────────────
    const { count: promoUsages }    = await supabase.from('promo_code_usages').select('id', { count: 'exact', head: true })
    const { data: promoDiscounts }  = await supabase.from('promo_code_usages').select('discount_amount')
    const promoTotalDiscount = (promoDiscounts as any[] | null)?.reduce((s, r) => s + (r.discount_amount ?? 0), 0) ?? 0

    // ── Disputes ─────────────────────────────────────────────────────────────
    const { count: disputesOpen }     = await supabase.from('disputes').select('id', { count: 'exact', head: true }).in('status', ['open', 'under_review'])
    const { count: disputesResolved } = await supabase.from('disputes').select('id', { count: 'exact', head: true }).eq('status', 'resolved')

    // ── Daily revenue chart (last 30 days) ───────────────────────────────────
    const { data: recentOrders } = await supabase
      .from('orders')
      .select('created_at, platform_fee, vaultshield_tier_fee, payment_processing_fee, total_amount')
      .in('status', ['paid', 'delivering', 'completed', 'disputed'])
      .gte('created_at', d30Ago)

    const dailyRevMap: Record<string, number> = {}
    const dailyOrdMap: Record<string, number> = {}
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      dailyRevMap[key] = 0
      dailyOrdMap[key] = 0
    }
    for (const o of (recentOrders as any[] | null) ?? []) {
      const key = (o.created_at as string).slice(0, 10)
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
        usersTotal:          usersTotal    ?? 0,
        usersNewMtd:         usersNewMtd   ?? 0,
        usersNewPrevMonth:   usersNewPrevM ?? 0,
        sellersActive:       sellersActive ?? 0,
        buyersTotal:         buyersTotal   ?? 0,
        listingsActive:      listingsActive ?? 0,
        listingsTotal:       listingsTotal  ?? 0,
        listingsNewMtd:      listingsNewMtd ?? 0,
        promoUsages:         promoUsages   ?? 0,
        promoTotalDiscount,
        disputesOpen:        disputesOpen     ?? 0,
        disputesResolved:    disputesResolved ?? 0,
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
