'use client'

/**
 * Adopt Me value list — the dual-axis pillar page.
 *
 * NOT a fork of the SAB directory client (Adopt Me's economy is different: no
 * income/s, no "mutations" — the price dimension is the 8-form potion/Neon
 * ladder chosen with a VARIANT SELECTOR that reprices the whole table). But it
 * matches SAB's professional list treatment: 64px framed art with a
 * rarity-tinted hover glow, a proper multi-column row, mono numerics, and the
 * same type scale — so the two hubs read as one product.
 *
 * Every row shows BOTH numbers — community trade value and DropMarket cash
 * (USD). Cash is an estimate today (no Adopt Me sales yet) and is visibly
 * marked, never dressed up as observed.
 */

import type { CSSProperties } from 'react'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import SearchIcon from '@mui/icons-material/Search'
import SwapVertIcon from '@mui/icons-material/SwapVert'
import CheckIcon from '@mui/icons-material/Check'
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import { AnimatePresence, motion } from 'framer-motion'
import { MARKET_CARD, MARKET_CARD_HOVER } from '@/lib/ui/surfaces'
import { variantColor } from './[itemSlug]/_adoptMeVariantColor'
import { CompactVariantPicker } from './_CompactVariantPicker'

/* ── Rarity → accent. Adopt Me's five tiers only. ─────────────────────────── */
const RARITY_META: Record<string, { label: string; color: string }> = {
  legendary: { label: 'Legendary', color: '#F5C542' },
  ultra_rare: { label: 'Ultra-Rare', color: '#B07BC9' },
  rare: { label: 'Rare', color: '#4FB477' },
  uncommon: { label: 'Uncommon', color: '#7FE3F0' },
  common: { label: 'Common', color: '#9BA8A0' },
}
const RARITY_ORDER = ['legendary', 'ultra_rare', 'rare', 'uncommon', 'common']

/* ── The 8-variant ladder. FR is the default (trading benchmark). ─────────── */
const VARIANTS = ['N', 'F', 'R', 'FR', 'NEON', 'NFR', 'MEGA', 'MFR'] as const
type Variant = (typeof VARIANTS)[number]
const VARIANT_LABEL: Record<Variant, string> = {
  N: 'Normal',
  F: 'Fly',
  R: 'Ride',
  FR: 'Fly Ride',
  NEON: 'Neon',
  NFR: 'Neon Fly Ride',
  MEGA: 'Mega Neon',
  MFR: 'Mega Fly Ride',
}

/* ── Data shape passed from the server ────────────────────────────────────── */
export interface AdoptMeVariantValue {
  variant: Variant
  tradeValue: number | null
  /** Headline cash = reputable market (average) when present, else legacy value. */
  cashUsd: number | null
  /** Lowest reputable-seller price (100+ reviews). Null until priced. */
  cheapestUsd: number | null
  /** Reputable market price (median of cheapest reputable listings). */
  averageUsd: number | null
  isEstimated: boolean
  confidence: string
}
export interface AdoptMePetItem {
  slug: string
  name: string
  rarity: string
  imageUrl: string | null
  topTradeValue: number
  /** Market demand rank (1 = most in-demand). Drives the Popular ordering;
   *  null-rank pets sort after ranked ones. */
  demandRank: number | null
  /** True when a /adopt-me/values/{slug} page exists — only then is the row a link. */
  hasPage: boolean
  values: Record<Variant, AdoptMeVariantValue | undefined>
}

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const TRADE = new Intl.NumberFormat('en-US')

/** Show the "typically ~$X" market line only when market exceeds cheapest by
 * this multiple; matches the SAB cards (≥25% step, else cheapest alone). */
const MARKET_SECONDARY_GAP = 1.25

function rarityMeta(r: string) {
  return RARITY_META[r] ?? { label: r, color: '#9BA8A0' }
}

/** Toolbar controls: fill-only (no resting border), neutral focus ring. */
const FIELD_CLS =
  'rounded-md border border-transparent bg-bg-overlay text-text-primary outline-none transition-colors ' +
  'hover:border-white/[0.08] focus-visible:border-focus-border focus-visible:ring-2 focus-visible:ring-focus-soft'

/** Dropdown panel: raised card, no outline (card-surface system). */
const PANEL_CLS =
  'absolute right-0 z-30 mt-1.5 w-full rounded-lg bg-bg-raised shadow-[0_18px_40px_-14px_rgba(0,0,0,0.75)]'

const POPULAR_COUNT = 12
const PAGE_SIZE = 25

