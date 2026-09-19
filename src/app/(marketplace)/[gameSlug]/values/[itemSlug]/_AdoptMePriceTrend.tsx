'use client'

/**
 * Adopt Me price-trend chart — the SAB _PriceTrendChart pattern, Adopt Me data.
 *
 * Same recharts structure and ZOOMED Y-axis (fits tightly around the visible
 * data instead of anchoring at 0, so a $60→$62 move is actually visible), but
 * keyed on Adopt Me's 8-form variant ladder with the shared variant colours,
 * not SAB mutations. Legend chips overlay/hide each variant; the hero-selected
 * variant stays lit. recharts is lazy-loaded (below the fold, ~100KB) so it
 * doesn't bloat the pet page's initial JS.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Area,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import CheckIcon from '@mui/icons-material/Check'
// Runtime constants come from the CLIENT-SAFE types module (the pet-data module
// is `server-only`, so importing values from it into this client component would
// break the build). Types are erased at compile time, so importing the type
// alone from the server module is fine — but we keep it local for clarity.
import { VARIANTS as VARIANT_ORDER, VARIANT_LABEL } from '../../calculator/_adoptMeCalcTypes'
import { variantColor } from './_adoptMeVariantColor'
import { useSelectedVariant } from './_SelectedVariantContext'

/** One daily price point (mirrors PetPricePoint from the server loader). */
type PetPricePoint = { date: string; price: number }

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

