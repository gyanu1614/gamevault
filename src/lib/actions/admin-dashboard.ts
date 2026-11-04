'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/actions/admin-permissions'
import { fetchDisputeOrderInfo } from '@/lib/admin/dispute-order-info'
import { getAdminOverviewStats } from '@/lib/admin/overview-stats'

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

    // One cached call for every shared number (lib/admin/overview-stats), plus
    // this admin's own unread count. Was 18 counts and a walk of every order.
    const [overview, notificationsResult] = await Promise.all([
      getAdminOverviewStats(),
      supabase.from('notifications').select('id', { count: 'exact' }).eq('user_id', admin.userId).eq('is_read', false).limit(1),
    ])
    const { orders, profiles, applications, disputes, fraud } = overview

    // Determine system health
    let systemHealth: 'good' | 'warning' | 'critical' = 'good'
    if (fraud.high > 0) {
      systemHealth = 'critical'
    } else if (disputes.urgent_open > 5) {
      systemHealth = 'warning'
    } else if (applications.pending > 20) {
      systemHealth = 'warning'
    }

    const stats: DashboardStats = {
      totalOrders: orders.total,
      ordersToday: orders.today,
      ordersThisWeek: orders.week,
      activeOrders: orders.in_progress,

      totalRevenue: orders.revenue_total,
      revenueToday: orders.revenue_today,
      revenueThisMonth: orders.revenue_month,
      revenueLastMonth: orders.revenue_prev_month,

      totalUsers: profiles.total,
      usersToday: profiles.today,
      totalBuyers: orders.distinct_buyers,
      activeSellers: profiles.sellers,

      pendingApplications: applications.pending,
      approvedToday: applications.approved_today,
      totalApproved: applications.approved,
      totalRejected: applications.rejected,

      openDisputes: disputes.open_all,
      disputesToday: disputes.today,
      highPriorityDisputes: disputes.urgent_open,

      pendingCancellations: overview.pending_cancellations,

      openFraudFlags: fraud.open,
      highSeverityFlags: fraud.high,

      unreadNotifications: notificationsResult.count || 0,
      pendingReviews: applications.pending + disputes.urgent_open,
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