type View = 'popular' | 'all' | string
type Sort =
  | 'value-desc'
  | 'value-asc'
  | 'cash-desc'
  | 'cash-asc'
  | 'name'

const SORT_OPTIONS: { value: Sort; label: string }[] = [
  { value: 'value-desc', label: 'Highest Trade Value' },
  { value: 'value-asc', label: 'Lowest Trade Value' },
  { value: 'cash-desc', label: 'Highest Cash Price' },
  { value: 'cash-asc', label: 'Lowest Cash Price' },
  { value: 'name', label: 'Name (A–Z)' },
]

/** Confidence → label + colour. Matches SAB's "price accuracy" treatment. */
function ConfidenceText({ confidence, hasCash }: { confidence: string; hasCash: boolean }) {
  // No real cash price → we're showing the community trade-points value, not a
  // derived dollar estimate. Say "Trade value only" rather than a cash-accuracy
  // grade that doesn't apply.
  if (!hasCash) {
    return <span className="text-[13px] text-[#8B978F]">Trade value only</span>
  }
  const map: Record<string, { label: string; color: string }> = {
    highly_accurate: { label: 'Highly Accurate', color: '#8FBF9C' },
    high: { label: 'High Confidence', color: '#8FBF9C' },
    medium: { label: 'Medium Confidence', color: '#E0B155' },
    low: { label: 'Low Confidence', color: '#9BA8A0' },
  }
  const c = map[confidence] ?? map.low
  return (
    <span className="text-[13px] font-semibold" style={{ color: c.color }}>
      {c.label}
    </span>
  )
}

/**
 * One segment of the rarity control (Option B). Each segment carries a DIMMED
 * tint of its rarity colour at rest (so the bar reads as coloured tiles), and
 * fills to the solid rarity colour with dark text when selected. `color` is the
 * rarity accent; hover lifts the dim tint slightly.
 */
function SegBtn({
  active,
  color,
  onClick,
  children,
}: {
  active: boolean
  color: string
  onClick: () => void
  children: React.ReactNode
}) {
  const style: CSSProperties = active
    ? { backgroundColor: color, color: '#0B0810' }
    : {
        // ~14% rarity tint on the near-black ground, text in the rarity colour.
        backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
        color: `color-mix(in srgb, ${color} 78%, #E6EAE7)`,
      }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`group/seg flex flex-1 items-center justify-center whitespace-nowrap rounded-md px-3.5 py-2.5 text-body-sm font-semibold transition-[filter,transform] active:scale-[0.98] ${
        active ? '' : 'hover:brightness-125'
      }`}
      style={style}
    >
      {children}
    </button>
  )
}

/** Count beside a segment label — dims within the tile (ink on active fill). */
function Count({ active, children }: { active: boolean; children: React.ReactNode }) {
  return <span className={active ? 'text-[#0C0F0E]/55' : 'opacity-60'}>{children}</span>
}

// useSearchParams() requires a Suspense boundary; the wrapper provides it so the
// page can render this client directly (mirrors SAB's ValuesDirectoryClient).
export default function AdoptMeValuesClient({ pets }: { pets: AdoptMePetItem[] }) {
  return (
    <Suspense fallback={null}>
      <AdoptMeValuesClientInner pets={pets} />
    </Suspense>
  )
}

