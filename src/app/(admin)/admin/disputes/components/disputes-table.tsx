'use client'

import { useRouter } from 'next/navigation'
import { ArrowRight, Scales } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { AdminEmpty, AdminPagination, StatusBadge, TABLE, type ChipTone } from '../../components/kit'
import { GameTile } from '../../components/GameTile'

interface DisputesTableProps {
  disputes: any[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  } | null
}

/** Status → label + tone. Resolved rows read "Completed – <who>". */
function statusOf(status: string, dispute: any): { label: string; tone: ChipTone } {
  if (status.startsWith('resolved_')) {
    const who =
      status === 'resolved_buyer_favor' ? 'Buyer Favor' : status === 'resolved_seller_favor' ? 'Seller Favor' : 'Partial'
    return { label: `Completed – ${who}`, tone: 'success' }
  }
  switch (status) {
    case 'under_review':
      return { label: dispute.assigned_to ? 'Assigned' : 'Pending', tone: 'info' }
    case 'escalated':
      return { label: 'Escalated', tone: 'error' }
    case 'awaiting_seller_response':
      return { label: 'Awaiting Seller', tone: 'warning' }
    case 'awaiting_buyer_response':
      return { label: 'Awaiting Buyer', tone: 'warning' }
    case 'closed':
      return { label: 'Closed', tone: 'neutral' }
    case 'open':
    default:
      return { label: 'Pending', tone: 'warning' }
  }
}

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const formatTime = (date: string) => new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
const formatAmount = (amount: number, currency: string = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
const reasonLabel = (reason?: string | null) =>
  (reason ?? '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || '—'

/** Game mark: an image URL, an emoji, or the scales tile. */
function GameMark({ icon, name }: { icon?: string | null; name?: string | null }) {
  if (icon && /^(\/|https?:\/\/)/.test(icon)) return <GameTile src={icon} name={name} className="h-10 w-10" />
  if (icon) return <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-bg-overlay text-xl">{icon}</span>
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-white/[0.05] text-text-tertiary">
      <Scales aria-hidden weight="bold" className="h-4 w-4" />
    </span>
  )
}

export function DisputesTable({ disputes, pagination }: DisputesTableProps) {
  const router = useRouter()
  const open = (id: string) => router.push(`/admin/disputes/${id}`)

  if (disputes.length === 0) {
    return <AdminEmpty icon={Scales} title="No disputes found" hint="Disputes appear here when a buyer or seller reports a problem." />
  }

  return (
    <div className="space-y-4">
      {/* Below xl: cards */}
      <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-3 xl:hidden">
        {disputes.map((d) => {
          const st = statusOf(d.status, d)
          return (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => open(d.id)}
                className="block w-full rounded-lg bg-bg-raised p-4 text-left transition-colors hover:bg-bg-raised-hover"
              >
                <div className="flex items-start gap-3">
                  <GameMark icon={d.game_icon} name={d.game_name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-text-primary">{d.listing_title || d.title}</p>
                    <p className="truncate text-[12.5px] text-text-tertiary">
                      {d.game_name || 'Unknown Game'}
                      {d.order_number && <> · #{d.order_number}</>}
                    </p>
                  </div>
                  <StatusBadge status={st.label} tone={st.tone} className="shrink-0" />
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-3">
                  <p className="min-w-0 truncate text-[12.5px] text-text-secondary">
                    {d.buyer_username || 'Buyer'}
                    <ArrowRight aria-hidden weight="bold" className="mx-1.5 inline h-3 w-3 text-text-tertiary" />
                    {d.seller_username || 'Seller'}
                  </p>
                  <p className="shrink-0 text-[14px] font-semibold tabular-nums text-text-primary">
                    {formatAmount(d.disputed_amount, d.currency)}
                  </p>
                </div>
                <p className="mt-1.5 flex justify-between text-[12px] text-text-tertiary">
                  <span>{reasonLabel(d.reason)}</span>
                  <span>{formatDate(d.created_at)}</span>
                </p>
              </button>
            </li>
          )
        })}
      </ul>

      {/* xl+: table */}
      <div className="hidden overflow-hidden rounded-lg bg-bg-raised xl:block">
        <div className={TABLE.wrap}>
          <table className={TABLE.table}>
            <thead>
              <tr>
                <th className={TABLE.th}>Order & Item</th>
                <th className={TABLE.th}>Reason</th>
                <th className={TABLE.th}>Parties</th>
                <th className={cn(TABLE.th, 'text-right')}>Amount</th>
                <th className={TABLE.th}>Status</th>
                <th className={cn(TABLE.th, 'text-right')}>Opened</th>
              </tr>
            </thead>
            <tbody>
              {disputes.map((d) => {
                const st = statusOf(d.status, d)
                return (
                  <tr
                    key={d.id}
                    tabIndex={0}
                    role="link"
                    onClick={() => open(d.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') open(d.id)
                    }}
                    className={cn(TABLE.row, 'cursor-pointer focus-visible:bg-white/[0.04] focus-visible:outline-none')}
                  >
                    <td className={TABLE.td}>
                      <div className="flex items-center gap-3">
                        <GameMark icon={d.game_icon} name={d.game_name} />
                        <div className="min-w-0 max-w-[280px]">
                          <p className="truncate text-[13.5px] font-medium text-text-primary">{d.listing_title || d.title}</p>
                          <p className="truncate text-[12px] text-text-tertiary">
                            {d.game_name || 'Unknown Game'}
                            {d.order_number && <> · <span className="font-mono">#{d.order_number}</span></>}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className={cn(TABLE.td, 'text-[12.5px]')}>{reasonLabel(d.reason)}</td>
                    <td className={TABLE.td}>
                      <p className="text-[12.5px] text-text-secondary">{d.buyer_username || 'Buyer'}</p>
                      <p className="text-[12px] text-text-tertiary">vs {d.seller_username || 'Seller'}</p>
                    </td>
                    <td className={cn(TABLE.tdPrimary, 'whitespace-nowrap text-right tabular-nums')}>
                      {formatAmount(d.disputed_amount, d.currency)}
                    </td>
                    <td className={TABLE.td}>
                      <StatusBadge status={st.label} tone={st.tone} />
                    </td>
                    <td className={cn(TABLE.td, 'whitespace-nowrap text-right')}>
                      <p className="text-[12.5px] text-text-secondary">{formatDate(d.created_at)}</p>
                      <p className="text-[12px] text-text-tertiary">{formatTime(d.created_at)}</p>
                    </td>
                  </tr>
                )
              })}
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
          noun="disputes"
          onPage={(page) => {
            const params = new URLSearchParams(window.location.search)
            params.set('page', page.toString())
            router.push(`/admin/disputes?${params.toString()}`)
          }}
        />
      )}
    </div>
  )
}
