'use client'

import { AlertTriangle, Clock, CheckCircle, AlertOctagon } from 'lucide-react'
import { StatCard } from '../../components/kit'

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

export function StatsCards({ stats }: StatsCardsProps) {
  if (!stats) return null

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      <StatCard label="Open" value={stats.open} icon={AlertTriangle} tone="warning" />
      <StatCard label="Under Review" value={stats.underReview} icon={Clock} tone="info" />
      <StatCard label="Escalated" value={stats.escalated} icon={AlertOctagon} tone="error" />
      <StatCard label="Resolved (7d)" value={stats.resolvedThisWeek} icon={CheckCircle} tone="success" />
    </div>
  )
}
