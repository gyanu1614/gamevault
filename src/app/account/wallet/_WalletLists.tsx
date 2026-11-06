'use client'

/** The feed's quiet states: nothing yet, nothing found, a failed read, still loading. */

import type { ReactNode } from 'react'
import type { Icon as TileIcon } from '@phosphor-icons/react'
import { ArrowsLeftRightIcon } from '@phosphor-icons/react/dist/csr/ArrowsLeftRight'
import { MagnifyingGlassIcon } from '@phosphor-icons/react/dist/csr/MagnifyingGlass'
import { PackageIcon } from '@phosphor-icons/react/dist/csr/Package'
import { PaperPlaneTiltIcon } from '@phosphor-icons/react/dist/csr/PaperPlaneTilt'
import { PlusIcon } from '@phosphor-icons/react/dist/csr/Plus'
import { ShoppingCartIcon } from '@phosphor-icons/react/dist/csr/ShoppingCart'
import { WarningCircleIcon } from '@phosphor-icons/react/dist/csr/WarningCircle'
import { IconTile, accountBtn, type IconTileTone } from '@/components/account/AccountSurface'
import Link from '@/components/navigation/AppLink'
import type { ActivityFilter } from '@/lib/wallet/activity'

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
      <p className="mt-3 text-[16px] font-semibold text-text-primary">{title}</p>
      <p className="mt-1 text-[14px] text-text-secondary">{body}</p>
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
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3 sm:px-6">
          <div className="skeleton h-12 w-12 shrink-0 rounded-md" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="skeleton h-4 w-56 max-w-full rounded" />
            <div className="skeleton h-3 w-36 rounded" />
          </div>
          <div className="skeleton h-5 w-20 rounded" />
        </div>
      ))}
    </div>
  )
}

export function ActivityEmpty({ filter, searching, isSeller }: { filter: ActivityFilter; searching: boolean; isSeller: boolean }) {
  if (searching) return <EmptyState icon={MagnifyingGlassIcon} title="Nothing Found" body="Try a different search." />
  if (filter === 'withdrawals') {
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
  if (filter === 'purchases' || !isSeller) {
    return (
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
    <EmptyState
      icon={filter === 'sales' ? PackageIcon : ArrowsLeftRightIcon}
      tone="speed"
      title={filter === 'sales' ? 'No Sales Yet' : 'No Activity Yet'}
      body={filter === 'sales' ? 'Your sales appear here.' : 'Your sales and withdrawals appear here.'}
      action={
        <Link href="/sell/new" className={accountBtn.primary}>
          <PlusIcon size={16} weight="bold" aria-hidden />
          Create Listing
        </Link>
      }
    />
  )
}
