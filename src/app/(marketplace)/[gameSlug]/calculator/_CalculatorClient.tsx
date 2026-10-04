'use client'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import confetti from 'canvas-confetti'
import { ThumbsDownIcon } from '@phosphor-icons/react/dist/csr/ThumbsDown'
import { XIcon } from '@phosphor-icons/react/dist/csr/X'
import { PlusIcon } from '@phosphor-icons/react/dist/csr/Plus'
import { ArrowRightIcon } from '@phosphor-icons/react/dist/csr/ArrowRight'
import { TrashIcon } from '@phosphor-icons/react/dist/csr/Trash'
import { LockSimpleIcon } from '@phosphor-icons/react/dist/csr/LockSimple'
import { CaretUpIcon } from '@phosphor-icons/react/dist/csr/CaretUp'
import { CaretDownIcon } from '@phosphor-icons/react/dist/csr/CaretDown'
import { cn } from '@/lib/utils'
import { ItemPickerDialog } from '@/components/values/ItemPickerDialog'
import { ValueArt } from '@/components/values/ValueArt'
import { ValueSearchField } from '@/components/values/ValueSearchField'
import { ValueSelect } from '@/components/values/ValueSelect'
import { ValueBuyActions } from '@/components/values/ValueBuyActions'
import { ValuesEmptyState } from '@/components/values/ValuesEmptyState'
import {
  VALUE_BTN_PRIMARY,
  VALUE_FIELD,
  VALUE_LABEL,
  VALUE_PILL,
  VALUE_SURFACE,
  VALUE_TILE,
} from '@/components/values/styles'
import { rarityMeta } from '@/lib/values/rarity'
import { centsToUsd, sumSide, tradeVerdict, type SideTotals } from '@/lib/calculator/trade-sum'
import { useBuyCta } from '@/components/value-listings/useBuyCta'
import { TrackOnMount } from '@/components/value-listings/TrackOnMount'
import { itemBuyHref, type ItemStock } from '@/lib/value-listings/buy-state'
import { SearchParamsBridge } from '@/components/navigation/SearchParamsBridge'
import { parseCalculatorDeepLink, type CalculatorDeepLink, type CalculatorTab } from './_deepLink'
import { HUB_NAV_CLEAR } from '@/components/content/hubNavGeometry'
import {
  formatCash,
  formatMultiplier,
  formatIncome,
  formatConfidence,
} from '@/lib/sab/format'
import {
  mutationOrder,
  mutationVisual,
} from '@/lib/sab/mutations'
import { MutationDot } from '@/lib/sab/MutationDot'

/** Focus ring for every bare button in this file. */
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring'
const SAB_SLUG = 'steal-a-brainrot'

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
  /** DropMarket's own live stock by brainrot slug (Bundle 2: buy buttons). */
  buyStock: Record<string, ItemStock>
  buyCategorySlug: string
}

/** Shared by the cash result's buy button and the trade list's links. */
type BuyContext = { stock: Record<string, ItemStock>; categorySlug: string }

type Tab = CalculatorTab


function makeId(): string {
  return typeof crypto !== 'undefined' &&
    'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`
}


/* -------------------------------------------------------------------------- */
/* Root — owns the tab state, shared lookup maps                              */
/* -------------------------------------------------------------------------- */

