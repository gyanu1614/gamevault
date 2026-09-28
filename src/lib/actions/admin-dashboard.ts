'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/actions/admin-permissions'
import { fetchAllRows } from '@/lib/db/fetch-all'
import { fetchDisputeOrderInfo } from '@/lib/admin/dispute-order-info'
import { utcPeriods } from '@/lib/admin/periods'
import {
  COLLECTED_ORDER_STATUSES,
  IN_PROGRESS_ORDER_STATUSES,
  OPEN_DISPUTE_STATUSES,
} from '@/lib/admin/status-sets'

export interface DashboardStats {
  // Orders
  totalOrders: number
  ordersToday: number
  ordersThisWeek: number
  /** Paid, not finished, not in dispute (IN_PROGRESS_ORDER_STATUSES). */
  activeOrders: number

  // Revenue — total_amount over collected orders (COLLECTED_ORDER_STATUSES),
  // the same figure as /admin/orders. Day / month boundaries are UTC.
  totalRevenue: number
  revenueToday: number
  revenueThisMonth: number
  revenueLastMonth: number

  // Users
  totalUsers: number
  usersToday: number
  /** Distinct buyers with at least one collected order. */
  totalBuyers: number
  activeSellers: number

  // Sellers
  pendingApplications: number
  approvedToday: number
  totalApproved: number
  totalRejected: number

  // Disputes — open = every OPEN_DISPUTE_STATUSES value
  openDisputes: number
  disputesToday: number
  highPriorityDisputes: number

  // Cancellations
  pendingCancellations: number

  // Fraud
  openFraudFlags: number
  highSeverityFlags: number

  // System
  unreadNotifications: number
  pendingReviews: number
  systemHealth: 'good' | 'warning' | 'critical'
}

