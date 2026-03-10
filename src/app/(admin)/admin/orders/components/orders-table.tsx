'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AdminOrder } from '@/lib/actions/admin-orders'
import { cn } from '@/lib/utils'
import { IconChevronLeft, IconChevronRight, IconExternalLink, IconUser, IconBuildingStore } from '@tabler/icons-react'
import { getAvatarUrl } from '@/lib/utils/avatar'

interface OrdersTableProps {
  orders: AdminOrder[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  } | null
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string }> = {
    pending: { label: 'Pending', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
    processing: { label: 'Processing', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
    paid: { label: 'Paid', color: 'bg-green-500/15 text-green-400 border-green-500/30' },
    completed: { label: 'Completed', color: 'bg-green-500/15 text-green-400 border-green-500/30' },
    cancelled: { label: 'Cancelled', color: 'bg-red-500/15 text-red-400 border-red-500/30' },
    refunded: { label: 'Refunded', color: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
  }

  const { label, color } = config[status] || { label: status, color: 'bg-gray-500/15 text-gray-400 border-gray-500/30' }

  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border', color)}>
      {label}
    </span>
  )
}

function EscrowBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string }> = {
    pending: { label: 'Pending', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
    held: { label: 'Held', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
    released: { label: 'Released', color: 'bg-green-500/15 text-green-400 border-green-500/30' },
    refunded: { label: 'Refunded', color: 'bg-red-500/15 text-red-400 border-red-500/30' },
  }

  const { label, color } = config[status] || { label: status, color: 'bg-gray-500/15 text-gray-400 border-gray-500/30' }

  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border', color)}>
      {label}
    </span>
  )
}

export function OrdersTable({ orders, pagination }: OrdersTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', newPage.toString())
    router.push(`?${params.toString()}`)
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-12">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="h-12 w-12 rounded-full bg-gray-500/10 flex items-center justify-center mb-3">
            <IconExternalLink className="h-6 w-6 text-gray-600" />
          </div>
          <p className="text-sm font-medium text-gray-400">No orders found</p>
          <p className="text-xs text-gray-600 mt-1">Try adjusting your search or filters</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Table */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Order</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Buyer</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Seller</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Listing</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Escrow</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="py-3 px-4">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="flex items-center gap-2 group-hover:text-violet-400 transition-colors"
                    >
                      <span className="text-sm font-semibold text-white">{order.order_number}</span>
                      <IconExternalLink className="h-3.5 w-3.5 text-gray-600 group-hover:text-violet-400 opacity-0 group-hover:opacity-100 transition-all" />
                    </Link>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <img
                        src={getAvatarUrl(order.buyer?.avatar_url, order.buyer?.username || 'buyer')}
                        alt={order.buyer?.username || 'Buyer'}
                        className="h-7 w-7 rounded-full border border-white/10"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{order.buyer?.username || 'Unknown'}</p>
                        <p className="text-[10px] text-gray-600 truncate">{order.buyer?.email || ''}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <img
                        src={getAvatarUrl(order.seller?.avatar_url, order.seller?.username || 'seller')}
                        alt={order.seller?.username || 'Seller'}
                        className="h-7 w-7 rounded-full border border-white/10"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{order.seller?.shop_name || order.seller?.username || 'Unknown'}</p>
                        <p className="text-[10px] text-gray-600 truncate">{order.seller?.email || ''}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2 min-w-0">
                      {order.listing?.game && (
                        <img
                          src={order.listing.game.image_url || `/games/${order.listing.game.slug}.png`}
                          alt={order.listing.game.name}
                          className="h-8 w-8 rounded object-cover flex-shrink-0"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.style.display = 'none'
                          }}
                        />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm text-white truncate max-w-xs">{order.listing?.title || 'N/A'}</p>
                        {order.listing?.game && (
                          <p className="text-[10px] text-gray-600 truncate">
                            {order.listing.game.name}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="text-sm font-semibold text-white">${order.total_amount.toFixed(2)}</div>
                    <div className="text-[10px] text-gray-600">Fee: ${order.platform_fee.toFixed(2)}</div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="py-3 px-4 text-center">
                    <EscrowBadge status={order.escrow_status} />
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="text-sm text-gray-400">
                      {new Date(order.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </div>
                    <div className="text-[10px] text-gray-600">
                      {new Date(order.created_at).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 rounded-lg border border-white/[0.06] bg-white/[0.025]">
          <div className="text-sm text-gray-500">
            Showing <span className="font-medium text-white">{((pagination.page - 1) * pagination.limit) + 1}</span> to{' '}
            <span className="font-medium text-white">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of{' '}
            <span className="font-medium text-white">{pagination.total}</span> orders
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="p-2 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <IconChevronLeft className="h-4 w-4 text-gray-400" />
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                let pageNum
                if (pagination.totalPages <= 5) {
                  pageNum = i + 1
                } else if (pagination.page <= 3) {
                  pageNum = i + 1
                } else if (pagination.page >= pagination.totalPages - 2) {
                  pageNum = pagination.totalPages - 4 + i
                } else {
                  pageNum = pagination.page - 2 + i
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={cn(
                      'min-w-[2rem] h-8 rounded-lg text-sm font-medium transition-colors',
                      pageNum === pagination.page
                        ? 'bg-violet-500/15 text-violet-400 border border-violet-500/30'
                        : 'bg-white/[0.03] text-gray-400 hover:bg-white/[0.06] hover:text-white border border-white/[0.08]'
                    )}
                  >
                    {pageNum}
                  </button>
                )
              })}
            </div>
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages}
              className="p-2 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <IconChevronRight className="h-4 w-4 text-gray-400" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
