'use client'

/**
 * Steal a Brainrot value list. Built on the shared values kit
 * (src/components/values) so it reads as one product with the Adopt Me list:
 * same toolbar, rarity tiles, card, picker overlay, pagination and empty state.
 */

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { SortAscendingIcon } from '@phosphor-icons/react/dist/csr/SortAscending'
import { FunnelSimpleIcon } from '@phosphor-icons/react/dist/csr/FunnelSimple'
import { mutationVisual } from '@/lib/sab/mutations'
import { MutationDot } from '@/lib/sab/MutationDot'
import { formatIncome } from '@/lib/sab/format'
import {
  CardPickerOverlay,
  PriceStatPair,
  RarityLabel,
  ValueCard,
  VariantPill,
} from '@/components/values/ValueCard'
import { ValueSearchField } from '@/components/values/ValueSearchField'
import { ValueSelect } from '@/components/values/ValueSelect'
import { ValuePagination } from '@/components/values/ValuePagination'
import { RarityFilterBar } from '@/components/values/RarityFilterBar'
import { ValuesEmptyState } from '@/components/values/ValuesEmptyState'
import { VALUE_BTN_SECONDARY } from '@/components/values/styles'
import { SAB_RARITIES, rarityMeta as sharedRarityMeta } from '@/lib/values/rarity'
import type { InitialValueList } from '@/lib/values/lazy-list'
import { useValueListRows } from '@/lib/values/useValueListRows'
import { ValueCardSkeleton } from './_generic/ValueListSkeleton'
import {
  asNumber,
  filterSortBrainrots,
  SAB_DEFAULT_OBTAIN,
  SAB_DEFAULT_SORT,
  SAB_DEFAULT_VIEW,
  SAB_PAGE_SIZE,
  type BrainrotDirectoryItem,
  type SabSort,
} from './_sabListModel'

export type { BrainrotDirectoryItem, CardMutation } from './_sabListModel'

const rarityMeta = (r: string) => sharedRarityMeta('steal-a-brainrot', r)
/** Rarest first — the order players think in, not alphabetical. */
const RARITY_ORDER = SAB_RARITIES.map((r) => r.key)

/**
 * Popular is an ORDERING, not a cut: the list stays complete and simply runs
 * most-traded first, so page 1 is the top 24 by popularity and paging carries
 * on down the same ranking to the end of the catalog.
 */

type SortOption = SabSort

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'value-desc', label: 'Highest Value' },
  { value: 'name', label: 'Name A–Z' },
  { value: 'income-desc', label: 'Highest Income' },
  { value: 'income-asc', label: 'Lowest Income' },
]

/** 'popular' | 'all' | a rarity name. Exactly one is ever active. */
type View = string