function AdoptMeValuesClientInner({ pets }: { pets: AdoptMePetItem[] }) {
  // Filters live in the URL so they SURVIVE navigation: tap a pet, hit Back, and
  // the same variant/search/view/sort/page is restored (and the view is
  // shareable/bookmarkable). Seeded from the query params on mount; a sync effect
  // mirrors changes back via replace(). Matches SAB's directory client exactly.
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [variant, setVariant] = useState<Variant>(
    () => (searchParams.get('variant') as Variant) ?? 'FR',
  )
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '')
  const [view, setView] = useState<View>(
    () => (searchParams.get('view') as View) ?? 'popular',
  )
  const [sort, setSort] = useState<Sort>(
    () => (searchParams.get('sort') as Sort) ?? 'value-desc',
  )
  const [page, setPage] = useState(() => {
    const p = Number(searchParams.get('page'))
    return Number.isInteger(p) && p > 0 ? p : 1
  })

  // Demand-first ordering: lower demand_rank = more popular (rank 1 first);
  // null-rank pets fall to the end, tiebroken by top trade value. This is the
  // Popular ORDERING — Popular is not a 12-item cut, it runs the WHOLE list
  // most-in-demand first and pages through everything (mirrors SAB).
  const byDemand = (a: AdoptMePetItem, b: AdoptMePetItem) => {
    const ar = a.demandRank ?? Infinity
    const br = b.demandRank ?? Infinity
    if (ar !== br) return ar - br
    return b.topTradeValue - a.topTradeValue
  }

  // The top few by demand still get a "Popular" tag on their card.
  const popularSlugs = useMemo(
    () => new Set([...pets].sort(byDemand).slice(0, POPULAR_COUNT).map((p) => p.slug)),
    [pets],
  )

  const raritiesPresent = useMemo(
    () => RARITY_ORDER.filter((r) => pets.some((p) => p.rarity === r)),
    [pets],
  )

  // Per-rarity counts for the tab labels (Legendary 42, Ultra-Rare 11…).
  const rarityCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const p of pets) m[p.rarity] = (m[p.rarity] ?? 0) + 1
    return m
  }, [pets])

  const valueOf = (p: AdoptMePetItem) => p.values[variant]

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    // Popular is an ORDERING, not a filter — it keeps the full list and only
    // changes the sort, so paging carries through every pet. A rarity chip still
    // filters to that rarity; 'all' is the whole list A-Z/by-sort.
    let list = pets.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q)) return false
      if (view === 'popular' || view === 'all') return true
      return p.rarity === view
    })
    list = [...list].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name)
      if (sort === 'cash-desc' || sort === 'cash-asc') {
        // Cheapest is the buyer-facing headline; sort on it, unpriced last.
        const ac = a.values[variant]?.cheapestUsd ?? a.values[variant]?.cashUsd ?? -1
        const bc = b.values[variant]?.cheapestUsd ?? b.values[variant]?.cashUsd ?? -1
        return sort === 'cash-asc' ? ac - bc : bc - ac
      }
      // Default (value-desc) in the Popular view means "most in demand first".
      if (view === 'popular' && sort === 'value-desc') return byDemand(a, b)
      const av = a.values[variant]?.tradeValue ?? -1
      const bv = b.values[variant]?.tradeValue ?? -1
      return sort === 'value-asc' ? av - bv : bv - av
    })
    return list
  }, [pets, query, view, sort, variant])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const resetPage = () => setPage(1)
  // Paging scrolls back to the top so the new page isn't stranded below the
  // pagination bar. Instant for reduced-motion users.
  const goToPage = (next: number) => {
    setPage(next)
    if (typeof window === 'undefined') return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })
  }

  const rangeStart = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(safePage * PAGE_SIZE, filtered.length)

  // Mirror the current variant/filter/sort/page into the URL (replace, so typing
  // doesn't spam history). Because the state lives in the URL, tapping a pet and
  // hitting Back restores exactly this view. Only non-default values are written,
  // keeping the URL clean on the landing view.
  useEffect(() => {
    const params = new URLSearchParams()
    if (variant !== 'FR') params.set('variant', variant)
    if (query.trim()) params.set('q', query.trim())
    if (view !== 'popular') params.set('view', view)
    if (sort !== 'value-desc') params.set('sort', sort)
    if (page > 1) params.set('page', String(page))
    const qs = params.toString()
    if (qs !== searchParams.toString()) {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    }
  }, [variant, query, view, sort, page, pathname, router, searchParams])

  return (
    <div>
      {/* ── Toolbar: search grows, variant + sort compact beside it; rarity
          below as a row of filled tiles (active one solid in its colour). ── */}
      {/* Row 1 — controls */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <span aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary">
            <SearchIcon sx={{ fontSize: 19 }} />
          </span>
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); resetPage() }}
            placeholder="Search a pet by name…"
            aria-label="Search pets"
            className={`h-12 w-full pl-11 pr-3 text-base placeholder:text-text-disabled sm:text-body ${FIELD_CLS}`}
          />
        </div>
        <div className="h-12 w-full shrink-0 sm:w-48">
          <VariantDropdown value={variant} onChange={(v) => setVariant(v)} />
        </div>
        <div className="h-12 w-full shrink-0 sm:w-52">
          <SortDropdown value={sort} onChange={(v) => { setSort(v); resetPage() }} />
        </div>
      </div>

      {/* Row 2 — rarity tiles, stretched FULL WIDTH to match the search row
          (each flex-1). Each is a DIMMED fill in its rarity colour; selecting
          one fills it solid with dark text. No outline; scrolls on mobile. */}
      <div className="mt-2 flex w-full gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <SegBtn active={view === 'popular'} color="#4FB477" onClick={() => { setView('popular'); resetPage() }}>
          Popular
        </SegBtn>
        <SegBtn active={view === 'all'} color="#9AA6A0" onClick={() => { setView('all'); resetPage() }}>
          <span className="inline-flex items-center gap-1.5">
            All
            <Count active={view === 'all'}>{pets.length}</Count>
          </span>
        </SegBtn>
        {raritiesPresent.map((r) => {
          const active = view === r
          return (
            <SegBtn key={r} active={active} color={rarityMeta(r).color} onClick={() => { setView(r); resetPage() }}>
              <span className="inline-flex items-center gap-1.5">
                {rarityMeta(r).label}
                <Count active={active}>{rarityCounts[r] ?? 0}</Count>
              </span>
            </SegBtn>
          )
        })}
      </div>

      {variant !== 'FR' && (
        <p className="mt-2 text-caption text-[#8B978F]">
          Fly Ride (FR) is the standard trading benchmark.
        </p>
      )}

      {/* ── Result count ─────────────────────────────────────────────────── */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-[#9BA8A0]">
          Showing{' '}
          <span className="font-semibold tabular-nums text-[#F1F3F1]">
            {filtered.length === 0 ? '0' : `${rangeStart.toLocaleString()}–${rangeEnd.toLocaleString()}`}
          </span>{' '}
          of <span className="tabular-nums">{filtered.length.toLocaleString()}</span> pets
        </p>
      </div>

      {/* ── Card grid ────────────────────────────────────────────────────── */}
      {visible.length === 0 ? (
        <div className={`mt-6 rounded-lg px-6 py-12 text-center ${MARKET_CARD}`}>
          <h2 className="text-xl font-semibold text-text-primary">No Pets Found</h2>
          <p className="mt-2 text-text-secondary">Try changing the search or filters.</p>
        </div>
      ) : (
        // SAB-style card grid (2→6 across), Adopt-Me-tinted. Each card carries a
        // per-card variant picker that reprices its own footer, independent of
        // the table-wide variant selector. Trade value (gold) + Cheapest (teal)
        // read as the two axes.
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
          {visible.map((p, i) => (
            <PetCard
              key={p.slug}
              pet={p}
              rank={(safePage - 1) * PAGE_SIZE + i + 1}
              isPopular={popularSlugs.has(p.slug)}
              tableVariant={variant}
            />
          ))}
        </div>
      )}


      {/* ── Pagination ───────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-1.5">
          <PageBtn disabled={safePage === 1} onClick={() => goToPage(safePage - 1)}>Prev</PageBtn>
          {pageNumbers(safePage, totalPages).map((n, i) =>
            n === '…' ? (
              <span key={`gap-${i}`} className="px-1.5 text-[13px] text-text-tertiary">…</span>
            ) : (
              <button
                key={n}
                type="button"
                onClick={() => goToPage(n)}
                aria-current={n === safePage ? 'page' : undefined}
                className={`h-9 min-w-[36px] rounded-md px-3 text-[13px] font-semibold tabular-nums transition-colors ${
                  n === safePage
                    ? 'bg-white/[0.12] text-text-primary'
                    : 'bg-bg-raised text-text-secondary hover:bg-bg-raised-hover hover:text-text-primary'
                }`}
              >
                {n}
              </button>
            ),
          )}
          <PageBtn disabled={safePage === totalPages} onClick={() => goToPage(safePage + 1)}>Next</PageBtn>
        </div>
      )}

      {/* ── Disclaimer (structure the brief + data rules require) ─────────── */}
      <p className="mt-8 border-t border-white/[0.07] pt-5 text-[12px] leading-relaxed text-text-tertiary">
        Prices come from active listings by reputable sellers. Bundles, account
        sales and disputed orders are excluded. Cash values marked “Est.” are derived
        from the variant ladder until we hold enough real sales; change indicators
        appear only where we hold enough price history.
      </p>
    </div>
  )
}

