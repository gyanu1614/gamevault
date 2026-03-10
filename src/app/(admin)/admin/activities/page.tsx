'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAllActivities } from '@/lib/actions/admin-dashboard'
import { cn } from '@/lib/utils'
import {
  AlertTriangle,
  UserPlus,
  Shield,
  ArrowLeft,
  Filter,
  Calendar
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

export default function ActivitiesPage() {
  const [filter, setFilter] = useState<'all' | 'dispute' | 'application' | 'fraud'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'resolved'>('all')

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-all-activities'],
    queryFn: async () => {
      const result = await getAllActivities()
      if (!result.success) throw new Error(result.error)
      return result.activities || []
    },
    refetchInterval: 30000,
  })

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const filteredActivities = data?.filter(activity => {
    // Type filter
    if (filter !== 'all' && activity.type !== filter) return false

    // Status filter
    if (statusFilter !== 'all') {
      const isResolved = activity.status?.toLowerCase().includes('resolved') ||
                        activity.status?.toLowerCase().includes('closed')
      if (statusFilter === 'resolved' && !isResolved) return false
      if (statusFilter === 'active' && isResolved) return false
    }

    return true
  }) || []

  const typeConfig = {
    dispute: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10', label: 'Disputes' },
    application: { icon: UserPlus, color: 'text-yellow-400', bg: 'bg-yellow-500/10', label: 'Applications' },
    fraud: { icon: Shield, color: 'text-purple-400', bg: 'bg-purple-500/10', label: 'Fraud Alerts' },
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/admin"
            className="h-9 w-9 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center hover:bg-white/[0.06] transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-gray-400" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">All Activities</h1>
            <p className="text-sm text-gray-500 mt-1">
              {filteredActivities.length} {statusFilter === 'all' ? '' : statusFilter} activities
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Type Filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <span className="text-xs font-medium text-gray-500 uppercase">Type:</span>
          <div className="flex items-center gap-1 p-1 rounded-lg bg-white/[0.03] border border-white/[0.06]">
            <button
              onClick={() => setFilter('all')}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded-md transition-all",
                filter === 'all'
                  ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                  : "text-gray-500 hover:text-gray-400"
              )}
            >
              All
            </button>
            {Object.entries(typeConfig).map(([key, config]) => (
              <button
                key={key}
                onClick={() => setFilter(key as any)}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-md transition-all",
                  filter === key
                    ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                    : "text-gray-500 hover:text-gray-400"
                )}
              >
                {config.label}
              </button>
            ))}
          </div>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500 uppercase">Status:</span>
          <div className="flex items-center gap-1 p-1 rounded-lg bg-white/[0.03] border border-white/[0.06]">
            <button
              onClick={() => setStatusFilter('all')}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded-md transition-all",
                statusFilter === 'all'
                  ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                  : "text-gray-500 hover:text-gray-400"
              )}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded-md transition-all",
                statusFilter === 'active'
                  ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                  : "text-gray-500 hover:text-gray-400"
              )}
            >
              Active
            </button>
            <button
              onClick={() => setStatusFilter('resolved')}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded-md transition-all",
                statusFilter === 'resolved'
                  ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                  : "text-gray-500 hover:text-gray-400"
              )}
            >
              Resolved
            </button>
          </div>
        </div>
      </div>

      {/* Activities List */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025]">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-violet-500 border-r-transparent"></div>
            <p className="text-sm text-gray-500 mt-3">Loading activities...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <p className="text-sm text-red-400">Failed to load activities</p>
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="p-12 text-center">
            <Calendar className="h-12 w-12 text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No activities found</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {filteredActivities.map((activity) => {
              const config = typeConfig[activity.type]
              const Icon = config.icon

              return (
                <Link
                  key={activity.id}
                  href={activity.link || '#'}
                  className="flex items-start gap-4 p-4 hover:bg-white/[0.03] transition-all group"
                >
                  {/* Icon or Game Logo */}
                  {activity.metadata?.gameIcon ? (
                    <div className="h-12 w-12 rounded-lg overflow-hidden flex-shrink-0 bg-white/[0.03] border border-white/[0.06]">
                      <Image
                        src={activity.metadata.gameIcon}
                        alt={activity.metadata.gameName || 'Game'}
                        width={48}
                        height={48}
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className={cn("h-12 w-12 rounded-lg flex items-center justify-center flex-shrink-0", config.bg)}>
                      <Icon className={cn("h-6 w-6", config.color)} />
                    </div>
                  )}

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white">
                          {activity.title}
                        </p>

                        {/* For disputes: show game name, item, amount */}
                        {activity.type === 'dispute' && activity.metadata ? (
                          <div className="mt-1.5 space-y-1">
                            {activity.metadata.gameName && (
                              <p className="text-sm text-gray-400">
                                {activity.metadata.gameName}
                              </p>
                            )}
                            {activity.metadata.itemTitle && (
                              <p className="text-sm text-gray-500">
                                {activity.metadata.itemTitle}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-1.5">
                              {activity.metadata.amount && (
                                <p className="text-sm font-semibold text-violet-400">
                                  {formatCurrency(activity.metadata.amount)}
                                </p>
                              )}
                              {activity.metadata.orderNumber && (
                                <p className="text-xs text-gray-600">
                                  Order #{activity.metadata.orderNumber}
                                </p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500 mt-1">
                            {activity.description}
                          </p>
                        )}

                        <p className="text-xs text-gray-600 mt-2">
                          {new Date(activity.timestamp).toLocaleString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>

                      {/* Status Badge */}
                      {activity.status && (
                        <span className={cn(
                          "text-xs font-medium px-3 py-1.5 rounded-lg whitespace-nowrap flex-shrink-0",
                          activity.status.toLowerCase().includes('resolved') && "bg-green-500/20 text-green-400 border border-green-500/30",
                          activity.status.toLowerCase().includes('closed') && "bg-gray-500/20 text-gray-400 border border-gray-500/30",
                          activity.status.toLowerCase().includes('open') && "bg-red-500/20 text-red-400 border border-red-500/30",
                          activity.status.toLowerCase().includes('review') && "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30",
                          activity.status.toLowerCase().includes('awaiting') && "bg-orange-500/20 text-orange-400 border border-orange-500/30",
                          activity.status.toLowerCase().includes('escalated') && "bg-purple-500/20 text-purple-400 border border-purple-500/30",
                          activity.status.toLowerCase().includes('pending') && "bg-blue-500/20 text-blue-400 border border-blue-500/30",
                          activity.status.toLowerCase().includes('approved') && "bg-green-500/20 text-green-400 border border-green-500/30",
                          activity.status.toLowerCase().includes('rejected') && "bg-red-500/20 text-red-400 border border-red-500/30"
                        )}>
                          {activity.status}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