function formatMoney(value: number | string | null): string | null {
  const amount = asNumber(value)
  if (amount == null) return null

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: amount < 10 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * `useSearchParams` requires a Suspense boundary (Next.js). The default export
 * wraps the inner component so the value page can render it directly, matching
 * the pattern used by _BrowseClient.
 */
export default function ValuesDirectoryClient({ initial }: { initial: InitialValueList }) {
  return (
    <Suspense fallback={null}>
      <ValuesDirectoryClientInner initial={initial} />
    </Suspense>
  )
}

function ValuesDirectoryClientInner({ initial }: { initial: InitialValueList }) {
  // The default view's first page ships in the page; every row arrives from
  // rows.json right after hydration (lib/values/lazy-list.ts — the full list
  // made this page 1.7 MB).
  const { rows: brainrots, ready, failed, retry } = useValueListRows<BrainrotDirectoryItem>('steal-a-brainrot', initial)
  // Filters live in the URL so they SURVIVE navigation: click an item, hit Back,
  // and the same view/search/sort/page you left is restored (and the filtered
  // view is shareable/bookmarkable). State is seeded from the query params on
  // mount, then a sync effect mirrors changes back to the URL via replace().
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [query, setQuery] = useState(() => searchParams.get('q') ?? '')
  // Popular is the landing view: A–Z put "1x1x1x1" first, which tells a
  // visitor nothing about what the game actually trades.
  const [view, setView] = useState<View>(() => searchParams.get('view') ?? 'popular')
  const [obtainability, setObtainability] = useState(
    () => searchParams.get('obtain') ?? 'all',
  )
  const [sort, setSort] = useState<SortOption>(
    () => (searchParams.get('sort') as SortOption) ?? 'value-desc',
  )

  // Only rarities present in the data get a tile, in rarest-first order.
  // Per-rarity counts for the tiles (Secret 42, Mythic 11…): from the page
  // until the full list is here.
  const rarityCounts = useMemo(() => {
    if (!ready) return initial.facets.rarity ?? {}
    const m: Record<string, number> = {}
    for (const b of brainrots) m[b.rarity] = (m[b.rarity] ?? 0) + 1
    return m
  }, [brainrots, ready, initial.facets])

  const rarities = useMemo(() => {
    const present = new Set(Object.keys(rarityCounts))
    const known = RARITY_ORDER.filter((r) => present.has(r))
    const unknown = [...present].filter((r) => !RARITY_ORDER.includes(r)).sort()
    return [...known, ...unknown]
  }, [rarityCounts])

  const obtainabilityOptions = useMemo(
    () =>
      (ready
        ? Array.from(new Set(brainrots.map((brainrot) => brainrot.obtainability).filter(Boolean)))
        : Object.keys(initial.facets.obtain ?? {})
      ).sort((a, b) => a.localeCompare(b)),
    [brainrots, ready, initial.facets],
  )

  const PAGE_SIZE = SAB_PAGE_SIZE
  const searching = query.trim().length > 0
  // A search should look through everything, not just the 10 popular rows —
  // otherwise searching from the landing view mostly returns nothing.
  const effectiveView = searching && view === 'popular' ? 'all' : view

  const filteredBrainrots = useMemo(
    () => (ready ? filterSortBrainrots(brainrots, { query, view, obtainability, sort }) : brainrots),
    [brainrots, ready, obtainability, query, sort, view],
  )

  const [page, setPage] = useState(() => {
    const p = Number(searchParams.get('page'))
    return Number.isInteger(p) && p > 0 ? p : 1
  })
  const isDefaultView =
    !searching &&
    view === SAB_DEFAULT_VIEW &&
    obtainability === SAB_DEFAULT_OBTAIN &&
    sort === SAB_DEFAULT_SORT &&
    page === 1
  // Before the full list arrives only the default first page is known; any
  // other view waits for it rather than filtering one page.
  const pending = !ready && !isDefaultView
  const filteredCount = ready ? filteredBrainrots.length : initial.total
  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE))

  /**
   * Paging without this left you stranded at the bottom of the page, staring
   * at the pagination bar while a brand-new page 2 sat above the fold. Glide
   * back to the top of the page on every page change.
   *
   * Smooth by default, instant for anyone who asked the OS for reduced motion —
   * a long smooth scroll is exactly the kind of movement that setting exists
   * to suppress.
   */
  const goToPage = (next: number) => {
    setPage(next)
    if (typeof window === 'undefined') return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })
  }
  // Reset to page 1 when the FILTERS change — but not on the very first render,
  // so a page number restored from the URL (e.g. arriving back on page 3) isn't
  // clobbered. A ref guards the initial mount.
  const didMount = useRef(false)
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true
      return
    }
    setPage(1)
  }, [query, view, obtainability, sort])

  // Mirror the current filter/search/sort/page into the URL (replace, so typing
  // doesn't spam history). Because the params are in the URL, navigating into an
  // item and hitting Back restores exactly this state. Only non-default values
  // are written, keeping the URL clean on the landing view.
  useEffect(() => {
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    if (view !== 'popular') params.set('view', view)
    if (obtainability !== 'all') params.set('obtain', obtainability)
    if (sort !== 'value-desc') params.set('sort', sort)
    if (page > 1) params.set('page', String(page))
    const qs = params.toString()
    const current = searchParams.toString()
    if (qs !== current) {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    }
  }, [query, view, obtainability, sort, page, pathname, router, searchParams])

  const currentPage = Math.min(page, totalPages)

  const visibleBrainrots = useMemo(
    () =>
      ready
        ? filteredBrainrots.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
        : pending
          ? []
          : filteredBrainrots,
    [filteredBrainrots, currentPage, ready, pending],
  )

  const filtersActive =
    searching || view !== 'popular' || obtainability !== 'all' || sort !== 'value-desc'

  const resetFilters = () => {
    setQuery('')
    setView('popular')
    setObtainability('all')
    setSort('value-desc')
  }

  const rarityOptions = [
    { key: 'popular', label: 'Popular', color: '#4FB477' },
    { key: 'all', label: 'All', color: '#9AA6A0', count: ready ? brainrots.length : initial.total },
    ...rarities.map((r) => ({
      key: r,
      label: rarityMeta(r).label,
      color: rarityMeta(r).color,
      count: rarityCounts[r] ?? 0,
    })),
  ]

  return (
    <>
      {/* Toolbar: search grows, obtainability + sort beside it; rarity tiles below. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <ValueSearchField
          className="flex-1"
          value={query}
          onChange={setQuery}
          placeholder="Search Brainrot name, rarity..."
          label="Search Brainrots"
        />

        <div className="w-full shrink-0 sm:w-52">
          <ValueSelect
            value={obtainability}
            onChange={setObtainability}
            options={[
              { value: 'all', label: 'All Obtainability' },
              ...obtainabilityOptions.map((o) => ({ value: o, label: o })),
            ]}
            label="Filter by obtainability"
            icon={<FunnelSimpleIcon size={16} weight="bold" />}
          />
        </div>

        {/* Popular is itself an ordering, so the sort control would contradict
            it — hidden in that view rather than shown doing nothing. Its note
            sits on the results row below, keeping this toolbar one row. */}
        {effectiveView !== 'popular' && (
          <div className="w-full shrink-0 sm:w-52">
            <ValueSelect
              value={sort}
              onChange={setSort}
              options={SORT_OPTIONS}
              label="Sort Brainrots"
              icon={<SortAscendingIcon size={16} weight="bold" />}
            />
          </div>
        )}
      </div>

      <div className="mt-2">
        <RarityFilterBar options={rarityOptions} value={view} onChange={setView} />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-text-secondary">
{pending ? (
            <>Loading every Brainrot…</>
          ) : (
            <>
          Showing{' '}
          <span className="font-semibold tabular-nums text-text-primary">
            {filteredCount === 0
              ? '0'
              : `${((currentPage - 1) * PAGE_SIZE + 1).toLocaleString()}–${Math.min(
                  currentPage * PAGE_SIZE,
                  filteredCount,
                ).toLocaleString()}`}
          </span>{' '}
          of <span className="tabular-nums">{filteredCount.toLocaleString()}</span>{' '}
          Brainrots
            </>
          )}
          {/* Trust line, inline on the results row. */}
          <span className="ml-2.5 hidden items-center gap-1.5 align-middle sm:inline-flex">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#4FB477]" />
            <span className="text-[12px] font-medium text-text-tertiary">Priced From Real Sales</span>
          </span>
          {/* Desktop only: on a phone this note was an orphan line, and the
              Popular tile already says what the ordering is. */}
          {effectiveView === 'popular' && (
            <span className="ml-2.5 hidden align-middle text-[12px] text-text-tertiary sm:inline">
              Popular blends marketplace demand with cash value
            </span>
          )}
        </p>

        {filtersActive && (
          <button
            type="button"
            onClick={resetFilters}
            className="rounded-md px-1 font-semibold text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            Reset Filters
          </button>
        )}
      </div>

      {pending && failed ? (
        <ValuesEmptyState
          className="mt-6"
          title="Couldn't Load Every Brainrot"
          body="Check your connection and try again."
          action={
            <button type="button" onClick={retry} className={`mt-5 ${VALUE_BTN_SECONDARY}`}>
              Try Again
            </button>
          }
        />
      ) : pending ? (
        <div aria-busy aria-label="Loading Brainrots" className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-6">
          {Array.from({ length: 12 }, (_, i) => (
            <ValueCardSkeleton key={i} />
          ))}
        </div>
      ) : visibleBrainrots.length === 0 ? (
        <ValuesEmptyState
          className="mt-6"
          title="No Brainrots Found"
          body="Try changing the search or filters."
          action={
            <button type="button" onClick={resetFilters} className={VALUE_BTN_SECONDARY}>
              Clear Filters
            </button>
          }
        />
      ) : (
        /* Card grid: 2 (mobile) → 3 (tablet) → 4 → 6 (widescreen). */
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-6">
          {visibleBrainrots.map((brainrot) => (
            <BrainrotCard key={brainrot.id} brainrot={brainrot} />
          ))}
        </div>
      )}

      <ValuePagination page={currentPage} totalPages={totalPages} onPage={goToPage} />
    </>
  )
}

