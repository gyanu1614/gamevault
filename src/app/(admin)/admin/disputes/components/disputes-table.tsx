'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import Image from 'next/image'
import {
  AlertTriangle,
  Clock,
  AlertOctagon,
  Eye,
  ChevronRight,
  DollarSign,
  User,
  Calendar
} from 'lucide-react'
import { PaginationControls } from '@/components/ui/pagination-controls'

interface DisputesTableProps {
  disputes: any[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  } | null
}

export function DisputesTable({ disputes, pagination }: DisputesTableProps) {
  const router = useRouter()
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)

  const getStatusBadge = (status: string, dispute: any) => {
    // If resolved, show "Completed - [Resolution Type]"
    if (status.startsWith('resolved_')) {
      let resolutionLabel = ''
      if (status === 'resolved_buyer_favor') resolutionLabel = 'Buyer Favor'
      else if (status === 'resolved_seller_favor') resolutionLabel = 'Seller Favor'
      else if (status === 'resolved_partial') resolutionLabel = 'Partial'

      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium border bg-green-500/10 text-green-400 border-green-500/20">
          <Clock className="h-2.5 w-2.5" />
          Completed - {resolutionLabel}
        </span>
      )
    }

    const statusConfig = {
      open: {
        label: 'Pending',
        icon: AlertTriangle,
        className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
      },
      under_review: {
        label: dispute.assigned_to ? 'Assigned' : 'Pending',
        icon: Clock,
        className: 'bg-blue-500/10 text-blue-400 border-blue-500/20'
      },
      escalated: {
        label: 'Escalated',
        icon: AlertOctagon,
        className: 'bg-red-500/10 text-red-400 border-red-500/20'
      },
      awaiting_seller_response: {
        label: 'Awaiting Seller',
        icon: Clock,
        className: 'bg-purple-500/10 text-purple-400 border-purple-500/20'
      },
      awaiting_buyer_response: {
        label: 'Awaiting Buyer',
        icon: Clock,
        className: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
      },
      closed: {
        label: 'Closed',
        icon: Clock,
        className: 'bg-gray-500/10 text-gray-400 border-gray-500/20'
      },
    }

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.open
    const Icon = config.icon

    return (
      <span className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium border",
        config.className
      )}>
        <Icon className="h-2.5 w-2.5" />
        {config.label}
      </span>
    )
  }

  const getPriorityBadge = (priority: string) => {
    const priorityConfig = {
      urgent: 'bg-red-500/10 text-red-400 border-red-500/20',
      high: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
      normal: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
      low: 'bg-green-500/10 text-green-400 border-green-500/20',
    }

    return (
      <span className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-medium border capitalize",
        priorityConfig[priority as keyof typeof priorityConfig] || priorityConfig.normal
      )}>
        {priority}
      </span>
    )
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatAmount = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount)
  }

  if (disputes.length === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-12 text-center">
        <AlertTriangle className="h-10 w-10 text-gray-600 mx-auto mb-3" />
        <p className="text-sm font-semibold text-white">No disputes found</p>
        <p className="text-xs text-gray-600 mt-1">Disputes will appear here when users report issues</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-white/[0.05]">
            <tr className="text-left">
              <th className="px-4 py-3 text-[10px] font-bold text-gray-600 uppercase tracking-[0.08em]">
                Order & Item
              </th>
              <th className="px-4 py-3 text-[10px] font-bold text-gray-600 uppercase tracking-[0.08em]">
                Type
              </th>
              <th className="px-4 py-3 text-[10px] font-bold text-gray-600 uppercase tracking-[0.08em]">
                Parties
              </th>
              <th className="px-4 py-3 text-[10px] font-bold text-gray-600 uppercase tracking-[0.08em]">
                Amount
              </th>
              <th className="px-4 py-3 text-[10px] font-bold text-gray-600 uppercase tracking-[0.08em]">
                Status
              </th>
              <th className="px-4 py-3 text-[10px] font-bold text-gray-600 uppercase tracking-[0.08em]">
                Created
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {disputes.map((dispute) => (
              <tr
                key={dispute.id}
                className={cn(
                  "cursor-pointer transition-colors",
                  "hover:bg-white/[0.025]"
                )}
                onClick={() => router.push(`/admin/disputes/${dispute.id}`)}
              >
                {/* Order & Item - with game logo + listing title */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {dispute.game_icon && dispute.game_icon.startsWith('/') ? (
                      <div className="h-10 w-10 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center flex-shrink-0 overflow-hidden">
                        <Image
                          src={dispute.game_icon}
                          alt={dispute.game_name || 'Game'}
                          width={40}
                          height={40}
                          className="object-cover"
                        />
                      </div>
                    ) : dispute.game_icon ? (
                      <div className="h-10 w-10 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center flex-shrink-0 text-xl">
                        {dispute.game_icon}
                      </div>
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="h-4 w-4 text-gray-600" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-white line-clamp-1">
                        {dispute.game_name || 'Unknown Game'}
                      </p>
                      <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">
                        {dispute.listing_title || dispute.title}
                      </p>
                    </div>
                  </div>
                </td>

                {/* Type (reason) */}
                <td className="px-4 py-3">
                  <p className="text-[11px] text-gray-500 capitalize">
                    {dispute.reason?.replace(/_/g, ' ')}
                  </p>
                </td>

                {/* Parties */}
                <td className="px-4 py-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <div className="h-5 w-5 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                        <User className="h-2.5 w-2.5 text-white" />
                      </div>
                      <span className="text-[11px] text-gray-500">
                        {dispute.buyer_username || 'Buyer'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-5 w-5 rounded-full bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                        <User className="h-2.5 w-2.5 text-white" />
                      </div>
                      <span className="text-[11px] text-gray-500">
                        {dispute.seller_username || 'Seller'}
                      </span>
                    </div>
                  </div>
                </td>

                {/* Amount */}
                <td className="px-4 py-3">
                  <span className="text-xs font-semibold text-white">
                    {formatAmount(dispute.disputed_amount, dispute.currency)}
                  </span>
                </td>

                {/* Status */}
                <td className="px-4 py-3">
                  {getStatusBadge(dispute.status, dispute)}
                </td>

                {/* Created Date */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                    <Calendar className="h-2.5 w-2.5" />
                    {formatDate(dispute.created_at)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <PaginationControls
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          hasNextPage={pagination.page < pagination.totalPages}
          hasPrevPage={pagination.page > 1}
          onPageChange={(page) => {
            const params = new URLSearchParams(window.location.search)
            params.set('page', page.toString())
            router.push(`/admin/disputes?${params.toString()}`)
          }}
          totalItems={pagination.total}
          itemsPerPage={pagination.limit}
        />
      )}
    </div>
  )
}
