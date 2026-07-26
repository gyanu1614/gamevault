'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Search, SlidersHorizontal } from 'lucide-react'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import CheckIcon from '@mui/icons-material/Check'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { sabInteractive } from '@/lib/sab/theme'

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
        className="flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-[#1E2723] bg-[#111613] px-3.5 text-sm text-[#F1F3F1] outline-none transition hover:border-[#2A3A31] focus:border-[#2E5B44]"
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
          className="absolute z-30 mt-1.5 max-h-72 w-full overflow-auto rounded-lg border border-[#1E2723] bg-[#0E1211] p-1 shadow-[0_16px_40px_-16px_rgba(0,0,0,0.9)]"
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
                className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm transition ${
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
}

type SortOption = 'name' | 'income-desc' | 'income-asc'

interface ValuesDirectoryClientProps {
  brainrots: BrainrotDirectoryItem[]
}

function asNumber(value: number | string | null): number | null {
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

function formatIncome(value: number | string | null): string {
  const amount = asNumber(value)
  if (amount == null) return 'Unknown'

  return `${new Intl.NumberFormat('en-US', {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 1,
  }).format(amount)}/s`
}

function formatConfidence(value: string): string {
  if (value === 'high') return 'High confidence'
  if (value === 'medium') return 'Medium confidence'
  if (value === 'low') return 'Low confidence'
  return 'Estimate'
}

// Color-coded confidence chip — matches the item page's ConfidenceBadge.
function ConfidencePill({ label }: { label: string }) {
  const tone =
    label === 'high'
      ? { fg: '#4FB477', bg: 'rgba(79,180,119,0.12)' }
      : label === 'medium'
        ? { fg: '#E0B155', bg: 'rgba(224,177,85,0.12)' }
        : { fg: '#9BA8A0', bg: 'rgba(155,168,160,0.1)' }
  return (
    <span
      className="mt-2 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold capitalize"
      style={{ color: tone.fg, backgroundColor: tone.bg }}
    >
      <span className="h-1 w-1 rounded-full" style={{ backgroundColor: tone.fg }} />
      {formatConfidence(label)}
    </span>
  )
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

export default function ValuesDirectoryClient({
  brainrots,
}: ValuesDirectoryClientProps) {
  const [query, setQuery] = useState('')
  const [rarity, setRarity] = useState('all')
  const [obtainability, setObtainability] = useState('all')
  const [sort, setSort] = useState<SortOption>('name')

  const rarities = useMemo(
    () =>
      Array.from(
        new Set(brainrots.map((brainrot) => brainrot.rarity).filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b)),
    [brainrots],
  )

  const obtainabilityOptions = useMemo(
    () =>
      Array.from(
        new Set(
          brainrots
            .map((brainrot) => brainrot.obtainability)
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [brainrots],
  )

  const PAGE_SIZE = 60

  const filteredBrainrots = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    const filtered = brainrots.filter((brainrot) => {
      const matchesQuery =
        !normalizedQuery ||
        `${brainrot.name} ${brainrot.rarity} ${brainrot.obtainability}`
          .toLowerCase()
          .includes(normalizedQuery)

      const matchesRarity =
        rarity === 'all' || brainrot.rarity === rarity

      const matchesObtainability =
        obtainability === 'all' ||
        brainrot.obtainability === obtainability

      return matchesQuery && matchesRarity && matchesObtainability
    })

    return [...filtered].sort((a, b) => {
      if (sort === 'income-desc') return compareIncome(a, b, 'desc')
      if (sort === 'income-asc') return compareIncome(a, b, 'asc')
      return a.name.localeCompare(b.name)
    })
  }, [brainrots, obtainability, query, rarity, sort])

  const totalPages = Math.max(1, Math.ceil(filteredBrainrots.length / PAGE_SIZE))
  const [page, setPage] = useState(1)
  // Reset to page 1 whenever the filtered set changes (new search/filter/sort).
  useEffect(() => {
    setPage(1)
  }, [query, rarity, obtainability, sort])
  const currentPage = Math.min(page, totalPages)

  const visibleBrainrots = useMemo(
    () => filteredBrainrots.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filteredBrainrots, currentPage],
  )

  const filtersActive =
    query.trim().length > 0 ||
    rarity !== 'all' ||
    obtainability !== 'all' ||
    sort !== 'name'

  const resetFilters = () => {
    setQuery('')
    setRarity('all')
    setObtainability('all')
    setSort('name')
  }

  return (
    <>
      <div className="rounded-lg border border-[#1E2723] bg-[#121613] p-4 sm:p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#F1F3F1]">
          <SlidersHorizontal className="h-4 w-4 text-[#4FB477]" />
          Search and filter
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(260px,1fr)_200px_220px_190px]">
          <label className="relative block">
            <span className="sr-only">Search Brainrots</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6D7A72]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search Brainrot name, rarity..."
              className="h-11 w-full rounded-lg border border-[#1E2723] bg-[#111613] pl-10 pr-4 text-base text-[#F1F3F1] outline-none transition placeholder:text-[#6D7A72] focus:border-[#2E5B44] sm:text-sm"
            />
          </label>

          <Dropdown
            ariaLabel="Filter by rarity"
            value={rarity}
            onChange={setRarity}
            options={[
              { value: 'all', label: 'All rarities' },
              ...rarities.map((o) => ({ value: o, label: o })),
            ]}
          />

          <Dropdown
            ariaLabel="Filter by obtainability"
            value={obtainability}
            onChange={setObtainability}
            options={[
              { value: 'all', label: 'All obtainability' },
              ...obtainabilityOptions.map((o) => ({ value: o, label: o })),
            ]}
          />

          <Dropdown
            ariaLabel="Sort Brainrots"
            value={sort}
            onChange={(v) => setSort(v as SortOption)}
            options={[
              { value: 'name', label: 'Name A–Z' },
              { value: 'income-desc', label: 'Highest income' },
              { value: 'income-asc', label: 'Lowest income' },
            ]}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
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
            of <span className="tabular-nums">{filteredBrainrots.length.toLocaleString()}</span> Brainrots
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
      </div>

      {visibleBrainrots.length === 0 ? (
        <div className="mt-6 rounded-lg border border-[#1E2723] bg-[#121613] px-6 py-12 text-center">
          <h2 className="text-xl font-semibold text-[#F1F3F1]">
            No Brainrots found
          </h2>
          <p className="mt-2 text-[#9BA8A0]">
            Try changing the search or filters.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-5 rounded-lg bg-[#1B6B3F] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#1f7a48]"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-5">
          {visibleBrainrots.map((brainrot) => {
            const displayPrice = formatMoney(brainrot.display_price_usd)

            return (
              <Link
                key={brainrot.id}
                href={`/steal-a-brainrot/values/${brainrot.slug}`}
                className={`group block overflow-hidden ${sabInteractive}`}
              >
                <div className="aspect-square overflow-hidden bg-[#0E1211]">
                  {brainrot.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={brainrot.image_url}
                      alt={`${brainrot.name} Steal a Brainrot`}
                      loading="lazy"
                      className="h-full w-full object-contain p-3 transition duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center px-4 text-center text-sm text-[#6D7A72]">
                      No image
                    </div>
                  )}
                </div>

                <div className="p-3 sm:p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="line-clamp-1 text-sm font-semibold text-[#F1F3F1] sm:text-[15px]">
                      {brainrot.name}
                    </h2>
                    <span className="shrink-0 rounded-md border border-[#26332C] bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-semibold text-[#9BA8A0]">
                      {brainrot.rarity}
                    </span>
                  </div>

                  {/* Clean label:value rows with grey dividers — matches the
                      item page. No more clunky "Average Current Market Price". */}
                  <dl className="mt-3 divide-y divide-white/[0.06] border-t border-white/[0.06]">
                    <div className="flex items-center justify-between gap-2 py-2">
                      <dt className="text-xs text-[#8B978F]">Income</dt>
                      <dd className="text-xs font-medium tabular-nums text-[#D6DCD8]">
                        {formatIncome(brainrot.base_income_per_second)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-2 py-2">
                      <dt className="text-xs text-[#8B978F]">Cash value</dt>
                      <dd className="text-sm font-semibold tabular-nums text-[#F1F3F1]">
                        {displayPrice ?? '—'}
                      </dd>
                    </div>
                  </dl>

                  {displayPrice ? (
                    <ConfidencePill label={brainrot.confidence_label} />
                  ) : (
                    <p className="mt-2 text-[11px] text-[#6D7A72]">Not enough market data yet</p>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-1.5">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="flex h-9 items-center gap-1 rounded-lg border border-[#26332C] bg-white/[0.03] px-3 text-sm font-semibold text-[#C6CEC9] transition enabled:hover:border-[#2A3A31] enabled:hover:bg-white/[0.06] disabled:opacity-40"
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
                onClick={() => setPage(n as number)}
                aria-current={n === currentPage ? 'page' : undefined}
                className={`h-9 min-w-9 rounded-lg px-2 text-sm font-semibold tabular-nums transition ${
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
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="flex h-9 items-center gap-1 rounded-lg border border-[#26332C] bg-white/[0.03] px-3 text-sm font-semibold text-[#C6CEC9] transition enabled:hover:border-[#2A3A31] enabled:hover:bg-white/[0.06] disabled:opacity-40"
          >
            Next
            <ChevronRightIcon sx={{ fontSize: 18 }} />
          </button>
        </div>
      )}
    </>
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