/**
 * One Brainrot on the shared ValueCard. Leads with the DEFAULT mutation's
 * prices, but the in-card pill opens a picker overlay; income, Market and
 * Cheapest then recompute for the selected mutation from REAL per-mutation
 * prices (never estimates — a mutation with no sale shows "No Sales"). Only the
 * art/name and footer navigate (carrying ?mutation= so the item page matches).
 */
function BrainrotCard({ brainrot }: { brainrot: BrainrotDirectoryItem }) {
  const rarity = rarityMeta(brainrot.rarity)
  const mutations = brainrot.mutations ?? []

  // Default is the initial selection; if there's no default row, the first
  // (lowest-multiplier) mutation leads.
  const defaultMutation =
    mutations.find((m) => m.slug === 'default') ?? mutations[0] ?? null
  const [selectedSlug, setSelectedSlug] = useState<string | null>(
    defaultMutation?.slug ?? null,
  )
  const [pickerOpen, setPickerOpen] = useState(false)

  const selected =
    mutations.find((m) => m.slug === selectedSlug) ?? defaultMutation
  const isDefault = !selected || selected.slug === 'default'
  const visual = mutationVisual(selected?.slug)

  // Prices for the SELECTED mutation. For default we can fall back to the item's
  // top-level cheapest/average (same value, but present even before the per-
  // mutation query lands); for a real mutation we use only its own row.
  const cheapestUsd = selected
    ? selected.cheapest_usd ??
      (isDefault ? asNumber(brainrot.cheapest_usd) : null)
    : asNumber(brainrot.cheapest_usd)
  const averageUsd = selected
    ? selected.average_usd ??
      (isDefault ? asNumber(brainrot.average_usd) : null)
    : asNumber(brainrot.average_usd)
  const marketUsd = averageUsd ?? (isDefault ? asNumber(brainrot.display_price_usd) : null)

  const headlineUsd = cheapestUsd ?? marketUsd
  const headline = headlineUsd != null ? formatMoney(headlineUsd) : null

  // Income for the selected mutation (falls back to the item's base income for
  // default). Only rendered when we have a real number.
  const incomeValue = selected?.income ?? asNumber(brainrot.base_income_per_second)
  const income = incomeValue != null ? formatIncome(incomeValue) : null

  const href = isDefault
    ? `/steal-a-brainrot/values/${brainrot.slug}`
    : `/steal-a-brainrot/values/${brainrot.slug}?mutation=${encodeURIComponent(selected!.slug)}`

  const hasMutations = mutations.length > 1
  // The pill names the SELECTED mutation; for default it reads "Default" (not a
  // generic "Mutation" prompt), so the card always states which variant it shows.
  const pillLabel = isDefault ? 'Default' : selected!.name
  const marketLabel = formatMoney(marketUsd)

  return (
    <ValueCard
      href={href}
      headerRight={<RarityLabel label={rarity.label} color={rarity.color} />}
      imageSrc={brainrot.image_url}
      imageAlt={`${brainrot.name} Steal a Brainrot`}
      pixelated
      name={brainrot.name}
      sub={income ? <span className="tabular-nums text-[#7EE0A6]">{income}</span> : undefined}
      control={
        hasMutations ? (
          <VariantPill
            label={pillLabel}
            color={isDefault ? undefined : visual.color}
            expanded={pickerOpen}
            onToggle={() => setPickerOpen((o) => !o)}
            ariaLabel={`Mutation: ${pillLabel}. Choose mutation`}
          />
        ) : (
          <div className="flex h-8 items-center justify-center text-[12px] font-medium text-text-disabled">
            No Mutations
          </div>
        )
      }
      footer={
        <PriceStatPair
          empty={headline ? null : isDefault ? 'No Price Yet' : 'No Sales'}
          stats={[
            { label: 'Market', value: marketLabel ?? headline, color: '#7EE0A6' },
            { label: 'Cheapest', value: headline },
          ]}
        />
      }
      overlay={
        hasMutations ? (
          <CardPickerOverlay
            open={pickerOpen}
            title="Choose Mutation"
            onClose={() => setPickerOpen(false)}
          >
            <div className="flex flex-1 flex-col gap-1 overflow-y-auto [scrollbar-width:thin]">
              {mutations.map((m) => {
                const mv = mutationVisual(m.slug)
                const active = m.slug === selected?.slug
                return (
                  <button
                    key={m.slug}
                    type="button"
                    aria-pressed={active}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setSelectedSlug(m.slug)
                      setPickerOpen(false)
                    }}
                    className={`flex shrink-0 items-center gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                      active ? '' : 'bg-white/[0.03] hover:bg-white/[0.07]'
                    }`}
                    style={active ? { backgroundColor: mv.soft } : undefined}
                  >
                    <MutationDot visual={mv} size={9} />
                    <span
                      className={`truncate text-[12px] font-medium ${active ? '' : 'text-text-secondary'}`}
                      style={active ? { color: mv.color } : undefined}
                    >
                      {m.name}
                    </span>
                  </button>
                )
              })}
            </div>
          </CardPickerOverlay>
        ) : undefined
      }
    />
  )
}
