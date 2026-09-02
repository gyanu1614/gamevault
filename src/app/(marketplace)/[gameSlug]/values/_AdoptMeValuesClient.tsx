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
import { VariantAxisPicker } from '../calculator/_VariantAxisPicker'

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
  { value: 'value-desc', label: 'Highest trade value' },
  { value: 'value-asc', label: 'Lowest trade value' },
  { value: 'cash-desc', label: 'Highest cash price' },
  { value: 'cash-asc', label: 'Lowest cash price' },
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

  const popularSlugs = useMemo(
    () =>
      new Set(
        [...pets]
          .sort((a, b) => b.topTradeValue - a.topTradeValue)
          .slice(0, POPULAR_COUNT)
          .map((p) => p.slug),
      ),
    [pets],
  )

  const raritiesPresent = useMemo(
    () => RARITY_ORDER.filter((r) => pets.some((p) => p.rarity === r)),
    [pets],
  )

  const valueOf = (p: AdoptMePetItem) => p.values[variant]

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = pets.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q)) return false
      if (view === 'popular') return popularSlugs.has(p.slug)
      if (view === 'all') return true
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
      const av = a.values[variant]?.tradeValue ?? -1
      const bv = b.values[variant]?.tradeValue ?? -1
      return sort === 'value-asc' ? av - bv : bv - av
    })
    return list
  }, [pets, query, view, sort, variant, popularSlugs])

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
      {/* ── Controls row: search + the variant picker as a compact dropdown ─
          The variant selector lives here (not on its own line) so it reads as
          part of the toolbar and the whole list reprices from one control that
          sits beside the search, mirroring SAB's dropdown pattern. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            resetPage()
          }}
          placeholder="Search a pet by name…"
          className="w-full flex-1 border border-[#1E2723] bg-white/[0.04] px-4 py-3 text-[16px] text-[#F1F3F1] outline-none transition-colors placeholder:text-[#6D7A72] focus:border-[#2F6B46]"
        />
        <div className="sm:w-56 sm:shrink-0">
          <VariantDropdown value={variant} onChange={(v) => setVariant(v)} />
        </div>
        {/* Sort — full option set (trade value, cash, name) in a native select
            so it's accessible and reprices/reorders the whole table. */}
        <div className="sm:w-52 sm:shrink-0">
          <label className="sr-only" htmlFor="am-values-sort">Sort pets</label>
          <select
            id="am-values-sort"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as Sort)
              resetPage()
            }}
            className="h-full w-full cursor-pointer appearance-none border border-[#1E2723] bg-white/[0.04] px-4 py-3 text-[15px] text-[#F1F3F1] outline-none transition-colors focus:border-[#2F6B46]"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} className="bg-[#0E1211]">
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {/* Variant shown in the column headers below, not a static line here.
          Keep only the benchmark hint when a non-FR variant is selected. */}
      {variant !== 'FR' && (
        <p className="mt-2 text-[12px] text-[#8B978F]">
          Fly Ride (FR) is the standard trading benchmark.
        </p>
      )}

      {/* ── Rarity chips — single-select, full-width segmented control ────── */}
      <div className="mt-3 flex flex-nowrap items-stretch gap-2 overflow-x-auto pb-1 sm:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => { setView('popular'); resetPage() }}
          aria-pressed={view === 'popular'}
          className={`flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap px-3.5 py-2.5 text-[13px] font-semibold transition sm:flex-1 sm:shrink ${
            view === 'popular'
              ? 'bg-[#B07BC9] text-[#0B0810]'
              : 'border border-[#4A3A5C] text-[#CBA8DA] hover:bg-[#B07BC9]/10'
          }`}
        >
          <span aria-hidden className={`h-1.5 w-1.5 ${view === 'popular' ? 'bg-[#0B0810]' : 'bg-[#B07BC9]'}`} />
          Popular
        </button>
        <button
          type="button"
          onClick={() => { setView('all'); resetPage() }}
          aria-pressed={view === 'all'}
          className={`shrink-0 whitespace-nowrap px-3.5 py-2.5 text-[13px] font-semibold transition sm:flex-1 sm:shrink ${
            view === 'all'
              ? 'bg-[#E8EDE9] text-[#0C0F0E]'
              : 'border border-[#2E2338] text-[#C6CEC9] hover:border-[#4A3A5C]'
          }`}
        >
          All {pets.length}
        </button>
        {raritiesPresent.map((r) => {
          const active = view === r
          const rc = rarityMeta(r).color
          return (
            <button
              key={r}
              type="button"
              onClick={() => { setView(r); resetPage() }}
              aria-pressed={active}
              style={active ? { backgroundColor: rc, color: '#0B0810', borderColor: rc } : { borderColor: `${rc}59`, color: rc }}
              className="shrink-0 whitespace-nowrap border px-3.5 py-2.5 text-[13px] font-semibold transition hover:brightness-110 sm:flex-1 sm:shrink"
            >
              {rarityMeta(r).label}
            </button>
          )
        })}
      </div>

      {/* ── Result count + honest trust line ─────────────────────────────── */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-[#9BA8A0]">
          Showing{' '}
          <span className="font-semibold tabular-nums text-[#F1F3F1]">
            {filtered.length === 0 ? '0' : `${rangeStart.toLocaleString()}–${rangeEnd.toLocaleString()}`}
          </span>{' '}
          of <span className="tabular-nums">{filtered.length.toLocaleString()}</span> pets
        </p>
      </div>

      {/* ── List ─────────────────────────────────────────────────────────── */}
      {visible.length === 0 ? (
        <div className="mt-6 border border-[#2E2338] bg-[#120E15] px-6 py-12 text-center">
          <h2 className="text-xl font-semibold text-[#F1F3F1]">No pets found</h2>
          <p className="mt-2 text-[#9BA8A0]">Try changing the search or filters.</p>
        </div>
      ) : (
        // Each row is its own FAQ-style card: separate white/[0.04] surfaces
        // with the neutral hairline, spaced apart (space-y-2), brightening to
        // white/[0.06] on hover — identical material to the FaqCards.
        <div className="mt-5 space-y-2">
          {/* Column headers — desktop only. Padded to line up with the card
              cells below (cards carry their own px-4). */}
          <div className="hidden grid-cols-[64px_minmax(0,1.5fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.9fr)] items-center gap-4 px-4 pb-1 lg:grid">
            <span className="text-[13px] font-medium text-[#C6CEC9]">Pet</span>
            <span className="text-[13px] font-medium text-[#C6CEC9]" />
            <span className="text-center text-[13px] font-medium text-[#C6CEC9]">Price accuracy</span>
            <button
              type="button"
              onClick={() => { setSort(sort === 'value-desc' ? 'value-asc' : 'value-desc'); resetPage() }}
              className="text-right text-[13px] font-medium text-[#C6CEC9] transition hover:text-[#F1F3F1]"
            >
              Trade value <span className="text-[#8FBF9C]">({variant})</span> {sort === 'value-asc' ? '↑' : '↓'}
            </button>
            <span className="text-right text-[13px] font-medium text-[#C6CEC9]">
              Cheapest <span className="text-[#8FBF9C]">({variant})</span>
            </span>
          </div>

          <ul className="space-y-2">
            {visible.map((p, i) => {
              const v = valueOf(p)
              const meta = rarityMeta(p.rarity)
              const rank = (safePage - 1) * PAGE_SIZE + i + 1
              const isPopular = popularSlugs.has(p.slug)
              return (
                <li key={p.slug}>
                  {/* Only a link when the pet has a page — otherwise a plain row,
                      so the list never links to a page that 404s. Each row IS a
                      FAQ-style card: border + white/[0.04], white/[0.06] hover. */}
                  {(() => {
                    const Wrapper = p.hasPage ? 'a' : 'div'
                    const wrapperProps = p.hasPage
                      ? { href: `/adopt-me/values/${p.slug}` }
                      : {}
                    return (
                  <Wrapper
                    {...wrapperProps}
                    style={{ ['--rc' as string]: meta.color } as CSSProperties}
                    className={`group grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3 border border-[#1E2723] bg-white/[0.04] px-3 py-3.5 transition-colors sm:gap-4 sm:px-4 lg:grid-cols-[64px_minmax(0,1.5fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.9fr)] ${p.hasPage ? 'hover:bg-white/[0.06]' : ''}`}
                  >
                    {/* Art — 64px framed tile with a rarity-tinted hover glow. */}
                    <span className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden border border-[#1E2723] bg-black/20 sm:h-16 sm:w-16">
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                        style={{ background: 'radial-gradient(70% 70% at 50% 45%, color-mix(in srgb, var(--rc) 26%, transparent), transparent 74%)' }}
                      />
                      {p.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- remote pet art
                        <img src={p.imageUrl} alt={`${p.name} — Adopt Me`} loading="lazy" className="relative h-full w-full object-contain p-1" />
                      ) : (
                        <span className="font-mono text-[9px] text-[#5E685E]">N/A</span>
                      )}
                    </span>

                    {/* Name + rank + rarity badge + popular tag */}
                    <span className="flex min-w-0 flex-col gap-1.5">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="shrink-0 font-mono text-[12px] font-bold tabular-nums text-[#6D7A72]">{rank}</span>
                        <span className="truncate text-[16.5px] font-semibold text-[#F1F3F1] transition-colors group-hover:text-white">
                          {p.name}
                        </span>
                        {isPopular && (
                          <span className="shrink-0 text-[12px] font-normal text-[#4FB477]">
                            Popular
                          </span>
                        )}
                      </span>
                      <span className="flex flex-wrap items-center gap-2">
                        <span
                          className="shrink-0 border px-2 py-0.5 font-mono text-[11px] font-semibold"
                          style={{ borderColor: `${meta.color}66`, color: meta.color }}
                        >
                          {meta.label}
                        </span>
                        {/* On mobile the trade value rides under the name (no column). */}
                        <span className="font-mono text-[12.5px] tabular-nums text-[#8B978F] lg:hidden">
                          {v?.tradeValue != null ? `${TRADE.format(v.tradeValue)} trade` : '—'}
                        </span>
                      </span>
                    </span>

                    {/* Price accuracy — desktop column */}
                    <span className="hidden text-center lg:block">
                      {v ? <ConfidenceText confidence={v.confidence} hasCash={(v.cheapestUsd ?? v.cashUsd) != null} /> : <span className="text-[13px] text-[#5E685E]">—</span>}
                    </span>

                    {/* Trade value — desktop column */}
                    <span className="hidden text-right font-mono text-[14.5px] font-bold tabular-nums text-[#E6EAE7] lg:block">
                      {v?.tradeValue != null ? TRADE.format(v.tradeValue) : '—'}
                    </span>

                    {/* CHEAPEST is the headline; the typical (market) price shows
                        beneath only when it's meaningfully higher — matches the SAB
                        cards. Estimate-aware, never a fake $0 or bare dash. */}
                    <span className="flex items-center justify-end gap-1.5 text-right">
                      <span className="flex flex-col items-end">
                        {v && (v.cheapestUsd ?? v.cashUsd) != null ? (
                          <>
                            <span className="text-[16px] font-bold tabular-nums text-[#8FBF9C] sm:text-[17.5px]">
                              {USD.format((v.cheapestUsd ?? v.cashUsd) as number)}
                            </span>
                            {v.cheapestUsd != null &&
                            v.averageUsd != null &&
                            v.averageUsd > v.cheapestUsd * MARKET_SECONDARY_GAP ? (
                              <span className="font-mono text-[11px] tabular-nums text-[#8B978F]">
                                typically ~{USD.format(v.averageUsd)}
                              </span>
                            ) : null}
                          </>
                        ) : v && v.tradeValue != null && v.tradeValue > 0 ? (
                          // No real cash → show the community trade-points value
                          // instead of a fabricated dollar estimate.
                          <>
                            <span className="text-[16px] font-bold tabular-nums text-[#F1F3F1] sm:text-[17.5px]">
                              {TRADE.format(v.tradeValue)}
                              <span className="ml-1 text-[11px] font-semibold text-[#7C8A80]">pts</span>
                            </span>
                            <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-[#8B978F]">trade value</span>
                          </>
                        ) : (
                          <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-[#6D7A72]">No data</span>
                        )}
                      </span>
                      {/* Chevron only on real links — a static row shouldn't
                          suggest a click target. */}
                      {p.hasPage && (
                        <ChevronRightIcon
                          sx={{ fontSize: 18 }}
                          className="shrink-0 text-[#4A3A5C] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-[#CBA8DA]"
                        />
                      )}
                    </span>
                  </Wrapper>
                    )
                  })()}
                </li>
              )
            })}
          </ul>
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
        className="flex h-full min-h-[50px] w-full items-center justify-between gap-2 border border-[#1E2723] bg-white/[0.04] px-3.5 text-[15px] text-[#F1F3F1] outline-none transition hover:bg-white/[0.06] focus:border-[#2F6B46]"
      >
        <span className="flex items-center gap-2">
          <span className="border border-[#26332C] bg-white/[0.05] px-1.5 py-0.5 text-[11px] font-semibold text-[#E6EAE7]">{value}</span>
          <span className="truncate">{VARIANT_LABEL[value]}</span>
        </span>
        <KeyboardArrowDownIcon sx={{ fontSize: 18 }} className={`shrink-0 text-[#8B978F] transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1.5 w-full min-w-[15rem] border border-[#1E2723] bg-[#0E1211] p-3.5 shadow-[0_16px_40px_-16px_rgba(0,0,0,0.9)]">
          {/* Two-axis picker: tier (Default/Neon/Mega) + Fly/Ride. The list
              falls back to trade value for unpriced forms, so nothing is
              disabled here — every form is a valid whole-list view. */}
          <VariantAxisPicker
            variant={value}
            onChange={onChange}
            hasCash={() => true}
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
