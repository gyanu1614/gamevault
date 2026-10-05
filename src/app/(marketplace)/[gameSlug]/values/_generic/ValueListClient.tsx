'use client'

/**
 * The value list for a values_* list hub (Murder Mystery 2 first): Adopt Me's
 * toolbar → filter tiles → "Showing" line → card grid → pagination, on the
 * shared values kit. No variant axis (a Chroma is its own item), so the
 * toolbar is search + sort.
 *
 * URL-driven, static-first: the prerendered HTML holds the default first page;
 * SearchParamsBridge seeds q / view / sort / page after hydration, and changes
 * are mirrored back with history.replaceState (no RSC round trip, no history
 * spam). Tap an item, hit Back, and the same view is restored.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { SortAscendingIcon } from '@phosphor-icons/react/dist/csr/SortAscending'
import { CaretUpIcon } from '@phosphor-icons/react/dist/csr/CaretUp'
import { CaretDownIcon } from '@phosphor-icons/react/dist/csr/CaretDown'
import { SearchParamsBridge } from '@/components/navigation/SearchParamsBridge'
import { CardRank, PriceStatPair, RarityLabel, ValueCard } from '@/components/values/ValueCard'
import { ValueSearchField } from '@/components/values/ValueSearchField'
import { ValueSelect } from '@/components/values/ValueSelect'
import { ValuePagination } from '@/components/values/ValuePagination'
import { RarityFilterBar } from '@/components/values/RarityFilterBar'
import { ValuesEmptyState } from '@/components/values/ValuesEmptyState'
import { FreshnessBadge } from '@/components/content/ValuesFreshnessBadge'
import { rarityMeta } from '@/lib/values/rarity'
import { matchesValueListTab, type ValueListHubConfig } from '@/lib/values/hub-config'

/** One list row, as the server hands it over (light: no obtain/history). */
export interface ValueListRow {
  id: string
  slug: string
  name: string
  rarity: string | null
  itemType: string | null
  imageUrl: string | null
  /** The item page, or null when the item has none (commons, unpriced). */
  href: string | null
  cheapestUsd: number | null
  marketUsd: number | null
  /** Reputable live listings behind the price at the last daily check. */
  listedNow: number
  /** 7-day change in percent; null without two days of history. */
  trendPct: number | null
}

type Sort = 'price-desc' | 'price-asc' | 'movers' | 'listed' | 'name'

const PAGE_SIZE = 25
const DEFAULT_VIEW = 'all'
const DEFAULT_SORT: Sort = 'price-desc'
/** Adopt Me's cash teal — "Cheapest" reads the same on every hub. */
const CHEAPEST_TEAL = '#54DDBE'
/** Moves smaller than this are noise, not a trend. */
const TREND_MIN_PCT = 0.05

/** Cents under $1,000; whole dollars above, so a two-column phone card never clips "$4,049.98". */
const usd = (v: number) =>
  v >= 1000
    ? v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
    : v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })

export default function ValueListClient({
  gameSlug,
  gameName,
  rows,
  hub,
  hasTrends,
  freshness,
}: {
  gameSlug: string
  gameName: string
  rows: ValueListRow[]
  hub: Pick<ValueListHubConfig, 'tabs' | 'itemTypeLabels' | 'pageRarities' | 'searchPlaceholder' | 'imageSource'>
  /** At least one item has a 7-day change — gates the Movers sort. */
  hasTrends: boolean
  freshness: { lastChangedAt: string | null; listingCount: number; sourceCount: number }
}) {
  const { tabs, itemTypeLabels, pageRarities, searchPlaceholder, imageSource } = hub
  const reduceMotion = useReducedMotion()
  const listTopRef = useRef<HTMLDivElement>(null)

  const [query, setQuery] = useState('')
  const [view, setView] = useState(DEFAULT_VIEW)
  const [sort, setSort] = useState<Sort>(DEFAULT_SORT)
  const [page, setPage] = useState(1)
  // URL → state ONCE, after hydration. Until then the URL is left alone, so
  // the first write-back can never wipe the params it has not read yet.
  const [seeded, setSeeded] = useState(false)

  const sortOptions = useMemo(
    () =>
      [
        { value: 'price-desc' as const, label: 'Highest Price' },
        { value: 'price-asc' as const, label: 'Lowest Price' },
        ...(hasTrends ? [{ value: 'movers' as const, label: 'Biggest Movers' }] : []),
        { value: 'listed' as const, label: 'Most Listed' },
        { value: 'name' as const, label: 'Name (A–Z)' },
      ] satisfies { value: Sort; label: string }[],
    [hasTrends],
  )

  // Tabs with no items are not offered (a tile that empties the grid is noise).
  const visibleTabs = useMemo(
    () =>
      tabs
        .map((t) => ({ ...t, count: rows.filter((r) => matchesValueListTab(t, r)).length }))
        .filter((t) => t.count > 0),
    [tabs, rows],
  )

  const seedFromUrl = useCallback(
    (params: URLSearchParams) => {
      if (seeded) return
      const q = params.get('q')?.trim() ?? ''
      const v = params.get('view') ?? ''
      const s = params.get('sort') as Sort | null
      const p = Number(params.get('page'))
      if (q) setQuery(q)
      if (v && visibleTabs.some((t) => t.key === v)) setView(v)
      if (s && sortOptions.some((o) => o.value === s)) setSort(s)
      if (Number.isInteger(p) && p > 1) setPage(p)
      setSeeded(true)
    },
    [seeded, visibleTabs, sortOptions],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const tab = view === DEFAULT_VIEW ? null : visibleTabs.find((t) => t.key === view) ?? null
    const list = rows.filter((r) => (!q || r.name.toLowerCase().includes(q)) && matchesValueListTab(tab, r))
    const priceOf = (r: ValueListRow) => r.cheapestUsd ?? -1
    return [...list].sort((a, b) => {
      // Unpriced items always sink, whatever the sort.
      const ap = a.cheapestUsd != null
      const bp = b.cheapestUsd != null
      if (ap !== bp && sort !== 'name') return ap ? -1 : 1
      switch (sort) {
        case 'price-asc':
          return priceOf(a) - priceOf(b)
        case 'movers': {
          const am = a.trendPct == null ? -1 : Math.abs(a.trendPct)
          const bm = b.trendPct == null ? -1 : Math.abs(b.trendPct)
          return bm - am || priceOf(b) - priceOf(a)
        }
        case 'listed':
          return b.listedNow - a.listedNow || priceOf(b) - priceOf(a)
        case 'name':
          return a.name.localeCompare(b.name)
        default:
          return priceOf(b) - priceOf(a) || a.name.localeCompare(b.name)
      }
    })
  }, [rows, query, view, sort, visibleTabs])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const rangeStart = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(safePage * PAGE_SIZE, filtered.length)

  const goToPage = (next: number) => {
    setPage(next)
    listTopRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
  }

  // State → URL (replace, only non-default values), once seeded.
  useEffect(() => {
    if (!seeded) return
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    if (view !== DEFAULT_VIEW) params.set('view', view)
    if (sort !== DEFAULT_SORT) params.set('sort', sort)
    if (safePage > 1) params.set('page', String(safePage))
    const qs = params.toString()
    const next = qs ? `${window.location.pathname}?${qs}` : window.location.pathname
    if (next !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(window.history.state, '', next)
    }
  }, [seeded, query, view, sort, safePage])

  const filterOptions = [
    { key: DEFAULT_VIEW, label: 'All', color: '#9AA6A0', count: rows.length },
    ...visibleTabs.map((t) => ({ key: t.key, label: t.label, color: t.color, count: t.count })),
  ]

  return (
    <div>
      <SearchParamsBridge onParams={seedFromUrl} />

      <div ref={listTopRef} className="scroll-mt-28">
        {/* Toolbar: search grows, sort beside it; filter tiles below. */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <ValueSearchField
            className="flex-1"
            value={query}
            onChange={(v) => {
              setQuery(v)
              setPage(1)
            }}
            placeholder={searchPlaceholder}
            label="Search items"
            clearable
          />
          <div className="w-full shrink-0 sm:w-56">
            <ValueSelect
              value={sort}
              onChange={(v) => {
                setSort(v)
                setPage(1)
              }}
              options={sortOptions}
              label="Sort items"
              icon={<SortAscendingIcon size={16} weight="bold" />}
            />
          </div>
        </div>

        <div className="mt-2">
          <RarityFilterBar
            options={filterOptions}
            value={view}
            onChange={(k) => {
              setView(k)
              setPage(1)
            }}
            label="Filter by rarity or type"
          />
        </div>

        <div className="mt-3 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-text-secondary">
            Showing{' '}
            <span className="font-semibold tabular-nums text-text-primary">
              {filtered.length === 0 ? '0' : `${rangeStart.toLocaleString()}–${rangeEnd.toLocaleString()}`}
            </span>{' '}
            of <span className="tabular-nums">{filtered.length.toLocaleString()}</span> items
          </p>
          <FreshnessBadge {...freshness} />
        </div>
      </div>

      {visible.length === 0 ? (
        <ValuesEmptyState className="mt-6" title="No Items Found" body="Try changing the search or filters." />
      ) : (
        <motion.div
          // Re-keyed per view so a filter / sort / page change eases in rather
          // than snapping; reduced motion gets the plain swap.
          key={`${view}|${sort}|${safePage}`}
          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5"
        >
          {visible.map((r, i) => (
            <ItemCard
              key={r.id}
              gameSlug={gameSlug}
              gameName={gameName}
              row={r}
              rank={(safePage - 1) * PAGE_SIZE + i + 1}
              typeLabel={r.itemType ? itemTypeLabels[r.itemType] ?? null : null}
            />
          ))}
        </motion.div>
      )}

      <ValuePagination page={safePage} totalPages={totalPages} onPage={goToPage} />

      <p className="mt-8 border-t border-white/[0.07] pt-5 text-[12px] leading-relaxed text-text-tertiary">
        Prices are in US dollars, from active listings by reputable sellers, checked daily. Cheapest is
        the lowest real price on offer; Market is the typical price. &ldquo;Listed now&rdquo; counts
        those listings; the 7-day change appears once we hold a week of history.
        {pageRarities.length > 0 && <> {listPhrase(pageRarities)} items have their own value page.</>}
        {imageSource && (
          <>
            {' '}Item images:{' '}
            <a
              href={imageSource.href}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="underline decoration-white/25 underline-offset-2 transition-colors hover:text-text-secondary"
            >
              {imageSource.label}
            </a>
            , {imageSource.license}.
          </>
        )}
      </p>
    </div>
  )
}

