'use client'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import confetti from 'canvas-confetti'
import ThumbDownAltOutlinedIcon from '@mui/icons-material/ThumbDownAltOutlined'
import SearchIcon from '@mui/icons-material/Search'
import CloseIcon from '@mui/icons-material/Close'
import AddIcon from '@mui/icons-material/Add'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import DeleteOutlineIcon from '@mui/icons-material/Delete'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import { cn } from '@/lib/utils'
import {
  formatCash,
  formatMultiplier,
  formatIncome,
} from '@/lib/sab/format'
import {
  mutationOrder,
  mutationVisual,
  shade,
} from '@/lib/sab/mutations'
import { MutationDot } from '@/lib/sab/MutationDot'
import {
  sabCard,
  sabInteractive,
} from '@/lib/sab/theme'
import { ValuesHeader } from '../values/_ValuesHeader'
import { SabSubNav } from '../values/_SabSubNav'

/* -------------------------------------------------------------------------- */
/* Shared types (unified across the cash + trade tabs)                        */
/* -------------------------------------------------------------------------- */

export type CalcBrainrot = {
  id: string
  name: string
  slug: string
  rarity: string
  baseIncomePerSecond: number | null
  imageUrl: string | null
}

export type CalcMutation = {
  id: string
  name: string
  slug: string
  multiplier: number
  availability: string
}

export type CalcPrice = {
  brainrotId: string
  mutationId: string
  marketValueUsd: number
  marketLowUsd: number
  marketHighUsd: number
  confidenceLabel: string
  sampleSize: number
  isTradeReady: boolean
}

interface CalculatorClientProps {
  brainrots: CalcBrainrot[]
  mutations: CalcMutation[]
  cashPrices: CalcPrice[]
  tradePrices: CalcPrice[]
  initialBrainrotSlug?: string
  initialMutationSlug?: string
  initialTab?: Tab
}

type Tab = 'cash' | 'trade'

const POPULAR_BRAINROT_SLUGS = [
  'garama-and-madundung',
  'dragon-cannelloni',
  'skibidi-toilet',
]

function makeId(): string {
  return typeof crypto !== 'undefined' &&
    'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`
}

function confidenceLabel(value: string): string {
  if (value === 'reviewed') return 'Reviewed'
  if (value === 'high') return 'High confidence'
  if (value === 'medium') return 'Medium confidence'
  if (value === 'low') return 'Low confidence'
  return 'Insufficient data'
}

/* -------------------------------------------------------------------------- */
/* Root — owns the tab state, shared lookup maps                              */
/* -------------------------------------------------------------------------- */

