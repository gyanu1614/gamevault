'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  LockKeyhole,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'

export type TradeBrainrot = {
  id: string
  name: string
  slug: string
  rarity: string
  imageUrl: string | null
}

export type TradeMutation = {
  id: string
  name: string
  slug: string
  multiplier: number
}

export type TradePrice = {
  brainrotId: string
  mutationId: string
  marketValueUsd: number
  marketLowUsd: number
  marketHighUsd: number
  sourceType: string
  sourceName: string | null
  confidenceLabel: string
  sampleSize: number
  priceUpdatedAt: string | null
  isTradeReady: boolean
}

type Side = 'give' | 'receive'

type TradeEntry = {
  instanceId: string
  brainrotId: string
  mutationId: string
  quantity: number
}

type EditorState = {
  side: Side
  instanceId?: string
} | null

type SideSummary = {
  point: number
  low: number
  high: number
  unknown: number
  lowConfidence: number
}

interface TradeCalculatorClientProps {
  brainrots: TradeBrainrot[]
  mutations: TradeMutation[]
  prices: TradePrice[]
}

function makeId(): string {
  return typeof crypto !== 'undefined' &&
    'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`
}

function formatMoney(value: number | null): string {
  if (value == null || !Number.isFinite(value)) {
    return 'Unknown'
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatRange(
  low: number | null,
  high: number | null,
  point: number | null,
): string {
  if (point == null) return 'No market estimate'

  if (
    low != null &&
    high != null &&
    Math.abs(high - low) > 0.01
  ) {
    return `${formatMoney(low)}–${formatMoney(high)}`
  }

  return formatMoney(point)
}

function confidenceLabel(value: string): string {
  if (value === 'reviewed') return 'Reviewed'
  if (value === 'high') return 'High confidence'
  if (value === 'medium') return 'Medium confidence'
  if (value === 'low') return 'Low confidence'
  return 'Insufficient data'
}

export default function TradeCalculatorClient({
  brainrots,
  mutations,
  prices,
}: TradeCalculatorClientProps) {
  const defaultMutationId =
    mutations.find(
      (mutation) => mutation.slug === 'default',
    )?.id ??
    mutations[0]?.id ??
    ''

  const [give, setGive] = useState<TradeEntry[]>([])
  const [receive, setReceive] = useState<TradeEntry[]>([])
  const [editor, setEditor] =
    useState<EditorState>(null)
  const [search, setSearch] = useState('')

  const brainrotMap = useMemo(
    () =>
      new Map(
        brainrots.map((brainrot) => [
          brainrot.id,
          brainrot,
        ]),
      ),
    [brainrots],
  )

  const mutationMap = useMemo(
    () =>
      new Map(
        mutations.map((mutation) => [
          mutation.id,
          mutation,
        ]),
      ),
    [mutations],
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

  const getEntries = (side: Side) =>
    side === 'give' ? give : receive

  const setEntries = (
    side: Side,
    updater: (entries: TradeEntry[]) => TradeEntry[],
  ) => {
    if (side === 'give') {
      setGive((entries) => updater(entries))
    } else {
      setReceive((entries) => updater(entries))
    }
  }

  const getEntryPrice = (
    entry: TradeEntry,
  ): TradePrice | null =>
    priceMap.get(
      `${entry.brainrotId}:${entry.mutationId}`,
    ) ?? null

  const summarize = (
    entries: TradeEntry[],
  ): SideSummary => {
    let point = 0
    let low = 0
    let high = 0
    let unknown = 0
    let lowConfidence = 0

    for (const entry of entries) {
      const price = getEntryPrice(entry)

      if (
        !price ||
        !price.isTradeReady ||
        price.marketValueUsd == null
      ) {
        unknown += 1
        continue
      }

      point +=
        price.marketValueUsd * entry.quantity
      low += price.marketLowUsd * entry.quantity
      high += price.marketHighUsd * entry.quantity

      if (
        price.confidenceLabel === 'low' ||
        price.confidenceLabel === 'insufficient'
      ) {
        lowConfidence += 1
      }
    }

    return {
      point,
      low,
      high,
      unknown,
      lowConfidence,
    }
  }

  const giveSummary = summarize(give)
  const receiveSummary = summarize(receive)

  const ready =
    give.length > 0 &&
    receive.length > 0 &&
    giveSummary.unknown === 0 &&
    receiveSummary.unknown === 0 &&
    giveSummary.point > 0

  const pointDifference =
    receiveSummary.point - giveSummary.point

  const percentageDifference = ready
    ? (pointDifference / giveSummary.point) * 100
    : null

  const verdict = (() => {
    if (!ready || percentageDifference == null) {
      return {
        label: '?',
        caption: 'Add priced variants to both sides',
        border: 'border-white/10',
        background: 'bg-white/[0.04]',
        text: 'text-text-secondary',
      }
    }

    const fairTolerance = 0.05

    const clearWin =
      receiveSummary.low >
      giveSummary.high * (1 + fairTolerance)

    const clearLoss =
      receiveSummary.high <
      giveSummary.low * (1 - fairTolerance)

    const rangesOverlapWithinTolerance =
      receiveSummary.low <=
        giveSummary.high * (1 + fairTolerance) &&
      giveSummary.low <=
        receiveSummary.high * (1 + fairTolerance)

    if (clearWin) {
      return {
        label: 'WIN',
        caption:
          'Even the lowest receive estimate beats the highest give estimate',
        border: 'border-success/40',
        background: 'bg-success/10',
        text: 'text-success',
      }
    }

    if (clearLoss) {
      return {
        label: 'LOSS',
        caption:
          'Even the highest receive estimate is below the lowest give estimate',
        border: 'border-danger/40',
        background: 'bg-danger/10',
        text: 'text-danger',
      }
    }

    if (
      Math.abs(percentageDifference) <= 5 &&
      rangesOverlapWithinTolerance
    ) {
      return {
        label: 'FAIR',
        caption:
          'Estimated values are within the 5% fair range',
        border: 'border-warning/40',
        background: 'bg-warning/10',
        text: 'text-warning',
      }
    }

    return {
      label: 'UNCERTAIN',
      caption:
        'The market ranges overlap too much for a reliable W/F/L result',
      border: 'border-white/20',
      background: 'bg-white/[0.06]',
      text: 'text-text-primary',
    }
  })()

  const filteredBrainrots = useMemo(() => {
    const query = search.trim().toLowerCase()

    const matching = !query
      ? brainrots
      : brainrots.filter((brainrot) =>
          `${brainrot.name} ${brainrot.rarity}`
            .toLowerCase()
            .includes(query),
        )

    return matching
      .sort((a, b) => {
        const aPrice = priceMap.get(
          `${a.id}:${defaultMutationId}`,
        )
        const bPrice = priceMap.get(
          `${b.id}:${defaultMutationId}`,
        )

        if (aPrice && !bPrice) return -1
        if (!aPrice && bPrice) return 1
        return a.name.localeCompare(b.name)
      })
      .slice(0, 20)
  }, [
    brainrots,
    defaultMutationId,
    priceMap,
    search,
  ])

  const activeEntry =
    editor?.instanceId
      ? getEntries(editor.side).find(
          (entry) =>
            entry.instanceId === editor.instanceId,
        ) ?? null
      : null

  const openEmptySlot = (side: Side) => {
    setSearch('')
    setEditor({ side })
  }

  const openEntry = (
    side: Side,
    instanceId: string,
  ) => {
    setSearch('')
    setEditor({ side, instanceId })
  }

  const addBrainrot = (brainrotId: string) => {
    if (!editor || !defaultMutationId) return
    if (getEntries(editor.side).length >= 9) return

    setEntries(editor.side, (entries) => [
      ...entries,
      {
        instanceId: makeId(),
        brainrotId,
        mutationId: defaultMutationId,
        quantity: 1,
      },
    ])

    setEditor(null)
    setSearch('')
  }

  const updateActiveEntry = (
    patch: Partial<TradeEntry>,
  ) => {
    if (!editor?.instanceId) return

    setEntries(editor.side, (entries) =>
      entries.map((entry) =>
        entry.instanceId === editor.instanceId
          ? { ...entry, ...patch }
          : entry,
      ),
    )
  }

  const removeActiveEntry = () => {
    if (!editor?.instanceId) return

    setEntries(editor.side, (entries) =>
      entries.filter(
        (entry) =>
          entry.instanceId !== editor.instanceId,
      ),
    )

    setEditor(null)
  }

  const clearTrade = () => {
    setGive([])
    setReceive([])
    setEditor(null)
  }

  return (
    <>
      <section className="overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(145deg,rgba(37,39,49,0.98),rgba(22,24,32,0.98))] shadow-2xl">
        <div className="border-b border-white/10 px-5 py-4 text-center sm:px-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-lime-text">
            DropMarket trade checker
          </p>

          <h2 className="mt-1 text-[18px] font-black tracking-tight text-white sm:text-[20px]">
            IS THIS TRADE FAIR?
          </h2>
        </div>

        <div className="grid gap-6 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_180px_minmax(0,1fr)] lg:items-center">
          <TradeGrid
            side="give"
            label="YOU GIVE"
            entries={give}
            brainrotMap={brainrotMap}
            mutationMap={mutationMap}
            priceMap={priceMap}
            summary={giveSummary}
            onEmptyClick={openEmptySlot}
            onEntryClick={openEntry}
          />

          <div className="order-first flex flex-col items-center justify-center lg:order-none">
            <div
              className={`flex h-36 w-36 flex-col items-center justify-center rounded-full border-2 shadow-xl ${verdict.border} ${verdict.background}`}
            >
              <span
                className={`text-center text-[28px] font-black tracking-tight sm:text-[30px] ${verdict.text}`}
              >
                {verdict.label}
              </span>

              {percentageDifference == null ? (
                <LockKeyhole className="mt-2 h-5 w-5 text-text-tertiary" />
              ) : (
                <span
                  className={`mt-1 text-sm font-bold ${verdict.text}`}
                >
                  {percentageDifference > 0 ? '+' : ''}
                  {percentageDifference.toFixed(1)}%
                </span>
              )}
            </div>

            <p className="mt-4 max-w-[220px] text-center text-[12.5px] font-semibold leading-5 text-text-secondary">
              {verdict.caption}
            </p>

            {ready && (
              <p className="mt-1 text-center text-xs text-text-tertiary">
                Midpoint difference:{' '}
                {formatMoney(
                  Math.abs(pointDifference),
                )}
              </p>
            )}
          </div>

          <TradeGrid
            side="receive"
            label="YOU RECEIVE"
            entries={receive}
            brainrotMap={brainrotMap}
            mutationMap={mutationMap}
            priceMap={priceMap}
            summary={receiveSummary}
            onEmptyClick={openEmptySlot}
            onEntryClick={openEntry}
          />
        </div>

        {(giveSummary.unknown > 0 ||
          receiveSummary.unknown > 0) && (
          <div className="mx-5 mb-3 rounded-xl border border-warning/25 bg-warning/10 px-4 py-3 text-center text-[12.5px] text-warning sm:mx-8">
            The verdict is paused because one or more
            selected mutation variants has no cash-market
            estimate.
          </div>
        )}

        {(giveSummary.lowConfidence > 0 ||
          receiveSummary.lowConfidence > 0) &&
          giveSummary.unknown === 0 &&
          receiveSummary.unknown === 0 && (
            <div className="mx-5 mb-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center text-[12.5px] text-text-secondary sm:mx-8">
              Low-confidence evidence is included. The
              verdict uses the full low-to-high market range
              rather than only the midpoint.
            </div>
          )}

        <div className="grid gap-3 border-t border-white/10 bg-black/15 p-5 sm:grid-cols-2 sm:px-8">
          <button
            type="button"
            onClick={clearTrade}
            className="min-h-11 rounded-xl bg-danger px-5 py-2.5 text-[13px] font-black uppercase tracking-wide text-white transition hover:opacity-90"
          >
            Clear trade
          </button>

          <Link
            href="/steal-a-brainrot/values"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-lime-text px-5 py-2.5 text-[13px] font-black uppercase tracking-wide text-black transition hover:opacity-90"
          >
            View values
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <p className="mt-4 text-center text-[12.5px] leading-5 text-text-tertiary">
        Cash estimates may use DropMarket sales, completed
        external sales, reviewed ranges, or current listings.
        They are estimates, not guaranteed sale prices.
      </p>

      {editor && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setEditor(null)
            }
          }}
        >
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-bg-base p-5 shadow-2xl sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-[18px] font-bold text-text-primary">
                  {activeEntry
                    ? 'Edit Brainrot'
                    : 'Add Brainrot'}
                </h3>

                <p className="mt-1 text-[12.5px] text-text-secondary">
                  {editor.side === 'give'
                    ? 'Your side of the trade'
                    : 'Their side of the trade'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setEditor(null)}
                className="rounded-lg p-2 text-text-tertiary transition hover:bg-white/5 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {activeEntry ? (
              <EntryEditor
                entry={activeEntry}
                brainrot={
                  brainrotMap.get(
                    activeEntry.brainrotId,
                  ) ?? null
                }
                mutations={mutations}
                priceMap={priceMap}
                price={getEntryPrice(activeEntry)}
                onUpdate={updateActiveEntry}
                onRemove={removeActiveEntry}
              />
            ) : (
              <>
                <div className="relative mt-5">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />

                  <input
                    autoFocus
                    value={search}
                    onChange={(event) =>
                      setSearch(event.target.value)
                    }
                    placeholder="Search Brainrots..."
                    className="h-11 w-full rounded-xl border border-border-subtle bg-black/20 pl-10 pr-4 text-sm text-text-primary outline-none placeholder:text-text-tertiary focus:border-lime-text/60"
                  />
                </div>

                <div className="mt-4 space-y-2">
                  {filteredBrainrots.map(
                    (brainrot) => {
                      const defaultPrice =
                        priceMap.get(
                          `${brainrot.id}:${defaultMutationId}`,
                        ) ?? null

                      return (
                        <button
                          key={brainrot.id}
                          type="button"
                          onClick={() =>
                            addBrainrot(brainrot.id)
                          }
                          className="flex w-full items-center gap-3 rounded-xl border border-border-subtle bg-black/10 p-3 text-left transition hover:border-lime-text/40 hover:bg-white/[0.04]"
                        >
                          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-black/20 p-1.5">
                            {brainrot.imageUrl && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={
                                  brainrot.imageUrl
                                }
                                alt=""
                                className="h-full w-full object-contain"
                              />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-text-primary">
                              {brainrot.name}
                            </p>

                            <p className="mt-0.5 text-xs text-text-tertiary">
                              {brainrot.rarity} ·{' '}
                              {defaultPrice
                                ? formatRange(
                                    defaultPrice.marketLowUsd,
                                    defaultPrice.marketHighUsd,
                                    defaultPrice.marketValueUsd,
                                  )
                                : 'No default cash estimate'}
                            </p>
                          </div>

                          <Plus className="h-5 w-5 text-lime-text" />
                        </button>
                      )
                    },
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function TradeGrid({
  side,
  label,
  entries,
  brainrotMap,
  mutationMap,
  priceMap,
  summary,
  onEmptyClick,
  onEntryClick,
}: {
  side: Side
  label: string
  entries: TradeEntry[]
  brainrotMap: Map<string, TradeBrainrot>
  mutationMap: Map<string, TradeMutation>
  priceMap: Map<string, TradePrice>
  summary: SideSummary
  onEmptyClick: (side: Side) => void
  onEntryClick: (
    side: Side,
    instanceId: string,
  ) => void
}) {
  return (
    <div>
      <div className="mb-4 text-center">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-text-tertiary">
          {label}
        </p>

        <p className="mt-1 text-[15px] font-bold text-white">
          {formatMoney(summary.point)}
        </p>

        {summary.unknown === 0 &&
          Math.abs(summary.high - summary.low) >
            0.01 && (
            <p className="mt-0.5 text-[11px] text-text-tertiary">
              {formatMoney(summary.low)}–
              {formatMoney(summary.high)}
            </p>
          )}
      </div>

      <div className="mx-auto grid max-w-[390px] grid-cols-3 gap-2.5 sm:gap-3">
        {Array.from({ length: 9 }).map(
          (_, index) => {
            const entry = entries[index]

            if (!entry) {
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() =>
                    onEmptyClick(side)
                  }
                  className="group aspect-square rounded-xl border border-dashed border-white/15 bg-black/20 transition hover:border-lime-text/50 hover:bg-lime-text/5"
                >
                  <Plus className="mx-auto h-6 w-6 text-white/20 transition group-hover:text-lime-text" />
                </button>
              )
            }

            const brainrot = brainrotMap.get(
              entry.brainrotId,
            )

            const mutation = mutationMap.get(
              entry.mutationId,
            )

            const price =
              priceMap.get(
                `${entry.brainrotId}:${entry.mutationId}`,
              ) ?? null

            return (
              <button
                key={entry.instanceId}
                type="button"
                title={
                  price
                    ? `${brainrot?.name}: ${formatRange(
                        price.marketLowUsd,
                        price.marketHighUsd,
                        price.marketValueUsd,
                      )}`
                    : `${brainrot?.name}: No market estimate`
                }
                onClick={() =>
                  onEntryClick(
                    side,
                    entry.instanceId,
                  )
                }
                className="group relative aspect-square overflow-hidden rounded-xl border border-white/15 bg-black/25 p-2 transition hover:-translate-y-0.5 hover:border-lime-text/50"
              >
                {brainrot?.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={brainrot.imageUrl}
                    alt={brainrot.name}
                    className="h-full w-full object-contain transition group-hover:scale-105"
                  />
                )}

                <span className="absolute left-1.5 top-1.5 max-w-[70%] truncate rounded-md bg-black/80 px-1.5 py-0.5 text-[9px] font-bold text-white">
                  {mutation?.name ?? 'Default'}
                </span>

                {entry.quantity > 1 && (
                  <span className="absolute right-1.5 top-1.5 rounded-md bg-black/80 px-1.5 py-0.5 text-[10px] font-black text-white">
                    ×{entry.quantity}
                  </span>
                )}

                <span
                  className={`absolute inset-x-1.5 bottom-1.5 truncate rounded-md bg-black/85 px-1.5 py-1 text-[9px] font-bold ${
                    price
                      ? 'text-white'
                      : 'text-warning'
                  }`}
                >
                  {price
                    ? formatMoney(
                        price.marketValueUsd *
                          entry.quantity,
                      )
                    : 'No estimate'}
                </span>
              </button>
            )
          },
        )}
      </div>

      <p className="mt-3 text-center text-[11px] text-text-tertiary">
        {entries.length}/9 slots used
      </p>
    </div>
  )
}

function EntryEditor({
  entry,
  brainrot,
  mutations,
  priceMap,
  price,
  onUpdate,
  onRemove,
}: {
  entry: TradeEntry
  brainrot: TradeBrainrot | null
  mutations: TradeMutation[]
  priceMap: Map<string, TradePrice>
  price: TradePrice | null
  onUpdate: (patch: Partial<TradeEntry>) => void
  onRemove: () => void
}) {
  return (
    <div className="mt-5">
      <div className="flex items-center gap-4 rounded-xl border border-border-subtle bg-black/15 p-4">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-black/20 p-2">
          {brainrot?.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={brainrot.imageUrl}
              alt=""
              className="h-full w-full object-contain"
            />
          )}
        </div>

        <div className="min-w-0">
          <p className="font-bold text-text-primary">
            {brainrot?.name ?? 'Unknown Brainrot'}
          </p>

          <p className="mt-1 text-xs text-text-tertiary">
            {brainrot?.rarity}
          </p>

          <p
            className={`mt-2 text-sm font-bold ${
              price
                ? 'text-lime-text'
                : 'text-warning'
            }`}
          >
            {price
              ? formatRange(
                  price.marketLowUsd *
                    entry.quantity,
                  price.marketHighUsd *
                    entry.quantity,
                  price.marketValueUsd *
                    entry.quantity,
                )
              : 'No cash-market estimate'}
          </p>

          {price && (
            <p className="mt-1 text-[11px] text-text-tertiary">
              {confidenceLabel(
                price.confidenceLabel,
              )}
              {price.sourceName
                ? ` · ${price.sourceName}`
                : ''}
            </p>
          )}
        </div>
      </div>

      <label className="mt-5 block">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
          Mutation
        </span>

        <select
          value={entry.mutationId}
          onChange={(event) =>
            onUpdate({
              mutationId: event.target.value,
            })
          }
          className="mt-2 h-11 w-full rounded-xl border border-border-subtle bg-black/15 px-3 text-sm text-text-primary outline-none focus:border-lime-text/60"
        >
          {mutations.map((mutation) => {
            const mutationPrice =
              priceMap.get(
                `${entry.brainrotId}:${mutation.id}`,
              ) ?? null

            return (
              <option
                key={mutation.id}
                value={mutation.id}
              >
                {mutation.name}{' '}
                {mutationPrice
                  ? `(${formatMoney(
                      mutationPrice.marketValueUsd,
                    )})`
                  : '(No estimate)'}
              </option>
            )
          })}
        </select>
      </label>

      <label className="mt-4 block">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
          Quantity
        </span>

        <input
          type="number"
          min={1}
          max={99}
          value={entry.quantity}
          onChange={(event) => {
            const parsed = Number.parseInt(
              event.target.value,
              10,
            )

            onUpdate({
              quantity: Number.isFinite(parsed)
                ? Math.min(
                    99,
                    Math.max(1, parsed),
                  )
                : 1,
            })
          }}
          className="mt-2 h-11 w-full rounded-xl border border-border-subtle bg-black/15 px-3 text-sm text-text-primary outline-none focus:border-lime-text/60"
        />
      </label>

      <button
        type="button"
        onClick={onRemove}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-4 py-2.5 text-[13px] font-bold text-danger transition hover:bg-danger/15"
      >
        <Trash2 className="h-4 w-4" />
        Remove Brainrot
      </button>
    </div>
  )
}
