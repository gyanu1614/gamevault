'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, SlidersHorizontal } from 'lucide-react'

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

  return `$${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(amount)}/s`
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

  const visibleBrainrots = useMemo(() => {
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
      <div className="rounded-2xl border border-border-subtle bg-bg-overlay p-4 sm:p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <SlidersHorizontal className="h-4 w-4 text-lime-text" />
          Search and filter
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(260px,1fr)_200px_220px_190px]">
          <label className="relative block">
            <span className="sr-only">Search Brainrots</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search Brainrot name, rarity..."
              className="h-12 w-full rounded-xl border border-border-subtle bg-black/15 pl-10 pr-4 text-text-primary outline-none transition placeholder:text-text-tertiary focus:border-lime-text/60"
            />
          </label>

          <label>
            <span className="sr-only">Filter by rarity</span>
            <select
              value={rarity}
              onChange={(event) => setRarity(event.target.value)}
              className="h-12 w-full rounded-xl border border-border-subtle bg-black/15 px-3 text-text-primary outline-none focus:border-lime-text/60"
            >
              <option value="all">All rarities</option>
              {rarities.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="sr-only">Filter by obtainability</span>
            <select
              value={obtainability}
              onChange={(event) => setObtainability(event.target.value)}
              className="h-12 w-full rounded-xl border border-border-subtle bg-black/15 px-3 text-text-primary outline-none focus:border-lime-text/60"
            >
              <option value="all">All obtainability</option>
              {obtainabilityOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="sr-only">Sort Brainrots</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortOption)}
              className="h-12 w-full rounded-xl border border-border-subtle bg-black/15 px-3 text-text-primary outline-none focus:border-lime-text/60"
            >
              <option value="name">Name A–Z</option>
              <option value="income-desc">Highest income</option>
              <option value="income-asc">Lowest income</option>
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="text-text-secondary">
            Showing{' '}
            <span className="font-bold text-text-primary">
              {visibleBrainrots.length.toLocaleString()}
            </span>{' '}
            of {brainrots.length.toLocaleString()} Brainrots
          </p>

          {filtersActive && (
            <button
              type="button"
              onClick={resetFilters}
              className="font-semibold text-lime-text transition hover:opacity-80"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>

      {visibleBrainrots.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-border-subtle bg-bg-overlay px-6 py-12 text-center">
          <h2 className="text-xl font-bold text-text-primary">
            No Brainrots found
          </h2>
          <p className="mt-2 text-text-secondary">
            Try changing the search or filters.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-5 rounded-xl bg-lime-text px-5 py-2.5 text-sm font-bold text-black"
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
                className="group overflow-hidden rounded-2xl border border-border-subtle bg-bg-overlay transition hover:-translate-y-0.5 hover:border-white/20"
              >
                <div className="aspect-square overflow-hidden bg-black/20">
                  {brainrot.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={brainrot.image_url}
                      alt={`${brainrot.name} Steal a Brainrot`}
                      loading="lazy"
                      className="h-full w-full object-contain p-3 transition duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center px-4 text-center text-sm text-text-tertiary">
                      No image
                    </div>
                  )}
                </div>

                <div className="p-3 sm:p-4">
                  <h2 className="line-clamp-2 min-h-10 text-sm font-bold leading-5 text-text-primary sm:text-base">
                    {brainrot.name}
                  </h2>

                  <div className="mt-2 flex items-center justify-between gap-2 text-xs text-text-tertiary">
                    <span>{brainrot.rarity}</span>
                    <span>{formatIncome(brainrot.base_income_per_second)}</span>
                  </div>

                  <div className="mt-3 border-t border-border-subtle pt-3">
                    {displayPrice ? (
                      <p className="text-sm font-bold text-text-primary">
                        {brainrot.display_price_label} {displayPrice}
                      </p>
                    ) : (
                      <p className="text-xs leading-5 text-text-tertiary">
                        Not enough verified market data
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}
