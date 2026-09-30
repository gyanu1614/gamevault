import { StatStrip } from '@/components/account/AccountSurface'
import { SkAdminStrip } from '../../components/AdminSkeletons'

interface StatsCardsProps {
  stats: {
    total: number
    open: number
    underReview: number
    escalated: number
    resolvedThisWeek: number
    awaitingResponse?: number
    urgent?: number
  } | null
}

/** The four dispute numbers as one panel with hairlines. */
export function StatsCards({ stats }: StatsCardsProps) {
  if (!stats) return <SkAdminStrip count={4} />

  return (
    <StatStrip
      stats={[
        { label: 'Open', value: <span className={stats.open > 0 ? 'text-warning' : undefined}>{stats.open}</span> },
        { label: 'Under Review', value: stats.underReview },
        { label: 'Escalated', value: <span className={stats.escalated > 0 ? 'text-error' : undefined}>{stats.escalated}</span> },
        { label: 'Resolved (7d)', value: stats.resolvedThisWeek },
      ]}
    />
  )
}
