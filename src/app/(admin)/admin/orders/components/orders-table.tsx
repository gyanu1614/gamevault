'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AdminOrder } from '@/lib/actions/admin-orders'
import { cn } from '@/lib/utils'
import { IconChevronLeft, IconChevronRight, IconExternalLink } from '@tabler/icons-react'
import { getAvatarUrl } from '@/lib/utils/avatar'
import { StatusBadge, TABLE } from '../../components/kit'

// Model C display labels for the escrow_status DB values (identifiers stay).
const ESCROW_DISPLAY: Record<string, string> = {
  pending: 'Pending',
  held: 'Payout Pending',
  released: 'Seller Paid Out',
  refunded: 'Refunded',
}

interface OrdersTableProps {
  orders: AdminOrder[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  } | null
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
      <div className="rounded-xl border border-border-default bg-bg-raised p-12">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="h-12 w-12 rounded-full border border-border-subtle bg-bg-overlay flex items-center justify-center mb-3">
            <IconExternalLink className="h-6 w-6 text-text-tertiary" />
          </div>
          <p className="text-sm font-medium text-text-secondary">No orders found</p>
          <p className="text-xs text-text-tertiary mt-1">Try adjusting your search or filters</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Table */}
      <div className="rounded-xl border border-border-default bg-bg-raised overflow-hidden">
        <div className={TABLE.wrap}>
          <table className={TABLE.table}>
            <thead>
              <tr>
                <th className={TABLE.th}>Order</th>
                <th className={TABLE.th}>Buyer</th>
                <th className={TABLE.th}>Seller</th>
                <th className={TABLE.th}>Listing</th>
                <th className={cn(TABLE.th, 'text-right')}>Amount</th>
                <th className={cn(TABLE.th, 'text-center')}>Status</th>
                <th className={cn(TABLE.th, 'text-center')}>Payout</th>
                <th className={cn(TABLE.th, 'text-right')}>Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className={cn(TABLE.row, 'group')}>
                  <td className={TABLE.tdPrimary}>
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="flex items-center gap-2 transition-colors"
                    >
                      <span className="text-sm font-semibold text-text-primary group-hover:text-lime-text transition-colors">{order.order_number}</span>
                      <IconExternalLink className="h-3.5 w-3.5 text-lime-text opacity-0 group-hover:opacity-100 transition-all" />
                    </Link>
                  </td>
                  <td className={TABLE.td}>
                    <div className="flex items-center gap-2">
                      <img
                        src={getAvatarUrl(order.buyer?.avatar_url, order.buyer?.username || 'buyer')}
                        alt={order.buyer?.username || 'Buyer'}
                        className="h-7 w-7 rounded-full border border-border-default"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{order.buyer?.username || 'Unknown'}</p>
                        <p className="text-[10px] text-text-tertiary truncate">{order.buyer?.email || ''}</p>
                      </div>
                    </div>
                  </td>
                  <td className={TABLE.td}>
                    <div className="flex items-center gap-2">
                      <img
                        src={getAvatarUrl(order.seller?.avatar_url, order.seller?.username || 'seller')}
                        alt={order.seller?.username || 'Seller'}
                        className="h-7 w-7 rounded-full border border-border-default"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{order.seller?.shop_name || order.seller?.username || 'Unknown'}</p>
                        <p className="text-[10px] text-text-tertiary truncate">{order.seller?.email || ''}</p>
                      </div>
                    </div>
                  </td>
                  <td className={TABLE.td}>
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
                        <p className="text-sm text-text-primary truncate max-w-xs">{order.listing?.title || 'N/A'}</p>
                        {order.listing?.game && (
                          <p className="text-[10px] text-text-tertiary truncate">
                            {order.listing.game.name}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className={cn(TABLE.td, 'text-right')}>
                    <div className="text-sm font-semibold tabular-nums text-text-primary">${order.total_amount.toFixed(2)}</div>
                    <div className="text-[10px] text-text-tertiary">Fee: ${order.platform_fee.toFixed(2)}</div>
                  </td>
                  <td className={cn(TABLE.td, 'text-center')}>
                    <StatusBadge status={order.status} />
                  </td>
                  <td className={cn(TABLE.td, 'text-center')}>
                    <StatusBadge status={ESCROW_DISPLAY[order.escrow_status ?? ''] ?? order.escrow_status} />
                  </td>
                  <td className={cn(TABLE.td, 'text-right')}>
                    <div className="text-sm text-text-secondary">
                      {new Date(order.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </div>
                    <div className="text-[10px] text-text-tertiary">
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
        <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-border-default bg-bg-raised">
          <div className="text-sm text-text-tertiary">
            Showing <span className="font-medium text-text-primary">{((pagination.page - 1) * pagination.limit) + 1}</span> to{' '}
            <span className="font-medium text-text-primary">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of{' '}
            <span className="font-medium text-text-primary">{pagination.total}</span> orders
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="p-2 rounded-lg border border-border-default bg-bg-overlay hover:bg-bg-raised-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <IconChevronLeft className="h-4 w-4 text-text-secondary" />
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
                        ? 'border border-lime-tint-border bg-lime-tint-bg text-lime-text'
                        : 'border border-border-default bg-bg-overlay text-text-secondary hover:bg-bg-raised-hover hover:text-text-primary'
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
              className="p-2 rounded-lg border border-border-default bg-bg-overlay hover:bg-bg-raised-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <IconChevronRight className="h-4 w-4 text-text-secondary" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