export async function getDashboardStats(): Promise<{
  success: boolean
  stats?: DashboardStats
  error?: string
}> {
  // Outside the try: requireAdmin redirects (throws NEXT_REDIRECT) for a
  // non-admin, and the catch below must not swallow that.
  const admin = await requireAdmin()
  try {
    const supabase = await createClient()

    const now = new Date()
    const periods = utcPeriods(now)
    const todayStart = periods.todayStart.toISOString()
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

    // Fetch all stats in parallel
    const [
      ordersResult,
      ordersTodayResult,
      ordersWeekResult,
      activeOrdersResult,
      usersResult,
      usersTodayResult,
      sellersResult,
      applicationsResult,
      approvedTodayResult,
      approvedResult,
      rejectedResult,
      disputesResult,
      disputesTodayResult,
      highPriorityDisputesResult,
      cancellationsResult,
      fraudResult,
      highSeverityFraudResult,
      notificationsResult,
      collectedWalk,
    ] = await Promise.all([
      // Orders (bounded GET counts — never head:true)
      supabase.from('orders').select('id', { count: 'exact' }).limit(1),
      supabase.from('orders').select('id', { count: 'exact' }).gte('created_at', todayStart).limit(1),
      supabase.from('orders').select('id', { count: 'exact' }).gte('created_at', weekStart).limit(1),
      supabase.from('orders').select('id', { count: 'exact' }).in('status', IN_PROGRESS_ORDER_STATUSES).limit(1),

      // Users
      supabase.from('profiles').select('*', { count: 'exact' }).limit(1),
      supabase.from('profiles').select('*', { count: 'exact' }).gte('created_at', todayStart).limit(1),
      supabase.from('profiles').select('*', { count: 'exact' }).eq('role', 'seller').limit(1),

      // Seller applications
      supabase.from('seller_applications').select('*', { count: 'exact' }).eq('status', 'pending').limit(1),
      supabase.from('seller_applications').select('*', { count: 'exact' }).eq('status', 'approved').gte('updated_at', todayStart).limit(1),
      supabase.from('seller_applications').select('*', { count: 'exact' }).eq('status', 'approved').limit(1),
      supabase.from('seller_applications').select('*', { count: 'exact' }).eq('status', 'rejected').limit(1),

      // Disputes
      supabase.from('disputes').select('*', { count: 'exact' }).in('status', OPEN_DISPUTE_STATUSES).limit(1),
      supabase.from('disputes').select('*', { count: 'exact' }).gte('created_at', todayStart).limit(1),
      supabase.from('disputes').select('*', { count: 'exact' }).eq('priority', 'urgent').in('status', OPEN_DISPUTE_STATUSES).limit(1),

      // Cancellations
      supabase.from('order_cancellation_requests').select('*', { count: 'exact' }).eq('status', 'pending').limit(1),

      // Fraud
      supabase.from('fraud_flags').select('*', { count: 'exact' }).eq('status', 'open').limit(1),
      supabase.from('fraud_flags').select('*', { count: 'exact' }).eq('status', 'open').eq('severity', 'high').limit(1),

      // Notifications
      supabase.from('notifications').select('*', { count: 'exact' }).eq('user_id', admin.userId).eq('is_read', false).limit(1),

      // Revenue: every collected order, paged by id — one response stops at
      // PostgREST's max_rows (1000) without saying so. Unpaid, cancelled and
      // refunded orders are not revenue.
      fetchAllRows<{
        total_amount: number | string | null
        created_at: string
        buyer_id: string | null
      }>((from, to) =>
        supabase
          .from('orders')
          .select('id, total_amount, created_at, buyer_id')
          .in('status', COLLECTED_ORDER_STATUSES)
          .order('id', { ascending: true })
          .range(from, to) as any,
      ),
    ])

    const { data: collected, error: collectedError } = collectedWalk
    if (collectedError) throw collectedError

    const today = periods.todayStart.getTime()
    const month = periods.monthStart.getTime()
    const lastMonth = periods.prevMonthStart.getTime()
    let revenueAllTime = 0
    let revenueToday = 0
    let revenueThisMonth = 0
    let revenueLastMonth = 0
    const buyers = new Set<string>()
    for (const o of collected ?? []) {
      const amount = Number(o.total_amount) || 0
      const at = new Date(o.created_at).getTime()
      revenueAllTime += amount
      if (at >= today) revenueToday += amount
      if (at >= month) revenueThisMonth += amount
      else if (at >= lastMonth) revenueLastMonth += amount
      if (o.buyer_id) buyers.add(o.buyer_id)
    }

    // Determine system health
    let systemHealth: 'good' | 'warning' | 'critical' = 'good'
    if (highSeverityFraudResult.count && highSeverityFraudResult.count > 0) {
      systemHealth = 'critical'
    } else if (highPriorityDisputesResult.count && highPriorityDisputesResult.count > 5) {
      systemHealth = 'warning'
    } else if (applicationsResult.count && applicationsResult.count > 20) {
      systemHealth = 'warning'
    }

    const stats: DashboardStats = {
      totalOrders: ordersResult.count || 0,
      ordersToday: ordersTodayResult.count || 0,
      ordersThisWeek: ordersWeekResult.count || 0,
      activeOrders: activeOrdersResult.count || 0,

      totalRevenue: revenueAllTime,
      revenueToday,
      revenueThisMonth,
      revenueLastMonth,

      totalUsers: usersResult.count || 0,
      usersToday: usersTodayResult.count || 0,
      totalBuyers: buyers.size,
      activeSellers: sellersResult.count || 0,

      pendingApplications: applicationsResult.count || 0,
      approvedToday: approvedTodayResult.count || 0,
      totalApproved: approvedResult.count || 0,
      totalRejected: rejectedResult.count || 0,

      openDisputes: disputesResult.count || 0,
      disputesToday: disputesTodayResult.count || 0,
      highPriorityDisputes: highPriorityDisputesResult.count || 0,

      pendingCancellations: cancellationsResult.count || 0,

      openFraudFlags: fraudResult.count || 0,
      highSeverityFlags: highSeverityFraudResult.count || 0,

      unreadNotifications: notificationsResult.count || 0,
      pendingReviews: (applicationsResult.count || 0) + (highPriorityDisputesResult.count || 0),
      systemHealth,
    }

    return { success: true, stats }
  } catch (error: any) {
    console.error('[Dashboard] Error fetching stats:', error)
    return { success: false, error: error.message }
  }
}

