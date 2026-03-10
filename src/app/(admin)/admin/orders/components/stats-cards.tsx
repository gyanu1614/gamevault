'use client'

import { IconShoppingCart, IconCircleCheck, IconClock, IconAlertTriangle, IconCurrencyDollar, IconCoins } from '@tabler/icons-react'

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
          <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-4 animate-pulse">
            <div className="h-4 w-16 bg-white/10 rounded mb-2" />
            <div className="h-6 w-20 bg-white/10 rounded" />
          </div>
        ))}
      </div>
    )
  }

  const cards = [
    {
      label: 'Total Orders',
      value: stats.totalOrders.toLocaleString(),
      icon: IconShoppingCart,
      color: 'violet',
    },
    {
      label: 'Completed',
      value: stats.completedOrders.toLocaleString(),
      icon: IconCircleCheck,
      color: 'green',
    },
    {
      label: 'Pending',
      value: stats.pendingOrders.toLocaleString(),
      icon: IconClock,
      color: 'amber',
    },
    {
      label: 'Disputed',
      value: stats.disputedOrders.toLocaleString(),
      icon: IconAlertTriangle,
      color: 'red',
    },
    {
      label: 'Total Revenue',
      value: `$${stats.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: IconCurrencyDollar,
      color: 'blue',
    },
    {
      label: 'Platform Fees',
      value: `$${stats.totalFees.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: IconCoins,
      color: 'indigo',
    },
  ]

  const colorClasses: Record<string, string> = {
    violet: 'text-violet-400 bg-violet-500/10',
    green: 'text-green-400 bg-green-500/10',
    amber: 'text-amber-400 bg-amber-500/10',
    red: 'text-red-400 bg-red-500/10',
    blue: 'text-blue-400 bg-blue-500/10',
    indigo: 'text-indigo-400 bg-indigo-500/10',
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <div
            key={card.label}
            className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-4 hover:bg-white/[0.04] transition-colors"
          >
            <div className="flex items-center gap-2.5 mb-2">
              <div className={`h-8 w-8 rounded-lg ${colorClasses[card.color]} flex items-center justify-center flex-shrink-0`}>
                <Icon className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-white">{card.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{card.label}</div>
          </div>
        )
      })}
    </div>
  )
}
