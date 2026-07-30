'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  ArrowRight,
  Calculator,
  CircleDollarSign,
  Search,
  Sparkles,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { formatConfidence } from '@/lib/sab/format'

export type CalculatorBrainrot = {
  id: string
  name: string
  slug: string
  rarity: string
  baseIncomePerSecond: number | null
  imageUrl: string | null
}

export type CalculatorMutation = {
  id: string
  name: string
  slug: string
  multiplier: number
  availability: string
}

export type CalculatorOverride = {
  brainrotId: string
  mutationId: string
  incomePerSecond: number
  incomeSource: string
}

export type CalculatorPrice = {
  brainrotId: string
  mutationId: string
  marketValueUsd: number
  marketLowUsd: number
  marketHighUsd: number
  confidenceLabel: string
  sampleSize: number
  priceUpdatedAt: string | null
  isTradeReady: boolean
}

interface ValueCalculatorClientProps {
  brainrots: CalculatorBrainrot[]
  mutations: CalculatorMutation[]
  overrides: CalculatorOverride[]
  prices: CalculatorPrice[]
  initialBrainrotSlug?: string
  initialMutationSlug?: string
}

const POPULAR_BRAINROT_SLUGS = [
  'garama-and-madundung',
  'dragon-cannelloni',
  'skibidi-toilet',
  'cerberus',
]

function formatCompactNumber(value: number | null): string {
  if (value == null || !Number.isFinite(value)) {
    return 'Unknown'
  }

  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 1,
  }).format(value)
}

function formatIncomeRate(
  value: number | null,
  unit: 's' | 'min' | 'hr' | 'day',
): string {
  const formatted = formatCompactNumber(value)
  return formatted === 'Unknown'
    ? formatted
    : `${formatted}/${unit}`
}