export interface AdminActivity {
  id: string
  type: 'dispute' | 'application' | 'fraud'
  title: string
  description: string
  timestamp: string
  status?: string
  severity?: 'low' | 'medium' | 'high'
  link?: string
  metadata?: {
    gameName?: string
    gameIcon?: string
    itemTitle?: string
    amount?: number
    currency?: string
    orderNumber?: string
  }
}

type SessionClient = Awaited<ReturnType<typeof createClient>>

interface DisputeRow {
  id: string
  transaction_id: string | null
  order_reference: string | null
  title: string
  reason: string
  status: string
  priority: string | null
  disputed_amount: number
  currency: string | null
  updated_at: string
}

const DISPUTE_STATUS_LABELS: Record<string, string> = {
  resolved_buyer_favor: 'Resolved - Buyer',
  resolved_seller_favor: 'Resolved - Seller',
  resolved_partial: 'Resolved - Partial',
  closed: 'Closed',
  escalated: 'Escalated',
  under_review: 'Under Review',
  awaiting_seller_response: 'Awaiting Seller',
  awaiting_buyer_response: 'Awaiting Buyer',
}

/**
 * The latest dispute per order among the `limit` most recently updated.
 * disputes has no FK to orders (transaction_id holds the order id), so the
 * order number, listing and game come from one lookup — the same one
 * /admin/disputes uses. Throws on a query error.
 */
async function disputeActivities(supabase: SessionClient, limit: number): Promise<AdminActivity[]> {
  const { data, error } = await supabase
    .from('disputes')
    .select('id, transaction_id, order_reference, title, reason, status, priority, disputed_amount, currency, updated_at')
    .order('updated_at', { ascending: false })
    .limit(limit) as { data: DisputeRow[] | null; error: { message: string } | null }
  if (error) throw new Error(`disputes: ${error.message}`)

  // Rows arrive newest first: the first one seen for an order is its latest.
  const latestByOrder = new Map<string, DisputeRow>()
  for (const dispute of data ?? []) {
    const key = dispute.transaction_id ?? dispute.id
    if (!latestByOrder.has(key)) latestByOrder.set(key, dispute)
  }
  const disputes = Array.from(latestByOrder.values())
  const orders = await fetchDisputeOrderInfo(supabase, disputes.map((d) => d.transaction_id))

  return disputes.map((dispute) => {
    const order = dispute.transaction_id ? orders.get(dispute.transaction_id) : undefined
    return {
      id: dispute.id,
      type: 'dispute',
      title: 'Dispute',
      description: dispute.reason?.replace(/_/g, ' ') || 'Dispute opened',
      timestamp: dispute.updated_at,
      status: DISPUTE_STATUS_LABELS[dispute.status] ?? 'Open',
      severity: dispute.priority === 'urgent' ? 'high' : 'medium',
      link: `/admin/disputes/${dispute.id}`,
      metadata: {
        gameName: order?.gameName ?? undefined,
        gameIcon: order?.gameIcon ?? undefined,
        itemTitle: order?.listingTitle ?? dispute.title,
        amount: dispute.disputed_amount,
        currency: dispute.currency ?? undefined,
        orderNumber: order?.orderNumber ?? dispute.order_reference ?? undefined,
      },
    }
  })
}

function fraudActivity(flag: { id: string; description: string; status: string; created_at: string | null }): AdminActivity {
  return {
    id: flag.id,
    type: 'fraud',
    title: 'Fraud Alert',
    description: flag.description,
    timestamp: flag.created_at ?? '',
    status: flag.status === 'open' ? 'Open' : flag.status === 'investigating' ? 'Investigating' : 'Resolved',
    severity: 'high',
    link: `/admin/fraud`,
  }
}

