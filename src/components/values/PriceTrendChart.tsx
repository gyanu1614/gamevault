'use client'

/**
 * The ONE price-trend chart for every values item page (SAB mutations, Adopt
 * Me variants). Two modes:
 *   • overlay — legend chips overlay/hide each series (SAB: compare mutations);
 *     the hero-selected series stays lit.
 *   • single  — one focused line; a dropdown switches series and writes the
 *     choice back through `onSelect` (Adopt Me: shared variant state).
 * Optional range tabs window every series to its last N days. The Y-axis is
 * ZOOMED around the visible data (not anchored at 0) so a $0.93→$1.00 move is
 * visible on a cheap item.
 *
 * recharts is ~100KB: callers load this module with next/dynamic (ssr: false,
 * `loading: TrendChartPlaceholder` from ValueItemHero) so it stays out of the
 * item page's initial JS.
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Area, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useReducedMotion } from 'framer-motion'
import { ChartLineIcon } from '@phosphor-icons/react/dist/csr/ChartLine'
import { CaretUpIcon } from '@phosphor-icons/react/dist/csr/CaretUp'
import { CaretDownIcon } from '@phosphor-icons/react/dist/csr/CaretDown'
import { ValueSelect } from './ValueSelect'
import { VALUE_LABEL, VALUE_SURFACE, VALUE_TILE } from './styles'

export type TrendPoint = { date: string; value: number }

export type TrendSeries = {
  key: string
  name: string
  color: string
  /** Daily points, oldest first. Series with < 2 points are not plottable. */
  points: TrendPoint[]
}

export type TrendRange = { key: string; label: string; days: number | null }

const UP = 'var(--color-success)'
const DOWN = 'var(--color-error)'
const AXIS = 'var(--color-text-tertiary)'

