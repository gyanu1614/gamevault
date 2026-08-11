'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import CheckIcon from '@mui/icons-material/Check'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import type { CSSProperties } from 'react'
import { mutationVisual } from '@/lib/sab/mutations'
import { MutationDot } from '@/lib/sab/MutationDot'
import { formatIncome } from '@/lib/sab/format'

/**
 * Rarity → accent colour. Drives both the rarity filter chips and each row's
 * rarity tag, so a rarity reads the same colour everywhere on the page.
 *
 * All eight rarities that actually exist in the catalog are covered — the map
 * used to hold five, which silently fell back to green for Brainrot God,
 * Common and OG.
 */
const RARITY_COLORS: Record<string, string> = {
  Secret: '#E23B4E',
  'Brainrot God': '#FF8A3D',
  Mythic: '#A98BFF',
  Legendary: '#F5C542',
  Epic: '#7FE3F0',
  Rare: '#4FB477',
  Common: '#9BA8A0',
  OG: '#E7C6FF',
}

/** Rarest first — the order players think in, not alphabetical. */
const RARITY_ORDER = [
  'Secret',
  'Brainrot God',
  'Mythic',
  'Legendary',
  'Epic',
  'Rare',
  'Common',
  'OG',
]

/** One class for every column header, so they can never drift apart. */
function rarityColor(rarity: string): string {
  return RARITY_COLORS[rarity] ?? '#4FB477'
}

/**
 * Popular is an ORDERING, not a cut: the list stays complete and simply runs
 * most-traded first, so page 1 is the top 25 by popularity and paging carries
 * on down the same ranking to the end of the catalog.
 */

/**
 * Themed dropdown — replaces native <select> (whose open menu can't be styled
 * and clashed with the forest theme). Button + absolute forest-dark menu.
 */
