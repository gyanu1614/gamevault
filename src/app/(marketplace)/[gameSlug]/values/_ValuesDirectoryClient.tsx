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

const rarityMeta = (r: string) => sharedRarityMeta('steal-a-brainrot', r)
/** Rarest first — the order players think in, not alphabetical. */
const RARITY_ORDER = SAB_RARITIES.map((r) => r.key)

/**
 * Popular is an ORDERING, not a cut: the list stays complete and simply runs
 * most-traded first, so page 1 is the top 24 by popularity and paging carries
 * on down the same ranking to the end of the catalog.
 */

/**
 * One mutation option for the in-card switcher. Prices are the REAL reputable
 * cheapest/average for that mutation (null → the card shows "No Sales"; we never
 * estimate). `income` is that mutation's income per second, `multiplier` its
 * income multiplier vs default.
 */
export type CardMutation = {
  slug: string
  name: string
  multiplier: number | null
  income: number | null
  cheapest_usd: number | null
  average_usd: number | null
}

export type BrainrotDirectoryItem = {
  id: string
  name: string
  slug: string
  rarity: string
  obtainability: string
  base_income_per_second: number | string | null
  image_url: string | null
  display_price_usd: number | string | null
  display_price_label: string
  display_price_source: string
  confidence_label: string
  /** Every mutation this item has metadata for, with real per-mutation prices
   * (absent/null = no sales). Drives the in-card mutation switcher. */
  mutations?: CardMutation[]
  /**
   * Low/high of the real listings behind the value. Retained for items not yet
   * priced by the reputable path (fallback range display).
   */
  market_low_usd?: number | null
  market_high_usd?: number | null
  /**
   * Reputable-seller prices: cheapest (lowest 100+ review listing) and average
   * (typical reputable price). When present these are the buyer-facing pair —
   * the row shows "Cheapest $X" and the headline "Market price" is the average.
   */
  cheapest_usd?: number | null
  average_usd?: number | null
  /**
   * Listings/sales we actually observed behind this item's price. Legacy
   * popularity proxy — kept as the tiebreaker; the primary Popular ordering is
   * now popularity_rank.
   */
  sample_size?: number | null
  /**
   * Real marketplace popularity rank (1 = most popular), from Eldorado's
   * usePopularItems ordering. The Popular tab sorts by this; null-rank items
   * (never seen in the popular feed) sort after all ranked items.
   */
  popularity_rank?: number | null
}

type SortOption = 'value-desc' | 'name' | 'income-desc' | 'income-asc'

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'value-desc', label: 'Highest Value' },
  { value: 'name', label: 'Name A–Z' },
  { value: 'income-desc', label: 'Highest Income' },
  { value: 'income-asc', label: 'Lowest Income' },
]

/** 'popular' | 'all' | a rarity name. Exactly one is ever active. */
type View = string

interface ValuesDirectoryClientProps {
  brainrots: BrainrotDirectoryItem[]
}

function asNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

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

function compareIncome(
  a: BrainrotDirectoryItem,
  b: BrainrotDirectoryItem,
  direction: 'asc' | 'desc',
): number {
  const aIncome = asNumber(a.base_income_per_second)
  const bIncome = asNumber(b.base_income_per_second)

  if (aIncome == null && bIncome == null) return a.name.localeCompare(b.name)
  if (aIncome == null) return 1
  if (bIncome == null) return -1

  return direction === 'asc' ? aIncome - bIncome : bIncome - aIncome
}

/** Highest value first, unpriced items last (never sorted as if they were $0). */
function compareValue(a: BrainrotDirectoryItem, b: BrainrotDirectoryItem): number {
  const av = asNumber(a.display_price_usd)
  const bv = asNumber(b.display_price_usd)
  if (av == null && bv == null) return a.name.localeCompare(b.name)
  if (av == null) return 1
  if (bv == null) return -1
  return bv - av
}

/**
 * `useSearchParams` requires a Suspense boundary (Next.js). The default export
 * wraps the inner component so the value page can render it directly, matching
 * the pattern used by _BrowseClient.
 */
export default function ValuesDirectoryClient(props: ValuesDirectoryClientProps) {
  return (
    <Suspense fallback={null}>
      <ValuesDirectoryClientInner {...props} />
    </Suspense>
  )
}

