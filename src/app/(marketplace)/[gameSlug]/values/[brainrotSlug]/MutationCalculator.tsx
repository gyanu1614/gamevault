'use client'

import { useMemo, useState } from 'react'
import { Calculator } from 'lucide-react'
import { cn } from '@/lib/utils'

export type MutationOption = {
  slug: string
  name: string
  multiplier: number
  availability: string
  calculatedIncomePerSecond: number | null
  incomeSource: string
  isVerifiedVariant: boolean
}

interface MutationCalculatorProps {
  brainrotName: string
  baseIncomePerSecond: number | null
  mutations: MutationOption[]
}

function formatIncome(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return 'Unknown'
  return `$${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(value)}/s`
}

function formatMultiplier(value: number): string {
  return `${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(value)}x`
}

export default function MutationCalculator({
  brainrotName,
  baseIncomePerSecond,
  mutations,
}: MutationCalculatorProps) {
  const defaultSlug = mutations.find((mutation) => mutation.slug === 'default')?.slug ?? mutations[0]?.slug ?? ''
  const [selectedSlug, setSelectedSlug] = useState(defaultSlug)

  const selected = useMemo(
    () => mutations.find((mutation) => mutation.slug === selectedSlug) ?? mutations[0] ?? null,
    [mutations, selectedSlug],
  )

  if (!selected) return null

  return (
    <section className="rounded-2xl border border-border-subtle bg-bg-overlay p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl border border-border-subtle bg-black/20 p-2.5 text-lime-text">
          <Calculator className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-text-primary">Mutation income calculator</h2>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            Select a mutation to estimate how much {brainrotName} earns per second.
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {mutations.map((mutation) => {
          const active = mutation.slug === selected.slug
          return (
            <button
              key={mutation.slug}
              type="button"
              onClick={() => setSelectedSlug(mutation.slug)}
              className={cn(
                'min-h-12 rounded-xl border px-3 py-2 text-left transition',
                active
                  ? 'border-lime-text/60 bg-lime-text/10 text-text-primary'
                  : 'border-border-subtle bg-black/10 text-text-secondary hover:border-white/20 hover:text-text-primary',
              )}
            >
              <span className="block text-sm font-semibold">{mutation.name}</span>
              <span className="mt-0.5 block text-xs text-text-tertiary">
                {formatMultiplier(mutation.multiplier)}
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border-subtle bg-black/15 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Base income</p>
          <p className="mt-2 text-xl font-bold text-text-primary">{formatIncome(baseIncomePerSecond)}</p>
        </div>
        <div className="rounded-xl border border-border-subtle bg-black/15 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Multiplier</p>
          <p className="mt-2 text-xl font-bold text-text-primary">{formatMultiplier(selected.multiplier)}</p>
        </div>
        <div className="rounded-xl border border-lime-text/30 bg-lime-text/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-lime-text">Estimated income</p>
          <p className="mt-2 text-xl font-extrabold text-text-primary">
            {formatIncome(selected.calculatedIncomePerSecond)}
          </p>
        </div>
      </div>

      <p className="mt-4 text-xs leading-5 text-text-tertiary">
        {selected.incomeSource === 'verified_override'
          ? 'This value uses a verified variant-specific income override.'
          : selected.calculatedIncomePerSecond == null
            ? 'The base income is not verified yet, so this mutation estimate is unavailable.'
            : `Calculated from the verified base income using the ${selected.name} multiplier.`}
      </p>
    </section>
  )
}
