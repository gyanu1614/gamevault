import { StatStrip, type Stat } from '@/components/account/AccountSurface'
import { SkAdminStrip } from '../../components/AdminSkeletons'

interface StatsCardsProps {
  stats: {
    totalOrders: number
    completedOrders: number
    pendingOrders: number
    disputedOrders: number
    totalRevenue: number
    totalFees: number
  } | null
}

const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** The six order numbers as one panel with hairlines (account StatStrip). */
export function StatsCards({ stats }: StatsCardsProps) {
  if (!stats) return <SkAdminStrip count={6} lgCols="md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6" />

  const cells: Stat[] = [
    { label: 'Total Orders', value: stats.totalOrders.toLocaleString() },
    { label: 'Completed', value: stats.completedOrders.toLocaleString() },
    { label: 'In Progress', value: stats.pendingOrders.toLocaleString() },
    {
      label: 'Disputed',
      value: <span className={stats.disputedOrders > 0 ? 'text-error' : undefined}>{stats.disputedOrders.toLocaleString()}</span>,
    },
    { label: 'Total Revenue', value: usd(stats.totalRevenue) },
    { label: 'Platform Fees', value: usd(stats.totalFees) },
  ]

  return <StatStrip stats={cells} className="md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6" />
}