function Dropdown({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  ariaLabel: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = options.find((o) => o.value === value)?.label ?? options[0]?.label

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 w-full items-center justify-between gap-2 border border-[#1E2723] bg-[#111613] px-3.5 text-sm text-[#F1F3F1] outline-none transition hover:border-[#2A3A31] focus:border-[#2E5B44]"
      >
        <span className="truncate">{current}</span>
        <KeyboardArrowDownIcon
          sx={{ fontSize: 18 }}
          className={`shrink-0 text-[#6D7A72] transition ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute z-30 mt-1.5 max-h-72 w-full overflow-auto border border-[#1E2723] bg-[#0E1211] p-1 shadow-[0_16px_40px_-16px_rgba(0,0,0,0.9)]"
        >
          {options.map((o) => {
            const active = o.value === value
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(o.value)
                  setOpen(false)
                }}
                className={`flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left text-sm transition ${
                  active
                    ? 'bg-[#15402A] text-[#EDF3E9]'
                    : 'text-[#C6CEC9] hover:bg-white/[0.04]'
                }`}
              >
                <span className="truncate">{o.label}</span>
                {active && <CheckIcon sx={{ fontSize: 16 }} className="shrink-0 text-[#4FB477]" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

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

/**
 * The real-listings range shown under the value as a trust signal. Returns null
 * unless the high is meaningfully above the value (a range that collapses to the
 * value itself proves nothing, so we show nothing rather than "$X – $X"). The
 * low is the value (our floor), so the range reads "value – high".
 */
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

  // Only rarities present in the data get a chip, in rarest-first order.
  const rarities = useMemo(() => {
    const present = new Set(brainrots.map((b) => b.rarity).filter(Boolean))
    const known = RARITY_ORDER.filter((r) => present.has(r))
    const unknown = [...present].filter((r) => !RARITY_ORDER.includes(r)).sort()
    return [...known, ...unknown]
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

  return (
    <>
      {/* ── Search + secondary controls ── */}
      <div className="grid gap-3 sm:grid-cols-[minmax(240px,1fr)_200px_190px]">
        <label className="relative block">
          <span className="sr-only">Search Brainrots</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6D7A72]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search Brainrot name, rarity..."
            className="h-11 w-full border border-[#1E2723] bg-[#111613] pl-10 pr-4 text-base text-[#F1F3F1] outline-none transition placeholder:text-[#6D7A72] focus:border-[#2E5B44] sm:text-sm"
          />
        </label>

        <Dropdown
          ariaLabel="Filter by obtainability"
          value={obtainability}
          onChange={setObtainability}
          options={[
            { value: 'all', label: 'All obtainability' },
            ...obtainabilityOptions.map((o) => ({ value: o, label: o })),
          ]}
        />

        {/* Popular is itself an ordering, so the sort control would contradict
            it — hidden in that view rather than shown doing nothing. */}
        {effectiveView !== 'popular' ? (
          <Dropdown
            ariaLabel="Sort Brainrots"
            value={sort}
            onChange={(v) => setSort(v as SortOption)}
            options={[
              { value: 'value-desc', label: 'Highest value' },
              { value: 'name', label: 'Name A–Z' },
              { value: 'income-desc', label: 'Highest income' },
              { value: 'income-asc', label: 'Lowest income' },
            ]}
          />
        ) : (
          /* Desktop only: on a phone this note landed as its own orphan line
             between the filters and the chips, and the Popular chip already
             says what the ordering is. */
          <p className="hidden h-11 items-center text-[12.5px] leading-snug text-[#6D7A72] sm:flex">
            Popular blends marketplace demand with cash value
          </p>
        )}
      </div>

      {/* ── Rarity chips — one row, single-select, full width ──
          Sits under the search row. `flex-nowrap` + horizontal scroll keeps it
          to a single line at every width — on a phone it scrolls instead of
          wrapping to a second row. From sm up each chip is `flex-1`, so the row
          spans the full width of the list below it rather than stopping ~2/3
          across, and the chips read as one segmented control. */}
      <div className="mt-3 flex flex-nowrap items-stretch gap-2 overflow-x-auto pb-1 sm:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => setView('popular')}
          aria-pressed={view === 'popular'}
          className={`flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap px-3.5 py-2.5 text-[13px] font-semibold transition sm:flex-1 sm:shrink ${
            view === 'popular'
              ? 'bg-[#3FA35C] text-[#08110B]'
              : 'border border-[#2F6B46] text-[#8FBF9C] hover:bg-[#4FB477]/10'
          }`}
        >
          <span
            aria-hidden
            className={`h-1.5 w-1.5 ${view === 'popular' ? 'bg-[#08110B]' : 'bg-[#4FB477]'}`}
          />
          Popular
        </button>

        <button
          type="button"
          onClick={() => setView('all')}
          aria-pressed={view === 'all'}
          className={`shrink-0 whitespace-nowrap px-3.5 py-2.5 text-[13px] font-semibold transition sm:flex-1 sm:shrink ${
            view === 'all'
              ? 'bg-[#E8EDE9] text-[#0C0F0E]'
              : 'border border-[#26332C] text-[#C6CEC9] hover:border-[#3A4A40]'
          }`}
        >
          All {brainrots.length}
        </button>

        {rarities.map((r) => {
          const active = view === r
          const rc = rarityColor(r)
          return (
            <button
              key={r}
              type="button"
              onClick={() => setView(r)}
              aria-pressed={active}
              // Each chip carries its own rarity colour: filled when selected,
              // hairline + coloured label when not.
              style={
                active
                  ? { backgroundColor: rc, color: '#0B0F0C', borderColor: rc }
                  : { borderColor: `${rc}59`, color: rc }
              }
              className="shrink-0 whitespace-nowrap border px-3.5 py-2.5 text-[13px] font-semibold transition hover:brightness-110 sm:flex-1 sm:shrink"
            >
              {r}
            </button>
          )
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-[#9BA8A0]">
          Showing{' '}
          <span className="font-semibold tabular-nums text-[#F1F3F1]">
            {filteredBrainrots.length === 0
              ? '0'
              : `${((currentPage - 1) * PAGE_SIZE + 1).toLocaleString()}–${Math.min(
                  currentPage * PAGE_SIZE,
                  filteredBrainrots.length,
                ).toLocaleString()}`}
          </span>{' '}
          of <span className="tabular-nums">{filteredBrainrots.length.toLocaleString()}</span>{' '}
          Brainrots
          {/* Trust line, inline — it used to be a badge on its own row above
              the title, costing a full line of vertical space for six words. */}
          <span className="ml-2.5 hidden items-center gap-1.5 align-middle sm:inline-flex">
            <span aria-hidden className="h-1.5 w-1.5 animate-pulse bg-[#3FA35C]" />
            <span className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-[#8FBF9C]">
              Priced from real sales
            </span>
          </span>
        </p>

        {filtersActive && (
          <button
            type="button"
            onClick={resetFilters}
            className="font-semibold text-[#4FB477] transition hover:opacity-80"
          >
            Reset filters
          </button>
        )}
      </div>

      {visibleBrainrots.length === 0 ? (
        <div className="mt-6 border border-[#1E2723] bg-[#121613] px-6 py-12 text-center">
          <h2 className="text-xl font-semibold text-[#F1F3F1]">No Brainrots found</h2>
          <p className="mt-2 text-[#9BA8A0]">Try changing the search or filters.</p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-5 bg-[#1B6B3F] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#1f7a48]"
          >
            Clear filters
          </button>
        </div>
      ) : (
        /* Card grid — a full-width row per item wasted most of the width with
           only 3-4 fields to fill. Compact cards read better and pack more per
           screen: image + name + rarity, then a two-column Market / Cheapest
           split. Responsive: 2 (mobile) → 3 (tablet) → 4 → 6 (widescreen). */
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {visibleBrainrots.map((brainrot) => (
            <BrainrotCard key={brainrot.id} brainrot={brainrot} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-1.5">
          <button
            type="button"
            onClick={() => goToPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="flex h-9 items-center gap-1 border border-[#26332C] bg-white/[0.03] px-3 text-sm font-semibold text-[#C6CEC9] transition enabled:hover:border-[#2A3A31] enabled:hover:bg-white/[0.06] disabled:opacity-40"
          >
            <ChevronLeftIcon sx={{ fontSize: 18 }} />
            Prev
          </button>
          {pageNumbers(currentPage, totalPages).map((n, i) =>
            n === '…' ? (
              <span key={`gap-${i}`} className="px-1.5 text-sm text-[#6D7A72]">
                …
              </span>
            ) : (
              <button
                key={n}
                type="button"
                onClick={() => goToPage(n as number)}
                aria-current={n === currentPage ? 'page' : undefined}
                className={`h-9 min-w-9 px-2 text-sm font-semibold tabular-nums transition ${
                  n === currentPage
                    ? 'bg-[#1B6B3F] text-white'
                    : 'border border-[#26332C] bg-white/[0.03] text-[#C6CEC9] hover:border-[#2A3A31] hover:bg-white/[0.06]'
                }`}
              >
                {n}
              </button>
            ),
          )}
          <button
            type="button"
            onClick={() => goToPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="flex h-9 items-center gap-1 border border-[#26332C] bg-white/[0.03] px-3 text-sm font-semibold text-[#C6CEC9] transition enabled:hover:border-[#2A3A31] enabled:hover:bg-white/[0.06] disabled:opacity-40"
          >
            Next
            <ChevronRightIcon sx={{ fontSize: 18 }} />
          </button>
        </div>
      )}
    </>
  )
}

/**
 * Grid card (design 1a). Leads with the DEFAULT mutation's cheapest, but lets the
 * user switch mutation INSIDE the card via a chip → overlay picker; the income,
 * Market and Cheapest numbers then recompute for the selected mutation from REAL
 * per-mutation prices (never estimates — a mutation with no sale shows "No Sales").
 * The card body is the link; the mutation chip + overlay stop propagation so only
 * clicking the art/name navigates (carrying ?mutation= so the item page matches).
 */
function BrainrotCard({ brainrot }: { brainrot: BrainrotDirectoryItem }) {
  const rc = rarityColor(brainrot.rarity)
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
  // The chip names the SELECTED mutation; for default it reads "Default" (not a
  // generic "Mutation" prompt), so the card always states which variant it shows.
  const chipLabel = isDefault ? 'Default' : selected!.name
  const marketLabel = formatMoney(marketUsd)

  return (
    <div
      style={{ ['--rc' as string]: rc } as CSSProperties}
      className="group relative flex flex-col overflow-hidden border border-[#1E2723] bg-gradient-to-b from-[#14181A] to-[#0B0D0E] transition-colors hover:border-[#2C3A31]"
    >
      {/* ── Top row: mutation chip (left) · rarity (right), then a grey divider.
          No colored fill — a defined header band on the plain card surface, with
          a hairline separating it from the art below. ── */}
      <div className="flex items-center justify-between gap-2 border-b border-[#1E2723] px-2.5 py-2">
        {hasMutations ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setPickerOpen((o) => !o)
            }}
            aria-label="Choose mutation"
            className="inline-flex min-w-0 items-center gap-1 border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] transition hover:brightness-125"
            style={
              isDefault
                ? { color: '#8C98A4', borderColor: '#2A3138', backgroundColor: 'transparent' }
                : { color: visual.color, borderColor: visual.color, backgroundColor: visual.soft }
            }
          >
            <span className="truncate">{chipLabel}</span>
            <span className="opacity-60">▾</span>
          </button>
        ) : (
          <span className="min-w-0 truncate text-[10px] font-medium uppercase tracking-[0.1em] text-[#5E685E]">
            No mutations
          </span>
        )}
        <span
          className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: rc }}
        >
          {brainrot.rarity}
        </span>
      </div>

      {/* Card body is the link — art + name + income. */}
      <Link href={href} className="flex flex-1 flex-col">
        {/* Art on a mutation-tinted radial glow. */}
        <div
          className="relative flex h-[118px] items-center justify-center px-3"
          style={{
            background: isDefault
              ? 'radial-gradient(120% 100% at 50% 8%, color-mix(in srgb, var(--rc) 12%, transparent), transparent 70%)'
              : `radial-gradient(120% 100% at 50% 8%, ${visual.color}33, transparent 70%)`,
          }}
        >
          {brainrot.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={brainrot.image_url}
              alt={`${brainrot.name} Steal a Brainrot`}
              loading="lazy"
              className="h-[92px] w-[92px] object-contain drop-shadow-[0_8px_14px_rgba(0,0,0,0.5)] [image-rendering:pixelated]"
            />
          ) : (
            <span className="font-mono text-[9px] text-[#5E685E]">N/A</span>
          )}
        </div>

        {/* Name + income (M/s). */}
        <div className="px-2.5 pb-2.5 pt-1 text-center">
          <div className="truncate text-[14px] font-bold leading-tight text-[#F1F3F1] transition-colors group-hover:text-white">
            {brainrot.name}
          </div>
          {income && (
            <div className="mt-1 font-mono text-[11px] font-semibold text-[#7EE0A6]">
              {income}
            </div>
          )}
        </div>
      </Link>

      {/* ── Price footer: MARKET | CHEAPEST split by a vertical divider, matching
          the design. Recomputes with the selected mutation. ── */}
      <Link href={href} className="mt-auto block">
        {headline ? (
          <div className="flex border-t border-[#1A211A]">
            <div className="flex-1 border-r border-[#1A211A] px-1.5 py-2.5 text-center">
              <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#5D6670]">
                Market
              </div>
              <div className="mt-1 truncate font-mono text-[16px] font-bold tabular-nums text-[#7EE0A6]">
                {marketLabel ?? headline}
              </div>
            </div>
            <div className="flex-1 px-1.5 py-2.5 text-center">
              <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#5D6670]">
                Cheapest
              </div>
              <div className="mt-1 truncate font-mono text-[16px] font-bold tabular-nums text-[#E9EDF2]">
                {headline}
              </div>
            </div>
          </div>
        ) : (
          <div className="border-t border-[#1A211A] px-1.5 py-3.5 text-center">
            <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#5E685E]">
              {isDefault ? 'No price yet' : 'No Sales'}
            </div>
          </div>
        )}
      </Link>

      {/* In-card mutation picker overlay — covers the whole card. */}
      {pickerOpen && (
        <div className="absolute inset-0 z-30 flex flex-col bg-[#060809]/[0.97] p-3">
          <div className="mb-2 flex shrink-0 items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#8C98A4]">
              Mutation
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setPickerOpen(false)
              }}
              aria-label="Close mutation picker"
              className="-mr-1 -mt-1 px-1 text-[14px] leading-none text-[#8C98A4] transition hover:text-white"
            >
              ✕
            </button>
          </div>
          <div className="flex flex-1 flex-col gap-1 overflow-y-auto [scrollbar-width:thin]">
            {mutations.map((m) => {
              const mv = mutationVisual(m.slug)
              const active = m.slug === selected?.slug
              return (
                <button
                  key={m.slug}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setSelectedSlug(m.slug)
                    setPickerOpen(false)
                  }}
                  className="flex items-center gap-2 border px-2.5 py-1.5 text-left transition hover:border-[#40484F]"
                  style={
                    active
                      ? { backgroundColor: mv.soft, borderColor: mv.color }
                      : { backgroundColor: '#12171A', borderColor: '#232A2F' }
                  }
                >
                  <MutationDot visual={mv} size={9} />
                  <span
                    className="truncate text-[12px] font-medium"
                    style={{ color: active ? mv.color : '#C3CCD4' }}
                  >
                    {m.name}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// Compact page list with ellipses, e.g. [1, …, 4, 5, 6, …, 9].
function pageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | '…')[] = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  if (start > 2) pages.push('…')
  for (let i = start; i <= end; i += 1) pages.push(i)
  if (end < total - 1) pages.push('…')
  pages.push(total)
  return pages
}
