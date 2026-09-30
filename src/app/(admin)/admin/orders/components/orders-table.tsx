'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, Receipt } from '@phosphor-icons/react'
import { AdminOrder } from '@/lib/actions/admin-orders'
import { cn } from '@/lib/utils'
import { getAvatarUrl } from '@/lib/utils/avatar'
import { AdminEmpty, AdminPagination, StatusBadge, TABLE } from '../../components/kit'
import { GameTile } from '../../components/GameTile'

// Model C display labels for the escrow_status DB values (identifiers stay).
// The badge tone is keyed on the DB value, the text on the label.
const ESCROW_DISPLAY: Record<string, string> = {
  pending: 'Pending',
  held: 'Payout Pending',
  frozen: 'Frozen',
  released: 'Seller Paid Out',
  refunded: 'Refunded',
}
const ESCROW_TONE: Record<string, 'success' | 'warning' | 'error' | 'neutral'> = {
  pending: 'neutral',
  held: 'warning',
  frozen: 'error',
  released: 'success',
  refunded: 'error',
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

const money = (n: number) => `$${n.toFixed(2)}`
const date = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

function PayoutBadge({ status }: { status: string | null }) {
  return <StatusBadge status={ESCROW_DISPLAY[status ?? ''] ?? status ?? '—'} tone={ESCROW_TONE[status ?? '']} />
}

function Person({ avatar, name, sub }: { avatar: string; name: string; sub: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={avatar} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
      {/* Emails only on very wide screens; the order page shows them. */}
      <div className="min-w-0 max-w-[150px] min-[1680px]:max-w-[210px]">
        <p className="truncate text-[13.5px] font-medium text-text-primary">{name}</p>
        {sub && <p className="hidden truncate text-[12px] text-text-tertiary min-[1680px]:block">{sub}</p>}
      </div>
    </div>
  )
}

function GameThumb({ game }: { game: NonNullable<AdminOrder['listing']>['game'] | null | undefined }) {
  if (!game) return null
  return <GameTile src={game.image_url || `/games/${game.slug}.png`} name={game.name} />
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
    return <AdminEmpty icon={Receipt} title="No orders found" hint="Try another search or clear the filters." />
  }

  return (
    <div className="space-y-4">
      {/* Below xl: cards (two across from md). Six columns + the sidebar need ~960px. */}
      <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-3 xl:hidden">
        {orders.map((order) => (
          <li key={order.id}>
            <Link
              href={`/admin/orders/${order.id}`}
              className="block rounded-lg bg-bg-raised p-4 transition-colors active:bg-bg-raised-hover"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-text-primary">{order.order_number}</p>
                  <p className="mt-0.5 text-[12px] text-text-tertiary">
                    {date(order.created_at)} · {time(order.created_at)}
                  </p>
                </div>
                <StatusBadge status={order.status} />
              </div>

              <div className="mt-3 flex items-center gap-2.5">
                <GameThumb game={order.listing?.game} />
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] text-text-primary">{order.listing?.title || 'N/A'}</p>
                  {order.listing?.game && (
                    <p className="truncate text-[12px] text-text-tertiary">{order.listing.game.name}</p>
                  )}
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-3">
                <p className="min-w-0 truncate text-[12.5px] text-text-secondary">
                  {order.buyer?.username || 'Unknown'}
                  <ArrowRight aria-hidden weight="bold" className="mx-1.5 inline h-3 w-3 text-text-tertiary" />
                  {order.seller?.shop_name || order.seller?.username || 'Unknown'}
                </p>
                <p className="shrink-0 text-[14px] font-semibold tabular-nums text-text-primary">
                  {money(order.total_amount)}
                </p>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-[12px] text-text-tertiary">Fee {money(order.platform_fee)}</span>
                <PayoutBadge status={order.escrow_status} />
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {/* xl+: the table */}
      <div className="hidden overflow-hidden rounded-lg bg-bg-raised xl:block">
        <div className={TABLE.wrap}>
          <table className={TABLE.table}>
            <thead>
              <tr>
                <th className={TABLE.th}>Order</th>
                <th className={TABLE.th}>Buyer</th>
                <th className={TABLE.th}>Seller</th>
                <th className={TABLE.th}>Listing</th>
                <th className={cn(TABLE.th, 'text-right')}>Amount</th>
                <th className={cn(TABLE.th, 'text-right')}>Status · Payout</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className={cn(TABLE.row, 'group')}>
                  <td className={TABLE.tdPrimary}>
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="whitespace-nowrap text-text-primary underline-offset-4 group-hover:underline"
                    >
                      {order.order_number}
                    </Link>
                    <p className="mt-0.5 whitespace-nowrap text-[12px] font-normal text-text-tertiary">
                      {date(order.created_at)} · {time(order.created_at)}
                    </p>
                  </td>
                  <td className={TABLE.td}>
                    <Person
                      avatar={getAvatarUrl(order.buyer?.avatar_url, order.buyer?.username || 'buyer')}
                      name={order.buyer?.username || 'Unknown'}
                      sub={order.buyer?.email || ''}
                    />
                  </td>
                  <td className={TABLE.td}>
                    <Person
                      avatar={getAvatarUrl(order.seller?.avatar_url, order.seller?.username || 'seller')}
                      name={order.seller?.shop_name || order.seller?.username || 'Unknown'}
                      sub={order.seller?.email || ''}
                    />
                  </td>
                  <td className={TABLE.td}>
                    <div className="flex min-w-0 items-center gap-2.5">
                      <GameThumb game={order.listing?.game} />
                      <div className="min-w-0 max-w-[200px] min-[1680px]:max-w-[280px]">
                        <p className="truncate text-[13.5px] text-text-primary">{order.listing?.title || 'N/A'}</p>
                        {order.listing?.game && (
                          <p className="truncate text-[12px] text-text-tertiary">{order.listing.game.name}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className={cn(TABLE.td, 'whitespace-nowrap text-right')}>
                    <div className="text-[13.5px] font-semibold tabular-nums text-text-primary">{money(order.total_amount)}</div>
                    <div className="text-[12px] tabular-nums text-text-tertiary">Fee {money(order.platform_fee)}</div>
                  </td>
                  <td className={cn(TABLE.td, 'text-right')}>
                    <div className="flex flex-col items-end gap-1">
                      <StatusBadge status={order.status} />
                      <PayoutBadge status={order.escrow_status} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {pagination && (
        <AdminPagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          limit={pagination.limit}
          onPage={handlePageChange}
          noun="orders"
        />
      )}
    </div>
  )
}
