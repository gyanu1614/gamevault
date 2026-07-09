'use client'

import { ShoppingCart, CheckCircle2, Clock, AlertTriangle, DollarSign, Coins } from 'lucide-react'
import { StatCard, type ChipTone } from '../../components/kit'

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

export function StatsCards({ stats }: StatsCardsProps) {
  if (!stats) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border-default bg-bg-raised p-4 animate-pulse">
            <div className="h-4 w-16 bg-bg-overlay rounded mb-2" />
            <div className="h-6 w-20 bg-bg-overlay rounded" />
          </div>
        ))}
      </div>
    )
  }

  const cards: { label: string; value: string; icon: typeof ShoppingCart; tone: ChipTone }[] = [
    {
      label: 'Total Orders',
      value: stats.totalOrders.toLocaleString(),
      icon: ShoppingCart,
      tone: 'lime',
    },
    {
      label: 'Completed',
      value: stats.completedOrders.toLocaleString(),
      icon: CheckCircle2,
      tone: 'success',
    },
    {
      label: 'Pending',
      value: stats.pendingOrders.toLocaleString(),
      icon: Clock,
      tone: 'warning',
    },
    {
      label: 'Disputed',
      value: stats.disputedOrders.toLocaleString(),
      icon: AlertTriangle,
      tone: 'error',
    },
    {
      label: 'Total Revenue',
      value: `$${stats.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: DollarSign,
      tone: 'info',
    },
    {
      label: 'Platform Fees',
      value: `$${stats.totalFees.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: Coins,
      tone: 'neutral',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
      {cards.map((card) => (
        <StatCard
          key={card.label}
          label={card.label}
          value={card.value}
          icon={card.icon}
          tone={card.tone}
        />
      ))}
    </div>
  )
}
