'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCash, formatIncome, formatMultiplier } from '@/lib/sab/format'
import { mutationVisual, mutationOrder } from '@/lib/sab/mutations'

export type MutationOption = {
  slug: string
  name: string
  multiplier: number
  availability: string
  calculatedIncomePerSecond: number | null
  incomeSource: string
  isVerifiedVariant: boolean
  marketValueUsd: number | null
  marketLowUsd: number | null
  marketHighUsd: number | null
  marketConfidenceLabel: string | null
  marketSampleSize: number
  marketUpdatedAt: string | null
}

interface MutationCalculatorProps {
  brainrotName: string
  baseIncomePerSecond: number | null
  mutations: MutationOption[]
  /** Marketplace search link for this brainrot + selected mutation. */
  listingsHref: string
}

export default function MutationCalculator({
  brainrotName,
  baseIncomePerSecond,
  mutations,
  listingsHref,
}: MutationCalculatorProps) {
  const ordered = useMemo(
    () => [...mutations].sort((a, b) => mutationOrder(a.slug) - mutationOrder(b.slug)),
    [mutations],
  )

  const defaultSlug =
    ordered.find((mutation) => mutation.slug === 'default')?.slug ?? ordered[0]?.slug ?? ''
  const [selectedSlug, setSelectedSlug] = useState(defaultSlug)

  const selected = useMemo(
    () => ordered.find((mutation) => mutation.slug === selectedSlug) ?? ordered[0] ?? null,
    [ordered, selectedSlug],
  )

  if (!selected) return null

  const visual = mutationVisual(selected.slug)
  const cash = formatCash(selected.marketValueUsd)
  const low = formatCash(selected.marketLowUsd)
  const high = formatCash(selected.marketHighUsd)
  const range = low && high && low !== high ? `${low} – ${high}` : null
  const selectedListingsHref = `${listingsHref}${
    selected.slug !== 'default' ? `%20${encodeURIComponent(selected.name)}` : ''
  }`

  return (
    <section className="overflow-hidden rounded-2xl border border-[#234B38] bg-[#0F3320] shadow-[0_20px_60px_-30px_rgba(0,0,0,0.8)]">
      {/* Header */}
      <div className="border-b border-[#1F4432] px-5 py-4 sm:px-6">
        <h2 className="text-lg font-bold text-[#F1F5EE]">{brainrotName} cash prices</h2>
        <p className="mt-1 text-sm leading-6 text-[#9FB6A6]">
          Live USD value per mutation, from recent marketplace listings.
        </p>
      </div>

      <div className="p-5 sm:p-6">
        {/* Mutation chips — each in its in-game color */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {ordered.map((mutation) => {
            const mv = mutationVisual(mutation.slug)
            const active = mutation.slug === selected.slug
            const price = formatCash(mutation.marketValueUsd)
            return (
              <button
                key={mutation.slug}
                type="button"
                onClick={() => setSelectedSlug(mutation.slug)}
                aria-pressed={active}
                className={cn(
                  'group relative min-h-[52px] rounded-xl border px-3 py-2 text-left transition',
                  active
                    ? 'border-transparent bg-[#15402A] ring-2'
                    : 'border-[#254B38] bg-[#12331F] hover:border-[#2E5B44]',
                )}
                style={active ? ({ ['--tw-ring-color' as string]: mv.color }) : undefined}
              >
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={
                      mv.gradient
                        ? { backgroundImage: mv.gradient }
                        : { backgroundColor: mv.color }
                    }
                  />
                  <span
                    className="truncate text-sm font-semibold"
                    style={{ color: active ? mv.color : '#DCE7DE' }}
                  >
                    {mutation.name}
                  </span>
                </span>
                <span className="mt-1 block text-xs font-medium text-[#8FA898]">
                  {price ?? formatMultiplier(mutation.multiplier)}
                </span>
              </button>
            )
          })}
        </div>

        {/* Selected mutation — cash headline + stats */}
        <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
          {/* Cash price */}
          <div
            className="rounded-xl border p-5"
            style={{ borderColor: `${visual.color}55`, backgroundColor: visual.soft }}
          >
            <div className="flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-full"
                style={
                  visual.gradient
                    ? { backgroundImage: visual.gradient }
                    : { backgroundColor: visual.color }
                }
              />
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: visual.color }}>
                {selected.name} cash price
              </p>
            </div>
            <p className="mt-2 text-3xl font-extrabold text-[#F5F8F2]">{cash ?? 'No data yet'}</p>
            {range ? <p className="mt-1 text-sm text-[#9FB6A6]">Typical range {range}</p> : null}
            {cash ? (
              <p className="mt-2 text-xs text-[#7E9686]">
                Based on {selected.marketSampleSize} recent listing
                {selected.marketSampleSize === 1 ? '' : 's'}
                {selected.marketConfidenceLabel ? ` · ${selected.marketConfidenceLabel} confidence` : ''}
              </p>
            ) : (
              <p className="mt-2 text-xs text-[#7E9686]">
                No priced listings for {selected.name} yet.
              </p>
            )}

            <Link
              href={selectedListingsHref}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#1B5E3A] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#227446]"
            >
              View {selected.name} listings
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* In-game stats */}
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Base income" value={formatIncome(baseIncomePerSecond)} />
            <Stat label="Multiplier" value={formatMultiplier(selected.multiplier)} />
            <Stat
              label={`${selected.name} income`}
              value={formatIncome(selected.calculatedIncomePerSecond)}
              className="col-span-2"
            />
          </div>
        </div>
      </div>
    </section>
  )
}

function Stat({
  label,
  value,
  className,
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div className={cn('rounded-xl border border-[#254B38] bg-[#12331F] p-4', className)}>
      <p className="text-xs font-semibold uppercase tracking-wide text-[#8FA898]">{label}</p>
      <p className="mt-1.5 text-xl font-bold text-[#EDF3E9]">{value}</p>
    </div>
  )
}
