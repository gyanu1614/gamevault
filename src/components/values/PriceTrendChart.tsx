'use client'

/**
 * The ONE price-trend chart for every values item page (SAB mutations, Adopt
 * Me variants), one behaviour everywhere:
 *   • it plots ONLY the series selected on the page (`selectedKey`, which the
 *     caller keeps in step with the hero picker), as a filled line;
 *   • header: that series' current price + its change over the range;
 *   • range tabs 7D / 30D / 90D / All (30D by default);
 *   • a compact "Compare" popover adds other series as extra lines (Select
 *     All inside), with Clear back to just the selected one.
 * Lines are linear (sharp day-to-day moves, no smoothing). The Y-axis is
 * ZOOMED around the visible data (not anchored at 0) so a $0.93→$1.00 move is
 * visible on a cheap item.
 *
 * recharts is ~100KB: callers load this module with next/dynamic (ssr: false,
 * `loading: TrendChartPlaceholder` from ValueItemHero) so it stays out of the
 * item page's initial JS. Callers import only TYPES from here.
 */

import { useMemo, useState, type ReactNode } from 'react'
import { Area, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useReducedMotion } from 'framer-motion'
import { CaretUpIcon } from '@phosphor-icons/react/dist/csr/CaretUp'
import { CaretDownIcon } from '@phosphor-icons/react/dist/csr/CaretDown'
import { CheckIcon } from '@phosphor-icons/react/dist/csr/Check'
import { PlusIcon } from '@phosphor-icons/react/dist/csr/Plus'
import { XIcon } from '@phosphor-icons/react/dist/csr/X'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { VALUE_LABEL, VALUE_PANEL, VALUE_SURFACE, VALUE_TILE } from './styles'

export type TrendPoint = { date: string; value: number }

export type TrendSeries = {
  key: string
  name: string
  color: string
  /** Daily points, oldest first. Series with < 2 points are not plottable. */
  points: TrendPoint[]
}

export type TrendRange = { key: string; label: string; days: number | null }

const RANGES: TrendRange[] = [
  { key: '7d', label: '7D', days: 7 },
  { key: '30d', label: '30D', days: 30 },
  { key: '90d', label: '90D', days: 90 },
  { key: 'all', label: 'All', days: null },
]
const DEFAULT_RANGE = '30d'

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

const SMALL_BTN =
  'inline-flex items-center gap-1.5 rounded-md bg-bg-overlay px-2.5 py-1.5 text-[12px] font-semibold text-text-secondary transition-colors ' +
  'hover:bg-bg-overlay-2 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring'