function ValuesDirectoryClientInner({
  brainrots,
}: ValuesDirectoryClientProps) {
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
  const rarities = useMemo(() => {
    const present = new Set(brainrots.map((b) => b.rarity).filter(Boolean))
    const known = RARITY_ORDER.filter((r) => present.has(r))
    const unknown = [...present].filter((r) => !RARITY_ORDER.includes(r)).sort()
    return [...known, ...unknown]
  }, [brainrots])

  // Per-rarity counts for the tiles (Secret 42, Mythic 11…).
  const rarityCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const b of brainrots) m[b.rarity] = (m[b.rarity] ?? 0) + 1
    return m
  }, [brainrots])

  const obtainabilityOptions = useMemo(
    () =>
      Array.from(
        new Set(brainrots.map((brainrot) => brainrot.obtainability).filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b)),
    [brainrots],
  )

  // 24 = a multiple of every grid width (2/3/4/6), so the last row of the card
  // grid always fills evenly instead of stranding one card on its own row.
  const PAGE_SIZE = 24
  const searching = query.trim().length > 0
  // A search should look through everything, not just the 10 popular rows —
  // otherwise searching from the landing view mostly returns nothing.
  const effectiveView = searching && view === 'popular' ? 'all' : view

  const filteredBrainrots = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    const filtered = brainrots.filter((brainrot) => {
      const matchesQuery =
        !normalizedQuery ||
        `${brainrot.name} ${brainrot.rarity} ${brainrot.obtainability}`
          .toLowerCase()
          .includes(normalizedQuery)

      const matchesRarity =
        effectiveView === 'popular' ||
        effectiveView === 'all' ||
        brainrot.rarity === effectiveView

      const matchesObtainability =
        obtainability === 'all' || brainrot.obtainability === obtainability

      return matchesQuery && matchesRarity && matchesObtainability
    })

    // Popular = a BLEND of real marketplace popularity AND cash value, so the
    // tab surfaces items that are both traded a lot AND worth something — not
    // popular-but-worthless junk. We rank each item on both axes independently
    // (popularity_rank from Eldorado's usePopularItems; value rank from the
    // corrected market price) and sort by the AVERAGE of the two rank positions.
    // An item strong on both (e.g. #4 popular, #6 valuable) beats one that is
    // wildly popular but near-worthless (#2 popular, #300 valuable). Items
    // missing a rank on either axis take that axis's worst position, so they
    // sink behind anything ranked on both.
    if (effectiveView === 'popular') {
      const n = filtered.length
      // Value rank: 0 = most valuable. Unpriced items get the worst position.
      const byValue = [...filtered].sort(compareValue)
      const valueRank = new Map<string, number>()
      byValue.forEach((item, i) => valueRank.set(item.id, i))

      // Popularity rank: Eldorado's is 1-based and sparse (not every item is in
      // the feed). Rerank the ones that ARE present into a dense 0-based order,
      // so the two axes are on the same scale; absent items take the worst.
      const byPop = [...filtered]
        .filter((item) => item.popularity_rank != null)
        .sort((a, b) => (a.popularity_rank as number) - (b.popularity_rank as number))
      const popRank = new Map<string, number>()
      byPop.forEach((item, i) => popRank.set(item.id, i))

      const blended = (item: BrainrotDirectoryItem) => {
        const pr = popRank.has(item.id) ? popRank.get(item.id)! : n
        const vr = valueRank.has(item.id) ? valueRank.get(item.id)! : n
        return (pr + vr) / 2
      }

      return [...filtered].sort((a, b) => {
        const diff = blended(a) - blended(b)
        if (diff !== 0) return diff
        // Tie-break: more observed activity, then higher value.
        const act = (asNumber(b.sample_size) ?? 0) - (asNumber(a.sample_size) ?? 0)
        return act !== 0 ? act : compareValue(a, b)
      })
    }

    return [...filtered].sort((a, b) => {
      if (sort === 'income-desc') return compareIncome(a, b, 'desc')
      if (sort === 'income-asc') return compareIncome(a, b, 'asc')
      if (sort === 'name') return a.name.localeCompare(b.name)
      return compareValue(a, b)
    })
  }, [brainrots, effectiveView, obtainability, query, sort])

  const totalPages = Math.max(1, Math.ceil(filteredBrainrots.length / PAGE_SIZE))
  const [page, setPage] = useState(() => {
    const p = Number(searchParams.get('page'))
    return Number.isInteger(p) && p > 0 ? p : 1
  })

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
    () => filteredBrainrots.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filteredBrainrots, currentPage],
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
    { key: 'all', label: 'All', color: '#9AA6A0', count: brainrots.length },
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
            it — hidden in that view rather than shown doing nothing. */}
        {effectiveView !== 'popular' ? (
          <div className="w-full shrink-0 sm:w-52">
            <ValueSelect
              value={sort}
              onChange={setSort}
              options={SORT_OPTIONS}
              label="Sort Brainrots"
              icon={<SortAscendingIcon size={16} weight="bold" />}
            />
          </div>
        ) : (
          /* Desktop only: on a phone this note landed as its own orphan line
             between the filters and the tiles, and the Popular tile already
             says what the ordering is. */
          <p className="hidden h-12 w-52 shrink-0 items-center text-[12.5px] leading-snug text-text-tertiary sm:flex">
            Popular blends marketplace demand with cash value
          </p>
        )}
      </div>

      <div className="mt-2">
        <RarityFilterBar options={rarityOptions} value={view} onChange={setView} />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-text-secondary">
          Showing{' '}
          <span className="font-semibold tabular-nums text-text-primary">
            {filteredBrainrots.length === 0
              ? '0'
              : `${((currentPage - 1) * PAGE_SIZE + 1).toLocaleString()}–${Math.min(
                  currentPage * PAGE_SIZE,
                  filteredBrainrots.length,
                ).toLocaleString()}`}
          </span>{' '}
          of <span className="tabular-nums">{filteredBrainrots.length.toLocaleString()}</span>{' '}
          Brainrots
          {/* Trust line, inline on the results row. */}
          <span className="ml-2.5 hidden items-center gap-1.5 align-middle sm:inline-flex">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#4FB477]" />
            <span className="text-[12px] font-medium text-text-tertiary">Priced From Real Sales</span>
          </span>
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

      {visibleBrainrots.length === 0 ? (
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
          <div className="flex h-9 items-center justify-center text-[12px] font-medium text-text-disabled">
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
