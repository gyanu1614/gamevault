'use client'

import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import Image from 'next/image'
import {
  AlertTriangle,
  Clock,
  AlertOctagon,
  User,
  Calendar
} from 'lucide-react'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { TABLE } from '../../components/kit'

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

  const getStatusBadge = (status: string, dispute: any) => {
    // If resolved, show "Completed - [Resolution Type]"
    if (status.startsWith('resolved_')) {
      let resolutionLabel = ''
      if (status === 'resolved_buyer_favor') resolutionLabel = 'Buyer Favor'
      else if (status === 'resolved_seller_favor') resolutionLabel = 'Seller Favor'
      else if (status === 'resolved_partial') resolutionLabel = 'Partial'

      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border bg-green-500/10 text-green-400 border-green-500/20">
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
        className: 'bg-amber-500/10 text-amber-400 border-amber-500/20'
      },
      awaiting_buyer_response: {
        label: 'Awaiting Buyer',
        icon: Clock,
        className: 'bg-amber-500/10 text-amber-400 border-amber-500/20'
      },
      closed: {
        label: 'Closed',
        icon: Clock,
        className: 'border-border-default bg-bg-overlay text-text-secondary'
      },
    }

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.open
    const Icon = config.icon

    return (
      <span className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border",
        config.className
      )}>
        <Icon className="h-2.5 w-2.5" />
        {config.label}
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
      <div className="rounded-xl border border-border-default bg-bg-raised p-12 text-center">
        <AlertTriangle className="h-10 w-10 text-text-tertiary mx-auto mb-3" />
        <p className="text-sm font-semibold text-text-primary">No disputes found</p>
        <p className="text-xs text-text-tertiary mt-1">Disputes will appear here when users report issues</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border-default bg-bg-raised overflow-hidden">
      <div className={TABLE.wrap}>
        <table className={TABLE.table}>
          <thead>
            <tr>
              <th className={TABLE.th}>
                Order & Item
              </th>
              <th className={TABLE.th}>
                Type
              </th>
              <th className={TABLE.th}>
                Parties
              </th>
              <th className={TABLE.th}>
                Amount
              </th>
              <th className={TABLE.th}>
                Status
              </th>
              <th className={TABLE.th}>
                Created
              </th>
            </tr>
          </thead>
          <tbody>
            {disputes.map((dispute) => (
              <tr
                key={dispute.id}
                className={cn(TABLE.row, 'cursor-pointer')}
                onClick={() => router.push(`/admin/disputes/${dispute.id}`)}
              >
                {/* Order & Item - with game logo + listing title */}
                <td className={TABLE.td}>
                  <div className="flex items-center gap-3">
                    {dispute.game_icon && dispute.game_icon.startsWith('/') ? (
                      <div className="h-10 w-10 rounded-lg bg-bg-overlay border border-border-subtle flex items-center justify-center flex-shrink-0 overflow-hidden">
                        <Image
                          src={dispute.game_icon}
                          alt={dispute.game_name || 'Game'}
                          width={40}
                          height={40}
                          className="object-cover"
                        />
                      </div>
                    ) : dispute.game_icon ? (
                      <div className="h-10 w-10 rounded-lg bg-bg-overlay border border-border-subtle flex items-center justify-center flex-shrink-0 text-xl">
                        {dispute.game_icon}
                      </div>
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-bg-overlay border border-border-subtle flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="h-4 w-4 text-text-tertiary" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-text-primary line-clamp-1">
                        {dispute.game_name || 'Unknown Game'}
                      </p>
                      <p className="text-[11px] text-text-tertiary mt-0.5 line-clamp-1">
                        {dispute.listing_title || dispute.title}
                      </p>
                    </div>
                  </div>
                </td>

                {/* Type (reason) */}
                <td className={TABLE.td}>
                  <p className="text-[11px] text-text-tertiary capitalize">
                    {dispute.reason?.replace(/_/g, ' ')}
                  </p>
                </td>

                {/* Parties */}
                <td className={TABLE.td}>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <div className="h-5 w-5 rounded-full border border-border-subtle bg-bg-overlay flex items-center justify-center flex-shrink-0">
                        <User className="h-2.5 w-2.5 text-text-secondary" />
                      </div>
                      <span className="text-[11px] text-text-tertiary">
                        {dispute.buyer_username || 'Buyer'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-5 w-5 rounded-full border border-border-subtle bg-bg-overlay flex items-center justify-center flex-shrink-0">
                        <User className="h-2.5 w-2.5 text-text-secondary" />
                      </div>
                      <span className="text-[11px] text-text-tertiary">
                        {dispute.seller_username || 'Seller'}
                      </span>
                    </div>
                  </div>
                </td>

                {/* Amount */}
                <td className={TABLE.td}>
                  <span className="text-xs font-semibold tabular-nums text-text-primary">
                    {formatAmount(dispute.disputed_amount, dispute.currency)}
                  </span>
                </td>

                {/* Status */}
                <td className={TABLE.td}>
                  {getStatusBadge(dispute.status, dispute)}
                </td>

                {/* Created Date */}
                <td className={TABLE.td}>
                  <div className="flex items-center gap-1.5 text-[11px] text-text-tertiary">
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
