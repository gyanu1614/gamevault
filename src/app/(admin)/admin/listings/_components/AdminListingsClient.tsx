'use client'

/**
 * Admin → Listings. A button answers at the click: the row changes at once and
 * goes back with an error if the action fails. The seller is emailed the reason
 * by takedownListing, which also adds the strike when ticked.
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MagnifyingGlass } from '@phosphor-icons/react/dist/ssr/MagnifyingGlass'
import { Storefront } from '@phosphor-icons/react/dist/ssr/Storefront'
import { toast } from 'sonner'
import Link from '@/components/navigation/AppLink'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { restoreListing, takedownListing } from '@/lib/actions/admin-moderation-tools'
import {
  ADMIN_LISTING_STATUSES,
  publicListingHref,
  type AdminListingRow,
  type AdminListingsFilters,
  type AdminListingsResult,
} from '@/lib/admin/admin-listings'
import { sellerFacingReason } from '@/lib/moderation/seller-reason'
import { money } from '@/lib/seller/format-amount'
import { cn } from '@/lib/utils'
import { adminBtn, adminBtnSm, AdminEmpty, adminFieldCls, AdminPagination, PageHeader, StatusBadge } from '../../components/kit'

const STATUS_LABEL = new Map<string, string>(ADMIN_LISTING_STATUSES.map((s) => [s.value, s.label]))
const STATUS_TONE: Record<string, 'success' | 'warning' | 'error' | 'neutral' | 'info'> = {
  active: 'success',
  pending_approval: 'info',
  changes_requested: 'warning',
  suspended: 'error',
  rejected: 'error',
}
/** Statuses takedown_listing accepts. */
const CAN_TAKE_DOWN = new Set(['active', 'paused', 'pending_approval', 'changes_requested'])

function hrefFor(filters: AdminListingsFilters, patch: Partial<AdminListingsFilters>): string {
  const next = { ...filters, ...patch, page: patch.page ?? 1 }
  const sp = new URLSearchParams()
  if (next.q) sp.set('q', next.q)
  if (next.status) sp.set('status', next.status)
  if (next.page && next.page > 1) sp.set('page', String(next.page))
  const qs = sp.toString()
  return `/admin/listings${qs ? `?${qs}` : ''}`
}

export default function AdminListingsClient({ result, filters }: { result: AdminListingsResult; filters: AdminListingsFilters }) {
  const router = useRouter()
  const { rows, total, page, pageSize } = result
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const [statusOverride, setStatusOverride] = useState<Record<string, string>>({})
  const [target, setTarget] = useState<AdminListingRow | null>(null)
  const [reason, setReason] = useState('')
  const [strike, setStrike] = useState(false)
  const [, startTransition] = useTransition()

  const setRowStatus = (id: string, status: string | null) =>
    setStatusOverride((current) => {
      const { [id]: _removed, ...rest } = current
      return status ? { ...rest, [id]: status } : rest
    })

  const openTakeDown = (row: AdminListingRow) => {
    setTarget(row)
    setReason('')
    setStrike(false)
  }

  const confirmTakeDown = () => {
    if (!target) return
    const { id } = target
    setRowStatus(id, 'suspended')
    setTarget(null)
    startTransition(async () => {
      const res = await takedownListing({ listingId: id, reason: reason.trim(), strike })
      if (!res.success) {
        setRowStatus(id, null)
        toast.error(res.error)
      }
    })
  }

  const restore = (row: AdminListingRow) => {
    setRowStatus(row.id, 'active')
    startTransition(async () => {
      const res = await restoreListing(row.id)
      if (!res.success) {
        setRowStatus(row.id, null)
        toast.error(res.error)
      }
    })
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Listings" description="Find any listing by title, store, username or id." />

      <div className="flex flex-col gap-3">
        <form action="/admin/listings" method="get" className="relative w-full lg:w-[320px]">
          {filters.status && <input type="hidden" name="status" value={filters.status} />}
          <MagnifyingGlass aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <input
            type="search"
            name="q"
            defaultValue={filters.q ?? ''}
            placeholder="Title, store, username or id…"
            autoComplete="off"
            aria-label="Search listings"
            className={cn(adminFieldCls, 'pl-9')}
          />
        </form>
        <div className="flex flex-wrap items-center gap-2">
          <ChipLink href={hrefFor(filters, { status: undefined })} selected={!filters.status}>All</ChipLink>
          {ADMIN_LISTING_STATUSES.map((s) => (
            <ChipLink key={s.value} href={hrefFor(filters, { status: s.value })} selected={filters.status === s.value}>{s.label}</ChipLink>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <AdminEmpty icon={Storefront} title="No Listings Match" hint="Try another status or clear the search." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-white/[0.06] bg-bg-raised">
          <div className="hidden grid-cols-[minmax(0,1fr)_170px_90px_140px_100px_110px] items-center gap-3 border-b border-white/[0.06] px-4 py-2 text-[12px] font-medium text-text-tertiary lg:grid">
            <span>Listing</span>
            <span>Seller</span>
            <span className="text-right">Price</span>
            <span>Status</span>
            <span className="text-right">Listed</span>
            <span className="sr-only">Actions</span>
          </div>
          <ul className="divide-y divide-white/[0.06]">
            {rows.map((row) => (
              <ListingRow
                key={row.id}
                row={row}
                status={statusOverride[row.id] ?? row.status}
                onTakeDown={() => openTakeDown(row)}
                onRestore={() => restore(row)}
              />
            ))}
          </ul>
        </div>
      )}

      {totalPages > 1 && (
        <AdminPagination
          page={page}
          totalPages={totalPages}
          total={total}
          limit={pageSize}
          onPage={(p) => router.push(hrefFor(filters, { page: p }))}
          noun="listings"
        />
      )}

      <Dialog open={!!target} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent className="max-w-[460px] rounded-lg border-white/[0.08] bg-[#16171B] p-5 text-text-primary">
          <DialogTitle className="text-[17px] font-semibold">Take Down “{target?.title}”</DialogTitle>
          <DialogDescription className="text-[13px] text-text-secondary">The seller is emailed this reason. Keep it plain and specific.</DialogDescription>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 1000))}
            rows={3}
            autoFocus
            aria-label="Reason"
            placeholder="Why it is being removed…"
            className="mt-3 w-full resize-none rounded-md bg-bg-well px-3 py-2 text-[16px] text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-focus-ring sm:text-[13.5px]"
          />
          <label className="mt-3 flex items-center gap-2 text-[13px] text-text-secondary">
            <input type="checkbox" checked={strike} onChange={(e) => setStrike(e.target.checked)} className="h-3.5 w-3.5 accent-white" />
            Also add a strike (three strikes bans the store)
          </label>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setTarget(null)} className={adminBtn.secondary}>Cancel</button>
            <button type="button" onClick={confirmTakeDown} disabled={reason.trim().length < 3} className={adminBtn.danger}>Take Down</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ChipLink({ href, selected, children }: { href: string; selected: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
        selected ? 'bg-white/[0.12] text-text-primary' : 'bg-white/[0.04] text-text-secondary hover:bg-white/[0.08]',
      )}
    >
      {children}
    </Link>
  )
}