export default function CalculatorClient({
  brainrots,
  mutations,
  cashPrices,
  tradePrices,
  buyStock,
  buyCategorySlug,
}: CalculatorClientProps) {
  const buy: BuyContext = useMemo(() => ({ stock: buyStock, categorySlug: buyCategorySlug }), [buyStock, buyCategorySlug])
  // Mode comes from the URL (?tab=cash), chosen in the navbar's Calculator
  // menu — there is no in-page switcher to hold local state for. The URL is
  // read on the client (Step 7a): the page is ISR, so the default view is in
  // the static HTML and the deep link applies after hydration.
  const [deepLink, setDeepLink] = useState<CalculatorDeepLink>({ tab: 'trade' })
  const onParams = useCallback(
    (params: URLSearchParams) => setDeepLink(parseCalculatorDeepLink((k) => params.get(k))),
    [],
  )
  const tab = deepLink.tab
  const { brainrot: initialBrainrotSlug, mutation: initialMutationSlug } = deepLink

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
      <SearchParamsBridge onParams={onParams} />
      <TrackOnMount event={{ event: 'value_view', surface: 'calculator', game: 'steal-a-brainrot' }} />
      {/* Nav renders server-side in the page (HubNav). No breadcrumb — the
          BreadcrumbList JSON-LD keeps the SERP trail. pt clears the nav. */}
      <section className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${HUB_NAV_CLEAR}`}>
        {/* Hero copy */}
        {/* Centred hero, matching the Values page. The lead is wider than the
            headline on purpose so it sets in two lines rather than three. */}
        {/* Type scale matches the shared HubHero (30 → 42px, mt-3). Kept
            inline rather than <HubHero> because this hero shares its clearance
            section with the calculator body below. */}
        <div className="flex flex-col items-center text-center">
          <h1 className="text-balance text-[30px] font-bold leading-[1.05] tracking-[-0.02em] text-text-primary sm:text-[42px]">
            Steal a Brainrot WFL Calculator
          </h1>
          <p className="mx-auto mt-3 max-w-3xl text-pretty text-[15px] leading-7 text-text-secondary sm:text-[17px]">
            Add your Brainrot and the one you want, and see instantly if the trade
            is a Win, Fair, or Loss — priced from real sales, not guesses.
          </p>
        </div>

        <div className="mt-10">
          {tab === 'cash' ? (
            <CashTab
              // Remount when the deep link lands so the seeded selection applies.
              key={`${initialBrainrotSlug ?? ''}|${initialMutationSlug ?? ''}`}
              brainrots={brainrots}
              orderedMutations={orderedMutations}
              mutations={mutations}
              prices={cashPrices}
              buy={buy}
              initialBrainrotSlug={initialBrainrotSlug}
              initialMutationSlug={initialMutationSlug}
            />
          ) : (
            <TradeTab
              brainrots={brainrots}
              mutations={mutations}
              // Value both sides at the SAME reputable price the rest of the site
              // shows (cheapest ?? average ?? market, from the corrected catalog) —
              // NOT the older sab_trade_price_catalog range, which was stale ($20.65
              // vs the real $16.64 for Dragon Cannelloni). One price source sitewide.
              prices={cashPrices}
              brainrotMap={brainrotMap}
              mutationMap={mutationMap}
              buy={buy}
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
  buy,
  initialBrainrotSlug,
  initialMutationSlug,
}: {
  brainrots: CalcBrainrot[]
  orderedMutations: CalcMutation[]
  mutations: CalcMutation[]
  prices: CalcPrice[]
  buy: BuyContext
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

  /**
   * Quick picks, ranked by the same signal the value list uses: how many real
   * listings and sales we observed (`sampleSize`). The old version was three
   * hardcoded slugs that would rot the moment the meta moved — this tracks the
   * market on its own, and only ever offers items we can actually price.
   */
  const popularBrainrots = useMemo(() => {
    const samples = new Map<string, number>()
    for (const price of prices) {
      // Default-mutation rows carry the item's overall market activity.
      if (defaultMutation && price.mutationId !== defaultMutation.id) continue
      samples.set(price.brainrotId, price.sampleSize ?? 0)
    }

    const ranked = brainrots
      .filter((b) => samples.has(b.id))
      .sort((a, b) => (samples.get(b.id) ?? 0) - (samples.get(a.id) ?? 0))

    // If nothing is priced yet, fall back to any item rather than an empty list.
    return (ranked.length > 0 ? ranked : brainrots).slice(0, 6)
  }, [brainrots, prices, defaultMutation])

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
    // `tab=cash` MUST survive this rewrite. The active mode is read from the
    // URL now (it used to be local state), so dropping the param here bounced
    // the user to the WFL tab a moment after picking a Brainrot.
    params.set('tab', 'cash')
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
      <div className={`overflow-hidden ${VALUE_SURFACE}`}>
        <div className="border-b border-white/[0.07] p-4">
          <ValueSearchField
            value={search}
            onChange={setSearch}
            placeholder="Search a Brainrot by name or rarity"
            label="Search Brainrots"
            clearable
          />
        </div>

        <div className="flex items-baseline justify-between px-[18px] pb-3 pt-4">
          <span className="text-[14px] font-semibold text-text-primary">
            {search.trim() ? 'Search Results' : 'Popular Brainrots'}
          </span>
          <span className={VALUE_LABEL}>
            {search.trim() ? `${visibleBrainrots.length} matching` : 'Quick Picks'}
          </span>
        </div>

        {visibleBrainrots.length > 0 ? (
          <div className="flex max-h-[520px] flex-col divide-y divide-white/[0.07] overflow-auto border-t border-white/[0.07]">
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
                  aria-pressed={active}
                  className={cn(
                    'flex items-center gap-3.5 px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring',
                    active ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]',
                  )}
                >
                  <ValueArt src={brainrot.imageUrl} alt="" size={46} className="shrink-0" />
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-[14px] font-semibold text-text-primary">
                      {brainrot.name}
                    </span>
                    <span className="truncate text-[12px] text-text-tertiary">
                      <span style={{ color: rarityMeta(SAB_SLUG, brainrot.rarity).color }}>{brainrot.rarity}</span>
                      {income ? ` · ${income}` : ''}
                    </span>
                  </span>
                  <span className="shrink-0 text-[14px] font-semibold tabular-nums text-text-primary">
                    {price ? formatCash(price.marketValueUsd) : '—'}
                  </span>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="px-5 py-11 text-center">
            <p className="mb-2 text-[14px] font-semibold text-text-primary">
              Nothing matched that
            </p>
            <p className="text-[12px] text-text-tertiary">
              Try a name or a rarity like “Secret”
            </p>
          </div>
        )}
      </div>

      {/* ── Insight panel ── */}
      {!selectedBrainrot || !selectedMutation ? (
        <ValuesEmptyState
          className="flex min-h-[420px] flex-col items-center justify-center"
          title="Select a Brainrot"
          body="Pick a popular item or search to see its current cash value by mutation."
        />
      ) : (
        <div className={`overflow-hidden ${VALUE_SURFACE}`}>
          <CashResult
            brainrot={selectedBrainrot}
            mutation={selectedMutation}
            orderedMutations={orderedMutations}
            price={selectedPrice}
            priceMap={priceMap}
            onChooseMutation={chooseMutation}
            buy={buy}
          />
        </div>
      )}
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
  buy,
}: {
  brainrot: CalcBrainrot
  mutation: CalcMutation
  orderedMutations: CalcMutation[]
  buy: BuyContext
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

  // DropMarket's own stock for this brainrot + mutation (Bundle 2).
  const cta = useBuyCta({
    gameSlug: 'steal-a-brainrot',
    categorySlug: buy.categorySlug,
    itemSlug: brainrot.slug,
    variant: mutation.slug,
    variantName: isDefault ? brainrot.name : mutation.name,
    stock: buy.stock[brainrot.slug] ?? null,
    surface: 'calculator',
  })

  const rarity = rarityMeta(SAB_SLUG, brainrot.rarity)

  return (
    <div>
      {/* Headline: art tile + price/chips/buy. Stacks on mobile. */}
      <div className="grid lg:grid-cols-[0.85fr_1.15fr]">
        <div className="relative flex items-center justify-center border-b border-white/[0.07] bg-white/[0.02] p-7 lg:border-b-0 lg:border-r">
          <ValueArt src={brainrot.imageUrl} alt={brainrot.name} size={176} priority />
          <span
            className="absolute left-4 top-4 rounded px-2 py-1 text-[11px] font-semibold"
            style={{
              color: rarity.color,
              backgroundColor: `color-mix(in srgb, ${rarity.color} 16%, transparent)`,
            }}
          >
            {brainrot.rarity}
          </span>
          <span className={`absolute bottom-4 left-4 ${VALUE_PILL}`}>
            {mutation.name}
          </span>
        </div>

        <div className="flex flex-col justify-center p-6 sm:p-7">
          <div
            className="mb-3 flex items-center gap-2 text-[12px] font-semibold"
            style={{ color: visual.color }}
          >
            <MutationDot visual={visual} size={8} />
            {mutation.name} Cash Value
          </div>
          <div className="mb-3.5 text-[38px] font-bold leading-none tracking-[-0.035em] text-text-primary tabular-nums sm:text-[46px]">
            {cash ?? 'No data yet'}
          </div>
          <div className="mb-5 flex flex-wrap items-center gap-2">
            {range && (
              <span className={`${VALUE_PILL} tabular-nums`}>
                Range {range}
              </span>
            )}
            <span className={VALUE_PILL}>
              {price ? formatConfidence(price.confidenceLabel) : 'No Data'}
            </span>
          </div>
          {/* Buy / Sell split at the price — both intents at peak arousal.
              The shared values pair: Buy loud (brand), Sell neutral. */}
          <ValueBuyActions
            cta={cta}
            itemName={brainrot.name}
            sell={{ href: '/steal-a-brainrot/sell?src=sab-calc-result', label: 'Sell Yours For Cash' }}
          />
        </div>
      </div>

      {/* 4-stat strip */}
      <div className="grid grid-cols-2 gap-2 border-y border-white/[0.07] p-3 sm:grid-cols-4">
        {[
          { label: 'Income', value: income },
          { label: 'Multiplier', value: formatMultiplier(mutation.multiplier) },
          { label: 'Rarity', value: brainrot.rarity },
          { label: 'Listings', value: listings },
        ].map((stat) => (
          <div key={stat.label} className={`${VALUE_TILE} px-4 py-3.5`}>
            <div className={`${VALUE_LABEL} mb-1.5`}>
              {stat.label}
            </div>
            <div className="text-[17px] font-bold text-text-primary tabular-nums">
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Variations & mutations — tap to re-price the headline. */}
      <div className="p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3.5">
          <span className="text-[15px] font-semibold text-text-primary">
            Variations &amp; Mutations
          </span>
          <span className={VALUE_LABEL}>
            Tap one to price it
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
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
                className={cn(
                  'flex flex-col gap-1.5 rounded-md p-3.5 text-left transition-colors',
                  FOCUS,
                  active ? '' : 'bg-white/[0.04] hover:bg-white/[0.07]',
                )}
                style={active ? { background: mv.soft } : undefined}
              >
                <span
                  className="text-[12px] font-semibold"
                  style={{ color: active ? mv.color : 'var(--color-text-primary)' }}
                >
                  {option.name}
                </span>
                <span
                  className="text-[15px] font-bold tabular-nums"
                  style={{ color: optionPrice ? mv.color : 'var(--color-text-disabled)' }}
                >
                  {optionPrice ?? '—'}
                </span>
                <span className="text-[11px] tabular-nums text-text-tertiary">
                  {formatMultiplier(option.multiplier)}
                </span>
              </button>
            )
          })}
        </div>
        <p className="mt-4 text-[12px] leading-relaxed text-text-tertiary">
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

/** "The verdict is paused because Garama (Diamond) has no cash estimate yet." */
function pausedMessage(labels: string[]): string {
  const [first, ...rest] = labels
  if (rest.length === 0) {
    return `The verdict is paused because ${first} has no cash estimate yet.`
  }
  const others = rest.length === 1 ? '1 other item' : `${rest.length} other items`
  return `The verdict is paused because ${first} and ${others} have no cash estimate yet.`
}

type SideSummary = {
  totals: SideTotals
  point: number
  low: number
  high: number
  unknown: number
  lowConfidence: number
}

type Verdict = {
  label: string
  caption: string
}

/**
 * Verdict as a fairness BAR: You lose ← Fair → You win. A marker sits at a
 * position driven by the % difference (0% = dead center; ±swing pins to the
 * ends). Rectangular, forest-themed, with a flowing sheen over the active
 * (win/loss) side. Replaces the old dashed circle.
 */
function VerdictBar({
  verdict,
  percentageDifference,
  pointDifference,
  ready,
}: {
  verdict: Verdict
  percentageDifference: number | null
  pointDifference: number
  ready: boolean
}) {
  // Map % → marker position (0–100). ±40% saturates to the ends; 0% = center.
  const SWING = 40
  const pct = percentageDifference ?? 0
  const clamped = Math.max(-SWING, Math.min(SWING, pct))
  const markerPos = 50 + (clamped / SWING) * 50 // 0..100

  const isWin = verdict.label === 'WIN'
  const isLoss = verdict.label === 'LOSS'
  const isFair = verdict.label === 'FAIR'
  const accent = isWin ? '#4FB477' : isLoss ? '#E23B4E' : isFair ? '#E0B155' : '#8C98A4'
  const noData = percentageDifference == null

  return (
    <div
      className="border-t border-white/[0.07] px-5 py-6 text-center sm:px-8 sm:py-7"
      style={{
        background: `radial-gradient(120% 120% at 50% 0%, ${accent}14, transparent 60%)`,
      }}
    >
      {/* Big verdict + delta pill */}
      <div className="flex flex-col items-center gap-2">
        <span
          className="text-[34px] font-black leading-none tracking-[-0.03em] sm:text-[40px]"
          style={{ color: noData ? 'var(--color-text-tertiary)' : accent }}
        >
          {noData ? <LockSimpleIcon size={34} weight="bold" aria-label="Verdict locked" /> : verdict.label}
        </span>
        {!noData && (
          <span
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-[13px] font-bold tabular-nums"
            style={{ color: accent, backgroundColor: `${accent}1a` }}
          >
            {isLoss ? (
              <ThumbsDownIcon size={15} weight="bold" aria-hidden />
            ) : pct >= 0 ? (
              <CaretUpIcon size={13} weight="fill" aria-hidden />
            ) : (
              <CaretDownIcon size={13} weight="fill" aria-hidden />
            )}
            {pct > 0 ? '+' : ''}
            {pct.toFixed(1)}%
          </span>
        )}
      </div>

      {/* The fairness bar — full, wide. */}
      <div className="mx-auto mt-5 w-full max-w-[520px]">
        <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold">
          <span style={{ color: isLoss ? '#E23B4E' : 'var(--color-text-tertiary)' }}>You Lose</span>
          <span style={{ color: isFair ? '#E0B155' : 'var(--color-text-tertiary)' }}>Fair</span>
          <span style={{ color: isWin ? '#4FB477' : 'var(--color-text-tertiary)' }}>You Win</span>
        </div>
        <div className="relative h-4 overflow-hidden rounded-full bg-bg-overlay">
          <div
            aria-hidden
            className="absolute inset-0 opacity-45"
            style={{
              background:
                'linear-gradient(90deg, rgba(226,59,78,0.55) 0%, rgba(224,177,85,0.4) 42%, rgba(224,177,85,0.4) 58%, rgba(79,180,119,0.55) 100%)',
            }}
          />
          <div aria-hidden className="absolute inset-y-0 left-1/2 w-px bg-white/25" />
          {!noData && (
            <div
              aria-hidden
              className="sab-verdict-sheen pointer-events-none absolute inset-0"
              style={{ background: `linear-gradient(110deg, transparent 35%, ${accent}66 50%, transparent 65%)` }}
            />
          )}
          {!noData && (
            <div
              className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bg-base transition-[left] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
              style={{ left: `${markerPos}%`, backgroundColor: accent, boxShadow: `0 0 12px ${accent}b3` }}
            />
          )}
        </div>
      </div>

      {/* Caption + gain line */}
      <p className="mx-auto mt-5 max-w-[440px] text-[13px] font-medium leading-6 text-text-secondary">
        {verdict.caption}
      </p>
      {ready && (
        <p className="mx-auto mt-1.5 max-w-[440px] text-[12px] leading-5 text-text-tertiary">
          {pointDifference === 0 ? (
            'Both sides come to the same value'
          ) : (
            <>
              {pointDifference > 0 ? 'You gain ' : 'You lose '}
              <span className="font-bold tabular-nums text-text-primary">
                {formatCash(Math.abs(pointDifference)) ?? '—'}
              </span>{' '}
              on this trade
            </>
          )}
        </p>
      )}
    </div>
  )
}

function TradeTab({
  brainrots,
  mutations,
  prices,
  brainrotMap,
  mutationMap,
  buy,
}: {
  brainrots: CalcBrainrot[]
  mutations: CalcMutation[]
  prices: CalcPrice[]
  brainrotMap: Map<string, CalcBrainrot>
  mutationMap: Map<string, CalcMutation>
  buy: BuyContext
}) {
  const defaultMutationId =
    mutations.find((m) => m.slug === 'default')?.id ??
    mutations[0]?.id ??
    ''

  // Rarest-first ordering for the mutation step, computed once.
  const orderedMutations = useMemo(
    () => [...mutations].sort((a, b) => mutationOrder(a.slug) - mutationOrder(b.slug)),
    [mutations],
  )

  const [give, setGive] = useState<TradeEntry[]>([])
  const [receive, setReceive] = useState<TradeEntry[]>([])
  const [editor, setEditor] = useState<EditorState>(null)
  const [search, setSearch] = useState('')
  // Picking a Brainrot no longer commits it. It parks here while the mutation
  // is chosen, because a Brainrot's mutation changes its value several times
  // over — silently defaulting to Default was quietly wrong on most picks.
  const [pendingBrainrotId, setPendingBrainrotId] = useState<string | null>(null)

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

  // Shared cents-based maths (src/lib/calculator/trade-sum.ts): every positive
  // estimate counts; only a variant with no price at all pauses the verdict.
  // Thin-evidence prices (`isTradeReady=false`, low confidence) are counted and
  // flagged, so the total always matches the tiles.
  const summarize = (
    entries: TradeEntry[],
  ): SideSummary => {
    const totals = sumSide(
      entries.map((entry) => {
        const price = getEntryPrice(entry)
        const brainrot = brainrotMap.get(entry.brainrotId)
        const mutation = mutationMap.get(entry.mutationId)
        return {
          pointUsd: price?.marketValueUsd ?? null,
          lowUsd: price?.marketLowUsd ?? null,
          highUsd: price?.marketHighUsd ?? null,
          quantity: entry.quantity,
          lowConfidence:
            price != null &&
            (!price.isTradeReady ||
              price.confidenceLabel === 'low' ||
              price.confidenceLabel === 'insufficient'),
          label: `${brainrot?.name ?? 'Unknown Brainrot'} (${mutation?.name ?? 'Default'})`,
        }
      }),
    )
    return {
      totals,
      point: centsToUsd(totals.pointCents),
      low: centsToUsd(totals.lowCents),
      high: centsToUsd(totals.highCents),
      unknown: totals.unknown,
      lowConfidence: totals.lowConfidence,
    }
  }

  const giveSummary = summarize(give)
  const receiveSummary = summarize(receive)

  const tradeResult = tradeVerdict(giveSummary.totals, receiveSummary.totals)
  const ready = tradeResult != null
  const pausedLabels = [
    ...giveSummary.totals.unknownLabels,
    ...receiveSummary.totals.unknownLabels,
  ]

  /**
   * Flattened view of both sides for the "Brainrots in this trade" table.
   * Built from the same entries the verdict uses, so the table can never
   * disagree with the maths above it.
   */
  const tradeItems = useMemo(() => {
    const build = (entries: TradeEntry[], side: 'give' | 'receive') =>
      entries.map((entry) => {
        const brainrot = brainrotMap.get(entry.brainrotId)
        const mutation = mutationMap.get(entry.mutationId)
        const price = priceMap.get(`${entry.brainrotId}:${entry.mutationId}`)
        return {
          key: entry.instanceId,
          side,
          // The item listings page (server-filtered), not a ?search= URL.
          buyHref: brainrot
            ? itemBuyHref({ gameSlug: 'steal-a-brainrot', categorySlug: buy.categorySlug, itemSlug: brainrot.slug, variant: mutation?.slug ?? null })
            : `/steal-a-brainrot/${buy.categorySlug}`,
          name: brainrot?.name ?? 'Unknown Brainrot',
          imageUrl: brainrot?.imageUrl ?? null,
          mutationName: mutation?.name ?? 'Default',
          quantity: entry.quantity,
          // No price is a real state (unpriced variant) — say so rather than
          // printing $0.00.
          priceLabel: price
            ? formatCash(price.marketValueUsd * entry.quantity) ?? '—'
            : 'No price yet',
        }
      })

    return [...build(give, 'give'), ...build(receive, 'receive')]
  }, [give, receive, brainrotMap, mutationMap, priceMap, buy.categorySlug])

  const pointDifference = tradeResult
    ? centsToUsd(tradeResult.diffCents)
    : centsToUsd(receiveSummary.totals.pointCents - giveSummary.totals.pointCents)

  const percentageDifference = tradeResult?.pct ?? null

  // --- ported verbatim: verdict (labels + captions; colours live in VerdictBar) ---
  const verdict: Verdict = (() => {
    if (!ready || percentageDifference == null) {
      return {
        label: '?',
        caption: 'Add priced variants to both sides',
      }
    }

    const clearWin = tradeResult?.kind === 'win'
    const clearLoss = tradeResult?.kind === 'loss'

    if (clearWin) {
      return {
        label: 'WIN',
        caption:
          "You're getting more than you give — even at the worst price we've seen",
      }
    }

    if (clearLoss) {
      return {
        label: 'LOSS',
        caption:
          "You're giving away more than you get — even at the best price we've seen",
      }
    }

    if (tradeResult?.kind === 'fair') {
      return {
        label: 'FAIR',
        caption:
          'Both sides are worth about the same',
      }
    }

    return {
      label: 'UNCERTAIN',
      caption:
        "Too close to call — prices move enough that this could go either way",
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

  const addBrainrot = (brainrotId: string, mutationId: string) => {
    if (!editor) return
    if (getEntries(editor.side).length >= 9) return

    setEntries(editor.side, (entries) => [
      ...entries,
      {
        instanceId: makeId(),
        brainrotId,
        mutationId,
        quantity: 1,
      },
    ])

    setEditor(null)
    setSearch('')
    setPendingBrainrotId(null)
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

  // The editor's second step (pick a mutation) or the entry editor; null
  // while the search grid shows.
  const pendingBrainrot = pendingBrainrotId ? brainrotMap.get(pendingBrainrotId) ?? null : null
  const editorDetail = activeEntry ? (
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
  ) : pendingBrainrot ? (
    /* ── Step 2: which mutation? ──
       No prices here on purpose: the whole point of the WFL tab
       is the verdict, and showing each variant's cash value
       turns the picker into a price list (that's what the Cash
       Price mode and the value list are for). */
    <div>
      <div className={`${VALUE_TILE} flex items-center gap-3 p-3`}>
        <ValueArt src={pendingBrainrot.imageUrl} alt="" size={48} className="shrink-0" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-text-primary">
            {pendingBrainrot.name}
          </p>
          <p className="mt-0.5 text-xs" style={{ color: rarityMeta(SAB_SLUG, pendingBrainrot.rarity).color }}>
            {pendingBrainrot.rarity}
          </p>
        </div>
      </div>

      <p className={`${VALUE_LABEL} mt-5`}>
        Choose The Mutation
      </p>

      <div className="mt-2.5 grid grid-cols-2 gap-2">
        {orderedMutations.map((mutation) => {
          const priced = priceMap.has(
            `${pendingBrainrot.id}:${mutation.id}`,
          )
          const visual = mutationVisual(mutation.slug)
          return (
            <button
              key={mutation.id}
              type="button"
              disabled={!priced}
              onClick={() => addBrainrot(pendingBrainrot.id, mutation.id)}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-2.5 text-left text-[13px] font-semibold transition-colors',
                FOCUS,
                priced
                  ? 'bg-white/[0.04] text-text-primary hover:bg-white/[0.08]'
                  : 'cursor-not-allowed bg-white/[0.015] text-text-disabled',
              )}
            >
              <MutationDot visual={visual} />
              <span className="truncate">{mutation.name}</span>
            </button>
          )
        })}
      </div>

      <p className="mt-4 text-[12px] leading-5 text-text-tertiary">
        Greyed-out mutations have no verified sale or listing for this
        Brainrot yet, so we can&apos;t price them.
      </p>
    </div>
  ) : undefined

  const closeEditor = () => {
    setEditor(null)
    setPendingBrainrotId(null)
  }

  return (
    <>
      <div className={`overflow-hidden ${VALUE_SURFACE}`}>
        {/* ── Two trade sides on top, side by side. Your side gets a faint green
            wash, their side a faint red wash — a subtle "win on mine / loss on
            theirs" cue without a separate tag. ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2">
          <div className="border-b border-white/[0.07] bg-[linear-gradient(180deg,rgba(79,180,119,0.05),transparent_60%)] p-5 sm:border-b-0 sm:border-r sm:p-6 lg:p-8">
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
          </div>
          <div className="bg-[linear-gradient(180deg,rgba(226,59,78,0.05),transparent_60%)] p-5 sm:p-6 lg:p-8">
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
        </div>

        {/* Any pause/low-confidence notices sit between the sides and the verdict
            so the verdict band always reads as the final answer. */}
        {pausedLabels.length > 0 && (
          <div className="border-t border-white/[0.07] bg-[#E0B155]/10 px-5 py-3 text-center text-[12.5px] text-[#E0B155] sm:px-8">
            {pausedMessage(pausedLabels)}
          </div>
        )}

        {/* ── Full-width verdict band: big WIN/LOSS + %, the fairness bar (you
            lose ← fair → you win) with a marker driven by the % difference and a
            flowing sheen, then the caption + gain line. ── */}
        <VerdictBar
          verdict={verdict}
          percentageDifference={percentageDifference}
          pointDifference={pointDifference}
          ready={ready}
        />

        {ready &&
          giveSummary.lowConfidence + receiveSummary.lowConfidence > 0 && (
            <p className="border-t border-white/[0.07] bg-white/[0.03] px-5 py-2.5 text-center text-[12px] text-text-secondary sm:px-8">
              Based on limited price data
            </p>
          )}

        <div className="grid gap-3 border-t border-white/[0.07] p-5 sm:grid-cols-2 sm:px-8">
          <button
            type="button"
            onClick={clearTrade}
            className={`inline-flex h-11 items-center justify-center rounded-md bg-[#E23B4E]/10 px-5 text-[13px] font-semibold text-[#E23B4E] transition-[background-color,transform] hover:bg-[#E23B4E]/15 active:scale-[0.98] ${FOCUS}`}
          >
            Clear Trade
          </button>

          <Link href="/steal-a-brainrot/values" className={`${VALUE_BTN_PRIMARY} h-11`}>
            View Values
            <ArrowRightIcon size={15} weight="bold" aria-hidden />
          </Link>
        </div>
      </div>

      {/* ── Items in this trade ──
          Every Brainrot on either side, with a direct route to buy that exact
          one. The verdict tells you whether the trade is good; this turns
          "their side is worth more" into something you can act on. Only
          rendered once something is on the table. */}
      {tradeItems.length > 0 && (
        <div className={`mt-6 overflow-hidden ${VALUE_SURFACE}`}>
          <div className="border-b border-white/[0.07] px-4 py-3">
            <h3 className="text-[15px] font-semibold text-text-primary">
              Brainrots in this trade
            </h3>
            <p className="mt-0.5 text-[12.5px] text-text-secondary">
              Tap any one to see it for sale on DropMarket.
            </p>
          </div>

          <ul className="divide-y divide-white/[0.07]">
            {tradeItems.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.buyHref}
                  className="group grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring"
                >
                  <ValueArt src={item.imageUrl} alt="" size={44} />

                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-[14.5px] font-semibold text-text-primary">
                      {item.name}
                      {item.quantity > 1 && (
                        <span className="ml-1.5 text-[12.5px] font-normal text-text-secondary">
                          ×{item.quantity}
                        </span>
                      )}
                    </span>
                    <span className="text-[12.5px] text-text-secondary">
                      {item.mutationName} · {item.side === 'give' ? 'Your side' : 'Their side'}
                    </span>
                  </span>

                  <span className="flex items-center gap-2 text-right">
                    <span className="text-[14.5px] font-bold tabular-nums text-text-primary">
                      {item.priceLabel}
                    </span>
                    <ArrowRightIcon
                      size={16}
                      weight="bold"
                      aria-hidden
                      className="shrink-0 text-text-tertiary transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-text-primary motion-reduce:transition-none"
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 text-center text-[12px] leading-5 text-text-tertiary">
        Cash estimates may use DropMarket sales, completed
        external sales, reviewed ranges, or current listings.
        They are estimates, not guaranteed sale prices.
      </p>

      <ItemPickerDialog
        open={editor != null}
        onClose={closeEditor}
        title={activeEntry ? 'Edit Brainrot' : 'Add Brainrot'}
        subtitle={editor?.side === 'give' ? 'Your side of the trade' : 'Their side of the trade'}
        items={filteredBrainrots.map((brainrot) => ({
          key: brainrot.id,
          name: brainrot.name,
          imageUrl: brainrot.imageUrl,
          // Rarity only — the price is deliberately withheld until the verdict.
          sub: brainrot.rarity,
          subColor: rarityMeta(SAB_SLUG, brainrot.rarity).color,
        }))}
        onPick={(id) => setPendingBrainrotId(id)}
        query={search}
        onQueryChange={setSearch}
        searchPlaceholder="Search Brainrots..."
        searchLabel="Search Brainrots"
        emptyText="No Brainrots match."
        detail={editorDetail}
        onBack={!activeEntry && pendingBrainrot ? () => setPendingBrainrotId(null) : undefined}
        backLabel="Back to Brainrots"
      />
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
        <p className="text-[12px] font-semibold text-text-secondary">
          {label}
        </p>
        <p className="mt-1 text-[15px] font-semibold tabular-nums text-text-primary">
          {formatCash(summary.point) ?? '$0'}
        </p>
        {summary.unknown === 0 &&
          Math.abs(summary.high - summary.low) > 0.01 && (
            <p className="mt-0.5 text-[11px] tabular-nums text-text-tertiary">
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
                aria-label={`Add a Brainrot to ${label}`}
                className={`group flex aspect-square items-center justify-center rounded-md bg-white/[0.03] transition-[background-color,transform] hover:bg-white/[0.07] active:scale-[0.97] ${FOCUS}`}
              >
                <PlusIcon
                  size={22}
                  weight="bold"
                  aria-hidden
                  className="text-white/20 transition-colors group-hover:text-text-primary"
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
              className={`group relative flex aspect-square items-center justify-center overflow-hidden rounded-md bg-white/[0.05] p-2 transition-colors hover:bg-white/[0.09] ${FOCUS}`}
            >
              <ValueArt
                src={brainrot?.imageUrl}
                alt={brainrot?.name ?? 'Unknown Brainrot'}
                size={60}
                className="transition-transform duration-200 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
              />

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
    <div>
      <div className={`${VALUE_TILE} flex items-center gap-4 p-4`}>
        <ValueArt src={brainrot?.imageUrl} alt="" size={80} className="shrink-0" />

        <div className="min-w-0">
          <p className="font-semibold text-text-primary">
            {brainrot?.name ?? 'Unknown Brainrot'}
          </p>
          <p className="mt-1 text-xs text-text-tertiary">
            {brainrot?.rarity}
          </p>
          <p
            className={cn(
              'mt-2 text-sm font-semibold tabular-nums',
              price ? 'text-text-primary' : 'text-[#E0B155]',
            )}
          >
            {price
              ? range ?? '—'
              : 'No cash-market estimate'}
          </p>
          {price && (
            <p className="mt-1 text-[11px] text-text-tertiary">
              {formatConfidence(price.confidenceLabel)}
            </p>
          )}
        </div>
      </div>

      <div className="mt-5">
        <span className={VALUE_LABEL}>
          Mutation
        </span>
        <ValueSelect
          className="mt-2 h-11 w-full"
          value={entry.mutationId}
          onChange={(mutationId) => onUpdate({ mutationId })}
          label="Mutation"
          options={mutations.map((mutation) => {
            const mutationPrice =
              priceMap.get(
                `${entry.brainrotId}:${mutation.id}`,
              ) ?? null
            return {
              value: mutation.id,
              label: `${mutation.name} ${
                mutationPrice
                  ? `(${formatCash(mutationPrice.marketValueUsd)})`
                  : '(No estimate)'
              }`,
              leading: <MutationDot visual={mutationVisual(mutation.slug)} />,
            }
          })}
        />
      </div>

      <label className="mt-4 block">
        <span className={VALUE_LABEL}>
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
          className={`mt-2 h-11 w-full px-3 text-base tabular-nums sm:text-sm ${VALUE_FIELD}`}
        />
      </label>

      <button
        type="button"
        onClick={onRemove}
        className={`mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#E23B4E]/10 px-4 text-[13px] font-semibold text-[#E23B4E] transition-[background-color,transform] hover:bg-[#E23B4E]/15 active:scale-[0.98] ${FOCUS}`}
      >
        <TrashIcon size={16} weight="bold" aria-hidden />
        Remove Brainrot
      </button>
    </div>
  )
}
