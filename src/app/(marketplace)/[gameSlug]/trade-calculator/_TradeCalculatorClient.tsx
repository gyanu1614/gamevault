'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Plus, Search, Trash2 } from 'lucide-react'

export type TradeBrainrot = {
  id: string
  name: string
  slug: string
  rarity: string
  baseIncomePerSecond: number | null
  imageUrl: string | null
}

export type TradeMutation = {
  id: string
  name: string
  slug: string
  multiplier: number
}

export type TradeOverride = {
  brainrotId: string
  mutationId: string
  incomePerSecond: number
}

type TradeEntry = {
  instanceId: string
  brainrotId: string
  mutationId: string
  quantity: number
}

type SideKey = 'give' | 'receive'

type SideSummary = {
  totalIncome: number
  unknownCount: number
}

interface TradeCalculatorClientProps {
  brainrots: TradeBrainrot[]
  mutations: TradeMutation[]
  overrides: TradeOverride[]
}

function createInstanceId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function formatIncome(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return 'Unknown'

  return `$${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(value)}/s`
}

function formatSignedIncome(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '-' : ''
  return `${sign}${formatIncome(Math.abs(value))}`
}

export default function TradeCalculatorClient({
  brainrots,
  mutations,
  overrides,
}: TradeCalculatorClientProps) {
  const defaultMutationId =
    mutations.find((mutation) => mutation.slug === 'default')?.id ??
    mutations[0]?.id ??
    ''

  const [giveEntries, setGiveEntries] = useState<TradeEntry[]>([])
  const [receiveEntries, setReceiveEntries] = useState<TradeEntry[]>([])

  const brainrotMap = useMemo(
    () => new Map(brainrots.map((brainrot) => [brainrot.id, brainrot])),
    [brainrots],
  )

  const mutationMap = useMemo(
    () => new Map(mutations.map((mutation) => [mutation.id, mutation])),
    [mutations],
  )

  const overrideMap = useMemo(
    () =>
      new Map(
        overrides.map((override) => [
          `${override.brainrotId}:${override.mutationId}`,
          override.incomePerSecond,
        ]),
      ),
    [overrides],
  )

  const entryIncome = (entry: TradeEntry): number | null => {
    const brainrot = brainrotMap.get(entry.brainrotId)
    const mutation = mutationMap.get(entry.mutationId)

    if (!brainrot || !mutation) return null

    const override = overrideMap.get(`${brainrot.id}:${mutation.id}`)
    const unitIncome =
      override ??
      (brainrot.baseIncomePerSecond == null
        ? null
        : brainrot.baseIncomePerSecond * mutation.multiplier)

    if (unitIncome == null) return null
    return unitIncome * entry.quantity
  }

  const summarize = (entries: TradeEntry[]): SideSummary => {
    let totalIncome = 0
    let unknownCount = 0

    entries.forEach((entry) => {
      const income = entryIncome(entry)
      if (income == null) {
        unknownCount += 1
      } else {
        totalIncome += income
      }
    })

    return { totalIncome, unknownCount }
  }

  const giveSummary = summarize(giveEntries)
  const receiveSummary = summarize(receiveEntries)

  const ready =
    giveEntries.length > 0 &&
    receiveEntries.length > 0 &&
    giveSummary.unknownCount === 0 &&
    receiveSummary.unknownCount === 0 &&
    giveSummary.totalIncome > 0

  const difference = receiveSummary.totalIncome - giveSummary.totalIncome
  const percentageDifference = ready
    ? (difference / giveSummary.totalIncome) * 100
    : null

  const verdict = (() => {
    if (!ready || percentageDifference == null) {
      return {
        label: 'Add both sides',
        description: 'Choose at least one verified-value Brainrot on each side.',
        className: 'border-border-subtle bg-black/15 text-text-secondary',
      }
    }

    if (Math.abs(percentageDifference) <= 5) {
      return {
        label: 'Fair',
        description: 'The two sides are within 5% of each other.',
        className: 'border-warning/30 bg-warning/10 text-warning',
      }
    }

    if (percentageDifference > 0) {
      return {
        label: 'Win',
        description: 'You receive more mutation-adjusted income value than you give.',
        className: 'border-success/30 bg-success/10 text-success',
      }
    }

    return {
      label: 'Loss',
      description: 'You give more mutation-adjusted income value than you receive.',
      className: 'border-danger/30 bg-danger/10 text-danger',
    }
  })()

  const setEntries = (
    side: SideKey,
    updater: (entries: TradeEntry[]) => TradeEntry[],
  ) => {
    if (side === 'give') {
      setGiveEntries((entries) => updater(entries))
    } else {
      setReceiveEntries((entries) => updater(entries))
    }
  }

  const addEntry = (side: SideKey, brainrotId: string) => {
    if (!defaultMutationId) return

    setEntries(side, (entries) => [
      ...entries,
      {
        instanceId: createInstanceId(),
        brainrotId,
        mutationId: defaultMutationId,
        quantity: 1,
      },
    ])
  }

  const updateEntry = (
    side: SideKey,
    instanceId: string,
    patch: Partial<TradeEntry>,
  ) => {
    setEntries(side, (entries) =>
      entries.map((entry) =>
        entry.instanceId === instanceId ? { ...entry, ...patch } : entry,
      ),
    )
  }

  const removeEntry = (side: SideKey, instanceId: string) => {
    setEntries(side, (entries) =>
      entries.filter((entry) => entry.instanceId !== instanceId),
    )
  }

  const clearAll = () => {
    setGiveEntries([])
    setReceiveEntries([])
  }

  if (brainrots.length === 0 || mutations.length === 0) {
    return (
      <div className="rounded-2xl border border-border-subtle bg-bg-overlay p-8 text-center text-text-secondary">
        Trade calculator data is temporarily unavailable.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_360px]">
        <TradeSide
          title="You give"
          description="Brainrots leaving your inventory"
          side="give"
          entries={giveEntries}
          brainrots={brainrots}
          mutations={mutations}
          brainrotMap={brainrotMap}
          entryIncome={entryIncome}
          onAdd={addEntry}
          onUpdate={updateEntry}
          onRemove={removeEntry}
        />

        <TradeSide
          title="You receive"
          description="Brainrots entering your inventory"
          side="receive"
          entries={receiveEntries}
          brainrots={brainrots}
          mutations={mutations}
          brainrotMap={brainrotMap}
          entryIncome={entryIncome}
          onAdd={addEntry}
          onUpdate={updateEntry}
          onRemove={removeEntry}
        />

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <section className="rounded-2xl border border-border-subtle bg-bg-overlay p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-lime-text">
              Trade result
            </p>

            <div className={`mt-4 rounded-2xl border p-5 ${verdict.className}`}>
              <p className="text-3xl font-extrabold tracking-tight">{verdict.label}</p>
              <p className="mt-2 text-sm leading-6 opacity-90">{verdict.description}</p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <SummaryCard label="You give" value={giveSummary.totalIncome} />
              <SummaryCard label="You receive" value={receiveSummary.totalIncome} />
            </div>

            <dl className="mt-5 space-y-4">
              <ResultRow
                label="Value difference"
                value={ready ? formatSignedIncome(difference) : 'Pending'}
              />
              <ResultRow
                label="Percentage difference"
                value={
                  percentageDifference == null
                    ? 'Pending'
                    : `${percentageDifference > 0 ? '+' : ''}${percentageDifference.toFixed(1)}%`
                }
              />
              <ResultRow
                label="Fair range"
                value="Within 5%"
              />
            </dl>

            {(giveSummary.unknownCount > 0 || receiveSummary.unknownCount > 0) && (
              <p className="mt-5 rounded-xl border border-warning/20 bg-warning/5 p-3 text-xs leading-5 text-warning">
                The verdict is paused because one or more selected Brainrots has no verified base income.
              </p>
            )}

            <button
              type="button"
              onClick={clearAll}
              className="mt-5 w-full rounded-xl border border-border-subtle px-4 py-2.5 text-sm font-semibold text-text-primary transition hover:border-white/20"
            >
              Clear trade
            </button>
          </section>

          <section className="rounded-2xl border border-border-subtle bg-bg-overlay p-5">
            <h2 className="font-bold text-text-primary">How this estimate works</h2>
            <p className="mt-3 text-sm leading-6 text-text-secondary">
              Each Brainrot uses its verified base income, selected mutation multiplier, quantity, and any verified variant override. This is an income-based estimate, not a guaranteed cash price.
            </p>
            <Link
              href="/steal-a-brainrot/values"
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-lime-text"
            >
              Browse Brainrot values
              <ArrowRight className="h-4 w-4" />
            </Link>
          </section>
        </aside>
      </div>
    </div>
  )
}