function formatMoney(value: number | null): string {
  if (value == null || !Number.isFinite(value)) {
    return 'Unknown'
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: value < 10 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatRange(
  low: number | null,
  high: number | null,
  point: number | null,
): string {
  if (point == null) return 'Not enough market data'

  if (
    low != null &&
    high != null &&
    Math.abs(high - low) > 0.01
  ) {
    return `${formatMoney(low)}–${formatMoney(high)}`
  }

  return formatMoney(point)
}


export default function ValueCalculatorClient({
  brainrots,
  mutations,
  overrides,
  prices,
  initialBrainrotSlug,
  initialMutationSlug,
}: ValueCalculatorClientProps) {
  const router = useRouter()
  const pathname = usePathname()

  const initialBrainrot =
    brainrots.find(
      (brainrot) => brainrot.slug === initialBrainrotSlug,
    ) ?? null

  const initialMutation =
    mutations.find(
      (mutation) =>
        mutation.slug === initialMutationSlug,
    ) ??
    mutations.find(
      (mutation) => mutation.slug === 'default',
    ) ??
    mutations[0] ??
    null

  const [selectedBrainrotId, setSelectedBrainrotId] =
    useState(initialBrainrot?.id ?? '')
  const [selectedMutationId, setSelectedMutationId] =
    useState(initialMutation?.id ?? '')
  const [search, setSearch] = useState('')

  const selectedBrainrot =
    brainrots.find(
      (brainrot) => brainrot.id === selectedBrainrotId,
    ) ?? null

  const selectedMutation =
    mutations.find(
      (mutation) => mutation.id === selectedMutationId,
    ) ??
    initialMutation ??
    null

  const overrideMap = useMemo(
    () =>
      new Map(
        overrides.map((override) => [
          `${override.brainrotId}:${override.mutationId}`,
          override,
        ]),
      ),
    [overrides],
  )

  const priceMap = useMemo(
    () =>
      new Map(
        prices.map((price) => [
          `${price.brainrotId}:${price.mutationId}`,
          price,
        ]),
      ),
    [prices],
  )

  const popularBrainrots = useMemo(() => {
    const prioritized = POPULAR_BRAINROT_SLUGS
      .map((slug) =>
        brainrots.find(
          (brainrot) => brainrot.slug === slug,
        ),
      )
      .filter(
        (brainrot): brainrot is CalculatorBrainrot =>
          brainrot != null,
      )

    const existingIds = new Set(
      prioritized.map((brainrot) => brainrot.id),
    )

    const fallback = brainrots
      .filter(
        (brainrot) =>
          !existingIds.has(brainrot.id) &&
          brainrot.baseIncomePerSecond != null,
      )
      .slice(0, Math.max(0, 6 - prioritized.length))

    return [...prioritized, ...fallback].slice(0, 6)
  }, [brainrots])

  const visibleBrainrots = useMemo(() => {
    const query = search.trim().toLowerCase()

    if (!query) return popularBrainrots

    return brainrots
      .filter((brainrot) =>
        `${brainrot.name} ${brainrot.rarity}`
          .toLowerCase()
          .includes(query),
      )
      .slice(0, 12)
  }, [brainrots, popularBrainrots, search])

  const selectedOverride =
    selectedBrainrot && selectedMutation
      ? overrideMap.get(
          `${selectedBrainrot.id}:${selectedMutation.id}`,
        ) ?? null
      : null

  const selectedPrice =
    selectedBrainrot && selectedMutation
      ? priceMap.get(
          `${selectedBrainrot.id}:${selectedMutation.id}`,
        ) ?? null
      : null

  const incomePerSecond = (() => {
    if (!selectedBrainrot || !selectedMutation) return null
    if (selectedOverride) {
      return selectedOverride.incomePerSecond
    }
    if (selectedBrainrot.baseIncomePerSecond == null) {
      return null
    }

    return Math.round(
      selectedBrainrot.baseIncomePerSecond *
        selectedMutation.multiplier,
    )
  })()

  const defaultMutationId =
    mutations.find(
      (mutation) => mutation.slug === 'default',
    )?.id ??
    mutations[0]?.id ??
    ''

  const defaultPriceByBrainrot = useMemo(() => {
    const result = new Map<string, CalculatorPrice>()

    for (const price of prices) {
      if (price.mutationId === defaultMutationId) {
        result.set(price.brainrotId, price)
      }
    }

    return result
  }, [defaultMutationId, prices])

  const updateUrl = (
    brainrotSlug: string,
    mutationSlug: string,
  ) => {
    const params = new URLSearchParams()
    params.set('brainrot', brainrotSlug)
    params.set('mutation', mutationSlug)

    router.replace(
      `${pathname}?${params.toString()}`,
      { scroll: false },
    )
  }

  const chooseBrainrot = (
    brainrot: CalculatorBrainrot,
  ) => {
    setSelectedBrainrotId(brainrot.id)
    setSearch('')

    if (selectedMutation) {
      updateUrl(
        brainrot.slug,
        selectedMutation.slug,
      )
    }
  }

  const chooseMutation = (mutationId: string) => {
    setSelectedMutationId(mutationId)

    const mutation = mutations.find(
      (item) => item.id === mutationId,
    )

    if (selectedBrainrot && mutation) {
      updateUrl(
        selectedBrainrot.slug,
        mutation.slug,
      )
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.12fr)_minmax(380px,0.88fr)] lg:items-start">
      <Card className="rounded-2xl border-border-subtle bg-bg-overlay shadow-none">
        <CardHeader className="space-y-3 border-b border-border-subtle p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="rounded-xl border border-border-subtle bg-black/20 p-2.5 text-lime-text">
              <Search className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-text-primary">
                Choose a Brainrot
              </CardTitle>
              <CardDescription className="mt-1 text-sm leading-6 text-text-secondary">
                Search all {brainrots.length.toLocaleString()}
                {' '}Brainrots or start with a popular item.
              </CardDescription>
            </div>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
            <Input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search Brainrot name or rarity"
              className="h-12 rounded-xl border-border-subtle bg-black/15 pl-10 pr-11 text-text-primary placeholder:text-text-tertiary focus-visible:ring-lime-text/30"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear Brainrot search"
                className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-text-tertiary transition hover:bg-white/5 hover:text-text-primary"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-5 sm:p-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-text-primary">
                {search.trim()
                  ? 'Search results'
                  : 'Popular Brainrots'}
              </p>
              <p className="mt-0.5 text-xs text-text-tertiary">
                {search.trim()
                  ? `${visibleBrainrots.length} matching items`
                  : 'Quick picks to start calculating'}
              </p>
            </div>
            {!search.trim() && (
              <Badge
                variant="outline"
                className="border-border-subtle bg-black/10 text-text-secondary"
              >
                <Sparkles className="mr-1 h-3 w-3 text-lime-text" />
                Popular
              </Badge>
            )}
          </div>

          {visibleBrainrots.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {visibleBrainrots.map((brainrot) => {
                const active =
                  brainrot.id === selectedBrainrotId
                const defaultPrice =
                  defaultPriceByBrainrot.get(brainrot.id)

                return (
                  <button
                    key={brainrot.id}
                    type="button"
                    onClick={() => chooseBrainrot(brainrot)}
                    className={cn(
                      'group flex min-h-[92px] w-full items-center gap-3 rounded-xl border p-3 text-left transition',
                      active
                        ? 'border-lime-text/60 bg-lime-text/10'
                        : 'border-border-subtle bg-black/10 hover:border-white/20 hover:bg-white/[0.03]',
                    )}
                  >
                    <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-border-subtle bg-black/20 p-1.5">
                      {brainrot.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={brainrot.imageUrl}
                          alt=""
                          className="h-full w-full object-contain transition group-hover:scale-[1.03]"
                        />
                      ) : null}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-bold leading-5 text-text-primary">
                        {brainrot.name}
                      </p>
                      <p className="mt-1 text-xs text-text-tertiary">
                        {brainrot.rarity}
                        {' · '}
                        {formatIncomeRate(
                          brainrot.baseIncomePerSecond,
                          's',
                        )}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-lime-text">
                        {defaultPrice
                          ? `Market ${formatMoney(defaultPrice.marketValueUsd)}`
                          : 'Market data pending'}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border-subtle bg-black/10 px-5 py-10 text-center">
              <p className="font-semibold text-text-primary">
                No Brainrots found
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                Try a different name or rarity.
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-4 border-border-subtle"
                onClick={() => setSearch('')}
              >
                Clear search
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border-subtle bg-bg-overlay shadow-none lg:sticky lg:top-28">
        <CardHeader className="border-b border-border-subtle p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="rounded-xl border border-border-subtle bg-black/20 p-2.5 text-lime-text">
              <Calculator className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-text-primary">
                Value and income
              </CardTitle>
              <CardDescription className="mt-1 text-sm leading-6 text-text-secondary">
                One exact Brainrot and mutation at a time.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5 sm:p-6">
          {!selectedBrainrot || !selectedMutation ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed border-border-subtle bg-black/10 px-6 text-center">
              <div className="rounded-2xl border border-border-subtle bg-bg-overlay p-4 text-lime-text">
                <Sparkles className="h-6 w-6" />
              </div>
              <h2 className="mt-5 text-lg font-bold text-text-primary">
                Select a Brainrot
              </h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-text-secondary">
                Choose a popular item or search above to view
                its current market price and mutation income.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center gap-4 rounded-xl border border-border-subtle bg-black/10 p-4">
                <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl border border-border-subtle bg-black/20 p-2">
                  {selectedBrainrot.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selectedBrainrot.imageUrl}
                      alt=""
                      className="h-full w-full object-contain"
                    />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-bold leading-6 text-text-primary">
                    {selectedBrainrot.name}
                  </p>
                  <p className="mt-1 text-sm text-text-secondary">
                    {selectedBrainrot.rarity}
                    {' · Base '}
                    {formatIncomeRate(
                      selectedBrainrot.baseIncomePerSecond,
                      's',
                    )}
                  </p>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                  Mutation
                </label>
                <Select
                  value={selectedMutation.id}
                  onValueChange={chooseMutation}
                >
                  <SelectTrigger className="mt-2 h-12 rounded-xl border-border-subtle bg-black/15">
                    <SelectValue placeholder="Choose mutation" />
                  </SelectTrigger>
                  <SelectContent>
                    {mutations.map((mutation) => (
                      <SelectItem
                        key={mutation.id}
                        value={mutation.id}
                      >
                        {mutation.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-2 text-xs text-text-tertiary">
                  {selectedMutation.name} uses a{' '}
                  {new Intl.NumberFormat('en-US', {
                    maximumFractionDigits: 2,
                  }).format(selectedMutation.multiplier)}
                  x income multiplier.
                </p>
              </div>

              <div className="rounded-xl border border-lime-text/30 bg-lime-text/5 p-5">
                <div className="flex items-center gap-2 text-lime-text">
                  <CircleDollarSign className="h-4 w-4" />
                  <p className="text-xs font-bold uppercase tracking-[0.14em]">
                    Current Market Price
                  </p>
                </div>

                {selectedPrice ? (
                  <>
                    <p className="mt-3 text-3xl font-extrabold tracking-tight text-text-primary">
                      {formatMoney(
                        selectedPrice.marketValueUsd,
                      )}
                    </p>
                    <p className="mt-2 text-sm text-text-secondary">
                      Typical market range{' '}
                      {formatRange(
                        selectedPrice.marketLowUsd,
                        selectedPrice.marketHighUsd,
                        selectedPrice.marketValueUsd,
                      )}
                    </p>
                    <p className="mt-1 text-xs text-text-tertiary">
                      {formatConfidence(
                        selectedPrice.confidenceLabel,
                      )}
                      {selectedPrice.sampleSize > 0
                        ? ` · Based on ${selectedPrice.sampleSize.toLocaleString()} current listings`
                        : ''}
                    </p>
                    {!selectedPrice.isTradeReady && (
                      <p className="mt-2 text-xs text-text-tertiary">
                        Display estimate only · Cash trade verdict requires stronger evidence
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="mt-3 text-lg font-bold text-text-primary">
                      Not enough verified market data
                    </p>
                    <p className="mt-2 text-sm text-text-secondary">
                      Income remains available below.
                    </p>
                  </>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                  Mutation income
                </p>
                <p className="mt-2 text-3xl font-extrabold tracking-tight text-text-primary">
                  {formatIncomeRate(
                    incomePerSecond,
                    's',
                  )}
                </p>
                <p className="mt-2 text-sm text-text-secondary">
                  {selectedOverride
                    ? 'Uses a verified variant-specific income value.'
                    : incomePerSecond == null
                      ? 'Base income has not been verified yet.'
                      : 'Calculated from the verified base income and selected mutation.'}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <MetricCard
                  label="Per minute"
                  value={formatIncomeRate(
                    incomePerSecond == null
                      ? null
                      : incomePerSecond * 60,
                    'min',
                  )}
                />
                <MetricCard
                  label="Per hour"
                  value={formatIncomeRate(
                    incomePerSecond == null
                      ? null
                      : incomePerSecond * 3600,
                    'hr',
                  )}
                />
                <MetricCard
                  label="Per day"
                  value={formatIncomeRate(
                    incomePerSecond == null
                      ? null
                      : incomePerSecond * 86400,
                    'day',
                  )}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Button
                  asChild
                  className="min-h-11 rounded-xl bg-lime-text font-bold text-black hover:bg-lime-text/90"
                >
                  <Link
                    href={`/steal-a-brainrot/values/${selectedBrainrot.slug}`}
                  >
                    Full value page
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>

                <Button
                  asChild
                  variant="outline"
                  className="min-h-11 rounded-xl border-border-subtle"
                >
                  <Link
                    href={`/steal-a-brainrot/buy-items?search=${encodeURIComponent(selectedBrainrot.name)}`}
                  >
                    Browse listings
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function MetricCard({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="min-w-0 rounded-xl border border-border-subtle bg-black/15 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">
        {label}
      </p>
      <p className="mt-2 truncate text-sm font-bold text-text-primary">
        {value}
      </p>
    </div>
  )
}
