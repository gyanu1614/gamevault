'use client'

import { AlertTriangle, Clock, CheckCircle, AlertOctagon } from 'lucide-react'

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

  const cards = [
    {
      title: 'Open',
      value: stats.open,
      icon: AlertTriangle,
      iconBg: 'bg-yellow-500/10',
      iconColor: 'text-yellow-400',
      borderColor: 'border-yellow-500/20'
    },
    {
      title: 'Under Review',
      value: stats.underReview,
      icon: Clock,
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-400',
      borderColor: 'border-blue-500/20'
    },
    {
      title: 'Escalated',
      value: stats.escalated,
      icon: AlertOctagon,
      iconBg: 'bg-red-500/10',
      iconColor: 'text-red-400',
      borderColor: 'border-red-500/20'
    },
    {
      title: 'Resolved (7d)',
      value: stats.resolvedThisWeek,
      icon: CheckCircle,
      iconBg: 'bg-green-500/10',
      iconColor: 'text-green-400',
      borderColor: 'border-green-500/20'
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <div
          key={card.title}
          className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4 hover:border-white/[0.09] transition-colors"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">{card.title}</p>
              <p className="text-2xl font-bold text-white">{card.value}</p>
            </div>
            <div className={`h-9 w-9 rounded-xl ${card.iconBg} border ${card.borderColor} flex items-center justify-center flex-shrink-0`}>
              <card.icon className={`h-4 w-4 ${card.iconColor}`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