/** "A, B and C". */
function listPhrase(words: readonly string[]): string {
  return words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

/** One item on the shared ValueCard: rank + type · rarity → art + name → listed now + trend → Cheapest / Market. */
function ItemCard({
  gameSlug,
  gameName,
  row,
  rank,
  typeLabel,
}: {
  gameSlug: string
  gameName: string
  row: ValueListRow
  rank: number
  typeLabel: string | null
}) {
  const rarity = row.rarity ? rarityMeta(gameSlug, row.rarity) : null
  const priced = row.cheapestUsd != null
  const trend = row.trendPct != null && Math.abs(row.trendPct) >= TREND_MIN_PCT ? row.trendPct : null
  const up = (trend ?? 0) >= 0
  const Caret = up ? CaretUpIcon : CaretDownIcon

  return (
    <ValueCard
      href={row.href}
      headerLeft={
        <>
          <CardRank rank={rank} />
          {typeLabel && <span className="truncate text-[11px] font-medium text-text-tertiary">{typeLabel}</span>}
        </>
      }
      headerRight={rarity ? <RarityLabel label={rarity.label} color={rarity.color} /> : undefined}
      imageSrc={row.imageUrl}
      imageAlt={`${row.name}${typeLabel ? ` ${typeLabel.toLowerCase()}` : ''} in ${gameName}`}
      name={row.name}
      sub={
        priced ? (
          <span className="flex items-center justify-center gap-1.5 tabular-nums">
            <span className="text-text-tertiary">{row.listedNow.toLocaleString('en-US')} listed now</span>
            {trend != null && (
              <span
                className="inline-flex items-center gap-0.5 font-semibold"
                style={{ color: up ? 'var(--color-success)' : 'var(--color-error)' }}
                title="7-day change"
              >
                <Caret aria-hidden size={10} weight="fill" />
                <span className="sr-only">{up ? 'Up' : 'Down'} over 7 days</span>
                {Math.abs(trend).toFixed(1)}%
              </span>
            )}
          </span>
        ) : undefined
      }
      footer={
        <PriceStatPair
          empty={priced ? null : 'No Price Yet'}
          stats={[
            { label: 'Cheapest', value: priced ? usd(row.cheapestUsd!) : null, color: CHEAPEST_TEAL },
            { label: 'Market', value: row.marketUsd != null ? usd(row.marketUsd) : null },
          ]}
        />
      }
    />
  )
}
