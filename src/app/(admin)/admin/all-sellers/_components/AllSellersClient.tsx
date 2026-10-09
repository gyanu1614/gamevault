'use client'

/**
 * Sellers — the whole seller journey on one page.
 *
 *   1. Funnel strip: Signed Up → Details → Store → Agreement → Live →
 *      Listed → Sold. Each tile is a filter (click = that slice).
 *   2. Toolbar: search (name, store, email, Discord, country), stage chips,
 *      trust chips (Verified / New), Founding.
 *   3. Rows: avatar, store or username, chips (stage, New/Verified, Founding,
 *      Test), where they are from, numbers (listings, sales, payout,
 *      balance), signed up, last active. Click → the seller detail page.
 *
 * All state is in the URL; this component only renders the result and
 * builds links. Newest first always.
 */
import { useRouter } from 'next/navigation'
import Link from '@/components/navigation/AppLink'
import { cn } from '@/lib/utils'
import { money } from '@/lib/seller/format-amount'
import { useNow } from '@/hooks/use-now'
import { GameTile } from '../../components/GameTile'
import { TierChip } from '../../components/TierChip'
import { AdminEmpty, AdminPagination, FilterChip, PageHeader, adminFieldCls } from '../../components/kit'
import { STAGE_LABEL, type AllSellersFilters, type AllSellersResult, type SellerFunnel, type SellerListRow } from '@/lib/admin/all-sellers'
import { MagnifyingGlass } from '@phosphor-icons/react/dist/ssr/MagnifyingGlass'
import { UsersThree } from '@phosphor-icons/react/dist/ssr/UsersThree'

const FLAG = 'inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-semibold'

