'use client'

/**
 * "Every MM2 Chroma": filter tiles (Knives · Guns · Pets · From Boxes · From
 * Events) + sort (Highest Price · Biggest Multiple), then one shared
 * ValueCard per Chroma: type · rarity → art + name → where it comes from →
 * the ×N multiple with a bar → Chroma / Normal prices.
 *
 * Static-first: the prerendered HTML holds every card in the default order
 * (the crawlable list); `?view=` / `?sort=` are read after hydration through
 * SearchParamsBridge and mirrored back with history.replaceState.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { SortAscendingIcon } from '@phosphor-icons/react/dist/csr/SortAscending'
import { SearchParamsBridge } from '@/components/navigation/SearchParamsBridge'
import { CardRank, PriceStatPair, ValueCard } from '@/components/values/ValueCard'
import { RarityFilterBar } from '@/components/values/RarityFilterBar'
import { ValueSelect } from '@/components/values/ValueSelect'
import { ValuesEmptyState } from '@/components/values/ValuesEmptyState'
import {
  CHROMA_BAR,
  CHROMA_FILTERS,
  CHROMA_SORTS,
  chromaMultiple,
  fmtMultiple,
  matchesChromaFilter,
  multipleBarPct,
  sortChromas,
  type ChromaEntry,
  type ChromaFilterKey,
  type ChromaSort,
} from '@/lib/values/chromas'
import { rarityMeta } from '@/lib/values/rarity'

/** "Cheapest" teal — money reads the same as on the value list. */
const MONEY = '#54DDBE'
const CHROMA = rarityMeta('murder-mystery-2', 'Chroma').color

const FILTER_COLOR: Record<ChromaFilterKey, string> = {
  all: '#9AA6A0',
  knife: '#7AB6FF',
  gun: '#A58BFF',
  pet: '#D7A57A',
  box: '#5EE2E6',
  event: '#F2A250',
}

/** Cents under $1,000; whole dollars above, so a two-column phone card never clips "$4,046". */
const usd = (v: number) =>
  v >= 1000
    ? v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
    : v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })

const DEFAULT_SORT: ChromaSort = 'price'

export function ChromaGrid({
  entries,
  maxMultiple,
  typeLabels,
  gameName,
}: {
  entries: ChromaEntry[]
  /** The biggest multiple on the page (the bar's full width). */
  maxMultiple: number
  typeLabels: Readonly<Record<string, string>>
  gameName: string
}) {
  const reduceMotion = useReducedMotion()
  const [view, setView] = useState<ChromaFilterKey>('all')
  const [sort, setSort] = useState<ChromaSort>(DEFAULT_SORT)
  const [seeded, setSeeded] = useState(false)

  const options = useMemo(() => {
    const counted = CHROMA_FILTERS.map((f) => ({ ...f, count: entries.filter((e) => matchesChromaFilter(e, f.key)).length }))
    return [
      { key: 'all', label: 'All', color: FILTER_COLOR.all, count: entries.length },
      ...counted.filter((f) => f.count > 0).map((f) => ({ key: f.key, label: f.label, color: FILTER_COLOR[f.key], count: f.count })),
    ]
  }, [entries])

  const seed = useCallback(
    (params: URLSearchParams) => {
      if (seeded) return
      const v = params.get('view')
      const s = params.get('sort')
      if (v && options.some((o) => o.key === v)) setView(v as ChromaFilterKey)
      if (s && CHROMA_SORTS.some((o) => o.value === s)) setSort(s as ChromaSort)
      setSeeded(true)
    },
    [seeded, options],
  )

  useEffect(() => {
    if (!seeded) return
    const params = new URLSearchParams(window.location.search)
    if (view === 'all') params.delete('view')
    else params.set('view', view)
    if (sort === DEFAULT_SORT) params.delete('sort')
    else params.set('sort', sort)
    const qs = params.toString()
    const next = qs ? `${window.location.pathname}?${qs}` : window.location.pathname
    if (next !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(window.history.state, '', next)
    }
  }, [seeded, view, sort])

  const shown = useMemo(() => sortChromas(entries.filter((e) => matchesChromaFilter(e, view)), sort), [entries, view, sort])

  return (
    <div>
      <SearchParamsBridge onParams={seed} />
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <RarityFilterBar options={options} value={view} onChange={(k) => setView(k as ChromaFilterKey)} label="Filter Chromas" />
        </div>
        <div className="w-full shrink-0 lg:w-56">
          <ValueSelect
            value={sort}
            onChange={setSort}
            options={CHROMA_SORTS}
            label="Sort Chromas"
            icon={<SortAscendingIcon size={16} weight="bold" />}
          />
        </div>
      </div>

      {shown.length === 0 ? (
        <ValuesEmptyState className="mt-6" title="No Chromas Here" body="Try another filter." />
      ) : (
        <motion.div
          key={`${view}|${sort}`}
          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5"
        >
          {shown.map((e, i) => (
            <ChromaCard
              key={e.slug}
              entry={e}
              rank={i + 1}
              maxMultiple={maxMultiple}
              typeLabel={e.itemType ? typeLabels[e.itemType] ?? null : null}
              gameName={gameName}
            />
          ))}
        </motion.div>
      )}
    </div>
  )
}

function ChromaCard({
  entry,
  rank,
  maxMultiple,
  typeLabel,
  gameName,
}: {
  entry: ChromaEntry
  rank: number
  maxMultiple: number
  typeLabel: string | null
  gameName: string
}) {
  const m = chromaMultiple(entry)
  const priced = entry.cheapestUsd != null
  const normal = entry.base?.cheapestUsd ?? null
  return (
    <ValueCard
      href={entry.href}
      headerLeft={
        <>
          <CardRank rank={rank} />
          {typeLabel && <span className="truncate text-[11px] font-medium text-text-tertiary">{typeLabel}</span>}
        </>
      }
      imageSrc={entry.imageUrl}
      imageAlt={`${entry.name}${typeLabel ? ` ${typeLabel.toLowerCase()}` : ''} in ${gameName}`}
      name={entry.name}
      sub={entry.source.label ? <span className="text-text-tertiary">{entry.source.label}</span> : undefined}
      control={
        m != null ? (
          <div className="flex items-center gap-2" title={`${entry.name} sells for ${m.toFixed(1)} times its normal version`}>
            <span className="text-[13px] font-bold tabular-nums" style={{ color: CHROMA }}>
              {fmtMultiple(m)}
            </span>
            <span aria-hidden className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
              <span className="block h-full rounded-full" style={{ width: `${multipleBarPct(m, maxMultiple)}%`, background: CHROMA_BAR }} />
            </span>
            <span className="text-[11px] font-medium text-text-tertiary">vs Normal</span>
          </div>
        ) : (
          <div className="flex h-[19.5px] items-center justify-center text-[11px] font-medium text-text-tertiary">
            {entry.base ? 'No Normal Price Yet' : 'No Normal Version Listed'}
          </div>
        )
      }
      footer={
        <PriceStatPair
          empty={priced ? null : 'No Price Yet'}
          stats={[
            { label: 'Chroma', value: priced ? usd(entry.cheapestUsd!) : null, color: MONEY },
            { label: 'Normal', value: normal != null ? usd(normal) : null },
          ]}
        />
      }
    />
  )
}
