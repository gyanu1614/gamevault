'use client'

/**
 * The wallet's three lists as real tables: the same columns on every row, money
 * right-aligned, so the eye can run down a column. Phones stack each row. Empty and
 * failed states say what to do next.
 */

import { useState, type ReactNode } from 'react'
import type { Icon as TileIcon } from '@phosphor-icons/react'
import { CaretRightIcon } from '@phosphor-icons/react/dist/csr/CaretRight'
import { GameControllerIcon } from '@phosphor-icons/react/dist/csr/GameController'
import { PackageIcon } from '@phosphor-icons/react/dist/csr/Package'
import { PaperPlaneTiltIcon } from '@phosphor-icons/react/dist/csr/PaperPlaneTilt'
import { PlusIcon } from '@phosphor-icons/react/dist/csr/Plus'
import { ShoppingCartIcon } from '@phosphor-icons/react/dist/csr/ShoppingCart'
import { WarningCircleIcon } from '@phosphor-icons/react/dist/csr/WarningCircle'
import { IconTile, accountBtn, type IconTileTone } from '@/components/account/AccountSurface'
import { OrderStatusPill } from '@/components/account/OrderStatusPill'
import Link from '@/components/navigation/AppLink'
import WithdrawalRequestCard, { WITHDRAWAL_TABLE_GRID } from '@/components/wallet/WithdrawalRequestCard'
import type { WithdrawalRequest } from '@/lib/actions/withdrawals'
import { cn } from '@/lib/utils'
import type { PurchaseTransaction, SaleTransaction } from './_walletData'

const ORDER_GRID = 'md:grid-cols-[minmax(0,1fr)_120px_96px_132px_96px_16px]'

const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

function ItemThumb({ imageUrl }: { imageUrl?: string | null }) {
  const [failed, setFailed] = useState(false)
  if (imageUrl && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- listing art from any host
      <img src={imageUrl} alt="" width={40} height={40} loading="lazy" onError={() => setFailed(true)} className="h-10 w-10 shrink-0 rounded-md object-cover" />
    )
  }
  return (
    <IconTile>
      <GameControllerIcon size={20} weight="duotone" />
    </IconTile>
  )
}

function TableHead({ grid, columns }: { grid: string; columns: { label: string; right?: boolean }[] }) {
  return (
    <div className={cn('hidden gap-x-4 border-b border-white/[0.07] px-5 py-2.5 text-[12.5px] font-medium text-text-tertiary md:grid', grid)}>
      {columns.map((c) => (
        <span key={c.label} className={c.right ? 'text-right' : undefined}>{c.label}</span>
      ))}
      <span aria-hidden />
    </div>
  )
}

function OrderRow({
  href,
  imageUrl,
  title,
  subtitle,
  middle,
  date,
  status,
  amount,
}: {
  href: string
  imageUrl?: string | null
  title: string
  subtitle?: string
  middle?: ReactNode
  date: string
  status: string
  amount: ReactNode
}) {
  return (
    <Link href={href} className={cn('group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-3 transition-colors hover:bg-white/[0.03] sm:px-5 md:gap-x-4', ORDER_GRID)}>
      <div className="flex min-w-0 items-center gap-3">
        <ItemThumb imageUrl={imageUrl} />
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-text-primary">{title}</p>
          <p className="mt-0.5 truncate text-[12px] text-text-tertiary">
            <span className="md:hidden">{date}</span>
            <span className="max-md:hidden">{subtitle}</span>
          </p>
        </div>
      </div>
      <div className="hidden truncate text-[13px] text-text-secondary md:block">{middle}</div>
      <div className="hidden text-[13px] text-text-secondary md:block">{date}</div>
      <div className="hidden md:block"><OrderStatusPill status={status} /></div>
      <div className="flex flex-col items-end gap-1 md:block md:text-right">
        <span className="text-[14.5px] font-bold tabular-nums">{amount}</span>
        <span className="md:hidden"><OrderStatusPill status={status} /></span>
      </div>
      <CaretRightIcon size={14} weight="bold" aria-hidden className="hidden text-text-tertiary transition-colors group-hover:text-text-secondary md:block" />
    </Link>
  )
}

