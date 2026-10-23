'use client'

/**
 * Game detail → Values (hub games only): what the values hub holds and
 * whether its data jobs are healthy. Counts first, then every item with the
 * price the site shows and what it is missing (picture, How To Get), the
 * Eldorado names to review (MarketNamesPanel), then the new-items catalogue
 * job's recent runs.
 */
import { useDeferredValue, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowSquareOut, Check, MagnifyingGlass, Warning } from '@phosphor-icons/react'
import Link from '@/components/navigation/AppLink'
import { StatStrip } from '@/components/account/AccountSurface'
import { getAdminValues } from '@/lib/actions/admin-values'
import { ADMIN_VALUES_PAGE_SIZE, type AdminValuesView } from '@/lib/values/admin-values'
import { AdminEmpty, AdminLoadingRows, AdminPagination, FilterChip, PanelHead, StatusBadge, TABLE, adminFieldCls, type ChipTone } from '../../components/kit'
import { MarketNamesPanel } from './MarketNamesPanel'

const VIEWS: { id: AdminValuesView; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New' },
  { id: 'no-price', label: 'No Price' },
  { id: 'no-image', label: 'No Picture' },
  { id: 'no-facts', label: 'No How To Get' },
  { id: 'hidden', label: 'Hidden' },
]

const RUN_TONE: Record<string, ChipTone> = { ok: 'success', nothing_new: 'neutral', blocked: 'warning', failed: 'error' }
const RUN_LABEL: Record<string, string> = { ok: 'Added', nothing_new: 'Nothing New', blocked: 'Stopped', failed: 'Failed' }
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Oct 22, 13:05 UTC" — built by hand so server and Safari agree. */
function when(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`
}
const day = (iso: string | null) => (iso ? when(iso).split(',')[0] : '—')
const usd = (v: number | null) => (v == null ? '—' : v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }))

export function ValuesTab({ gameSlug, gameName }: { gameSlug: string; gameName: string }) {
  const [view, setView] = useState<AdminValuesView>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const q = useDeferredValue(search)

  const query = useQuery({
    queryKey: ['admin-values', gameSlug, view, q, page],
    queryFn: () => getAdminValues(gameSlug, { view, q, page }),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  })
  const res = query.data
  const data = res?.ok ? res.data : null
  const lastRun = data?.runs[0] ?? null

  if (res && !res.ok) return <AdminEmpty icon={Warning} tone="error" title="Couldn't Load Values" hint={res.error} />

  return (
    <div className="space-y-5">
      <StatStrip
        loading={!data}
        stats={[
          { label: 'Items', value: data?.summary.total.toLocaleString() ?? '—', hint: data ? `${data.summary.visible.toLocaleString()} shown on the site` : undefined },
          { label: 'New (14 Days)', value: data?.summary.newItems.toLocaleString() ?? '—' },
          { label: 'No Price Yet', value: data?.summary.noPrice.toLocaleString() ?? '—' },
          { label: 'No Picture', value: data?.summary.noImage.toLocaleString() ?? '—' },
          { label: 'No How To Get', value: data?.summary.noHowToGet.toLocaleString() ?? '—' },
          { label: 'Last Catalogue Run', value: lastRun ? (RUN_LABEL[lastRun.status] ?? lastRun.status) : 'Never', hint: lastRun ? when(lastRun.startedAt) : 'runs daily' },
          { label: 'Last Price Update', value: data ? day(data.lastPriceAt) : '—', hint: data?.lastPriceAt ? when(data.lastPriceAt) : undefined },
        ]}
      />

      <section className="rounded-lg bg-bg-raised p-4 sm:p-5">
        <PanelHead title={`${gameName} Items`} subtitle="The price shown is our own listing when there is one, else the market price." />
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter items">
            {VIEWS.map((v) => (
              <FilterChip
                key={v.id}
                selected={view === v.id}
                onClick={() => {
                  setView(v.id)
                  setPage(1)
                }}
              >
                {v.label}
              </FilterChip>
            ))}
          </div>
          <label className="relative block w-full sm:w-64">
            <span className="sr-only">Search items</span>
            <MagnifyingGlass aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Search by name"
              className={`${adminFieldCls} pl-9`}
            />
          </label>
        </div>

        <div className={`mt-4 ${TABLE.wrap}`}>
          {!data ? (
            <AdminLoadingRows rows={8} />
          ) : data.rows.length === 0 ? (
            <AdminEmpty icon={MagnifyingGlass} title="No Items Here" hint="Try another filter or search." />
          ) : (
            <table className={TABLE.table}>
              <thead>
                <tr>
                  <th className={TABLE.th}>Item</th>
                  <th className={TABLE.th}>Rarity</th>
                  <th className={TABLE.th}>On DropMarket</th>
                  <th className={TABLE.th}>Market</th>
                  {gameSlug === 'adopt-me' && <th className={TABLE.th}>Trade Value</th>}
                  <th className={TABLE.th}>How To Get</th>
                  <th className={TABLE.th}>Added</th>
                  <th className={TABLE.th}>On Site</th>
                  <th className={TABLE.th}>
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.slug} className={TABLE.row}>
                    <td className={TABLE.tdPrimary}>
                      <div className="flex min-w-[12rem] items-center gap-3">
                        {r.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail, already 512 px WebP
                          <img src={r.imageUrl} alt="" width={32} height={32} loading="lazy" className="h-8 w-8 shrink-0 rounded object-contain" />
                        ) : (
                          <span aria-hidden className="h-8 w-8 shrink-0 rounded bg-white/[0.05]" />
                        )}
                        <span className="truncate">{r.name}</span>
                        {r.isNew && <StatusBadge status="New" tone="lime" />}
                      </div>
                    </td>
                    <td className={TABLE.td}>{r.rarity ?? '—'}</td>
                    <td className={`${TABLE.td} tabular-nums`}>{usd(r.ourUsd)}</td>
                    <td className={`${TABLE.td} tabular-nums`}>{usd(r.marketUsd)}</td>
                    {gameSlug === 'adopt-me' && <td className={`${TABLE.td} tabular-nums`}>{r.tradeValue == null ? '—' : r.tradeValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>}
                    <td className={TABLE.td}>{r.hasHowToGet ? <Check aria-label="Yes" weight="bold" className="h-4 w-4 text-success" /> : <span aria-label="No">—</span>}</td>
                    <td className={`${TABLE.td} whitespace-nowrap`}>{day(r.addedAt)}</td>
                    <td className={TABLE.td}>{r.isVisible ? <StatusBadge status="Shown" tone="success" /> : <StatusBadge status="Hidden" tone="warning" />}</td>
                    <td className={TABLE.td}>
                      <Link href={r.href} target="_blank" className="inline-flex text-text-tertiary transition-colors hover:text-text-primary" aria-label={`Open ${r.name}'s page`}>
                        <ArrowSquareOut weight="bold" className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {data && data.totalPages > 1 && (
          <div className="mt-4">
            <AdminPagination page={data.page} totalPages={data.totalPages} total={data.total} limit={ADMIN_VALUES_PAGE_SIZE} onPage={setPage} noun="items" />
          </div>
        )}
      </section>

      <MarketNamesPanel gameSlug={gameSlug} />

      <section className="rounded-lg bg-bg-raised p-4 sm:p-5">
        <PanelHead title="New-Items Catalogue" subtitle="Runs daily from the game's wiki and only ever adds items." />
        {!data ? (
          <AdminLoadingRows rows={3} />
        ) : data.runs.length === 0 ? (
          <AdminEmpty icon={Warning} title="No Runs Yet" hint="The daily job has not run for this game." />
        ) : (
          <div className={`mt-3 ${TABLE.wrap}`}>
            <table className={TABLE.table}>
              <thead>
                <tr>
                  <th className={TABLE.th}>When</th>
                  <th className={TABLE.th}>Result</th>
                  <th className={TABLE.th}>Added</th>
                </tr>
              </thead>
              <tbody>
                {data.runs.map((r) => (
                  <tr key={r.startedAt} className={TABLE.row}>
                    <td className={`${TABLE.td} whitespace-nowrap`}>{when(r.startedAt)}</td>
                    <td className={TABLE.td}>
                      <StatusBadge status={RUN_LABEL[r.status] ?? r.status} tone={RUN_TONE[r.status] ?? 'neutral'} />
                    </td>
                    <td className={TABLE.td}>
                      {r.message ? r.message : r.added.length ? `${r.added.length}: ${r.added.slice(0, 6).join(', ')}${r.added.length > 6 ? ' …' : ''}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
