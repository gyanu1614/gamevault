'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowRight, Calculator, Search } from 'lucide-react'

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

interface ValueCalculatorClientProps {
  brainrots: CalculatorBrainrot[]
  mutations: CalculatorMutation[]
  overrides: CalculatorOverride[]
  initialBrainrotSlug?: string
  initialMutationSlug?: string
}

function formatIncome(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return 'Unknown'
  return `$${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(value)}`
}

export default function ValueCalculatorClient({
  brainrots,
  mutations,
  overrides,
  initialBrainrotSlug,
  initialMutationSlug,
}: ValueCalculatorClientProps) {
  const router = useRouter()
  const pathname = usePathname()

  const initialBrainrot =
    brainrots.find((brainrot) => brainrot.slug === initialBrainrotSlug) ??
    brainrots.find((brainrot) => brainrot.baseIncomePerSecond != null) ??
    brainrots[0]

  const initialMutation =
    mutations.find((mutation) => mutation.slug === initialMutationSlug) ??
    mutations.find((mutation) => mutation.slug === 'default') ??
    mutations[0]

  const [selectedBrainrotId, setSelectedBrainrotId] = useState(initialBrainrot?.id ?? '')
  const [selectedMutationId, setSelectedMutationId] = useState(initialMutation?.id ?? '')
  const [search, setSearch] = useState(initialBrainrot?.name ?? '')

  const selectedBrainrot =
    brainrots.find((brainrot) => brainrot.id === selectedBrainrotId) ?? brainrots[0] ?? null
  const selectedMutation =
    mutations.find((mutation) => mutation.id === selectedMutationId) ?? mutations[0] ?? null

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

  const filteredBrainrots = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return brainrots.slice(0, 12)
    return brainrots
      .filter((brainrot) =>
        `${brainrot.name} ${brainrot.rarity}`.toLowerCase().includes(query),
      )
      .slice(0, 12)
  }, [brainrots, search])

  const selectedOverride =
    selectedBrainrot && selectedMutation
      ? overrideMap.get(`${selectedBrainrot.id}:${selectedMutation.id}`) ?? null
      : null

  const incomePerSecond = (() => {
    if (!selectedBrainrot || !selectedMutation) return null
    if (selectedOverride) return selectedOverride.incomePerSecond
    if (selectedBrainrot.baseIncomePerSecond == null) return null
    return Math.round(selectedBrainrot.baseIncomePerSecond * selectedMutation.multiplier)
  })()

  const updateUrl = (brainrotSlug: string, mutationSlug: string) => {
    const params = new URLSearchParams()
    params.set('brainrot', brainrotSlug)
    params.set('mutation', mutationSlug)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const chooseBrainrot = (brainrot: CalculatorBrainrot) => {
    setSelectedBrainrotId(brainrot.id)
    setSearch(brainrot.name)
    if (selectedMutation) updateUrl(brainrot.slug, selectedMutation.slug)
  }

  const chooseMutation = (mutationId: string) => {
    setSelectedMutationId(mutationId)
    const mutation = mutations.find((item) => item.id === mutationId)
    if (selectedBrainrot && mutation) updateUrl(selectedBrainrot.slug, mutation.slug)
  }

  if (!selectedBrainrot || !selectedMutation) {
    return (
      <div className="rounded-2xl border border-border-subtle bg-bg-overlay p-8 text-center text-text-secondary">
        Calculator data is unavailable.
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className="rounded-2xl border border-border-subtle bg-bg-overlay p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-border-subtle bg-black/20 p-2.5 text-lime-text">
            <Search className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-text-primary">Choose a Brainrot</h2>
            <p className="mt-1 text-sm text-text-secondary">Search all {brainrots.length.toLocaleString()} Brainrots.</p>
          </div>
        </div>

        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by Brainrot name or rarity"
          className="mt-5 h-12 w-full rounded-xl border border-border-subtle bg-black/15 px-4 text-text-primary outline-none transition placeholder:text-text-tertiary focus:border-lime-text/60"
        />

        <div className="mt-3 max-h-[360px] space-y-2 overflow-y-auto pr-1">
          {filteredBrainrots.length > 0 ? (
            filteredBrainrots.map((brainrot) => {
              const active = brainrot.id === selectedBrainrot.id
              return (
                <button
                  key={brainrot.id}
                  type="button"
                  onClick={() => chooseBrainrot(brainrot)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                    active
                      ? 'border-lime-text/50 bg-lime-text/10'
                      : 'border-border-subtle bg-black/10 hover:border-white/20'
                  }`}
                >
                  <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-black/20 p-1.5">
                    {brainrot.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={brainrot.imageUrl} alt="" className="h-full w-full object-contain" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-text-primary">{brainrot.name}</p>
                    <p className="mt-0.5 text-xs text-text-tertiary">
                      {brainrot.rarity} · Base {formatIncome(brainrot.baseIncomePerSecond)}/s
                    </p>
                  </div>
                </button>
              )
            })
          ) : (
            <p className="rounded-xl border border-border-subtle bg-black/10 p-4 text-sm text-text-secondary">
              No Brainrots match that search.
            </p>
          )}
        </div>
      </section>

      <aside className="space-y-6">
        <section className="rounded-2xl border border-border-subtle bg-bg-overlay p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-border-subtle bg-black/20 p-2.5 text-lime-text">
              <Calculator className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-text-primary">Income result</h2>
              <p className="mt-1 text-sm text-text-secondary">Choose a mutation to recalculate.</p>
            </div>
          </div>

          <label className="mt-5 block text-xs font-semibold uppercase tracking-wide text-text-tertiary">
            Mutation
          </label>
          <select
            value={selectedMutation.id}
            onChange={(event) => chooseMutation(event.target.value)}
            className="mt-2 h-12 w-full rounded-xl border border-border-subtle bg-black/15 px-3 text-text-primary outline-none focus:border-lime-text/60"
          >
            {mutations.map((mutation) => (
              <option key={mutation.id} value={mutation.id}>
                {mutation.name} ({mutation.multiplier}x)
              </option>
            ))}
          </select>

          <div className="mt-5 rounded-2xl border border-lime-text/30 bg-lime-text/5 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-lime-text">
              {selectedBrainrot.name} · {selectedMutation.name}
            </p>
            <p className="mt-3 text-4xl font-extrabold tracking-tight text-text-primary">
              {formatIncome(incomePerSecond)}
              <span className="ml-1 text-lg font-semibold text-text-secondary">/s</span>
            </p>
            <p className="mt-2 text-sm text-text-secondary">
              {selectedOverride
                ? 'Uses a verified variant-specific income value.'
                : incomePerSecond == null
                  ? 'Base income has not been verified yet.'
                  : `${selectedMutation.multiplier}x the verified base income.`}
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <ResultCard label="Per minute" value={incomePerSecond == null ? null : incomePerSecond * 60} />
            <ResultCard label="Per hour" value={incomePerSecond == null ? null : incomePerSecond * 3600} />
            <ResultCard label="Per day" value={incomePerSecond == null ? null : incomePerSecond * 86400} />
            <ResultCard label="Multiplier" value={selectedMutation.multiplier} suffix="x" raw />
          </div>

          <div className="mt-5 flex flex-col gap-3">
            <Link
              href={`/steal-a-brainrot/values/${selectedBrainrot.slug}`}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-lime-text px-4 py-2.5 text-sm font-bold text-black transition hover:opacity-90"
            >
              View full {selectedBrainrot.name} value page
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={`/steal-a-brainrot/buy-items?search=${encodeURIComponent(selectedBrainrot.name)}`}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border-subtle px-4 py-2.5 text-sm font-semibold text-text-primary transition hover:border-white/20"
            >
              Browse {selectedBrainrot.name} listings
            </Link>
          </div>
        </section>
      </aside>
    </div>
  )
}

function ResultCard({
  label,
  value,
  suffix = '',
  raw = false,
}: {
  label: string
  value: number | null
  suffix?: string
  raw?: boolean
}) {
  const formatted = value == null
    ? 'Unknown'
    : raw
      ? `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)}${suffix}`
      : `${formatIncome(value)}${suffix}`

  return (
    <div className="rounded-xl border border-border-subtle bg-black/15 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">{label}</p>
      <p className="mt-2 break-words font-bold text-text-primary">{formatted}</p>
    </div>
  )
}