function formatDay(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/** Round a bound to a "nice" number so axis ticks read cleanly at any scale. */
function niceBound(value: number, dir: 'floor' | 'ceil'): number {
  if (value <= 0) return 0
  const mag = Math.pow(10, Math.floor(Math.log10(value)))
  const step = mag / 2
  return dir === 'floor'
    ? Math.max(0, Math.floor(value / step) * step)
    : Math.ceil(value / step) * step
}

const RANGES: { key: string; label: string; days: number | null }[] = [
  { key: '7d', label: '7D', days: 7 },
  { key: '30d', label: '30D', days: 30 },
  { key: '90d', label: '90D', days: 90 },
  { key: 'all', label: 'All', days: null },
]

export function AdoptMePriceTrend({
  history,
}: {
  /** Daily history keyed by variant (from getAdoptMePet). */
  history: Record<string, PetPricePoint[]>
}) {
  // The selected variant is SHARED with the hero + stats via context — changing
  // it in the hero reprices this chart, and the chart's own dropdown writes back
  // (so it reprices the hero too). Both stay in lockstep.
  const { selectedCode, setSelectedCode } = useSelectedVariant()

  // Variants with ≥2 days of history to plot, in ladder order — the dropdown set.
  const plottable = useMemo(
    () =>
      (VARIANT_ORDER as readonly string[])
        .filter((v) => (history[v]?.length ?? 0) >= 2)
        .map((v) => ({ variant: v, name: VARIANT_LABEL[v as keyof typeof VARIANT_LABEL] })),
    [history],
  )

  // If the shared variant has no plottable history, fall back to the first that
  // does (for the chart only — the rest of the page still shows the selection).
  const activeVariant =
    plottable.find((p) => p.variant === selectedCode)?.variant ?? plottable[0]?.variant ?? selectedCode

  const [range, setRange] = useState<string>('30d')
  const rangeDays = RANGES.find((r) => r.key === range)?.days ?? null

  // The active variant's series, windowed to the range, on a shared axis. Zoomed
  // Y-domain around the windowed min/max so small moves are visible.
  const { data, domain } = useMemo(() => {
    let pts = history[activeVariant] ?? []
    if (rangeDays != null && pts.length > rangeDays) pts = pts.slice(pts.length - rangeDays)
    let min = Infinity
    let max = -Infinity
    const rows = pts.map((p) => {
      if (p.price < min) min = p.price
      if (p.price > max) max = p.price
      return { date: p.date, label: formatDay(p.date), price: p.price }
    })
    let dom: [number, number] | ['auto', 'auto'] = ['auto', 'auto']
    if (Number.isFinite(min) && Number.isFinite(max)) {
      const pad = Math.max((max - min) * 0.12, max * 0.04, 0.02)
      dom = [niceBound(min - pad, 'floor'), niceBound(max + pad, 'ceil')]
    }
    return { data: rows, domain: dom }
  }, [history, activeVariant, rangeDays])

  // Header stats for the windowed active series: current price + change over it.
  const stats = useMemo(() => {
    if (data.length < 2) return null
    const first = data[0].price
    const last = data[data.length - 1].price
    const change = last - first
    const pct = first > 0 ? (change / first) * 100 : 0
    return { current: last, change, pct, up: change >= 0 }
  }, [data])

  const accent = variantColor(activeVariant)
  const activeName = VARIANT_LABEL[activeVariant as keyof typeof VARIANT_LABEL] ?? activeVariant
  const enoughData = data.length >= 2

  return (
    <section className="rounded-lg border border-[#1E2723] bg-[#0E1211] p-5 sm:p-6">
      {/* Header — variant dropdown + current price + change on the left, range
          tabs on the right. One focused line below. */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            {plottable.length > 1 ? (
              <TrendVariantDropdown value={activeVariant} options={plottable} onChange={(v) => setSelectedCode(v as typeof selectedCode)} accent={accent} />
            ) : (
              <span className="inline-flex items-center gap-2 text-body-sm font-semibold text-[#F1F3F1]">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: accent }} />
                {activeName}
              </span>
            )}
            <span className="text-caption font-semibold uppercase tracking-[0.1em] text-[#6D7A72]">Price trend</span>
          </div>
          {stats && (
            <div className="mt-2.5 flex items-baseline gap-2.5">
              <span className="text-heading font-extrabold tabular-nums text-[#F1F3F1]">
                {USD.format(stats.current)}
              </span>
              <span
                className="text-body-sm font-bold tabular-nums"
                style={{ color: stats.up ? '#4FB477' : '#E0662E' }}
              >
                {stats.up ? '▲' : '▼'} {USD.format(Math.abs(stats.change))} ({stats.pct >= 0 ? '+' : ''}
                {stats.pct.toFixed(1)}%)
              </span>
            </div>
          )}
        </div>

        {/* Range tabs */}
        <div className="flex gap-0.5 rounded-md border border-[#1E2723] bg-white/[0.02] p-1">
          {RANGES.map((r) => {
            const on = range === r.key
            return (
              <button
                key={r.key}
                type="button"
                onClick={() => setRange(r.key)}
                aria-pressed={on}
                className={`rounded px-3 py-1.5 text-caption font-bold transition-colors ${
                  on ? 'bg-[#242C28] text-[#F1F3F1]' : 'text-[#8B978F] hover:text-[#D6DCD8]'
                }`}
              >
                {r.label}
              </button>
            )
          })}
        </div>
      </div>

      {!enoughData ? (
        <div className="mt-5 flex h-[200px] flex-col items-center justify-center rounded-md border border-dashed border-[#254B38] bg-white/[0.02] text-center">
          <p className="text-body-sm font-semibold text-[#9BA8A0]">Collecting price history</p>
          <p className="mt-1 max-w-[300px] text-caption text-[#6D7A72]">
            We snapshot {activeName}&apos;s price every day. The trend line appears once we
            have a few days of data in this range.
          </p>
        </div>
      ) : (
        <div className="mt-5 h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -14 }}>
              <defs>
                <linearGradient id="am-trend-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accent} stopOpacity={0.26} />
                  <stop offset="100%" stopColor={accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                tick={{ fill: '#6D7A72', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#1E2723' }}
                minTickGap={28}
              />
              <YAxis
                tick={{ fill: '#6D7A72', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={54}
                tickFormatter={(v) => USD.format(Number(v))}
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
                formatter={(value) => [USD.format(Number(value)), activeName] as [string, string]}
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke={accent}
                strokeWidth={2.25}
                fill="url(#am-trend-fill)"
                dot={false}
                activeDot={{ r: 4, fill: accent, stroke: '#0E1211', strokeWidth: 2 }}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}

/** Variant switcher for the trend chart — a small dropdown so the chart shows
 *  one focused line at a time. Styled to match the hero/list dropdowns. */
function TrendVariantDropdown({
  value,
  options,
  onChange,
  accent,
}: {
  value: string
  options: { variant: string; name: string }[]
  onChange: (v: string) => void
  accent: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('touchstart', onDoc)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('touchstart', onDoc)
    }
  }, [open])
  const name = VARIANT_LABEL[value as keyof typeof VARIANT_LABEL] ?? value
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-md border border-[#1E2723] bg-white/[0.04] px-3 py-1.5 text-body-sm font-semibold text-[#F1F3F1] outline-none transition hover:bg-white/[0.06] focus:border-[#2F6B46]"
      >
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: accent }} />
        {name}
        <KeyboardArrowDownIcon sx={{ fontSize: 18 }} className={`text-[#8B978F] transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute left-0 z-30 mt-1.5 min-w-[13rem] overflow-hidden rounded-md border border-[#232A2F] bg-[#0E1211] p-1 shadow-[0_16px_40px_-16px_rgba(0,0,0,0.9)]"
        >
          {options.map((o) => {
            const on = o.variant === value
            const c = variantColor(o.variant)
            return (
              <button
                key={o.variant}
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => { onChange(o.variant); setOpen(false) }}
                className={`flex w-full items-center gap-2 rounded px-3 py-2 text-left text-body-sm transition ${
                  on ? 'bg-white/[0.06] font-semibold text-[#F1F3F1]' : 'text-[#9BA8A0] hover:bg-white/[0.04] hover:text-[#E6EAE7]'
                }`}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c }} />
                <span className="flex-1 truncate">{o.name}</span>
                {on && <CheckIcon sx={{ fontSize: 16 }} className="shrink-0 text-[#4FB477]" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
