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
import { useEffect, useMemo, useRef, useState } from 'react'
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

function rarityMeta(r: string) {
  return RARITY_META[r] ?? { label: r, color: '#9BA8A0' }
}

const POPULAR_COUNT = 12
const PAGE_SIZE = 25

type View = 'popular' | 'all' | string
type Sort = 'value-desc' | 'value-asc' | 'name'

/** Confidence → label + colour. Matches SAB's "price accuracy" treatment. */
function ConfidenceText({ confidence, estimated }: { confidence: string; estimated: boolean }) {
  // Until real sales exist every cash value is an estimate — say so plainly
  // rather than borrowing SAB's "Highly Accurate" for numbers we derived.
  if (estimated) {
    return <span className="text-[13px] text-[#8B7BA0]">Estimated</span>
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

export default function AdoptMeValuesClient({ pets }: { pets: AdoptMePetItem[] }) {
  const [variant, setVariant] = useState<Variant>('FR')
  const [query, setQuery] = useState('')
  const [view, setView] = useState<View>('popular')
  const [sort, setSort] = useState<Sort>('value-desc')
  const [page, setPage] = useState(1)

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

  const rangeStart = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(safePage * PAGE_SIZE, filtered.length)

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
              Cash USD <span className="text-[#8FBF9C]">({variant})</span>
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
                      {v ? <ConfidenceText confidence={v.confidence} estimated={v.isEstimated} /> : <span className="text-[13px] text-[#5E685E]">—</span>}
                    </span>

                    {/* Trade value — desktop column */}
                    <span className="hidden text-right font-mono text-[14.5px] font-bold tabular-nums text-[#E6EAE7] lg:block">
                      {v?.tradeValue != null ? TRADE.format(v.tradeValue) : '—'}
                    </span>

                    {/* Cash (USD) + chevron — estimate-aware, never fake $0 */}
                    <span className="flex items-center justify-end gap-1.5 text-right">
                      <span className="flex flex-col items-end">
                        {v?.cashUsd != null ? (
                          <>
                            <span className="text-[16px] font-bold tabular-nums text-[#8FBF9C] sm:text-[17.5px]">
                              {USD.format(v.cashUsd)}
                            </span>
                            {v.isEstimated && (
                              <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-[#8B7BA0]">Est.</span>
                            )}
                          </>
                        ) : (
                          <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-[#6D7A72]">Est. pending</span>
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
        <div className="mt-8 flex items-center justify-center gap-2">
          <PageBtn disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>Prev</PageBtn>
          <span className="px-3 font-mono text-[13px] tabular-nums text-[#8B978F]">{safePage} / {totalPages}</span>
          <PageBtn disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)}>Next</PageBtn>
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