export function EmptyState({
  icon: Icon,
  tone = 'neutral',
  title,
  body,
  action,
}: {
  icon: TileIcon
  tone?: IconTileTone
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center px-4 py-16 text-center">
      <IconTile tone={tone} className="h-12 w-12">
        <Icon size={26} weight="duotone" />
      </IconTile>
      <p className="mt-3 text-[15px] font-semibold text-text-primary">{title}</p>
      <p className="mt-1 text-[13px] text-text-secondary">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function LoadError({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div role="alert">
      <EmptyState
        icon={WarningCircleIcon}
        tone="attention"
        title={`We Couldn’t Load ${what}`}
        body="Please try again in a moment."
        action={<button type="button" onClick={onRetry} className={accountBtn.secondary}>Try Again</button>}
      />
    </div>
  )
}

export function ListSkeleton() {
  return (
    <div className="divide-y divide-white/[0.07]" aria-busy>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3 sm:px-5">
          <div className="skeleton h-10 w-10 shrink-0 rounded-md" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="skeleton h-4 w-48 max-w-full rounded" />
            <div className="skeleton h-3 w-32 rounded" />
          </div>
          <div className="skeleton h-5 w-16 rounded" />
        </div>
      ))}
    </div>
  )
}

export function PurchaseList({ rows, filtered }: { rows: PurchaseTransaction[]; filtered: boolean }) {
  if (rows.length === 0) {
    return filtered ? (
      <EmptyState icon={ShoppingCartIcon} title="No Matching Purchases" body="Try a different search or status." />
    ) : (
      <EmptyState
        icon={ShoppingCartIcon}
        tone="speed"
        title="No Purchases Yet"
        body="Your orders appear here."
        action={<Link href="/" className={accountBtn.primary}>Browse Listings</Link>}
      />
    )
  }
  return (
    <>
      <TableHead grid={ORDER_GRID} columns={[{ label: 'Item' }, { label: 'Order' }, { label: 'Date' }, { label: 'Status' }, { label: 'Total', right: true }]} />
      <div className="divide-y divide-white/[0.07]">
        {rows.map((t) => (
          <OrderRow
            key={t.id}
            href={`/account/orders/${t.orderId}`}
            imageUrl={t.listingImageUrl || t.gameImageUrl}
            title={t.title}
            subtitle={t.gameName}
            middle={t.orderNumber ? `#${t.orderNumber}` : null}
            date={day(t.createdAt)}
            status={t.status}
            amount={<span className="text-text-primary">${t.amount.toFixed(2)}</span>}
          />
        ))}
      </div>
    </>
  )
}

export function SalesList({ rows, filtered }: { rows: SaleTransaction[]; filtered: boolean }) {
  if (rows.length === 0) {
    return filtered ? (
      <EmptyState icon={PackageIcon} title="No Matching Sales" body="Try a different search." />
    ) : (
      <EmptyState
        icon={PackageIcon}
        tone="speed"
        title="No Sales Yet"
        body="Your sales appear here."
        action={
          <Link href="/sell/new" className={accountBtn.primary}>
            <PlusIcon size={16} weight="bold" aria-hidden />
            Create Listing
          </Link>
        }
      />
    )
  }
  return (
    <>
      <TableHead grid={ORDER_GRID} columns={[{ label: 'Item' }, { label: 'Buyer' }, { label: 'Date' }, { label: 'Status' }, { label: 'You Earned', right: true }]} />
      <div className="divide-y divide-white/[0.07]">
        {rows.map((t) => (
          <OrderRow
            key={t.id}
            href={`/account/orders/${t.orderId}`}
            imageUrl={t.listingImageUrl || t.gameImageUrl}
            title={t.listingTitle}
            subtitle={t.gameName}
            middle={t.buyerUsername}
            date={day(t.createdAt)}
            status={t.status}
            amount={<span className="text-success">+${t.netAmount.toFixed(2)}</span>}
          />
        ))}
      </div>
    </>
  )
}

export function PayoutList({ requests, onUpdate }: { requests: WithdrawalRequest[]; onUpdate: () => void }) {
  if (requests.length === 0) {
    return (
      <EmptyState
        icon={PaperPlaneTiltIcon}
        tone="money"
        title="No Withdrawals Yet"
        body="Your withdrawals appear here."
        action={<Link href="/account/wallet/withdraw" className={accountBtn.primary}>Withdraw</Link>}
      />
    )
  }
  return (
    <>
      <TableHead grid={WITHDRAWAL_TABLE_GRID} columns={[{ label: 'Method' }, { label: 'Date' }, { label: 'Status' }, { label: 'You Receive', right: true }]} />
      <div className="divide-y divide-white/[0.07]">
        {requests.map((request) => (
          <WithdrawalRequestCard key={request.id} table request={request} onUpdate={onUpdate} />
        ))}
      </div>
    </>
  )
}
