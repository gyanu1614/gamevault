'use client'

/**
 * The events timeline: season filter chips, then one surface per year with
 * its events as plain rows split by hairlines (no card-in-card). Each row is
 * season tile · name + dates · item thumbs · item count · set value.
 *
 * Static-first: the prerendered HTML holds every year and every row (the
 * crawlable list); `?season=` is read after hydration through
 * SearchParamsBridge and mirrored back with history.replaceState.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { CaretRightIcon } from '@phosphor-icons/react/dist/csr/CaretRight'
import Link from '@/components/navigation/AppLink'
import { SearchParamsBridge } from '@/components/navigation/SearchParamsBridge'
import { RarityFilterBar } from '@/components/values/RarityFilterBar'
import { ValueArt } from '@/components/values/ValueArt'
import { VALUE_LABEL, VALUE_SURFACE } from '@/components/values/styles'
import {
  EVENT_SEASONS,
  SEASON_FILTERS,
  formatEventUsd,
  groupEventsByYear,
  hexRgb,
  seasonFilterOf,
  type EventSeason,
  type EventStatus,
  type SeasonFilterKey,
} from '@/lib/values/events-model'
import { EventSeasonTile } from './_EventSeasonTile'

export interface TimelineRow {
  slug: string
  href: string
  name: string
  season: EventSeason
  year: number
  status: EventStatus
  /** "Oct 18 – Nov 21, 2025" / "Date Not Announced". */
  dateLine: string
  itemCount: number
  setValueUsd: number | null
  thumbs: { name: string; imageUrl: string | null; color: string }[]
}

type Filter = 'all' | SeasonFilterKey

/** "Cheapest" teal — money reads the same as on the value list. */
const MONEY = '#54DDBE'

