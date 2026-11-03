import { Suspense } from 'react'
import { requireAdmin } from '@/lib/actions/admin-permissions'
import { getDashboardStats, getRecentActivity } from '@/lib/actions/admin-dashboard'
import CompactDashboard from '../components/CompactDashboard'
import { RecentActivityPanel, RecentActivitySkeleton } from '../components/RecentActivityPanel'
import { SkAdminStrip } from '../components/AdminSkeletons'
import { TrustpilotCard } from '../components/TrustpilotCard'
import { getTrustpilotSummary } from '@/lib/actions/admin-trustpilot'

export const metadata = { title: 'Dashboard' }

/** The feed reads three tables; the numbers above it never wait for them. */
async function RecentActivitySection() {
  const result = await getRecentActivity()
  return (
    <RecentActivityPanel
      activities={result.success && result.activities ? result.activities : []}
      failed={!result.success}
    />
  )
}

async function TrustpilotSection() {
  const trustpilot = await getTrustpilotSummary().catch(() => ({ ok: false as const, error: 'Couldn’t load invite stats.' }))
  return (
    <TrustpilotCard
      summary={trustpilot.ok ? trustpilot.summary : null}
      loadError={trustpilot.ok ? undefined : trustpilot.error}
    />
  )
}

export default async function AdminDashboardPage() {
  const admin = await requireAdmin()

  // Admin / super-admin only (the card can change the public TrustBox switch).
  const showTrustpilot = admin.role === 'admin' || admin.role === 'super_admin'

  const statsResult = await getDashboardStats()

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

  return (
    <div className="space-y-7 sm:space-y-8">
      <CompactDashboard
        admin={admin}
        stats={stats}
        activity={
          <Suspense fallback={<RecentActivitySkeleton />}>
            <RecentActivitySection />
          </Suspense>
        }
      />
      {showTrustpilot && (
        <Suspense fallback={<SkAdminStrip count={3} />}>
          <TrustpilotSection />
        </Suspense>
      )}
    </div>
  )
}
