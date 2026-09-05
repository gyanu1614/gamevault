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
import { variantColor } from './[brainrotSlug]/_adoptMeVariantColor'
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

/** #RRGGBB → an rgba() glow colour for the card's subtle hover bloom + shadow. */
function hexToGlow(hex: string, alpha = 0.16): string {
  const c = hex.replace('#', '')
  const r = parseInt(c.slice(0, 2), 16)
  const g = parseInt(c.slice(2, 4), 16)
  const b = parseInt(c.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Card depth: flat rectangular surface at rest; the variant-tinted glow and
 *  lift appear ONLY on hover (no ambient bloom sitting there all the time). */
const AM_CARD_CSS = `
.am-card{
  background:linear-gradient(180deg,#141917 0%,#0D1110 100%);
  box-shadow:0 2px 6px -3px rgba(0,0,0,.55);
}
.am-card::before{
  content:'';position:absolute;inset:0;z-index:0;opacity:0;transition:opacity .25s;pointer-events:none;
  background:radial-gradient(75% 48% at 50% 0%, var(--vglow) 0%, transparent 62%);
}
.am-card:hover{
  box-shadow:
    0 12px 24px -14px rgba(0,0,0,.7),
    0 0 16px -10px var(--vglow);
}
.am-card:hover::before{opacity:.4}
.am-vbar{
  background:linear-gradient(180deg, color-mix(in srgb,var(--vc) 12%,transparent), color-mix(in srgb,var(--vc) 5%,transparent));
}
.am-vbar:hover{filter:brightness(1.08)}
@media (prefers-reduced-motion: reduce){
  .am-card{transition:none}
  .am-card:hover{transform:none}
}
`

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
  first = false,
  onClick,
  children,
}: {
  active: boolean
  color: string
  first?: boolean
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
      className={`group/seg flex flex-1 items-center justify-center whitespace-nowrap px-3 py-2.5 text-body-sm font-semibold transition-colors ${
        first ? '' : 'border-l border-[#151B18]'
      } ${active ? '' : 'hover:brightness-125'}`}
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
      {/* Card depth + glow — layered shadow, inset edge highlight, and an
          ambient variant-tinted bloom (::before) that intensifies on hover.
          Kept in one style block because the layered box-shadow + gradient
          pseudo-element can't be expressed as Tailwind utilities. --vc / --vglow
          are set per-card inline. */}
      <style dangerouslySetInnerHTML={{ __html: AM_CARD_CSS }} />
      {/* ── Toolbar (Option B): search is the hero (grows) with the variant +
          sort compact beside it; rarity below as a CONNECTED segmented control
          (one bordered unit, active segment filled in its rarity colour). ── */}
      {/* Row 1 — controls */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <span aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#5E6B63]">
            <SearchIcon sx={{ fontSize: 19 }} />
          </span>
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); resetPage() }}
            placeholder="Search a pet by name…"
            className="h-12 w-full rounded-md border border-[#1E2723] bg-white/[0.04] pl-11 pr-3 text-body text-[#F1F3F1] outline-none transition-colors placeholder:text-[#6D7A72] focus:border-[#2F6B46]"
          />
        </div>
        <div className="h-12 w-full shrink-0 sm:w-48">
          <VariantDropdown value={variant} onChange={(v) => setVariant(v)} />
        </div>
        <div className="h-12 w-full shrink-0 sm:w-52">
          <SortDropdown value={sort} onChange={(v) => { setSort(v); resetPage() }} />
        </div>
      </div>

      {/* Row 2 — rarity as a connected segmented control, stretched FULL WIDTH
          to match the search row (each segment flex-1, equal share). Each is a
          DIMMED tile in its rarity colour; selecting one fills it solid with
          dark text. One bordered unit, hairline dividers, scrolls on mobile. */}
      <div className="mt-3 flex w-full overflow-x-auto rounded-md border border-[#1E2723] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <SegBtn active={view === 'popular'} color="#4FB477" first onClick={() => { setView('popular'); resetPage() }}>
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
        <div className="mt-6 border border-[#2E2338] bg-[#120E15] px-6 py-12 text-center">
          <h2 className="text-xl font-semibold text-[#F1F3F1]">No pets found</h2>
          <p className="mt-2 text-[#9BA8A0]">Try changing the search or filters.</p>
        </div>
      ) : (
        // SAB-style card grid (2→6 across), Adopt-Me-tinted. Each card carries a
        // per-card variant picker that reprices its own footer, independent of
        // the table-wide variant selector. Trade value (gold) + Cheapest (teal)
        // read as the two axes.
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
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
              <span key={`gap-${i}`} className="px-1.5 font-mono text-[13px] text-[#5E685E]">…</span>
            ) : (
              <button
                key={n}
                type="button"
                onClick={() => goToPage(n)}
                aria-current={n === safePage ? 'page' : undefined}
                className={`min-w-[38px] border px-3 py-2 text-[13px] font-semibold tabular-nums transition ${
                  n === safePage
                    ? 'border-[#B07BC9] bg-[#B07BC9]/15 text-[#CBA8DA]'
                    : 'border-[#1E2723] text-[#9BA8A0] hover:border-[#2A3A31] hover:text-[#E6EAE7]'
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
      <p className="mt-8 border-t border-[#1A1420] pt-5 font-mono text-[11px] leading-relaxed text-[#6D7A72]">
        Prices are medians of completed sales and active listings. Bundles, account
        sales and disputed orders are excluded. Cash values marked “Est.” are derived
        from the variant ladder until we hold enough real sales; change indicators
        appear only where we hold enough price history.
      </p>
    </div>
  )
}

/**
 * One value card — the SAB card pattern in Adopt Me colours (Option B).
 *
 * Header: a variant chip (opens the in-card picker) + rarity. Body: art on a
 * variant-tinted radial glow + name. Footer: TRADE (gold) | CHEAPEST (teal) —
 * the two axes read as different colours. The card seeds its variant from the
 * table-wide selector but can be repriced on its own via the picker; the whole
 * card is a link to the pet page (only when it has one, so we never 404).
 */
/**
 * One value card — SAB card structure, polished with Apple-style depth.
 *
 * Rounded surface that lifts on hover with a layered drop-shadow; an ambient
 * glow in the selected variant's colour blooms behind the art; a glass edge
 * highlight rings the card. Body: art + name. A full-width variant BAR (the
 * primary control, opens the in-card picker) sits above the footer. Footer:
 * TRADE (gold) | CHEAPEST (teal) — the two axes, in Inter (not mono). The whole
 * card links to the pet page (only when one exists, so we never 404).
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
  const glow = hexToGlow(c)
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
      style={
        {
          ['--vc' as string]: c,
          ['--vglow' as string]: glow,
        } as CSSProperties
      }
      className="am-card group relative isolate flex flex-col overflow-hidden border border-[#1E2723] transition-[transform,box-shadow,border-color] duration-200 hover:border-[#2C3A31]"
    >
      {/* Header: rarity only (the variant lives in the bar below). */}
      <div className="relative z-[1] flex items-center justify-end px-3.5 pt-3">
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.13em]"
          style={{ color: meta.color }}
        >
          {meta.label}
        </span>
      </div>

      {/* Body (link): art on the ambient glow + Popular/rank + name. */}
      <Wrapper {...wrapperProps} className="relative z-[1] flex flex-1 flex-col">
        <div className="relative flex h-[118px] items-center justify-center px-3 pt-1.5">
          {isPopular && (
            <span className="absolute left-3 top-0 text-[10px] font-semibold text-[#5AD08A]">
              Popular
            </span>
          )}
          <span className="absolute right-3.5 top-0 text-[11px] font-semibold tabular-nums text-[#616B65]">
            {rank}
          </span>
          {pet.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote pet art
            <img
              src={pet.imageUrl}
              alt={`${pet.name} — Adopt Me`}
              loading="lazy"
              className="h-[96px] w-[96px] object-contain drop-shadow-[0_10px_16px_rgba(0,0,0,0.55)]"
            />
          ) : (
            <span className="font-mono text-[9px] text-[#5E685E]">N/A</span>
          )}
        </div>
        <div className="px-3 pb-2 pt-2 text-center text-[15.5px] font-semibold tracking-[-0.01em] text-[#F2F5F2] transition-colors group-hover:text-white">
          {pet.name}
        </div>
      </Wrapper>

      {/* Variant bar — the primary control (opens the picker). Full width,
          glowing dot, gradient fill in the variant colour. */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setPickerOpen((o) => !o)
        }}
        aria-label="Choose variant"
        className="am-vbar relative z-[1] mx-3 mb-3 flex items-center justify-center gap-2 border px-3 py-2 text-[13px] font-semibold tracking-[0.01em] transition"
        style={{ color: c, borderColor: c }}
      >
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: c, boxShadow: `0 0 8px 0 ${c}` }}
        />
        {VARIANT_LABEL[code]}
        <span className="text-[11px] opacity-60">▾</span>
      </button>

      {/* Footer: TRADE (gold) | CHEAPEST (teal). Numbers in Inter. */}
      <Wrapper {...wrapperProps} className="relative z-[1] block">
        <div className="flex border-t border-white/[0.06] bg-gradient-to-b from-white/[0.015] to-transparent">
          <div className="flex-1 border-r border-white/[0.06] px-1.5 py-3 text-center">
            <div className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-[#616B65]">
              Trade
            </div>
            <div className="mt-1 truncate text-[18px] font-semibold tracking-[-0.01em] text-[#E8BD6A]">
              {tradeVal != null ? TRADE.format(tradeVal) : '—'}
            </div>
          </div>
          <div className="flex-1 px-1.5 py-3 text-center">
            <div className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-[#616B65]">
              Cheapest
            </div>
            <div className="mt-1 truncate text-[18px] font-semibold tracking-[-0.01em] text-[#54DDBE]">
              {cheapest != null ? USD.format(cheapest) : '—'}
            </div>
            {showTypical && (
              <div className="text-[10px] tabular-nums text-[#616B65]">
                ~{USD.format(v!.averageUsd as number)}
              </div>
            )}
          </div>
        </div>
      </Wrapper>

      {/* In-card variant picker overlay. */}
      {pickerOpen && (
        <div className="absolute inset-0 z-30 flex flex-col rounded-md bg-[#060809]/[0.97] p-3">
          <div className="mb-2 flex shrink-0 items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#8C98A4]">
              Variant
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setPickerOpen(false)
              }}
              aria-label="Close variant picker"
              className="-mr-1 -mt-1 px-1 text-[14px] leading-none text-[#8C98A4] transition hover:text-white"
            >
              ✕
            </button>
          </div>
          {/* Two-axis picker (shared with the toolbar dropdown), accented in the
              card's variant colour. Stacked Tier + Potion rows; Neon/Mega show a
              single Fly-Ride toggle since they inherit the base pet's abilities. */}
          <div className="flex flex-1 flex-col justify-center">
            <CompactVariantPicker variant={code} onChange={setCode} accent={c} />
          </div>
        </div>
      )}
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
        className="flex h-full w-full items-center justify-between gap-2 rounded-md border border-[#1E2723] bg-white/[0.04] px-3.5 text-body-sm text-[#C6CEC9] outline-none transition hover:bg-white/[0.06] focus:border-[#2F6B46]"
      >
        <span className="flex items-center gap-2 truncate">
          <SwapVertIcon sx={{ fontSize: 17 }} className="shrink-0 text-[#6D7A72]" />
          <span className="truncate">{current.label}</span>
        </span>
        <KeyboardArrowDownIcon sx={{ fontSize: 18 }} className={`shrink-0 text-[#8B978F] transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute right-0 z-30 mt-1.5 w-full min-w-[13rem] overflow-hidden rounded-md border border-[#232A2F] bg-[#0E1211] p-1 shadow-[0_16px_40px_-16px_rgba(0,0,0,0.9)]"
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
                className={`flex w-full items-center justify-between gap-2 rounded px-3 py-2 text-left text-body-sm transition ${
                  active ? 'bg-white/[0.06] font-semibold text-[#F1F3F1]' : 'text-[#9BA8A0] hover:bg-white/[0.04] hover:text-[#E6EAE7]'
                }`}
              >
                {o.label}
                {active && <CheckIcon sx={{ fontSize: 16 }} className="shrink-0 text-[#4FB477]" />}
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
        className="flex h-full w-full items-center justify-between gap-2 rounded-md border border-[#1E2723] bg-white/[0.04] px-3.5 text-body-sm text-[#F1F3F1] outline-none transition hover:bg-white/[0.06] focus:border-[#2F6B46]"
      >
        <span className="flex items-center gap-2">
          <span className="border border-[#26332C] bg-white/[0.05] px-1.5 py-0.5 text-[11px] font-semibold text-[#E6EAE7]">{value}</span>
          <span className="truncate">{VARIANT_LABEL[value]}</span>
        </span>
        <KeyboardArrowDownIcon sx={{ fontSize: 18 }} className={`shrink-0 text-[#8B978F] transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1.5 w-full min-w-[16rem] rounded-md border border-[#232A2F] bg-[#0E1211] p-3.5 shadow-[0_16px_40px_-16px_rgba(0,0,0,0.9)]">
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
      className="border border-[#2E2338] bg-[#120E15] px-4 py-2 text-[13px] font-semibold text-[#CBA8DA] transition hover:bg-[#181022] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  )
}