export function PriceTrendChart({
  series,
  selectedKey,
  formatValue,
  seriesNoun = 'series',
  emptyBody,
  height = 200,
  idPrefix,
}: {
  /** Every series in display order (unplottable ones can't be compared). */
  series: TrendSeries[]
  /** The series selected on the page: the chart's main line and headline. */
  selectedKey: string
  formatValue: (v: number) => string
  /** For the compare control: "Compare mutations". */
  seriesNoun?: string
  /** Empty-state body; receives the selected series name. */
  emptyBody: (name: string) => ReactNode
  height?: number
  /** Unique prefix for the SVG gradient ids. */
  idPrefix: string
}) {
  const reduceMotion = useReducedMotion()
  const byKey = useMemo(() => new Map(series.map((s) => [s.key, s])), [series])
  const comparable = useMemo(
    () => series.filter((s) => s.key !== selectedKey && s.points.length >= 2),
    [series, selectedKey],
  )

  const [range, setRange] = useState(DEFAULT_RANGE)
  const rangeDays = RANGES.find((r) => r.key === range)?.days ?? null
  const [compare, setCompare] = useState<ReadonlySet<string>>(() => new Set())

  const selected = byKey.get(selectedKey)
  const selectedName = selected?.name ?? selectedKey
  const accent = selected?.color ?? 'var(--color-text-secondary)'

  // The selected line first (drawn as the filled area), then compared lines.
  const shown = useMemo(() => {
    const extra = comparable.filter((s) => compare.has(s.key))
    return selected && selected.points.length >= 2 ? [selected, ...extra] : extra
  }, [selected, comparable, compare])

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

  // Headline: the selected series' current price + change over the range.
  const stats = useMemo(() => {
    const pts = windowed(selected?.points ?? [], rangeDays)
    if (pts.length < 2) return null
    const first = pts[0].value
    const last = pts[pts.length - 1].value
    const change = last - first
    return { current: last, change, pct: first > 0 ? (change / first) * 100 : 0, up: change >= 0 }
  }, [selected, rangeDays])

  function toggle(key: string) {
    setCompare((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const compared = comparable.filter((s) => compare.has(s.key))
  const enoughData = data.length >= 2
  const Trend = stats?.up ? CaretUpIcon : CaretDownIcon

  return (
    <section className={`${VALUE_SURFACE} p-5 sm:p-6`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-2 text-[14px] font-semibold text-text-primary">
              <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: accent }} />
              {selectedName}
            </span>
            <h2 className={`${VALUE_LABEL} text-[13px]`}>Price trend</h2>
          </div>
          {stats && (
            <p className="mt-2.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <span className="text-heading font-extrabold tabular-nums text-text-primary">{formatValue(stats.current)}</span>
              <span
                className="inline-flex items-center gap-1 text-[13px] font-semibold tabular-nums"
                style={{ color: stats.up ? UP : DOWN }}
              >
                <Trend aria-hidden size={12} weight="fill" />
                <span className="sr-only">{stats.up ? 'Up' : 'Down'}</span>
                {formatValue(Math.abs(stats.change))} ({stats.pct >= 0 ? '+' : ''}
                {stats.pct.toFixed(1)}%)
              </span>
            </p>
          )}
        </div>

        <div role="group" aria-label="Range" className="flex gap-0.5 rounded-md bg-bg-overlay p-1">
          {RANGES.map((r) => {
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
      </div>

      {comparable.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Popover>
            <PopoverTrigger className={`${SMALL_BTN} data-[state=open]:bg-bg-overlay-2 data-[state=open]:text-text-primary`}>
              <PlusIcon aria-hidden size={12} weight="bold" />
              Compare
              {compared.length > 0 && <span className="tabular-nums text-text-tertiary">{compared.length}</span>}
            </PopoverTrigger>
            <PopoverContent
              align="start"
              side="bottom"
              className={`w-60 max-w-[calc(100vw-24px)] p-1.5 text-[13px] ${VALUE_PANEL}`}
            >
              <p className={`px-2 pb-1.5 pt-1 ${VALUE_LABEL}`}>Compare {seriesNoun}</p>
              <div role="group" aria-label={`Compare ${seriesNoun}`} className="max-h-64 overflow-y-auto overscroll-contain">
                {comparable.map((s) => {
                  const on = compare.has(s.key)
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => toggle(s.key)}
                      aria-pressed={on}
                      className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left font-medium text-text-primary transition-colors hover:bg-bg-overlay focus-visible:bg-bg-overlay focus-visible:outline-none"
                    >
                      <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                      <span className="min-w-0 flex-1 truncate">{s.name}</span>
                      {on && <CheckIcon aria-hidden size={14} weight="bold" className="shrink-0 text-text-secondary" />}
                    </button>
                  )
                })}
              </div>
              <div className="mt-1 flex gap-1.5 border-t border-white/[0.07] px-0.5 pt-1.5">
                <button type="button" onClick={() => setCompare(new Set(comparable.map((s) => s.key)))} className={SMALL_BTN}>
                  Select All
                </button>
                <button type="button" onClick={() => setCompare(new Set())} className={SMALL_BTN}>
                  Clear
                </button>
              </div>
            </PopoverContent>
          </Popover>

          {compared.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => toggle(s.key)}
              aria-label={`Remove ${s.name} from the chart`}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-semibold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              style={{ backgroundColor: `color-mix(in srgb, ${s.color} 16%, transparent)`, color: s.color }}
            >
              <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
              {s.name}
              <XIcon aria-hidden size={11} weight="bold" />
            </button>
          ))}
          {compared.length > 0 && (
            <button type="button" onClick={() => setCompare(new Set())} className={SMALL_BTN}>
              Clear
            </button>
          )}
        </div>
      )}

      {!enoughData ? (
        <div
          className={`mt-4 flex flex-col items-center justify-center px-4 text-center ${VALUE_TILE}`}
          style={{ height: height - 20 }}
        >
          <p className="text-sm font-semibold text-text-secondary">Collecting price history</p>
          <p className="mt-1 max-w-[300px] text-xs text-text-tertiary">{emptyBody(selectedName)}</p>
        </div>
      ) : (
        <div className="mt-4 w-full" style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -14 }}>
              <defs>
                <linearGradient id={`${idPrefix}-fill`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accent} stopOpacity={0.24} />
                  <stop offset="100%" stopColor={accent} stopOpacity={0} />
                </linearGradient>
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
              {/* The selected series is the filled area; compared ones are
                  plain lines over it. Linear: no smoothing between days. */}
              {shown.map((s) =>
                s.key === selectedKey ? (
                  <Area
                    key={s.key}
                    type="linear"
                    dataKey={s.key}
                    stroke={s.color}
                    strokeWidth={2.25}
                    fill={`url(#${idPrefix}-fill)`}
                    dot={false}
                    activeDot={{ r: 4, fill: s.color, stroke: 'var(--color-bg-raised)', strokeWidth: 2 }}
                    connectNulls
                    isAnimationActive={!reduceMotion}
                  />
                ) : (
                  <Line
                    key={s.key}
                    type="linear"
                    dataKey={s.key}
                    stroke={s.color}
                    strokeWidth={1.75}
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