/**
 * One value card, on the marketplace card system (MARKET_CARD: near-black
 * gradient, soft drop shadow, NO outline). Header: rank + Popular + rarity.
 * Body: art + name. A flat variant pill (opens the in-card picker) sits above
 * the footer band. Footer: Trade (gold) | Cheapest (teal), the two axes. The
 * card seeds its variant from the table-wide selector but can be repriced on
 * its own; body + footer link to the pet page (only when one exists, so we
 * never 404).
 */
function PetCard({
  pet,
  rank,
  isPopular,
  tableVariant,
}: {
  pet: AdoptMePetItem
  rank: number
  isPopular: boolean
  tableVariant: Variant
}) {
  const [code, setCode] = useState<Variant>(tableVariant)
  const [pickerOpen, setPickerOpen] = useState(false)
  // Follow the table-wide selector when it changes.
  useEffect(() => setCode(tableVariant), [tableVariant])

  const v = pet.values[code]
  const meta = rarityMeta(pet.rarity)
  const c = variantColor(code)
  const cheapest = v?.cheapestUsd ?? v?.cashUsd ?? null
  const showTypical =
    v?.cheapestUsd != null &&
    v?.averageUsd != null &&
    v.averageUsd > v.cheapestUsd * MARKET_SECONDARY_GAP
  const tradeVal = v?.tradeValue ?? null

  const Wrapper: any = pet.hasPage ? 'a' : 'div'
  const wrapperProps = pet.hasPage
    ? {
        href:
          code === 'FR'
            ? `/adopt-me/values/${pet.slug}`
            : `/adopt-me/values/${pet.slug}?variant=${code}`,
      }
    : {}

  return (
    <div
      className={`group relative isolate flex flex-col overflow-hidden rounded-lg ${MARKET_CARD} ${MARKET_CARD_HOVER}`}
    >
      {/* Header: rank + Popular left, rarity right. */}
      <div className="flex items-center justify-between gap-2 px-3 pt-3">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="text-[11px] font-medium tabular-nums text-text-tertiary">#{rank}</span>
          {isPopular && (
            <span className="rounded bg-[#4FB477]/[0.14] px-1.5 py-0.5 text-[10px] font-semibold text-[#6FD495]">
              Popular
            </span>
          )}
        </span>
        <span className="truncate text-[11px] font-semibold" style={{ color: meta.color }}>
          {meta.label}
        </span>
      </div>

      {/* Body (link): art + name. */}
      <Wrapper {...wrapperProps} className="flex flex-1 flex-col">
        <div className="flex h-[112px] items-center justify-center px-3 pt-1">
          {pet.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote pet art
            <img
              src={pet.imageUrl}
              alt={`${pet.name} in Adopt Me`}
              width={96}
              height={96}
              loading="lazy"
              className="h-[96px] w-[96px] object-contain drop-shadow-[0_10px_16px_rgba(0,0,0,0.55)] transition-transform duration-300 ease-out group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            />
          ) : (
            <span className="text-[11px] text-text-disabled">No Image</span>
          )}
        </div>
        <div className="truncate px-3 pb-2.5 pt-1.5 text-center text-[15px] font-medium tracking-[-0.01em] text-text-primary">
          {pet.name}
        </div>
      </Wrapper>

      {/* Variant pill — opens the in-card picker. Flat fill, dot in the
          variant colour, no outline. */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setPickerOpen((o) => !o)
        }}
        aria-label={`Variant: ${VARIANT_LABEL[code]}. Change variant`}
        aria-expanded={pickerOpen}
        className="mx-3 mb-3 flex h-9 items-center justify-center gap-2 rounded-md bg-bg-overlay px-3 text-[13px] font-semibold text-text-primary transition-[background-color,transform] hover:bg-bg-overlay-2 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      >
        <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: c }} />
        <span className="truncate">{VARIANT_LABEL[code]}</span>
        <KeyboardArrowDownRoundedIcon aria-hidden style={{ fontSize: 16 }} className="shrink-0 text-text-tertiary" />
      </button>

      {/* Footer band: Trade (gold) | Cheapest (teal). */}
      <Wrapper {...wrapperProps} className="block">
        <div className="flex border-t border-white/[0.07] bg-[#17181C]">
          <div className="flex-1 px-1.5 py-2.5 text-center">
            <div className="text-[11px] font-medium text-text-tertiary">Trade</div>
            <div className="mt-0.5 truncate text-[17px] font-semibold tabular-nums tracking-[-0.01em] text-[#E8BD6A]">
              {tradeVal != null ? TRADE.format(tradeVal) : '-'}
            </div>
          </div>
          <div aria-hidden className="my-2.5 w-px bg-white/[0.07]" />
          <div className="flex-1 px-1.5 py-2.5 text-center">
            <div className="text-[11px] font-medium text-text-tertiary">Cheapest</div>
            <div className="mt-0.5 truncate text-[17px] font-semibold tabular-nums tracking-[-0.01em] text-[#54DDBE]">
              {cheapest != null ? USD.format(cheapest) : '-'}
            </div>
            {showTypical && (
              <div className="text-[10px] tabular-nums text-text-tertiary">
                ~{USD.format(v!.averageUsd as number)}
              </div>
            )}
          </div>
        </div>
      </Wrapper>

      {/* In-card variant picker overlay. */}
      <AnimatePresence>
        {pickerOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 z-30 flex flex-col rounded-lg bg-[#1A1B1F]/[0.98] p-3"
          >
            <div className="mb-2 flex shrink-0 items-center justify-between">
              <span className="text-[12px] font-semibold text-text-secondary">Choose Variant</span>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setPickerOpen(false)
                }}
                aria-label="Close variant picker"
                className="-mr-1 -mt-1 flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-white/[0.06] hover:text-text-primary"
              >
                <CloseRoundedIcon style={{ fontSize: 17 }} />
              </button>
            </div>
            {/* Two-axis picker (shared with the toolbar dropdown), accented in the
                card's variant colour. */}
            <div className="flex flex-1 flex-col justify-center">
              <CompactVariantPicker variant={code} onChange={setCode} accent={c} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Sort control as a custom dropdown (not a native <select>) so it matches the
 *  toolbar — bordered trigger + a styled panel with a check on the active row. */