export default function CalculatorClient({
  brainrots,
  mutations,
  cashPrices,
  tradePrices,
  initialBrainrotSlug,
  initialMutationSlug,
  initialTab = 'cash',
}: CalculatorClientProps) {
  const [tab, setTab] = useState<Tab>(initialTab)

  const orderedMutations = useMemo(
    () =>
      [...mutations].sort(
        (a, b) =>
          mutationOrder(a.slug) - mutationOrder(b.slug),
      ),
    [mutations],
  )

  const brainrotMap = useMemo(
    () =>
      new Map(brainrots.map((b) => [b.id, b])),
    [brainrots],
  )

  const mutationMap = useMemo(
    () =>
      new Map(mutations.map((m) => [m.id, m])),
    [mutations],
  )

  return (
    <>
      <ValuesHeader
        gameName="Steal a Brainrot"
        buyHref="/steal-a-brainrot/buy-items"
      />
      <SabSubNav />

      <section className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="flex flex-wrap items-center gap-1.5 pt-8 text-[12.5px] text-[#9BA8A0]">
          <Link
            href="/steal-a-brainrot"
            className="transition-colors hover:text-[#F1F3F1]"
          >
            Steal a Brainrot
          </Link>
          <span aria-hidden className="text-[#4C564E]">
            /
          </span>
          <span className="font-medium text-[#F1F3F1]">Calculator</span>
        </nav>

        {/* Game identity block — same as the blog hub for consistency. */}
        <div className="mb-7 mt-6 flex items-center gap-4">
          <span
            aria-hidden
            className="flex h-[52px] w-[52px] shrink-0 items-center justify-center bg-[#1B6B3F] font-mono text-[15px] font-bold text-white"
          >
            SAB
          </span>
          <span className="flex flex-col gap-1.5">
            <span className="text-[18px] font-bold leading-none tracking-tight text-[#F1F3F1]">
              Steal a Brainrot
            </span>
            <span className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-[#8FBF9C]">
              Roblox
            </span>
          </span>
        </div>

        {/* Hero copy */}
        <div className="max-w-[720px]">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[#5FC17B]">
            DropMarket Calculator
          </p>
          <h1 className="text-[32px] font-bold leading-[1.04] tracking-[-0.03em] text-[#F2F6F0] sm:text-[42px] lg:text-[48px]">
            Steal a Brainrot value &amp; trade calculator
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-7 text-[#98A398] sm:text-[17px]">
            Look up the live cash value of any mutation, then check whether a
            full trade is a Win, Fair or Loss.
          </p>
        </div>

        {/* Tab switch — square segmented control (design style). */}
        <div className="mt-8 inline-flex border border-[#1E251E] bg-[#0B0F0C]">
          {(
            [
              ['cash', 'Cash Price'],
              ['trade', 'Trade / WFL'],
            ] as const
          ).map(([value, label]) => {
            const active = tab === value
            return (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                aria-pressed={active}
                className={cn(
                  'px-6 py-3.5 text-[13px] font-semibold transition',
                  active
                    ? 'bg-[#3FA35C] text-[#08110B]'
                    : 'text-[#9BA8A0] hover:text-[#F1F3F1]',
                )}
              >
                {label}
              </button>
            )
          })}
        </div>

        <div className="mt-10">
          {tab === 'cash' ? (
            <CashTab
              brainrots={brainrots}
              orderedMutations={orderedMutations}
              mutations={mutations}
              prices={cashPrices}
              initialBrainrotSlug={initialBrainrotSlug}
              initialMutationSlug={initialMutationSlug}
            />
          ) : (
            <TradeTab
              brainrots={brainrots}
              mutations={mutations}
              prices={tradePrices}
              brainrotMap={brainrotMap}
              mutationMap={mutationMap}
            />
          )}
        </div>
      </section>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* CASH TAB                                                                    */
/* -------------------------------------------------------------------------- */

function CashTab({
  brainrots,
  orderedMutations,
  mutations,
  prices,
  initialBrainrotSlug,
  initialMutationSlug,
}: {
  brainrots: CalcBrainrot[]
  orderedMutations: CalcMutation[]
  mutations: CalcMutation[]
  prices: CalcPrice[]
  initialBrainrotSlug?: string
  initialMutationSlug?: string
}) {
  const router = useRouter()
  const pathname = usePathname()

  const defaultMutation =
    mutations.find((m) => m.slug === 'default') ??
    mutations[0] ??
    null

  const initialBrainrot =
    brainrots.find((b) => b.slug === initialBrainrotSlug) ??
    null

  const initialMutation =
    mutations.find((m) => m.slug === initialMutationSlug) ??
    defaultMutation

  const [selectedBrainrotId, setSelectedBrainrotId] =
    useState(initialBrainrot?.id ?? '')
  const [selectedMutationId, setSelectedMutationId] =
    useState(initialMutation?.id ?? '')
  const [search, setSearch] = useState('')

  const priceMap = useMemo(
    () =>
      new Map(
        prices.map((p) => [
          `${p.brainrotId}:${p.mutationId}`,
          p,
        ]),
      ),
    [prices],
  )

  const defaultPriceByBrainrot = useMemo(() => {
    const result = new Map<string, CalcPrice>()
    if (!defaultMutation) return result
    for (const price of prices) {
      if (price.mutationId === defaultMutation.id) {
        result.set(price.brainrotId, price)
      }
    }
    return result
  }, [defaultMutation, prices])

  const popularBrainrots = useMemo(() => {
    const prioritized = POPULAR_BRAINROT_SLUGS.map((slug) =>
      brainrots.find((b) => b.slug === slug),
    ).filter(
      (b): b is CalcBrainrot => b != null,
    )

    const seen = new Set(prioritized.map((b) => b.id))
    const fallback = brainrots
      .filter(
        (b) =>
          !seen.has(b.id) &&
          b.baseIncomePerSecond != null,
      )
      .slice(0, Math.max(0, 3 - prioritized.length))

    return [...prioritized, ...fallback].slice(0, 6)
  }, [brainrots])

  const visibleBrainrots = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return popularBrainrots

    return brainrots
      .filter((b) =>
        `${b.name} ${b.rarity}`
          .toLowerCase()
          .includes(query),
      )
      .slice(0, 12)
  }, [brainrots, popularBrainrots, search])

  const selectedBrainrot =
    brainrots.find((b) => b.id === selectedBrainrotId) ??
    null

  const selectedMutation =
    mutations.find((m) => m.id === selectedMutationId) ??
    defaultMutation

  const selectedPrice =
    selectedBrainrot && selectedMutation
      ? priceMap.get(
          `${selectedBrainrot.id}:${selectedMutation.id}`,
        ) ?? null
      : null

  const updateUrl = (
    brainrotSlug: string,
    mutationSlug: string,
  ) => {
    const params = new URLSearchParams()
    params.set('brainrot', brainrotSlug)
    params.set('mutation', mutationSlug)
    router.replace(`${pathname}?${params.toString()}`, {
      scroll: false,
    })
  }

  const chooseBrainrot = (brainrot: CalcBrainrot) => {
    setSelectedBrainrotId(brainrot.id)
    setSearch('')
    if (selectedMutation) {
      updateUrl(brainrot.slug, selectedMutation.slug)
    }
  }

  const chooseMutation = (mutation: CalcMutation) => {
    setSelectedMutationId(mutation.id)
    if (selectedBrainrot) {
      updateUrl(selectedBrainrot.slug, mutation.slug)
    }
  }

  return (
    // Design layout: fixed search+list column, insight panel fills the rest.
    // Stacks to one column on mobile (list above panel).
    <div className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)] lg:items-start">
      {/* ── Search + results ── */}
      <div className="border border-[#1A211A] bg-[#0B0F0C]">
        <div className="border-b border-[#1A211A] p-4">
          <div className="flex items-center gap-2.5 border border-[#1E251E] bg-[#0A0D0B] px-3.5">
            <SearchIcon sx={{ fontSize: 16 }} className="shrink-0 text-[#5E685E]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search a Brainrot by name or rarity"
              className="w-full bg-transparent py-3.5 text-[14px] text-[#E4EAE2] outline-none placeholder:text-[#5E685E]"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="shrink-0 text-[#5E685E] transition hover:text-[#F1F3F1]"
              >
                <CloseIcon sx={{ fontSize: 16 }} />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-baseline justify-between px-[18px] pb-3 pt-4">
          <span className="text-[14px] font-bold text-[#E4EAE2]">
            {search.trim() ? 'Search results' : 'Popular Brainrots'}
          </span>
          <span className="font-mono text-[11px] text-[#5E685E]">
            {search.trim() ? `${visibleBrainrots.length} matching` : 'Quick picks'}
          </span>
        </div>

        {visibleBrainrots.length > 0 ? (
          <div className="flex max-h-[520px] flex-col gap-px overflow-auto border-t border-[#151B15] bg-[#151B15]">
            {visibleBrainrots.map((brainrot) => {
              const active = brainrot.id === selectedBrainrotId
              const price = defaultPriceByBrainrot.get(brainrot.id)
              const income =
                brainrot.baseIncomePerSecond != null
                  ? formatIncome(brainrot.baseIncomePerSecond)
                  : null
              return (
                <button
                  key={brainrot.id}
                  type="button"
                  onClick={() => chooseBrainrot(brainrot)}
                  className={cn(
                    'flex items-center gap-3.5 px-4 py-3 text-left transition-colors hover:bg-[#111710]',
                    active
                      ? 'border-l-2 border-[#3FA35C] bg-[#0E140F]'
                      : 'border-l-2 border-transparent bg-[#0B0F0C]',
                  )}
                >
                  <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center border border-[#1A211A] bg-[#0E140F]">
                    {brainrot.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={brainrot.imageUrl}
                        alt=""
                        className="h-full w-full object-contain"
                      />
                    )}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="truncate text-[14px] font-semibold text-[#E4EAE2]">
                      {brainrot.name}
                    </span>
                    <span className="truncate font-mono text-[11px] text-[#5E685E]">
                      {brainrot.rarity}
                      {income ? ` · ${income}` : ''}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[14px] font-semibold text-[#8FBF9C]">
                    {price ? formatCash(price.marketValueUsd) : '—'}
                  </span>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="bg-[#0B0F0C] px-5 py-11 text-center">
            <p className="mb-2 text-[14px] font-semibold text-[#D7DED4]">
              Nothing matched that
            </p>
            <p className="font-mono text-[12px] text-[#5E685E]">
              Try a name or a rarity like “Secret”
            </p>
          </div>
        )}
      </div>

      {/* ── Insight panel ── */}
      <div className="border border-[#1A211A] bg-[#0B0F0C]">
        {!selectedBrainrot || !selectedMutation ? (
          <div className="flex min-h-[420px] flex-col items-center justify-center px-10 py-24 text-center">
            <SearchIcon sx={{ fontSize: 32 }} className="mb-5 text-[#3FA35C]" />
            <h2 className="mb-3 text-[22px] font-bold tracking-tight text-[#E4EAE2]">
              Select a Brainrot
            </h2>
            <p className="max-w-[340px] text-[15px] leading-relaxed text-[#7C877C]">
              Pick a popular item or search to see its current cash value by
              mutation.
            </p>
          </div>
        ) : (
          <CashResult
            brainrot={selectedBrainrot}
            mutation={selectedMutation}
            orderedMutations={orderedMutations}
            price={selectedPrice}
            priceMap={priceMap}
            onChooseMutation={chooseMutation}
          />
        )}
      </div>
    </div>
  )
}

function CashResult({
  brainrot,
  mutation,
  orderedMutations,
  price,
  priceMap,
  onChooseMutation,
}: {
  brainrot: CalcBrainrot
  mutation: CalcMutation
  orderedMutations: CalcMutation[]
  price: CalcPrice | null
  priceMap: Map<string, CalcPrice>
  onChooseMutation: (mutation: CalcMutation) => void
}) {
  const visual = mutationVisual(mutation.slug)
  const isDefault = mutation.slug === 'default'
  const cash = formatCash(price?.marketValueUsd ?? null)
  const low = formatCash(price?.marketLowUsd ?? null)
  const high = formatCash(price?.marketHighUsd ?? null)
  const range =
    low && high && low !== high ? `${low} – ${high}` : null

  const income =
    brainrot.baseIncomePerSecond != null
      ? formatIncome(brainrot.baseIncomePerSecond)
      : '—'
  const listings = price?.sampleSize ? String(price.sampleSize) : '—'

  const buyHref = `/steal-a-brainrot/buy-items?search=${encodeURIComponent(
    brainrot.name,
  )}${isDefault ? '' : `%20${encodeURIComponent(mutation.name)}`}`

  return (
    <div>
      {/* Headline: art tile + price/chips/buy. Stacks on mobile. */}
      <div className="grid lg:grid-cols-[0.85fr_1.15fr]">
        <div
          className="relative flex items-center justify-center border-b border-[#1A211A] p-7 lg:border-b-0 lg:border-r"
          style={{
            background: 'linear-gradient(165deg,#111A12,#0A0D0B)',
          }}
        >
          {brainrot.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={brainrot.imageUrl}
              alt={brainrot.name}
              className="aspect-square w-full max-w-[190px] object-contain"
            />
          )}
          <span className="absolute left-4 top-4 bg-[#3FA35C] px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[#08110B]">
            {brainrot.rarity}
          </span>
          <span
            className="absolute bottom-4 left-4 border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[#7C877C]"
            style={{ borderColor: '#2A3529' }}
          >
            {mutation.name}
          </span>
        </div>

        <div className="flex flex-col justify-center p-7">
          <div
            className="mb-3.5 flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[0.14em]"
            style={{ color: visual.color }}
          >
            <MutationDot visual={visual} size={8} />
            {mutation.name} cash value
          </div>
          <div className="mb-3.5 text-[38px] font-bold leading-none tracking-[-0.035em] text-[#F2F6F0] tabular-nums sm:text-[46px]">
            {cash ?? 'No data yet'}
          </div>
          <div className="mb-5 flex flex-wrap items-center gap-2.5">
            {range && (
              <span className="border border-[#263026] px-2.5 py-1.5 font-mono text-[11px] font-medium text-[#7C877C]">
                RANGE {range}
              </span>
            )}
            <span className="border border-[#23331F] px-2.5 py-1.5 font-mono text-[11px] font-medium text-[#8FBF9C]">
              {price ? confidenceLabel(price.confidenceLabel).toUpperCase() : 'NO DATA'}
            </span>
          </div>
          <Link
            href={buyHref}
            className="inline-flex items-center gap-1.5 self-start bg-[#3FA35C] px-5 py-3.5 text-[13px] font-semibold text-[#08110B] transition hover:bg-[#4CBB6B]"
          >
            Buy {brainrot.name}
            <ArrowForwardIcon sx={{ fontSize: 16 }} />
          </Link>
        </div>
      </div>

      {/* 4-stat strip */}
      <div className="grid grid-cols-2 gap-px border-y border-[#1A211A] bg-[#151B15] sm:grid-cols-4">
        {[
          { label: 'Income', value: income },
          { label: 'Multiplier', value: formatMultiplier(mutation.multiplier) },
          { label: 'Rarity', value: brainrot.rarity },
          { label: 'Listings', value: listings },
        ].map((stat) => (
          <div key={stat.label} className="bg-[#0B0F0C] p-[18px]">
            <div className="mb-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.11em] text-[#5E685E]">
              {stat.label}
            </div>
            <div className="text-[17px] font-bold text-[#E4EAE2] tabular-nums">
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Variations & mutations — tap to re-price the headline. */}
      <div className="p-6">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3.5">
          <span className="text-[15px] font-bold text-[#E4EAE2]">
            Variations &amp; mutations
          </span>
          <span className="font-mono text-[11px] text-[#5E685E]">
            TAP ONE TO PRICE IT
          </span>
        </div>
        <div className="grid grid-cols-2 gap-px border border-[#1A211A] bg-[#151B15] lg:grid-cols-4">
          {orderedMutations.map((option) => {
            const mv = mutationVisual(option.slug)
            const active = option.id === mutation.id
            const optionPrice = formatCash(
              priceMap.get(`${brainrot.id}:${option.id}`)?.marketValueUsd ?? null,
            )
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onChooseMutation(option)}
                aria-pressed={active}
                className="flex flex-col gap-2 p-3.5 text-left transition-colors hover:bg-[#111710]"
                style={{
                  background: active ? mv.soft : '#0B0F0C',
                }}
              >
                <span
                  className="text-[12px] font-semibold"
                  style={{ color: active ? mv.color : '#D6DCD8' }}
                >
                  {option.name}
                </span>
                <span
                  className="font-mono text-[15px] font-bold tabular-nums"
                  style={{ color: optionPrice ? mv.color : '#5E685E' }}
                >
                  {optionPrice ?? '—'}
                </span>
                <span className="font-mono text-[10px] text-[#5E685E]">
                  {formatMultiplier(option.multiplier)}
                </span>
              </button>
            )
          })}
        </div>
        <p className="mt-4 font-mono text-[11px] leading-relaxed text-[#5E685E]">
          A dash means no verified sale or listing for that variant yet. We
          never publish a price derived from a multiplier alone.
        </p>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* TRADE TAB — logic ported verbatim from the trade calculator                */
/* -------------------------------------------------------------------------- */

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

type Verdict = {
  label: string
  caption: string
  border: string
  background: string
  text: string
}

function TradeTab({
  brainrots,
  mutations,
  prices,
  brainrotMap,
  mutationMap,
}: {
  brainrots: CalcBrainrot[]
  mutations: CalcMutation[]
  prices: CalcPrice[]
  brainrotMap: Map<string, CalcBrainrot>
  mutationMap: Map<string, CalcMutation>
}) {
  const defaultMutationId =
    mutations.find((m) => m.slug === 'default')?.id ??
    mutations[0]?.id ??
    ''

  const [give, setGive] = useState<TradeEntry[]>([])
  const [receive, setReceive] = useState<TradeEntry[]>([])
  const [editor, setEditor] = useState<EditorState>(null)
  const [search, setSearch] = useState('')

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
  ): CalcPrice | null =>
    priceMap.get(
      `${entry.brainrotId}:${entry.mutationId}`,
    ) ?? null

  // --- ported verbatim: summarize ---
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

      point += price.marketValueUsd * entry.quantity
      low += price.marketLowUsd * entry.quantity
      high += price.marketHighUsd * entry.quantity

      if (
        price.confidenceLabel === 'low' ||
        price.confidenceLabel === 'insufficient'
      ) {
        lowConfidence += 1
      }
    }

    return { point, low, high, unknown, lowConfidence }
  }

  const giveSummary = summarize(give)
  const receiveSummary = summarize(receive)

  // --- ported verbatim: ready ---
  const ready =
    give.length > 0 &&
    receive.length > 0 &&
    giveSummary.unknown === 0 &&
    receiveSummary.unknown === 0 &&
    giveSummary.point > 0

  const pointDifference =
    receiveSummary.point - giveSummary.point

  // --- ported verbatim: percentageDifference ---
  const percentageDifference = ready
    ? (pointDifference / giveSummary.point) * 100
    : null

  // --- ported verbatim: verdict (colors mapped to forest theme) ---
  const verdict: Verdict = (() => {
    if (!ready || percentageDifference == null) {
      return {
        label: '?',
        caption: 'Add priced variants to both sides',
        border: 'border-[#1E2723]',
        background: 'bg-white/[0.04]',
        text: 'text-[#9BA8A0]',
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
        border: 'border-[#4FB477]/50',
        background: 'bg-[#4FB477]/10',
        text: 'text-[#4FB477]',
      }
    }

    if (clearLoss) {
      return {
        label: 'LOSS',
        caption:
          'Even the highest receive estimate is below the lowest give estimate',
        border: 'border-[#E23B4E]/50',
        background: 'bg-[#E23B4E]/10',
        text: 'text-[#E23B4E]',
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
        border: 'border-[#E0B155]/50',
        background: 'bg-[#E0B155]/10',
        text: 'text-[#E0B155]',
      }
    }

    return {
      label: 'UNCERTAIN',
      caption:
        'The market ranges overlap too much for a reliable W/F/L result',
      border: 'border-white/20',
      background: 'bg-white/[0.06]',
      text: 'text-[#F1F3F1]',
    }
  })()

  // Celebrate a WIN with confetti (only when the verdict newly becomes WIN,
  // not on every re-render). Respects reduced-motion.
  const lastLabelRef = useRef<string>('')
  useEffect(() => {
    if (verdict.label === lastLabelRef.current) return
    lastLabelRef.current = verdict.label
    if (verdict.label !== 'WIN') return
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return
    }
    confetti({
      particleCount: 90,
      spread: 70,
      startVelocity: 38,
      origin: { y: 0.35 },
      colors: ['#4FB477', '#8FD86F', '#C6FF3D', '#F1F3F1'],
      scalar: 0.9,
      disableForReducedMotion: true,
    })
  }, [verdict.label])

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
  }, [brainrots, defaultMutationId, priceMap, search])

  const activeEntry = editor?.instanceId
    ? getEntries(editor.side).find(
        (entry) => entry.instanceId === editor.instanceId,
      ) ?? null
    : null

  const openEmptySlot = (side: Side) => {
    setSearch('')
    setEditor({ side })
  }

  const openEntry = (side: Side, instanceId: string) => {
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
      <div className="overflow-hidden border border-[#1A211A] bg-[#0B0F0C]">
        <div className="border-b border-[#1A211A] bg-[#0E130F] px-5 py-4 text-center sm:px-8">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8FBF9C]">
            DropMarket trade checker
          </p>
          <h2 className="mt-1.5 text-[18px] font-bold tracking-tight text-[#F1F3F1] sm:text-[20px]">
            Is this trade fair?
          </h2>
        </div>

        <div className="grid gap-6 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_180px_minmax(0,1fr)] lg:items-center">
          <TradeSide
            side="give"
            label="Your Side"
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
              className={cn(
                'flex h-36 w-36 flex-col items-center justify-center rounded-full border-2 border-dashed',
                verdict.border,
                verdict.background,
              )}
            >
              <span
                className={cn(
                  'text-center text-[26px] font-bold tracking-tight',
                  verdict.text,
                )}
              >
                {verdict.label}
              </span>
              {percentageDifference == null ? (
                <LockOutlinedIcon
                  sx={{ fontSize: 20 }}
                  className="mt-2 text-[#6D7A72]"
                />
              ) : verdict.label === 'LOSS' ? (
                <span className={cn('mt-1 flex items-center gap-1.5 text-sm font-bold tabular-nums', verdict.text)}>
                  <ThumbDownAltOutlinedIcon sx={{ fontSize: 16 }} />
                  {percentageDifference > 0 ? '+' : ''}
                  {percentageDifference.toFixed(1)}%
                </span>
              ) : (
                <span
                  className={cn(
                    'mt-1 text-sm font-bold tabular-nums',
                    verdict.text,
                  )}
                >
                  {percentageDifference > 0 ? '+' : ''}
                  {percentageDifference.toFixed(1)}%
                </span>
              )}
            </div>

            <p className="mt-4 max-w-[220px] text-center text-[12.5px] font-medium leading-5 text-[#9BA8A0]">
              {verdict.caption}
            </p>

            {ready && (
              <p className="mt-1 text-center text-xs tabular-nums text-[#6D7A72]">
                Midpoint difference:{' '}
                {formatCash(Math.abs(pointDifference)) ??
                  '—'}
              </p>
            )}
          </div>

          <TradeSide
            side="receive"
            label="Their Side"
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
          <div className="mx-5 mb-3 border border-[#E0B155]/25 bg-[#E0B155]/10 px-4 py-3 text-center text-[12.5px] text-[#E0B155] sm:mx-8">
            The verdict is paused because one or more selected
            mutation variants has no cash-market estimate.
          </div>
        )}

        {(giveSummary.lowConfidence > 0 ||
          receiveSummary.lowConfidence > 0) &&
          giveSummary.unknown === 0 &&
          receiveSummary.unknown === 0 && (
            <div className="mx-5 mb-3 bg-white/[0.04] px-4 py-3 text-center text-[12.5px] text-[#9BA8A0] sm:mx-8">
              Low-confidence evidence is included. The verdict
              uses the full low-to-high market range rather than
              only the midpoint.
            </div>
          )}

        <div className="grid gap-3 border-t border-[#1A211A] bg-black/20 p-5 sm:grid-cols-2 sm:px-8">
          <button
            type="button"
            onClick={clearTrade}
            className="min-h-11 border border-[#E23B4E]/30 bg-[#E23B4E]/10 px-5 py-2.5 text-[13px] font-semibold text-[#E23B4E] transition hover:bg-[#E23B4E]/15"
          >
            Clear Trade
          </button>

          <Link
            href="/steal-a-brainrot/values"
            className="inline-flex min-h-11 items-center justify-center gap-2 bg-[#3FA35C] px-5 py-2.5 text-[13px] font-semibold text-[#08110B] transition hover:bg-[#4CBB6B]"
          >
            View Values
            <ArrowForwardIcon sx={{ fontSize: 16 }} />
          </Link>
        </div>
      </div>

      <p className="mt-4 text-center font-mono text-[11px] leading-5 text-[#5E685E]">
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
          <div className="max-h-[86vh] w-full max-w-lg overflow-y-auto border border-[#263026] bg-[#0B0F0C] p-5 shadow-2xl sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-[#F1F3F1]">
                  {activeEntry
                    ? 'Edit Brainrot'
                    : 'Add Brainrot'}
                </h3>
                <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.1em] text-[#8FBF9C]">
                  {editor.side === 'give'
                    ? 'Your side of the trade'
                    : 'Their side of the trade'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setEditor(null)}
                className="flex h-8 w-8 items-center justify-center border border-[#263026] text-[#6D7A72] transition hover:text-[#F1F3F1]"
              >
                <CloseIcon sx={{ fontSize: 20 }} />
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
                  <SearchIcon
                    sx={{ fontSize: 18 }}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#6D7A72]"
                  />
                  <input
                    autoFocus
                    value={search}
                    onChange={(event) =>
                      setSearch(event.target.value)
                    }
                    placeholder="Search Brainrots..."
                    className="h-11 w-full rounded-lg border border-[#1E2723] bg-white/[0.03] pl-10 pr-4 text-base text-[#F1F3F1] outline-none placeholder:text-[#6D7A72] focus:border-[#2A3A31]"
                  />
                </div>

                <div className="mt-4 space-y-2">
                  {filteredBrainrots.map((brainrot) => {
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
                        className={cn(
                          'flex w-full items-center gap-3 px-3 py-3 text-left',
                          sabInteractive,
                        )}
                      >
                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-white/[0.03] p-1.5">
                          {brainrot.imageUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={brainrot.imageUrl}
                              alt=""
                              className="h-full w-full object-contain"
                            />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-[#F1F3F1]">
                            {brainrot.name}
                          </p>
                          <p className="mt-0.5 text-xs tabular-nums text-[#6D7A72]">
                            {brainrot.rarity} ·{' '}
                            {defaultPrice
                              ? formatCash(
                                  defaultPrice.marketValueUsd,
                                )
                              : 'No default estimate'}
                          </p>
                        </div>
                        <AddIcon
                          sx={{ fontSize: 20 }}
                          className="text-[#4FB477]"
                        />
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function TradeSide({
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
  brainrotMap: Map<string, CalcBrainrot>
  mutationMap: Map<string, CalcMutation>
  priceMap: Map<string, CalcPrice>
  summary: SideSummary
  onEmptyClick: (side: Side) => void
  onEntryClick: (side: Side, instanceId: string) => void
}) {
  return (
    <div>
      <div className="mb-4 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6D7A72]">
          {label}
        </p>
        <p className="mt-1 text-[15px] font-semibold tabular-nums text-[#F1F3F1]">
          {formatCash(summary.point) ?? '$0'}
        </p>
        {summary.unknown === 0 &&
          Math.abs(summary.high - summary.low) > 0.01 && (
            <p className="mt-0.5 text-[11px] tabular-nums text-[#6D7A72]">
              {formatCash(summary.low)}–
              {formatCash(summary.high)}
            </p>
          )}
      </div>

      <div className="mx-auto grid max-w-[264px] grid-cols-3 gap-2">
        {Array.from({ length: 9 }).map((_, index) => {
          const entry = entries[index]

          if (!entry) {
            return (
              <button
                key={index}
                type="button"
                onClick={() => onEmptyClick(side)}
                className="group aspect-square rounded-lg border border-dashed border-white/15 bg-white/[0.02] transition hover:border-[#4FB477]/50 hover:bg-[#4FB477]/5"
              >
                <AddIcon
                  sx={{ fontSize: 24 }}
                  className="mx-auto text-white/20 transition group-hover:text-[#4FB477]"
                />
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
              onClick={() =>
                onEntryClick(side, entry.instanceId)
              }
              className="group relative aspect-square overflow-hidden rounded-lg border border-[#1E2723] bg-white/[0.03] p-2 transition hover:-translate-y-0.5 hover:border-[#2A3A31]"
            >
              {brainrot?.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={brainrot.imageUrl}
                  alt={brainrot.name}
                  className="h-full w-full object-contain transition group-hover:scale-105"
                />
              )}

              <span className="absolute left-1.5 top-1.5 max-w-[70%] truncate rounded bg-black/80 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                {mutation?.name ?? 'Default'}
              </span>

              {entry.quantity > 1 && (
                <span className="absolute right-1.5 top-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white">
                  ×{entry.quantity}
                </span>
              )}

              <span
                className={cn(
                  'absolute inset-x-1.5 bottom-1.5 truncate rounded bg-black/85 px-1.5 py-1 text-[9px] font-semibold tabular-nums',
                  price ? 'text-white' : 'text-[#E0B155]',
                )}
              >
                {price
                  ? formatCash(
                      price.marketValueUsd *
                        entry.quantity,
                    )
                  : 'No estimate'}
              </span>
            </button>
          )
        })}
      </div>

      <p className="mt-3 text-center text-[11px] text-[#6D7A72]">
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
  brainrot: CalcBrainrot | null
  mutations: CalcMutation[]
  priceMap: Map<string, CalcPrice>
  price: CalcPrice | null
  onUpdate: (patch: Partial<TradeEntry>) => void
  onRemove: () => void
}) {
  const low = formatCash(
    price ? price.marketLowUsd * entry.quantity : null,
  )
  const high = formatCash(
    price ? price.marketHighUsd * entry.quantity : null,
  )
  const point = formatCash(
    price ? price.marketValueUsd * entry.quantity : null,
  )
  const range =
    low && high && low !== high
      ? `${low}–${high}`
      : point

  return (
    <div className="mt-5">
      <div className="flex items-center gap-4 rounded-lg bg-white/[0.025] p-4">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-white/[0.03] p-2">
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
          <p className="font-semibold text-[#F1F3F1]">
            {brainrot?.name ?? 'Unknown Brainrot'}
          </p>
          <p className="mt-1 text-xs text-[#6D7A72]">
            {brainrot?.rarity}
          </p>
          <p
            className={cn(
              'mt-2 text-sm font-semibold tabular-nums',
              price ? 'text-[#4FB477]' : 'text-[#E0B155]',
            )}
          >
            {price
              ? range ?? '—'
              : 'No cash-market estimate'}
          </p>
          {price && (
            <p className="mt-1 text-[11px] text-[#6D7A72]">
              {confidenceLabel(price.confidenceLabel)}
            </p>
          )}
        </div>
      </div>

      <label className="mt-5 block">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#6D7A72]">
          Mutation
        </span>
        <select
          value={entry.mutationId}
          onChange={(event) =>
            onUpdate({ mutationId: event.target.value })
          }
          className="mt-2 h-11 w-full rounded-lg border border-[#1E2723] bg-white/[0.03] px-3 text-base text-[#F1F3F1] outline-none focus:border-[#2A3A31]"
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
                  ? `(${formatCash(
                      mutationPrice.marketValueUsd,
                    )})`
                  : '(No estimate)'}
              </option>
            )
          })}
        </select>
      </label>

      <label className="mt-4 block">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#6D7A72]">
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
                ? Math.min(99, Math.max(1, parsed))
                : 1,
            })
          }}
          className="mt-2 h-11 w-full rounded-lg border border-[#1E2723] bg-white/[0.03] px-3 text-base text-[#F1F3F1] outline-none focus:border-[#2A3A31]"
        />
      </label>

      <button
        type="button"
        onClick={onRemove}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#E23B4E]/30 bg-[#E23B4E]/10 px-4 py-2.5 text-[13px] font-semibold text-[#E23B4E] transition hover:bg-[#E23B4E]/15"
      >
        <DeleteOutlineIcon sx={{ fontSize: 16 }} />
        Remove Brainrot
      </button>
    </div>
  )
}