function TradeSide({
  title,
  description,
  side,
  entries,
  brainrots,
  mutations,
  brainrotMap,
  entryIncome,
  onAdd,
  onUpdate,
  onRemove,
}: {
  title: string
  description: string
  side: SideKey
  entries: TradeEntry[]
  brainrots: TradeBrainrot[]
  mutations: TradeMutation[]
  brainrotMap: Map<string, TradeBrainrot>
  entryIncome: (entry: TradeEntry) => number | null
  onAdd: (side: SideKey, brainrotId: string) => void
  onUpdate: (side: SideKey, instanceId: string, patch: Partial<TradeEntry>) => void
  onRemove: (side: SideKey, instanceId: string) => void
}) {
  const [query, setQuery] = useState('')

  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return []

    return brainrots
      .filter((brainrot) =>
        `${brainrot.name} ${brainrot.rarity}`.toLowerCase().includes(normalized),
      )
      .slice(0, 8)
  }, [brainrots, query])

  const addBrainrot = (brainrotId: string) => {
    onAdd(side, brainrotId)
    setQuery('')
  }

  return (
    <section className="rounded-2xl border border-border-subtle bg-bg-overlay p-5 sm:p-6">
      <div>
        <h2 className="text-xl font-bold text-text-primary">{title}</h2>
        <p className="mt-1 text-sm text-text-secondary">{description}</p>
      </div>

      <div className="relative mt-5">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search and add a Brainrot"
          className="h-12 w-full rounded-xl border border-border-subtle bg-black/15 pl-10 pr-4 text-text-primary outline-none placeholder:text-text-tertiary focus:border-lime-text/60"
        />
      </div>

      {query.trim() && (
        <div className="mt-2 max-h-64 space-y-1 overflow-y-auto rounded-xl border border-border-subtle bg-black/20 p-2">
          {matches.length > 0 ? (
            matches.map((brainrot) => (
              <button
                key={brainrot.id}
                type="button"
                onClick={() => addBrainrot(brainrot.id)}
                className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition hover:bg-white/5"
              >
                <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-black/20 p-1">
                  {brainrot.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={brainrot.imageUrl} alt="" className="h-full w-full object-contain" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-text-primary">{brainrot.name}</p>
                  <p className="text-xs text-text-tertiary">{brainrot.rarity} · {formatIncome(brainrot.baseIncomePerSecond)}</p>
                </div>
                <Plus className="h-4 w-4 text-lime-text" />
              </button>
            ))
          ) : (
            <p className="p-3 text-sm text-text-secondary">No Brainrots found.</p>
          )}
        </div>
      )}

      <div className="mt-5 space-y-3">
        {entries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border-subtle bg-black/10 px-4 py-10 text-center text-sm text-text-tertiary">
            Search above to add the first Brainrot.
          </div>
        ) : (
          entries.map((entry) => {
            const brainrot = brainrotMap.get(entry.brainrotId)
            if (!brainrot) return null

            return (
              <div key={entry.instanceId} className="rounded-xl border border-border-subtle bg-black/10 p-3">
                <div className="flex items-start gap-3">
                  <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-black/20 p-1.5">
                    {brainrot.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={brainrot.imageUrl} alt="" className="h-full w-full object-contain" />
                    ) : null}
                  </div>

                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/steal-a-brainrot/values/${brainrot.slug}`}
                      className="line-clamp-1 font-semibold text-text-primary hover:text-lime-text"
                    >
                      {brainrot.name}
                    </Link>
                    <p className="mt-0.5 text-xs text-text-tertiary">{brainrot.rarity}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onRemove(side, entry.instanceId)}
                    aria-label={`Remove ${brainrot.name}`}
                    className="rounded-lg p-2 text-text-tertiary transition hover:bg-white/5 hover:text-danger"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-[minmax(0,1fr)_88px] gap-2">
                  <select
                    value={entry.mutationId}
                    onChange={(event) =>
                      onUpdate(side, entry.instanceId, { mutationId: event.target.value })
                    }
                    className="h-10 min-w-0 rounded-lg border border-border-subtle bg-bg-overlay px-2 text-sm text-text-primary outline-none focus:border-lime-text/60"
                  >
                    {mutations.map((mutation) => (
                      <option key={mutation.id} value={mutation.id}>
                        {mutation.name} ({mutation.multiplier}x)
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={entry.quantity}
                    onChange={(event) => {
                      const parsed = Number.parseInt(event.target.value, 10)
                      onUpdate(side, entry.instanceId, {
                        quantity: Number.isFinite(parsed) ? Math.min(99, Math.max(1, parsed)) : 1,
                      })
                    }}
                    aria-label={`${brainrot.name} quantity`}
                    className="h-10 rounded-lg border border-border-subtle bg-bg-overlay px-2 text-center text-sm text-text-primary outline-none focus:border-lime-text/60"
                  />
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 border-t border-border-subtle pt-3 text-sm">
                  <span className="text-text-tertiary">Adjusted value</span>
                  <span className="font-bold text-text-primary">{formatIncome(entryIncome(entry))}</span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-black/15 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">{label}</p>
      <p className="mt-2 break-words font-bold text-text-primary">{formatIncome(value)}</p>
    </div>
  )
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border-subtle pb-4 last:border-0 last:pb-0">
      <dt className="text-sm text-text-secondary">{label}</dt>
      <dd className="text-right text-sm font-bold text-text-primary">{value}</dd>
    </div>
  )
}