function SortDropdown({
  value,
  onChange,
}: {
  value: Sort
  onChange: (v: Sort) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('touchstart', onDoc)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('touchstart', onDoc)
    }
  }, [open])
  const current = SORT_OPTIONS.find((o) => o.value === value) ?? SORT_OPTIONS[0]
  return (
    <div ref={ref} className="relative h-full">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`flex h-full w-full items-center justify-between gap-2 px-3.5 text-body-sm ${FIELD_CLS}`}
      >
        <span className="flex items-center gap-2 truncate">
          <SwapVertIcon sx={{ fontSize: 17 }} className="shrink-0 text-text-tertiary" />
          <span className="truncate">{current.label}</span>
        </span>
        <KeyboardArrowDownIcon sx={{ fontSize: 18 }} className={`shrink-0 text-text-tertiary transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          role="listbox"
          className={`min-w-[13rem] overflow-hidden p-1 ${PANEL_CLS}`}
        >
          {SORT_OPTIONS.map((o) => {
            const active = o.value === value
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => { onChange(o.value); setOpen(false) }}
                className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-body-sm transition-colors ${
                  active ? 'bg-white/[0.06] font-semibold text-text-primary' : 'text-text-secondary hover:bg-white/[0.04] hover:text-text-primary'
                }`}
              >
                {o.label}
                {active && <CheckIcon sx={{ fontSize: 16 }} className="shrink-0 text-text-primary" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Compact variant picker — the whole-list repricing control, dropdown form. */
function VariantDropdown({
  value,
  onChange,
}: {
  value: Variant
  onChange: (v: Variant) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('touchstart', onDoc)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('touchstart', onDoc)
    }
  }, [open])

  return (
    <div ref={ref} className="relative h-full">
      <button
        type="button"
        aria-label="Choose variant"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`flex h-full w-full items-center justify-between gap-2 px-3.5 text-body-sm ${FIELD_CLS}`}
      >
        <span className="flex items-center gap-2">
          <span className="rounded bg-white/[0.08] px-1.5 py-0.5 text-[11px] font-semibold text-text-primary">{value}</span>
          <span className="truncate">{VARIANT_LABEL[value]}</span>
        </span>
        <KeyboardArrowDownIcon sx={{ fontSize: 18 }} className={`shrink-0 text-text-tertiary transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className={`min-w-[16rem] p-3.5 ${PANEL_CLS}`}>
          {/* Two-axis picker: tier (Default/Neon/Mega) + Fly/Ride, forest accent.
              Every form is a valid whole-list view (unpriced forms fall back to
              trade value), so nothing is disabled. */}
          <CompactVariantPicker
            variant={value}
            onChange={onChange}
            accent="#4FB477"
          />
        </div>
      )}
    </div>
  )
}

// Compact page list with ellipses, e.g. [1, …, 4, 5, 6, …, 9]. Same shape as
// SAB's directory pagination.
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

function PageBtn({ disabled, onClick, children }: { disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="h-9 rounded-md bg-bg-raised px-4 text-[13px] font-semibold text-text-secondary transition-colors hover:bg-bg-raised-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-bg-raised"
    >
      {children}
    </button>
  )
}
