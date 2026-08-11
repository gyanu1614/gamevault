'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Area,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import ShowChartIcon from '@mui/icons-material/ShowChart'
import { sabCard } from '@/lib/sab/theme'
import { mutationVisual, mutationOrder } from '@/lib/sab/mutations'
import { formatCash } from '@/lib/sab/format'

export type PricePoint = { date: string; median: number }

/** One selectable mutation series for the combined chart. */
export type ChartSeries = {
  slug: string
  name: string
  points: PricePoint[]
}

interface PriceTrendChartProps {
  /** The mutation selected in the hero — pre-lit and used for the header %. */
  selectedSlug: string
  selectedName: string
  /** History for EVERY mutation that has data, keyed by slug. */
  history: Record<string, PricePoint[]>
  /** Ordered mutation metadata (slug + name) to build the legend from. */
  mutations: { slug: string; name: string }[]
}

function formatDay(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/** Round a bound to a "nice" number so axis ticks read cleanly at any scale. */
function niceBound(value: number, dir: 'floor' | 'ceil'): number {
  if (value <= 0) return 0
  const mag = Math.pow(10, Math.floor(Math.log10(value)))
  const step = mag / 2 // half-decade steps: 0.5, 1, 5, 10, 50…
  return dir === 'floor'
    ? Math.max(0, Math.floor(value / step) * step)
    : Math.ceil(value / step) * step
}

export function PriceTrendChart({
  selectedSlug,
  selectedName,
  history,
  mutations,
}: PriceTrendChartProps) {
  // The legend: only mutations that actually have ≥2 days of history to plot.
  const legend = useMemo(
    () =>
      [...mutations]
        .filter((m) => (history[m.slug]?.length ?? 0) >= 2)
        .sort((a, b) => mutationOrder(a.slug) - mutationOrder(b.slug)),
    [mutations, history],
  )

  // Which mutation lines are visible. Default: ALL of them, so the page opens on
  // the full comparison; the user narrows with the legend or the Clear button.
  const allSlugs = useMemo(() => legend.map((m) => m.slug), [legend])
  const [visible, setVisible] = useState<Set<string>>(() => new Set(allSlugs))

  // Keep the hero-selected mutation lit when the user switches it above.
  useEffect(() => {
    setVisible((prev) => (prev.has(selectedSlug) ? prev : new Set(prev).add(selectedSlug)))
  }, [selectedSlug])

  // Merge all visible series onto a shared date axis: one row per date, a keyed
  // value per visible mutation slug.
  const { data, domain } = useMemo(() => {
    const byDate = new Map<string, Record<string, number | string>>()
    let min = Infinity
    let max = -Infinity
    for (const slug of visible) {
      for (const p of history[slug] ?? []) {
        const row = byDate.get(p.date) ?? { date: p.date, label: formatDay(p.date) }
        row[slug] = p.median
        byDate.set(p.date, row)
        if (p.median < min) min = p.median
        if (p.median > max) max = p.median
      }
    }
    const rows = [...byDate.values()].sort((a, b) =>
      String(a.date).localeCompare(String(b.date)),
    )
    // ZOOMED Y-axis: fit tightly around the visible data (±~8% padding) instead
    // of anchoring at 0. This is what makes a $0.93→$1.00 move actually visible
    // on a cheap item — the old fixed floor flatlined it against the bottom.
    let dom: [number, number] | ['auto', 'auto'] = ['auto', 'auto']
    if (Number.isFinite(min) && Number.isFinite(max)) {
      const pad = Math.max((max - min) * 0.12, max * 0.04, 0.02)
      dom = [niceBound(min - pad, 'floor'), niceBound(max + pad, 'ceil')]
    }
    return { data: rows, domain: dom }
  }, [visible, history])

  // Header % change for the hero-selected mutation.
  const stats = useMemo(() => {
    const pts = history[selectedSlug] ?? []
    if (pts.length < 2) return null
    const first = pts[0].median
    const last = pts[pts.length - 1].median
    const change = last - first
    const pct = first > 0 ? (change / first) * 100 : 0
    return { change, pct, up: change >= 0 }
  }, [history, selectedSlug])

  function toggle(slug: string) {
    setVisible((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) {
        // Keep at least one line on screen.
        if (next.size > 1) next.delete(slug)
      } else {
        next.add(slug)
      }
      return next
    })
  }

  const selectedColor = mutationVisual(selectedSlug).color
  const enoughData = data.length >= 2

  return (
    <section className={`${sabCard} p-5 sm:p-6`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShowChartIcon sx={{ fontSize: 18 }} style={{ color: selectedColor }} />
          <h2 className="text-sm font-semibold text-[#F1F3F1]">Price trend</h2>
        </div>
        {stats && (
          <span
            className="text-[13px] font-medium tabular-nums"
            style={{ color: stats.up ? '#4FB477' : '#E23B4E' }}
          >
            {selectedName} {stats.up ? '▲' : '▼'} {formatCash(Math.abs(stats.change))} (
            {stats.pct >= 0 ? '+' : ''}
            {stats.pct.toFixed(1)}%)
          </span>
        )}
      </div>

      {/* Select all / Clear — quick bulk toggles for the legend below. */}
      {legend.length > 1 && (
        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-[11px] font-medium text-[#6D7A72]">
            {visible.size} of {legend.length} mutations shown
          </p>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setVisible(new Set(allSlugs))}
              className="border border-[#26332C] px-2.5 py-1 text-[11px] font-semibold text-[#C6CEC9] transition hover:border-[#3A4A40]"
            >
              Select all
            </button>
            <button
              type="button"
              // Clear leaves the hero-selected line on, so the chart never empties.
              onClick={() => setVisible(new Set([selectedSlug]))}
              className="border border-[#26332C] px-2.5 py-1 text-[11px] font-semibold text-[#C6CEC9] transition hover:border-[#3A4A40]"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Legend chips — click to overlay / hide each mutation's line. */}
      {legend.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {legend.map((m) => {
            const mv = mutationVisual(m.slug)
            const on = visible.has(m.slug)
            return (
              <button
                key={m.slug}
                type="button"
                onClick={() => toggle(m.slug)}
                aria-pressed={on}
                className="inline-flex items-center gap-1.5 border px-2.5 py-1 text-[11.5px] font-semibold transition"
                style={
                  on
                    ? { backgroundColor: mv.soft, borderColor: mv.color, color: mv.color }
                    : { backgroundColor: 'transparent', borderColor: '#232A2F', color: '#5E685E' }
                }
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: on ? mv.color : '#3A423C' }}
                />
                {m.name}
              </button>
            )
          })}
        </div>
      )}

      {!enoughData ? (
        <div className="mt-4 flex h-[160px] flex-col items-center justify-center border border-dashed border-[#254B38] bg-white/[0.02] text-center">
          <p className="text-sm font-medium text-[#9BA8A0]">Collecting price history</p>
          <p className="mt-1 max-w-[280px] text-xs text-[#6D7A72]">
            We snapshot each mutation&apos;s price every day. Trend lines appear once we have a few
            days of data.
          </p>
        </div>
      ) : (
        <div className="mt-4 h-[180px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -14 }}>
              <defs>
                {[...visible].map((slug) => {
                  const c = mutationVisual(slug).color
                  return (
                    <linearGradient key={slug} id={`sab-trend-${slug}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={c} stopOpacity={0.22} />
                      <stop offset="100%" stopColor={c} stopOpacity={0} />
                    </linearGradient>
                  )
                })}
              </defs>
              <XAxis
                dataKey="label"
                tick={{ fill: '#6D7A72', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#1E2723' }}
                minTickGap={24}
              />
              <YAxis
                tick={{ fill: '#6D7A72', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={54}
                tickFormatter={(v) => formatCash(Number(v)) ?? `$${v}`}
                domain={domain}
                allowDecimals
              />
              <Tooltip
                contentStyle={{
                  background: '#0E1211',
                  border: '1px solid #1E2723',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: '#9BA8A0' }}
                itemStyle={{ color: '#F1F3F1' }}
                formatter={(value, name) => {
                  const slug = String(name)
                  const label = legend.find((m) => m.slug === slug)?.name ?? slug
                  return [formatCash(Number(value)) ?? `$${value}`, label] as [string, string]
                }}
              />
              {/* One filled Area per visible mutation. The single-line case reads
                  like the old chart; multiple lines overlay for comparison. */}
              {[...visible]
                .sort((a, b) => mutationOrder(a) - mutationOrder(b))
                .map((slug) => {
                  const c = mutationVisual(slug).color
                  const only = visible.size === 1
                  return only ? (
                    <Area
                      key={slug}
                      type="monotone"
                      dataKey={slug}
                      stroke={c}
                      strokeWidth={2}
                      fill={`url(#sab-trend-${slug})`}
                      dot={false}
                      activeDot={{ r: 3, fill: c }}
                      connectNulls
                    />
                  ) : (
                    <Line
                      key={slug}
                      type="monotone"
                      dataKey={slug}
                      stroke={c}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 3, fill: c }}
                      connectNulls
                    />
                  )
                })}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}