function ListingRow({ row, status, onTakeDown, onRestore }: { row: AdminListingRow; status: string; onTakeDown: () => void; onRestore: () => void }) {
  const href = status === 'active' ? publicListingHref(row) : null
  const reason = status === row.status ? sellerFacingReason({ status: row.status, moderation_notes: row.note, rejection_reason: null }) : null
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_170px_90px_140px_100px_110px] lg:gap-3">
      <div className="col-span-2 flex min-w-0 items-center gap-3 lg:col-span-1">
        {row.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={row.image} alt="" width={40} height={40} loading="lazy" className="h-10 w-10 shrink-0 rounded-md object-cover" />
        ) : (
          <span aria-hidden className="h-10 w-10 shrink-0 rounded-md bg-white/[0.05]" />
        )}
        <div className="min-w-0">
          {href ? (
            <Link href={href} className="block truncate text-[13.5px] font-medium text-text-primary hover:underline">{row.title}</Link>
          ) : (
            <p className="truncate text-[13.5px] font-medium text-text-primary">{row.title}</p>
          )}
          <p className="truncate text-[12px] text-text-tertiary">{[row.game?.name, row.category?.name].filter(Boolean).join(' · ')}</p>
          {reason && <p className={cn('mt-0.5 line-clamp-2 text-[12px]', reason.label === 'Requested' ? 'text-warning' : 'text-error')}>{reason.text}</p>}
        </div>
      </div>
      <div className="min-w-0 text-[13px]">
        {row.seller.id ? (
          <Link href={`/admin/active-sellers/${row.seller.id}`} className="block truncate text-text-secondary hover:underline">{row.seller.name ?? 'Unnamed'}</Link>
        ) : (
          <span className="text-text-tertiary">Unknown</span>
        )}
      </div>
      <div className="text-right text-[13px] tabular-nums text-text-primary">{money(row.price)}</div>
      <div><StatusBadge status={STATUS_LABEL.get(status) ?? status} tone={STATUS_TONE[status] ?? 'neutral'} /></div>
      <div className="text-right text-[12.5px] text-text-tertiary">
        {new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
      </div>
      <div className="col-span-2 empty:hidden lg:col-span-1 lg:text-right lg:empty:block">
        {CAN_TAKE_DOWN.has(status) && <button type="button" onClick={onTakeDown} className={adminBtnSm.danger}>Take Down</button>}
        {status === 'suspended' && <button type="button" onClick={onRestore} className={adminBtnSm.secondary}>Restore</button>}
      </div>
    </li>
  )
}
