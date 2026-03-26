'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/actions/admin-permissions'

export interface DashboardStats {
  // Orders
  totalOrders: number
  ordersToday: number
  ordersThisWeek: number
  activeOrders: number

  // Revenue
  totalRevenue: number
  revenueToday: number
  revenueThisMonth: number
  revenueLastMonth: number

  // Users
  totalUsers: number
  usersToday: number
  totalBuyers: number
  activeSellers: number

  // Sellers
  pendingApplications: number
  approvedToday: number
  totalApproved: number
  totalRejected: number

  // Disputes
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
  try {
    const admin = await requireAdmin()
    const supabase = await createClient()

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
    const lastMonthEnd = monthStart

    // Fetch all stats in parallel
    const [
      ordersResult,
      ordersTodayResult,
      ordersWeekResult,
      activeOrdersResult,
      usersResult,
      usersTodayResult,
      buyersResult,
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
    ] = await Promise.all([
      // Orders
      supabase.from('orders').select('total_amount', { count: 'exact', head: true }),
      supabase.from('orders').select('total_amount', { count: 'exact', head: false }).gte('created_at', todayStart),
      supabase.from('orders').select('*', { count: 'exact', head: true }).gte('created_at', weekStart),
      supabase.from('orders').select('*', { count: 'exact', head: true }).in('status', ['pending', 'paid', 'processing', 'delivering']),

      // Users
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', todayStart),
      supabase.from('orders').select('buyer_id', { count: 'exact', head: true }).not('buyer_id', 'is', null),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'seller'),

      // Seller applications
      supabase.from('seller_applications').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('seller_applications').select('*', { count: 'exact', head: true }).eq('status', 'approved').gte('updated_at', todayStart),
      supabase.from('seller_applications').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
      supabase.from('seller_applications').select('*', { count: 'exact', head: true }).eq('status', 'rejected'),

      // Disputes
      supabase.from('disputes').select('*', { count: 'exact', head: true }).in('status', ['open', 'under_review']),
      supabase.from('disputes').select('*', { count: 'exact', head: true }).gte('created_at', todayStart),
      supabase.from('disputes').select('*', { count: 'exact', head: true }).eq('priority', 'urgent').in('status', ['open', 'under_review']),

      // Cancellations
      supabase.from('order_cancellation_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),

      // Fraud
      supabase.from('fraud_flags').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.from('fraud_flags').select('*', { count: 'exact', head: true }).eq('status', 'open').eq('severity', 'high'),

      // Notifications
      supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', admin.userId).eq('is_read', false),
    ])

    // Calculate revenue
    const revenueAllTime = ordersTodayResult.data?.reduce((sum: number, order: any) => sum + (Number(order.total_amount) || 0), 0) || 0
    const revenueToday = ordersTodayResult.data?.reduce((sum: number, order: any) => sum + (Number(order.total_amount) || 0), 0) || 0

    // Get monthly revenue
    const { data: ordersThisMonth } = await supabase
      .from('orders')
      .select('total_amount')
      .gte('created_at', monthStart) as any

    const { data: ordersLastMonth } = await supabase
      .from('orders')
      .select('total_amount')
      .gte('created_at', lastMonthStart)
      .lt('created_at', lastMonthEnd) as any

    const revenueThisMonth = ordersThisMonth?.reduce((sum: number, order: any) => sum + (Number(order.total_amount) || 0), 0) || 0
    const revenueLastMonth = ordersLastMonth?.reduce((sum: number, order: any) => sum + (Number(order.total_amount) || 0), 0) || 0

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
      totalBuyers: buyersResult.count || 0,
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

export async function getAllActivities(): Promise<{
  success: boolean
  activities?: Array<{
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
  }>
  error?: string
}> {
  try {
    await requireAdmin()
    const supabase = await createClient()

    const activities: any[] = []

    // Get ALL disputes (not limited) with full details
    const { data: disputes } = await supabase
      .from('disputes')
      .select(`
        id,
        order_id,
        title,
        reason,
        status,
        priority,
        disputed_amount,
        currency,
        created_at,
        updated_at,
        game_name,
        game_icon,
        listing_title,
        orders!inner(order_number)
      `)
      .order('updated_at', { ascending: false })
      .limit(100) as any

    // Group by order_id - only keep latest per order
    const disputesByOrder = new Map()
    disputes?.forEach((dispute: any) => {
      if (!disputesByOrder.has(dispute.order_id) ||
          new Date(dispute.updated_at) > new Date(disputesByOrder.get(dispute.order_id).updated_at)) {
        disputesByOrder.set(dispute.order_id, dispute)
      }
    })

    disputesByOrder.forEach((dispute: any) => {
      const statusLabel = dispute.status === 'resolved_buyer_favor' ? 'Resolved - Buyer' :
                         dispute.status === 'resolved_seller_favor' ? 'Resolved - Seller' :
                         dispute.status === 'resolved_partial' ? 'Resolved - Partial' :
                         dispute.status === 'closed' ? 'Closed' :
                         dispute.status === 'escalated' ? 'Escalated' :
                         dispute.status === 'under_review' ? 'Under Review' :
                         dispute.status === 'awaiting_seller_response' ? 'Awaiting Seller' :
                         dispute.status === 'awaiting_buyer_response' ? 'Awaiting Buyer' :
                         'Open'

      activities.push({
        id: dispute.id,
        type: 'dispute',
        title: 'Dispute',
        description: dispute.reason?.replace(/_/g, ' ') || 'Dispute opened',
        timestamp: dispute.updated_at,
        status: statusLabel,
        severity: dispute.priority === 'urgent' ? 'high' : 'medium',
        link: `/admin/disputes/${dispute.id}`,
        metadata: {
          gameName: dispute.game_name,
          gameIcon: dispute.game_icon,
          itemTitle: dispute.listing_title || dispute.title,
          amount: dispute.disputed_amount,
          currency: dispute.currency,
          orderNumber: dispute.orders?.order_number,
        }
      })
    })

    // Get ALL seller applications
    const { data: applications } = await supabase
      .from('seller_applications')
      .select('id, display_name, status, created_at, updated_at, country')
      .order('updated_at', { ascending: false })
      .limit(50) as any

    applications?.forEach((app: any) => {
      const statusLabel = app.status === 'approved' ? 'Approved' :
                         app.status === 'rejected' ? 'Rejected' :
                         app.status === 'under_review' ? 'Under Review' :
                         'Pending'

      activities.push({
        id: app.id,
        type: 'application',
        title: 'Seller Application',
        description: app.display_name,
        timestamp: app.updated_at,
        status: statusLabel,
        link: `/admin/sellers/${app.id}`,
        metadata: {
          gameName: app.country,
        }
      })
    })

    // Get high-severity fraud flags
    const { data: fraudFlags } = await supabase
      .from('fraud_flags')
      .select('id, flag_type, description, severity, status, created_at, user_id')
      .eq('severity', 'high')
      .order('created_at', { ascending: false })
      .limit(20) as any

    fraudFlags?.forEach((flag: any) => {
      activities.push({
        id: flag.id,
        type: 'fraud',
        title: 'Fraud Alert',
        description: flag.description,
        timestamp: flag.created_at,
        status: flag.status === 'open' ? 'Open' : flag.status === 'investigating' ? 'Investigating' : 'Resolved',
        severity: 'high',
        link: `/admin/fraud`,
      })
    })

    // Sort all activities by timestamp
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return { success: true, activities }
  } catch (error: any) {
    console.error('[Dashboard] Error fetching all activities:', error)
    return { success: false, error: error.message }
  }
}

export async function getRecentActivity(): Promise<{
  success: boolean
  activities?: Array<{
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
  }>
  error?: string
}> {
  try {
    await requireAdmin()
    const supabase = await createClient()

    const activities: any[] = []

    // Get recent disputes with full details (grouped by order - only latest per order)
    const { data: disputes } = await supabase
      .from('disputes')
      .select(`
        id,
        order_id,
        title,
        reason,
        status,
        priority,
        disputed_amount,
        currency,
        created_at,
        updated_at,
        game_name,
        game_icon,
        listing_title,
        orders!inner(order_number)
      `)
      .order('updated_at', { ascending: false })
      .limit(20) as any

    // Group disputes by order_id and keep only the latest
    const disputesByOrder = new Map()
    disputes?.forEach((dispute: any) => {
      if (!disputesByOrder.has(dispute.order_id) ||
          new Date(dispute.updated_at) > new Date(disputesByOrder.get(dispute.order_id).updated_at)) {
        disputesByOrder.set(dispute.order_id, dispute)
      }
    })

    disputesByOrder.forEach((dispute: any) => {
      const statusLabel = dispute.status === 'resolved_buyer_favor' ? 'Resolved - Buyer' :
                         dispute.status === 'resolved_seller_favor' ? 'Resolved - Seller' :
                         dispute.status === 'resolved_partial' ? 'Resolved - Partial' :
                         dispute.status === 'closed' ? 'Closed' :
                         dispute.status === 'escalated' ? 'Escalated' :
                         dispute.status === 'under_review' ? 'Under Review' :
                         dispute.status === 'awaiting_seller_response' ? 'Awaiting Seller' :
                         dispute.status === 'awaiting_buyer_response' ? 'Awaiting Buyer' :
                         'Open'

      activities.push({
        id: dispute.id,
        type: 'dispute',
        title: 'Dispute',
        description: dispute.reason?.replace(/_/g, ' ') || 'Dispute opened',
        timestamp: dispute.updated_at,
        status: statusLabel,
        severity: dispute.priority === 'urgent' ? 'high' : 'medium',
        link: `/admin/disputes/${dispute.id}`,
        metadata: {
          gameName: dispute.game_name,
          gameIcon: dispute.game_icon,
          itemTitle: dispute.listing_title || dispute.title,
          amount: dispute.disputed_amount,
          currency: dispute.currency,
          orderNumber: dispute.orders?.order_number,
        }
      })
    })

    // Get recent seller applications - ONLY pending/under_review (active ones)
    const { data: applications } = await supabase
      .from('seller_applications')
      .select('id, display_name, status, created_at, updated_at, country')
      .in('status', ['pending', 'under_review'])
      .order('updated_at', { ascending: false })
      .limit(10) as any

    applications?.forEach((app: any) => {
      const statusLabel = app.status === 'under_review' ? 'Under Review' : 'Pending'

      activities.push({
        id: app.id,
        type: 'application',
        title: 'Seller Application',
        description: app.display_name,
        timestamp: app.updated_at,
        status: statusLabel,
        link: `/admin/sellers/${app.id}`,
        metadata: {
          gameName: app.country,
        }
      })
    })

    // Get recent high-severity fraud flags
    const { data: fraudFlags } = await supabase
      .from('fraud_flags')
      .select('id, flag_type, description, severity, status, created_at, user_id')
      .eq('severity', 'high')
      .order('created_at', { ascending: false })
      .limit(3) as any

    fraudFlags?.forEach((flag: any) => {
      activities.push({
        id: flag.id,
        type: 'fraud',
        title: 'Fraud Alert',
        description: flag.description,
        timestamp: flag.created_at,
        status: flag.status === 'open' ? 'Open' : flag.status === 'investigating' ? 'Investigating' : 'Resolved',
        severity: 'high',
        link: `/admin/fraud`,
      })
    })

    // Sort all activities by timestamp
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return { success: true, activities: activities.slice(0, 20) }
  } catch (error: any) {
    console.error('[Dashboard] Error fetching activity:', error)
    return { success: false, error: error.message }
  }
}
