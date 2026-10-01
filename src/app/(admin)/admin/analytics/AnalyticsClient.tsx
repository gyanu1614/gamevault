'use client'

/**
 * P6.2 — Admin Analytics Dashboard Client
 *
 * Built on the admin kit: one numbers strip (month-to-date with the change
 * against last month), two 30-day charts, then breakdown panels. Flat
 * fills, hairline dividers, no outlines.
 *
 * Content is visible in the server HTML itself (no framer-motion
 * `initial="hidden"` gate — that once left the page invisible when
 * hydration stalled under the admin tree).
 *
 * Sections:
 *  1. KPI strip — revenue, GMV, orders, avg order, users, listings
 *  2. 30-day revenue + orders charts (inline SVG, zero deps)
 *  3. Orders by status breakdown
 *  4. User & listing stats
 *  5. Top sellers
 *  6. Promo code performance + disputes summary
 */

import Link from 'next/link'
import { ArrowRight, Warning } from '@phosphor-icons/react'
import type { AnalyticsData, DailyPoint } from '@/lib/actions/admin-analytics'
import { StatStrip } from '@/components/account/AccountSurface'
import { cn } from '@/lib/utils'
import { AdminEmpty, PageHeader, PanelHead } from '../components/kit'

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number, opts?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat('en-US', opts).format(n)
}
function fmtUSD(n: number) {
  return fmt(n, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}
function pctChange(current: number, prev: number): number | null {
  if (prev === 0) return null
  return ((current - prev) / prev) * 100
}

/** "+12.5% vs last month" in success / error, or the fallback line. */
function Delta({ pct, fallback }: { pct: number | null; fallback: string }) {
  if (pct == null) return <>{fallback}</>
  return (
    <>
      <span className={cn('font-semibold tabular-nums', pct >= 0 ? 'text-success' : 'text-error')}>
        {pct >= 0 ? '+' : '−'}
        {Math.abs(pct).toFixed(1)}%
      </span>{' '}
      vs last month
    </>
  )
}

// ── Inline SVG sparkline ───────────────────────────────────────────────────

function Sparkline({ points, color, height = 60 }: {
  points: DailyPoint[]
  color: string
  height?: number
}) {
  // Guard: a line needs at least two points (avoids NaN coords /
  // undefined access on an empty dataset).
  if (points.length < 2) return null

  const width = 400
  const pad   = 4
  const vals  = points.map(p => p.value)
  const min   = Math.min(...vals)
  const max   = Math.max(...vals)
  const range = max - min || 1

  const coords = vals.map((v, i) => {
    const x = pad + (i / (vals.length - 1)) * (width - pad * 2)
    const y = pad + ((1 - (v - min) / range) * (height - pad * 2))
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  const polyline = coords.join(' ')
  // closed polygon for the (flat) area fill
  const first    = coords[0]
  const last     = coords[coords.length - 1]
  const fillPath = `${first} ${polyline} ${last.split(',')[0]},${height - pad} ${pad},${height - pad}`

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" preserveAspectRatio="none" aria-hidden>
      <polygon points={fillPath} fill={color} fillOpacity={0.1} />
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

// ── Chart panel ────────────────────────────────────────────────────────────

function ChartPanel({ title, total, points, color }: {
  title: string
  total: string
  points: DailyPoint[]
  color: string
}) {
  return (
    <section className="rounded-lg bg-bg-raised p-4 sm:p-5">
      <PanelHead
        title={title}
        subtitle="Last 30 days"
        aside={<p className="text-[20px] font-bold leading-tight tabular-nums text-text-primary">{total}</p>}
      />
      <div className="h-32">
        {points.length > 1 ? (
          <Sparkline points={points} color={color} height={128} />
        ) : (
          <p className="flex h-full items-center justify-center rounded-md bg-bg-overlay text-[12.5px] text-text-tertiary">
            Not enough data yet
          </p>
        )}
      </div>
      <div className="mt-2 flex justify-between">
        <span className="text-[11.5px] tabular-nums text-text-tertiary">{points[0]?.date}</span>
        <span className="text-[11.5px] tabular-nums text-text-tertiary">{points[points.length - 1]?.date}</span>
      </div>
    </section>
  )
}

// ── Breakdown row (dot + label + count, optional share bar) ────────────────

function BreakdownRow({ label, count, dotClass, of }: { label: string; count: number; dotClass: string; of?: number }) {
  const share = of && of > 0 ? Math.min(100, (count / of) * 100) : null
  return (
    <div className="py-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-[13px] text-text-secondary">
          <span className={cn('h-2 w-2 shrink-0 rounded-full', dotClass)} />
          {label}
        </span>
        <span className="text-[13px] font-semibold tabular-nums text-text-primary">{fmt(count)}</span>
      </div>
      {share != null && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]">
          <div className={cn('h-full rounded-full', dotClass)} style={{ width: `${share}%` }} />
        </div>
      )}
    </div>
  )
}

function Tile({ label, value, tone }: { label: string; value: React.ReactNode; tone?: 'error' | 'success' | 'warning' }) {
  return (
    <div className="rounded-md bg-bg-overlay px-3.5 py-3">
      <p className="text-[12px] text-text-tertiary">{label}</p>
      <p
        className={cn(
          'mt-0.5 text-[20px] font-bold leading-tight tabular-nums',
          tone === 'error' ? 'text-error' : tone === 'success' ? 'text-success' : tone === 'warning' ? 'text-warning' : 'text-text-primary',
        )}
      >
        {value}
      </p>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

interface Props {
  data:        AnalyticsData | null
  fetchError?: string
}

export default function AnalyticsClient({ data, fetchError }: Props) {
  // ── Error state ──────────────────────────────────────────────────────────
  if (fetchError || !data) {
    return (
      <div className="space-y-5 pb-10">
        <PageHeader title="Analytics" className="mb-0 sm:mb-0" />
        <AdminEmpty icon={Warning} tone="error" title="Couldn't Load Analytics" hint={fetchError ?? 'Unknown error'} />
      </div>
    )
  }

  const revPct    = pctChange(data.platformRevenueMtd, data.platformRevenuePrevMonth)
  const ordPct    = pctChange(data.ordersMtd,          data.ordersPrevMonth)
  const usersPct  = pctChange(data.usersNewMtd,        data.usersNewPrevMonth)

  const revenue30 = data.dailyRevenue.reduce((sum, p) => sum + p.value, 0)
  const orders30  = data.dailyOrders.reduce((sum, p) => sum + p.value, 0)

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        title="Analytics"
        description="Platform-wide performance and revenue, month to date."
        className="mb-0 sm:mb-0"
      />

      {/* ── KPI strip ───────────────────────────────────────────────────── */}
      <StatStrip
        className="md:grid-cols-3 lg:grid-cols-3"
        stats={[
          {
            label: 'Platform Revenue MTD',
            value: fmtUSD(data.platformRevenueMtd),
            hint: <Delta pct={revPct} fallback={`All-time ${fmtUSD(data.platformRevenueTotal)}`} />,
          },
          { label: 'GMV This Month', value: fmtUSD(data.gmvMtd), hint: `All-time ${fmtUSD(data.gmvTotal)}` },
          {
            label: 'Orders MTD',
            value: fmt(data.ordersMtd),
            hint: <Delta pct={ordPct} fallback={`All-time ${fmt(data.ordersTotal)}`} />,
          },
          { label: 'Avg Order Value', value: fmtUSD(data.avgOrderValue), hint: 'Completed orders only' },
          {
            label: 'New Users MTD',
            value: fmt(data.usersNewMtd),
            hint: <Delta pct={usersPct} fallback={`Total ${fmt(data.usersTotal)}`} />,
          },
          {
            label: 'Active Listings',
            value: fmt(data.listingsActive),
            hint: `${fmt(data.listingsNewMtd)} new this month`,
          },
        ]}
      />

      {/* ── Charts row ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <ChartPanel
          title="Daily Platform Revenue"
          total={fmtUSD(revenue30)}
          points={data.dailyRevenue}
          color="var(--color-success)"
        />
        <ChartPanel
          title="Daily Orders"
          total={fmt(orders30)}
          points={data.dailyOrders}
          color="var(--color-accent-default)"
        />
      </div>

      {/* ── Orders breakdown + user stats + sellers ─────────────────────── */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <section className="rounded-lg bg-bg-raised p-4 sm:p-5">
          <PanelHead title="Orders by Status" subtitle={`${fmt(data.ordersTotal)} total`} className="mb-2" />
          <div className="divide-y divide-white/[0.06]">
            <BreakdownRow label="Completed" count={data.ordersCompleted} dotClass="bg-success" of={data.ordersTotal} />
            <BreakdownRow label="Disputed"  count={data.ordersDisputed}  dotClass="bg-error" of={data.ordersTotal} />
            <BreakdownRow label="Refunded"  count={data.ordersRefunded}  dotClass="bg-warning" of={data.ordersTotal} />
            <BreakdownRow label="Guest"     count={data.ordersGuest}     dotClass="bg-text-tertiary" of={data.ordersTotal} />
          </div>
        </section>

        <section className="rounded-lg bg-bg-raised p-4 sm:p-5">
          <PanelHead title="Users & Listings" subtitle={`${fmt(data.usersTotal)} users · ${fmt(data.listingsTotal)} listings`} className="mb-2" />
          <div className="divide-y divide-white/[0.06]">
            <BreakdownRow label="Active Sellers"   count={data.sellersActive}  dotClass="bg-lime" />
            <BreakdownRow label="Buyers"           count={data.buyersTotal}    dotClass="bg-info" />
            <BreakdownRow label="Active Listings"  count={data.listingsActive} dotClass="bg-text-tertiary" />
            <BreakdownRow label="New Listings MTD" count={data.listingsNewMtd} dotClass="bg-success" />
          </div>
        </section>

        <section className="rounded-lg bg-bg-raised p-4 sm:p-5 md:col-span-2 xl:col-span-1">
          <PanelHead title="Top Sellers" subtitle="By lifetime earnings" className="mb-2" />
          {data.topSellers.length === 0 ? (
            <p className="rounded-md bg-bg-overlay py-6 text-center text-[13px] text-text-tertiary">No seller data yet</p>
          ) : (
            <ol className="divide-y divide-white/[0.06]">
              {data.topSellers.map((s, i) => (
                <li key={s.username} className="flex items-center gap-3 py-2.5">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white/[0.06] text-[11.5px] font-bold tabular-nums text-text-secondary">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-text-primary">@{s.username}</span>
                  <span className="shrink-0 text-[12px] tabular-nums text-text-tertiary">{fmt(s.totalSales)} sales</span>
                  <span className="w-24 shrink-0 text-right text-[13px] font-semibold tabular-nums text-success">
                    {fmtUSD(s.lifetimeEarnings)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {/* ── Promos & Disputes ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <section className="rounded-lg bg-bg-raised p-4 sm:p-5">
          <PanelHead title="Promo Code Performance" subtitle="Discount cost absorbed by the platform. Seller payouts unaffected." />
          <div className="grid grid-cols-2 gap-2">
            <Tile label="Total Usages" value={fmt(data.promoUsages)} />
            <Tile label="Discounts Given" value={fmtUSD(data.promoTotalDiscount)} tone={data.promoTotalDiscount > 0 ? 'error' : undefined} />
          </div>
        </section>

        <section className="rounded-lg bg-bg-raised p-4 sm:p-5">
          <PanelHead
            title="Disputes"
            subtitle="Open and finished, all time."
            aside={
              data.disputesOpen > 0 ? (
                <Link
                  href="/admin/disputes"
                  className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-warning underline-offset-4 hover:underline"
                >
                  {data.disputesOpen} need attention
                  <ArrowRight aria-hidden weight="bold" className="h-3.5 w-3.5" />
                </Link>
              ) : undefined
            }
          />
          <div className="grid grid-cols-2 gap-2">
            <Tile label="Open / Under Review" value={fmt(data.disputesOpen)} tone={data.disputesOpen > 0 ? 'warning' : undefined} />
            <Tile label="Resolved" value={fmt(data.disputesResolved)} tone={data.disputesResolved > 0 ? 'success' : undefined} />
          </div>
        </section>
      </div>
    </div>
  )
}
