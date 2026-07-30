'use client'

import { useMemo } from 'react'
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import ShowChartIcon from '@mui/icons-material/ShowChart'
import { sabCard } from '@/lib/sab/theme'
import { mutationVisual } from '@/lib/sab/mutations'
import { formatCash } from '@/lib/sab/format'

export type PricePoint = { date: string; median: number }

interface PriceTrendChartProps {
  /** Selected mutation slug — colors the line + labels the copy. */
  mutationSlug: string
  mutationName: string
  /** Ascending-by-date points for the selected mutation. */
  points: PricePoint[]
}

function formatDay(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export function PriceTrendChart({
  mutationSlug,
  mutationName,
  points,
}: PriceTrendChartProps) {
  const color = mutationVisual(mutationSlug).color
  const gradientId = `sab-trend-${mutationSlug}`

  const data = useMemo(
    () => points.map((p) => ({ ...p, label: formatDay(p.date) })),
    [points],
  )

  const stats = useMemo(() => {
    if (data.length < 2) return null
    const first = data[0].median
    const last = data[data.length - 1].median
    const change = last - first
    const pct = first > 0 ? (change / first) * 100 : 0
    return { change, pct, up: change >= 0 }
  }, [data])

  return (
    <section className={`${sabCard} p-5 sm:p-6`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShowChartIcon sx={{ fontSize: 18 }} style={{ color }} />
          <h2 className="text-sm font-semibold text-[#F1F3F1]">
            {mutationName} price trend
          </h2>
        </div>
        {stats && (
          <span
            className="text-[13px] font-medium tabular-nums"
            style={{ color: stats.up ? '#4FB477' : '#E23B4E' }}
          >
            {stats.up ? '▲' : '▼'} {formatCash(Math.abs(stats.change))} ({stats.pct >= 0 ? '+' : ''}
            {stats.pct.toFixed(1)}%)
          </span>
        )}
      </div>

      {/* Not enough days yet — we capture one point per day, so a real trend
          needs a few days to accumulate. Show an honest collecting state. */}
      {data.length < 2 ? (
        <div className="mt-4 flex h-[140px] flex-col items-center justify-center border border-dashed border-[#254B38] bg-white/[0.02] text-center">
          <p className="text-sm font-medium text-[#9BA8A0]">Collecting price history</p>
          <p className="mt-1 max-w-[280px] text-xs text-[#6D7A72]">
            We snapshot the {mutationName} price every day. The trend line appears once we have a
            few days of data.
          </p>
        </div>
      ) : (
        <div className="mt-4 h-[160px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
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
                width={52}
                tickFormatter={(v) => `$${v}`}
                domain={['auto', 'auto']}
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
                formatter={(value) =>
                  [formatCash(Number(value)) ?? `$${value}`, 'Median'] as [string, string]
                }
              />
              <Area
                type="monotone"
                dataKey="median"
                stroke={color}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                dot={false}
                activeDot={{ r: 3, fill: color }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}