function relativeTime(iso: string | null | undefined, now: number | null): string {
  if (!iso || now == null) return ''
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ''
  const mins = Math.max(0, Math.round((now - then) / 60_000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function shortDate(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Builds the page URL for a changed filter; page resets unless given. */
function hrefFor(filters: AllSellersFilters, patch: Partial<AllSellersFilters>): string {
  const next = { ...filters, ...patch, page: patch.page ?? 1 }
  const sp = new URLSearchParams()
  if (next.q) sp.set('q', next.q)
  if (next.stage && next.stage !== 'all') sp.set('stage', next.stage)
  if (next.trust && next.trust !== 'all') sp.set('trust', next.trust)
  if (next.founding) sp.set('founding', '1')
  if (next.page && next.page > 1) sp.set('page', String(next.page))
  const qs = sp.toString()
  return `/admin/all-sellers${qs ? `?${qs}` : ''}`
}

export default function AllSellersClient({ result, filters }: { result: AllSellersResult; filters: AllSellersFilters }) {
  const router = useRouter()
  const now = useNow()
  const { rows, total, page, pageSize, funnel } = result
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sellers"
        description="Everyone who started selling, newest first. Click a funnel step to see who is there."
      />

      <FunnelStrip funnel={funnel} filters={filters} />

      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <form action="/admin/all-sellers" method="get" className="relative w-full lg:w-[320px]">
          {filters.stage && filters.stage !== 'all' && <input type="hidden" name="stage" value={filters.stage} />}
          {filters.trust && filters.trust !== 'all' && <input type="hidden" name="trust" value={filters.trust} />}
          {filters.founding && <input type="hidden" name="founding" value="1" />}
          <MagnifyingGlass aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <input
            type="search"
            name="q"
            defaultValue={filters.q ?? ''}
            placeholder="Search name, store, email, Discord, country"
            aria-label="Search sellers"
            className={cn(adminFieldCls, 'pl-9')}
          />
        </form>
        <div className="flex flex-wrap items-center gap-2">
          <ChipLink href={hrefFor(filters, { stage: 'all' })} selected={!filters.stage || filters.stage === 'all'}>All</ChipLink>
          <ChipLink href={hrefFor(filters, { stage: 'in_progress' })} selected={filters.stage === 'in_progress'}>In Progress</ChipLink>
          <ChipLink href={hrefFor(filters, { stage: 'stalled' })} selected={filters.stage === 'stalled'}>Stalled 3d+</ChipLink>
          <ChipLink href={hrefFor(filters, { stage: 'live' })} selected={filters.stage === 'live'}>Live</ChipLink>
          <span aria-hidden className="mx-1 hidden h-5 w-px bg-white/10 sm:block" />
          <ChipLink href={hrefFor(filters, { trust: filters.trust === 'verified' ? 'all' : 'verified' })} selected={filters.trust === 'verified'}>Verified</ChipLink>
          <ChipLink href={hrefFor(filters, { trust: filters.trust === 'new' ? 'all' : 'new' })} selected={filters.trust === 'new'}>New</ChipLink>
          <ChipLink href={hrefFor(filters, { founding: !filters.founding })} selected={Boolean(filters.founding)}>Founding</ChipLink>
        </div>
      </div>

      {/* Rows */}
      {rows.length === 0 ? (
        <AdminEmpty icon={UsersThree} title="No sellers match" hint="Try another filter or clear the search." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-white/[0.06] bg-bg-raised">
          <div className="hidden grid-cols-[minmax(0,1fr)_120px_90px_90px_110px_110px] items-center gap-3 border-b border-white/[0.06] px-4 py-2 text-[12px] font-medium text-text-tertiary lg:grid">
            <span>Seller</span>
            <span>Stage</span>
            <span className="text-right">Listings</span>
            <span className="text-right">Sales</span>
            <span className="text-right">Payout</span>
            <span className="text-right">Signed Up</span>
          </div>
          <ul className="divide-y divide-white/[0.06]">
            {rows.map((r) => (
              <SellerRow key={r.id} row={r} now={now} onOpen={() => router.push(`/admin/active-sellers/${r.id}`)} />
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
          noun="sellers"
        />
      )}
    </div>
  )
}

/* ── Funnel ─────────────────────────────────────────────────────── */

function FunnelStrip({ funnel, filters }: { funnel: SellerFunnel; filters: AllSellersFilters }) {
  const steps: { label: string; value: number; patch: Partial<AllSellersFilters>; active: boolean }[] = [
    { label: 'Signed Up', value: funnel.signed_up, patch: { stage: 'all', trust: 'all', founding: false }, active: (!filters.stage || filters.stage === 'all') && (!filters.trust || filters.trust === 'all') && !filters.founding },
    { label: 'In Progress', value: funnel.signed_up - funnel.live, patch: { stage: 'in_progress' }, active: filters.stage === 'in_progress' },
    { label: 'Live', value: funnel.live, patch: { stage: 'live' }, active: filters.stage === 'live' },
    { label: 'Listed', value: funnel.listed, patch: { stage: 'listed' }, active: filters.stage === 'listed' },
    { label: 'Sold', value: funnel.sold, patch: { stage: 'sold' }, active: filters.stage === 'sold' },
    { label: 'Verified', value: funnel.verified, patch: { stage: 'live', trust: 'verified' }, active: filters.trust === 'verified' },
    { label: 'Founding', value: funnel.founding, patch: { founding: true }, active: Boolean(filters.founding) },
  ]
  const base = funnel.signed_up || 1
  return (
    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7" aria-label="Seller funnel">
      {steps.map((s, i) => {
        const pct = Math.round((s.value / base) * 100)
        return (
          <li key={s.label}>
            <Link
              href={hrefFor(filters, s.patch)}
              aria-current={s.active ? 'true' : undefined}
              className={cn(
                'block rounded-lg border px-3.5 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                s.active ? 'border-white/20 bg-white/[0.06]' : 'border-white/[0.06] bg-bg-raised hover:bg-white/[0.04]',
              )}
            >
              <span className="block text-[12px] font-medium text-text-tertiary">{s.label}</span>
              <span className="mt-1 flex items-baseline gap-2">
                <span className="text-[22px] font-semibold tabular-nums leading-none text-text-primary">{s.value.toLocaleString('en-US')}</span>
                {i > 0 && <span className="text-[11.5px] tabular-nums text-text-tertiary">{pct}%</span>}
              </span>
              <span aria-hidden className="mt-2.5 block h-1 overflow-hidden rounded-full bg-white/[0.06]">
                <span className={cn('block h-full rounded-full', i <= 2 ? 'bg-info' : i <= 4 ? 'bg-lime' : 'bg-success')} style={{ width: `${i === 0 ? 100 : pct}%` }} />
              </span>
            </Link>
          </li>
        )
      })}
    </ol>
  )
}

/* ── Rows ───────────────────────────────────────────────────────── */

function SellerRow({ row, now, onOpen }: { row: SellerListRow; now: number | null; onOpen: () => void }) {
  const name = row.shop_name || row.username || row.email || 'Unnamed'
  const live = row.stage === 5
  const stageTone =
    live ? 'bg-success-bg text-success' : row.stage === 4 ? 'bg-lime-tint-bg text-lime-text' : 'bg-warning-bg text-warning'
  const where = [row.country, row.discord ? `@${row.discord.replace(/^@/, '')}` : null].filter(Boolean).join(' · ')

  return (
    <li
      role="link"
      tabIndex={0}
      aria-label={`Open seller ${name}`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      className="group grid cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03] focus-visible:bg-white/[0.04] focus-visible:outline-none lg:grid-cols-[auto_minmax(0,1fr)_120px_90px_90px_110px_110px]"
    >
      <GameTile src={row.avatar_url} name={name} className="h-10 w-10 rounded-md text-[14px]" />

      {/* Identity */}
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <p className="min-w-0 truncate text-[14px] font-semibold text-text-primary">{name}</p>
          {live && <TierChip tier={row.seller_tier} />}
          {live && (row.is_verified ? <span className={cn(FLAG, 'bg-info-bg text-info')}>Verified</span> : <span className={cn(FLAG, 'bg-white/[0.07] text-text-secondary')}>New</span>)}
          {row.founding_seller && <span className={cn(FLAG, 'bg-success-bg text-success')}>Founding</span>}
          {row.seller_status === 'restricted' && <span className={cn(FLAG, 'bg-error-bg text-error')}>Restricted</span>}
          {row.seller_status === 'banned' && <span className={cn(FLAG, 'bg-error-bg text-error')}>Banned</span>}
          {row.is_test && <span className={cn(FLAG, 'bg-white/[0.07] text-text-secondary')}>Test</span>}
        </div>
        <p className="mt-0.5 truncate text-[12.5px] text-text-tertiary">
          {row.username ? `@${row.username}` : ''}
          {row.username && row.email ? ' · ' : ''}
          {row.email ?? ''}
          {where ? ` · ${where}` : ''}
        </p>
        {/* Small screens: stage + numbers under the name */}
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] tabular-nums text-text-secondary lg:hidden">
          <span className={cn(FLAG, stageTone)}>{STAGE_LABEL[row.stage]}</span>
          {live && (
            <span>
              {row.stats.active_listings} listings · {row.stats.completed_sales} sales · {money(row.stats.revenue)}
            </span>
          )}
          <span className="text-text-tertiary">{shortDate(row.signed_up_at)}</span>
        </p>
      </div>

      {/* Wide screens: columns */}
      <div className="hidden lg:block">
        <span className={cn(FLAG, stageTone)}>{STAGE_LABEL[row.stage]}</span>
        {!live && row.last_active_at && <p className="mt-1 text-[11.5px] text-text-tertiary">active {relativeTime(row.last_active_at, now)}</p>}
      </div>
      <p className="hidden text-right text-[13.5px] tabular-nums text-text-secondary lg:block">{live ? row.stats.active_listings : '—'}</p>
      <p className="hidden text-right text-[13.5px] tabular-nums text-text-secondary lg:block">{live ? row.stats.completed_sales : '—'}</p>
      <div className="hidden text-right lg:block">
        <p className="text-[13.5px] tabular-nums text-text-primary">{live ? money(row.stats.revenue) : '—'}</p>
        {live && row.stats.balance_usd != null && <p className="text-[11.5px] tabular-nums text-text-tertiary">bal {money(row.stats.balance_usd)}</p>}
      </div>
      <div className="hidden text-right lg:block">
        <p className="text-[13.5px] tabular-nums text-text-secondary">{shortDate(row.signed_up_at)}</p>
        {live && row.last_active_at && <p className="text-[11.5px] tabular-nums text-text-tertiary">active {relativeTime(row.last_active_at, now)}</p>}
      </div>
    </li>
  )
}

function ChipLink({ href, selected, children }: { href: string; selected: boolean; children: React.ReactNode }) {
  const router = useRouter()
  return (
    <FilterChip selected={selected} onClick={() => router.push(href)}>
      {children}
    </FilterChip>
  )
}
