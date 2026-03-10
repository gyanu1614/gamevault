import { requireAdmin } from '@/lib/actions/admin-permissions'
import { getDashboardStats, getRecentActivity } from '@/lib/actions/admin-dashboard'
import CompactDashboard from './components/CompactDashboard'

export default async function AdminDashboardPage() {
  const admin = await requireAdmin()

  // Fetch comprehensive dashboard stats
  const statsResult = await getDashboardStats()
  const activityResult = await getRecentActivity()

  // Default to empty data if fetch fails
  const stats = statsResult.success && statsResult.stats ? statsResult.stats : {
    totalOrders: 0,
    ordersToday: 0,
    ordersThisWeek: 0,
    activeOrders: 0,
    totalRevenue: 0,
    revenueToday: 0,
    revenueThisMonth: 0,
    revenueLastMonth: 0,
    totalUsers: 0,
    usersToday: 0,
    totalBuyers: 0,
    activeSellers: 0,
    pendingApplications: 0,
    approvedToday: 0,
    totalApproved: 0,
    totalRejected: 0,
    openDisputes: 0,
    disputesToday: 0,
    highPriorityDisputes: 0,
    pendingCancellations: 0,
    openFraudFlags: 0,
    highSeverityFlags: 0,
    unreadNotifications: 0,
    pendingReviews: 0,
    systemHealth: 'good' as const,
  }

  const activities = activityResult.success && activityResult.activities ? activityResult.activities : []

  return (
    <CompactDashboard
      admin={admin}
      stats={stats}
      activities={activities}
    />
  )
}