export function formatTrendDay(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/** Round a bound to a "nice" number so axis ticks read cleanly at any scale. */
function niceBound(value: number, dir: 'floor' | 'ceil'): number {
  if (value <= 0) return 0
  const mag = Math.pow(10, Math.floor(Math.log10(value)))
  const step = mag / 2 // half-decade steps: 0.5, 1, 5, 10, 50…
  return dir === 'floor' ? Math.max(0, Math.floor(value / step) * step) : Math.ceil(value / step) * step
}

function windowed(points: TrendPoint[], days: number | null): TrendPoint[] {
  return days != null && points.length > days ? points.slice(points.length - days) : points
}

export function PriceTrendChart({
  series,
  selectedKey,
  mode,
  formatValue,
  onSelect,
  ranges,
  defaultRange,
  showCurrent = false,
  seriesNoun = 'series',
  emptyBody,
  height = 200,
  idPrefix,
}: {
  /** Every series in display order (unplottable ones are skipped). */
  series: TrendSeries[]
  /** The hero-selected series: pre-lit, and the one the header % describes. */
  selectedKey: string
  mode: 'overlay' | 'single'
  formatValue: (v: number) => string
  /** Single mode: switch series from the chart (writes the shared selection). */
  onSelect?: (key: string) => void
  ranges?: TrendRange[]
  defaultRange?: string
  /** Header leads with the current price (single mode). */
  showCurrent?: boolean
  /** Overlay count line: "3 of 9 mutations shown". */
  seriesNoun?: string
  /** Empty-state body; receives the active series name. */
  emptyBody: (name: string) => ReactNode
  height?: number
  /** Unique prefix for the SVG gradient ids. */
  idPrefix: string
}) {
  const reduceMotion = useReducedMotion()
  const plottable = useMemo(() => series.filter((s) => s.points.length >= 2), [series])
  const byKey = useMemo(() => new Map(series.map((s) => [s.key, s])), [series])

  const [range, setRange] = useState<string>(defaultRange ?? ranges?.[0]?.key ?? 'all')
  const rangeDays = ranges?.find((r) => r.key === range)?.days ?? null

  // Single mode: the selected series when it can be plotted, else the first
  // that can (the rest of the page keeps the selection).
  const activeKey =
    mode === 'single'
      ? (plottable.find((s) => s.key === selectedKey)?.key ?? plottable[0]?.key ?? selectedKey)
      : selectedKey
  const active = byKey.get(activeKey)
  const activeName = active?.name ?? activeKey

  // Overlay mode: which lines are visible. Opens on ALL of them; the hero
  // selection is kept lit when it changes above.
  const allKeys = useMemo(() => plottable.map((s) => s.key), [plottable])
  const [visible, setVisible] = useState<Set<string>>(() => new Set(allKeys))
  useEffect(() => {
    if (mode !== 'overlay') return
    setVisible((prev) => (prev.has(selectedKey) ? prev : new Set(prev).add(selectedKey)))
  }, [mode, selectedKey])

  const shown = useMemo(
    () =>
      mode === 'single'
        ? plottable.filter((s) => s.key === activeKey)
        : plottable.filter((s) => visible.has(s.key)),
    [mode, plottable, activeKey, visible],
  )

  // Merge the shown series onto one date axis with a zoomed Y-domain.
  const { data, domain } = useMemo(() => {
    const byDate = new Map<string, Record<string, number | string>>()
    let min = Infinity
    let max = -Infinity
    for (const s of shown) {
      for (const p of windowed(s.points, rangeDays)) {
        const row = byDate.get(p.date) ?? { date: p.date, label: formatTrendDay(p.date) }
        row[s.key] = p.value
        byDate.set(p.date, row)
        if (p.value < min) min = p.value
        if (p.value > max) max = p.value
      }
    }
    const rows = [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)))
    let dom: [number, number] | ['auto', 'auto'] = ['auto', 'auto']
    if (Number.isFinite(min) && Number.isFinite(max)) {
      const pad = Math.max((max - min) * 0.12, max * 0.04, 0.02)
      dom = [niceBound(min - pad, 'floor'), niceBound(max + pad, 'ceil')]
    }
    return { data: rows, domain: dom }
  }, [shown, rangeDays])

  // Header: change over the window for the active series.
  const stats = useMemo(() => {
    const pts = windowed(byKey.get(activeKey)?.points ?? [], rangeDays)
    if (pts.length < 2) return null
    const first = pts[0].value
    const last = pts[pts.length - 1].value
    const change = last - first
    return { current: last, change, pct: first > 0 ? (change / first) * 100 : 0, up: change >= 0 }
  }, [byKey, activeKey, rangeDays])

  function toggle(key: string) {
    setVisible((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        if (next.size > 1) next.delete(key) // keep at least one line on screen
      } else next.add(key)
      return next
    })
  }

  const enoughData = data.length >= 2
  const accent = active?.color ?? 'var(--color-text-secondary)'
  const Trend = stats?.up ? CaretUpIcon : CaretDownIcon

  return (
    <section className={`${VALUE_SURFACE} p-5 sm:p-6`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            {mode === 'single' && onSelect && plottable.length > 1 ? (
              <ValueSelect
                value={activeKey}
                onChange={onSelect}
                label="Price Trend Variant"
                className="h-10 w-auto min-w-[11rem] font-semibold"
                options={plottable.map((s) => ({
                  value: s.key,
                  label: s.name,
                  leading: <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />,
                }))}
              />
            ) : mode === 'single' ? (
              <span className="inline-flex items-center gap-2 text-[14px] font-semibold text-text-primary">
                <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: accent }} />
                {activeName}
              </span>
            ) : (
              <ChartLineIcon aria-hidden size={18} weight="bold" style={{ color: accent }} />
            )}
            <h2 className={mode === 'single' ? `${VALUE_LABEL} text-[13px]` : 'text-sm font-semibold text-text-primary'}>
              Price trend
            </h2>
          </div>
          {stats && (
            <p className="mt-2.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              {showCurrent && (
                <span className="text-heading font-extrabold tabular-nums text-text-primary">
                  {formatValue(stats.current)}
                </span>
              )}
              <span
                className="inline-flex items-center gap-1 text-[13px] font-semibold tabular-nums"
                style={{ color: stats.up ? UP : DOWN }}
              >
                {!showCurrent && <span className="mr-0.5 text-text-secondary">{activeName}</span>}
                <Trend aria-hidden size={12} weight="fill" />
                <span className="sr-only">{stats.up ? 'Up' : 'Down'}</span>
                {formatValue(Math.abs(stats.change))} ({stats.pct >= 0 ? '+' : ''}
                {stats.pct.toFixed(1)}%)
              </span>
            </p>
          )}
        </div>

        {ranges && ranges.length > 1 && (
          <div role="group" aria-label="Range" className="flex gap-0.5 rounded-md bg-bg-overlay p-1">
            {ranges.map((r) => {
              const on = range === r.key
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setRange(r.key)}
                  aria-pressed={on}
                  className={`rounded px-3 py-1.5 text-caption font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                    on ? 'bg-bg-overlay-2 text-text-primary' : 'text-text-tertiary hover:text-text-primary'
                  }`}
                >
                  {r.label}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {mode === 'overlay' && plottable.length > 1 && (
        <>
          <div className="mt-3 flex items-center justify-between gap-2">
            <p className={VALUE_LABEL}>
              {visible.size} of {plottable.length} {seriesNoun} shown
            </p>
            <div className="flex gap-1.5">
              <button type="button" onClick={() => setVisible(new Set(allKeys))} className={CHIP_BTN}>
                Select All
              </button>
              {/* Clear leaves the hero-selected line on, so the chart never empties. */}
              <button type="button" onClick={() => setVisible(new Set([selectedKey]))} className={CHIP_BTN}>
                Clear
              </button>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {plottable.map((s) => {
              const on = visible.has(s.key)
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => toggle(s.key)}
                  aria-pressed={on}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                    on ? '' : 'bg-bg-overlay text-text-tertiary hover:text-text-secondary'
                  }`}
                  style={
                    on
                      ? { backgroundColor: `color-mix(in srgb, ${s.color} 18%, transparent)`, color: s.color }
                      : undefined
                  }
                >
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: on ? s.color : 'var(--color-text-disabled)' }}
                  />
                  {s.name}
                </button>
              )
            })}
          </div>
        </>
      )}

      {!enoughData ? (
        <div
          className={`mt-4 flex flex-col items-center justify-center px-4 text-center ${VALUE_TILE}`}
          style={{ height: height - 20 }}
        >
          <p className="text-sm font-semibold text-text-secondary">Collecting price history</p>
          <p className="mt-1 max-w-[300px] text-xs text-text-tertiary">{emptyBody(activeName)}</p>
        </div>
      ) : (
        <div className="mt-4 w-full" style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -14 }}>
              <defs>
                {shown.map((s) => (
                  <linearGradient key={s.key} id={`${idPrefix}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={s.color} stopOpacity={0.24} />
                    <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <XAxis
                dataKey="label"
                tick={{ fill: AXIS, fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: 'rgba(255,255,255,0.07)' }}
                minTickGap={26}
              />
              <YAxis
                tick={{ fill: AXIS, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={54}
                tickFormatter={(v) => formatValue(Number(v))}
                domain={domain}
                allowDecimals
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--color-bg-raised)',
                  border: 'none',
                  borderRadius: 8,
                  boxShadow: '0 18px 40px -14px rgba(0,0,0,0.75)',
                  fontSize: 12,
                }}
                labelStyle={{ color: 'var(--color-text-secondary)' }}
                itemStyle={{ color: 'var(--color-text-primary)' }}
                formatter={(value, name) => [
                  formatValue(Number(value)),
                  byKey.get(String(name))?.name ?? String(name),
                ] as [string, string]}
              />
              {/* One filled Area when a single line shows; plain Lines overlay
                  for comparison. */}
              {shown.map((s) =>
                shown.length === 1 ? (
                  <Area
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    stroke={s.color}
                    strokeWidth={2.25}
                    fill={`url(#${idPrefix}-${s.key})`}
                    dot={false}
                    activeDot={{ r: 4, fill: s.color, stroke: 'var(--color-bg-raised)', strokeWidth: 2 }}
                    connectNulls
                    isAnimationActive={!reduceMotion}
                  />
                ) : (
                  <Line
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    stroke={s.color}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 3, fill: s.color }}
                    connectNulls
                    isAnimationActive={!reduceMotion}
                  />
                ),
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}

const CHIP_BTN =
  'rounded-md bg-bg-overlay px-2.5 py-1 text-[11px] font-semibold text-text-secondary transition-colors hover:bg-bg-overlay-2 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring'