export function EventsTimeline({ rows, gameName }: { rows: TimelineRow[]; gameName: string }) {
  const reduceMotion = useReducedMotion()
  const [filter, setFilter] = useState<Filter>('all')
  const [seeded, setSeeded] = useState(false)

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const r of rows) c[seasonFilterOf(r.season)] = (c[seasonFilterOf(r.season)] ?? 0) + 1
    return c
  }, [rows])

  const options = [
    { key: 'all', label: 'All', color: '#9AA6A0', count: rows.length },
    ...SEASON_FILTERS.filter((f) => (counts[f.key] ?? 0) > 0).map((f) => ({
      key: f.key,
      label: f.label,
      color: f.key === 'other' ? EVENT_SEASONS.other.color : EVENT_SEASONS[f.key as EventSeason].color,
      count: counts[f.key] ?? 0,
    })),
  ]

  const seed = useCallback(
    (params: URLSearchParams) => {
      if (seeded) return
      const s = params.get('season')
      if (s && SEASON_FILTERS.some((f) => f.key === s)) setFilter(s as Filter)
      setSeeded(true)
    },
    [seeded],
  )

  useEffect(() => {
    if (!seeded) return
    const params = new URLSearchParams(window.location.search)
    if (filter === 'all') params.delete('season')
    else params.set('season', filter)
    const qs = params.toString()
    const next = qs ? `${window.location.pathname}?${qs}` : window.location.pathname
    if (next !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(window.history.state, '', next)
    }
  }, [seeded, filter])

  const groups = useMemo(
    () => groupEventsByYear(filter === 'all' ? rows : rows.filter((r) => seasonFilterOf(r.season) === filter)),
    [rows, filter],
  )

  return (
    <div>
      <SearchParamsBridge onParams={seed} />
      <RarityFilterBar
        options={options}
        value={filter}
        onChange={(k) => setFilter(k as Filter)}
        label="Filter events by season"
      />

      <div className="mt-8 space-y-10">
        <AnimatePresence initial={false} mode="popLayout">
          {groups.map((g) => (
            <motion.section
              key={g.year}
              layout={!reduceMotion}
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              aria-labelledby={`events-${g.year}`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3 id={`events-${g.year}`} className="text-[22px] font-bold tabular-nums tracking-tight text-text-primary">
                  <span className="sr-only">{gameName} events in </span>
                  {g.year}
                </h3>
                <span className="text-[13px] font-medium tabular-nums text-text-tertiary">
                  {g.events.length} {g.events.length === 1 ? 'Event' : 'Events'}
                </span>
              </div>
              <ul className={`mt-4 overflow-hidden ${VALUE_SURFACE}`}>
                {g.events.map((r, i) => (
                  <EventRow key={r.slug} row={r} first={i === 0} />
                ))}
              </ul>
            </motion.section>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

function EventRow({ row, first }: { row: TimelineRow; first: boolean }) {
  const rgb = hexRgb(EVENT_SEASONS[row.season].color)
  const upcoming = row.status === 'upcoming'
  return (
    <li className={first ? '' : 'border-t border-white/[0.07]'}>
      <Link
        href={row.href}
        className="group relative flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-white/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring sm:px-5 lg:flex-row lg:items-center lg:gap-6"
        style={{ backgroundImage: `linear-gradient(90deg, rgba(${rgb},0.09) 0%, rgba(${rgb},0.02) 28%, transparent 55%)` }}
      >
        {/* Season tile + name + dates */}
        <div className="flex min-w-0 flex-1 items-center gap-3.5">
          <EventSeasonTile season={row.season} size={42} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-semibold leading-6 tracking-[-0.01em] text-text-primary">{row.name}</p>
            <p className="truncate text-[13px] leading-5 text-text-secondary">
              {row.status === 'live' && <span className="font-semibold text-[#3FD986]">Live Now · </span>}
              {row.dateLine}
            </p>
          </div>
          {/* Phone: the set value sits on the name line. */}
          <div className="text-right lg:hidden">
            <p className={VALUE_LABEL}>Set Value</p>
            <p className="text-[15px] font-semibold tabular-nums" style={{ color: row.setValueUsd != null ? MONEY : undefined }}>
              {row.setValueUsd != null ? formatEventUsd(row.setValueUsd) : '—'}
            </p>
          </div>
        </div>

        {/* Thumbs (+ count on phones) */}
        <div className="flex items-center justify-between gap-3 lg:justify-end">
          <Thumbs thumbs={row.thumbs} />
          <p className="text-[13px] font-medium tabular-nums text-text-tertiary lg:hidden">
            {upcoming ? 'Items Not Out Yet' : `${row.itemCount} ${row.itemCount === 1 ? 'Item' : 'Items'}`}
          </p>
        </div>

        {/* Desktop stats */}
        <div className="hidden w-16 text-right lg:block">
          <p className={VALUE_LABEL}>Items</p>
          <p className="text-[15px] font-semibold tabular-nums text-text-primary">{upcoming ? '—' : row.itemCount}</p>
        </div>
        <div className="hidden w-24 text-right lg:block">
          <p className={VALUE_LABEL}>Set Value</p>
          <p className="text-[15px] font-semibold tabular-nums" style={{ color: row.setValueUsd != null ? MONEY : 'var(--color-text-tertiary)' }}>
            {row.setValueUsd != null ? formatEventUsd(row.setValueUsd) : '—'}
          </p>
        </div>
        <CaretRightIcon
          aria-hidden
          size={16}
          weight="bold"
          className="hidden shrink-0 text-text-tertiary transition-transform group-hover:translate-x-0.5 group-hover:text-text-primary lg:block"
        />
      </Link>
    </li>
  )
}

function Thumbs({ thumbs }: { thumbs: TimelineRow['thumbs'] }) {
  if (thumbs.length === 0) return <span className="lg:w-[196px]" />
  return (
    <span className="flex gap-1.5 lg:w-[196px] lg:justify-end">
      {thumbs.map((t, i) => (
        <span
          key={`${t.name}-${i}`}
          title={t.name}
          className="grid h-9 w-9 place-items-center rounded-md"
          style={{ background: `radial-gradient(closest-side, ${t.color}2E, rgba(255,255,255,0.03))` }}
        >
          <ValueArt src={t.imageUrl} alt={t.name} size={28} />
        </span>
      ))}
    </span>
  )
}