function byNewest(a: AdminActivity, b: AdminActivity) {
  return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
}

export async function getAllActivities(): Promise<{
  success: boolean
  activities?: AdminActivity[]
  error?: string
}> {
  // Outside the try: requireAdmin redirects (throws NEXT_REDIRECT) for a
  // non-admin, and the catch below must not swallow that.
  await requireAdmin()
  try {
    const supabase = await createClient()

    const [disputes, applicationsResult, fraudResult] = await Promise.all([
      disputeActivities(supabase, 100),
      supabase
        .from('seller_applications')
        .select('id, display_name, status, created_at, updated_at, country')
        .order('updated_at', { ascending: false })
        .limit(50),
      supabase
        .from('fraud_flags')
        .select('id, description, severity, status, created_at')
        .eq('severity', 'high')
        .order('created_at', { ascending: false })
        .limit(20),
    ])
    // A failed query is an error, never an empty feed.
    if (applicationsResult.error) throw new Error(`seller_applications: ${applicationsResult.error.message}`)
    if (fraudResult.error) throw new Error(`fraud_flags: ${fraudResult.error.message}`)

    const applications: AdminActivity[] = (applicationsResult.data ?? []).map((app: any) => ({
      id: app.id,
      type: 'application',
      title: 'Seller Application',
      description: app.display_name,
      timestamp: app.updated_at,
      status: app.status === 'approved' ? 'Approved' :
              app.status === 'rejected' ? 'Rejected' :
              app.status === 'under_review' ? 'Under Review' :
              'Pending',
      link: `/admin/sellers/${app.id}`,
      metadata: {
        gameName: app.country,
      },
    }))

    const activities = [...disputes, ...applications, ...(fraudResult.data ?? []).map(fraudActivity)]
    activities.sort(byNewest)

    return { success: true, activities }
  } catch (error: any) {
    console.error('[Dashboard] Error fetching all activities:', error)
    return { success: false, error: error.message }
  }
}

export async function getRecentActivity(): Promise<{
  success: boolean
  activities?: AdminActivity[]
  error?: string
}> {
  // Outside the try: requireAdmin redirects (throws NEXT_REDIRECT) for a
  // non-admin, and the catch below must not swallow that.
  await requireAdmin()
  try {
    const supabase = await createClient()

    const [disputes, applicationsResult, fraudResult] = await Promise.all([
      disputeActivities(supabase, 20),
      // Only pending/under_review (active) applications
      supabase
        .from('seller_applications')
        .select('id, display_name, status, created_at, updated_at, country')
        .in('status', ['pending', 'under_review'])
        .order('updated_at', { ascending: false })
        .limit(10),
      supabase
        .from('fraud_flags')
        .select('id, description, severity, status, created_at')
        .eq('severity', 'high')
        .order('created_at', { ascending: false })
        .limit(3),
    ])
    // A failed query is an error, never an empty feed.
    if (applicationsResult.error) throw new Error(`seller_applications: ${applicationsResult.error.message}`)
    if (fraudResult.error) throw new Error(`fraud_flags: ${fraudResult.error.message}`)

    const applications: AdminActivity[] = (applicationsResult.data ?? []).map((app: any) => ({
      id: app.id,
      type: 'application',
      title: 'Seller Application',
      description: app.display_name,
      timestamp: app.updated_at,
      status: app.status === 'under_review' ? 'Under Review' : 'Pending',
      link: `/admin/sellers/${app.id}`,
      metadata: {
        gameName: app.country,
      },
    }))

    const activities = [...disputes, ...applications, ...(fraudResult.data ?? []).map(fraudActivity)]
    activities.sort(byNewest)

    return { success: true, activities: activities.slice(0, 20) }
  } catch (error: any) {
    console.error('[Dashboard] Error fetching activity:', error)
    return { success: false, error: error.message }
  }
}
