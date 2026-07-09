'use client'

/**
 * P6.2 — Admin Analytics Dashboard Client
 *
 * V53 restyle — rebuilt on the admin kit (PageHeader / StatCard /
 * AdminPanel), neutral surfaces + lime accent.
 *
 * FIX: the previous version wrapped the ENTIRE page (title included) in
 * framer-motion `initial="hidden"` stagger variants. Those initial
 * styles (opacity:0 / translateY) are serialized into the SSR HTML, so
 * the page rendered invisibly until the client-side animation ran —
 * and stayed invisible whenever hydration stalled or errored under the
 * admin tree. Content is now visible in the server HTML itself; no
 * JS required to see the page.
 *
 * Sections:
 *  1. KPI stat cards — revenue, GMV, orders, avg order, users, listings
 *  2. 30-day revenue + orders charts (inline SVG, zero deps)
 *  3. Orders by status breakdown
 *  4. User & listing stats
 *  5. Top sellers
 *  6. Promo code performance + disputes summary
 */

import {
  TrendingUp, DollarSign, ShoppingCart, Users,
  Package, Tag, AlertTriangle, CheckCircle2, Star, Activity,
} from 'lucide-react'
import type { AnalyticsData, DailyPoint } from '@/lib/actions/admin-analytics'
import {
  PageHeader, AdminPanel, StatCard, IconChip, SectionLabel,
} from '../components/kit'

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

// ── Inline SVG sparkline ───────────────────────────────────────────────────

function Sparkline({ id, points, color, height = 60 }: {
  /** Unique gradient id — must differ per chart instance on the page. */
  id: string
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
  // closed polygon for fill
  const first    = coords[0]
  const last     = coords[coords.length - 1]
  const fillPath = `${first} ${polyline} ${last.split(',')[0]},${height - pad} ${pad},${height - pad}`

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0"   />
        </linearGradient>
      </defs>
      <polygon points={fillPath} fill={`url(#spark-${id})`} />
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ── Chart panel ────────────────────────────────────────────────────────────

function ChartPanel({ id, title, sub, points, color }: {
  id: string
  title: string
  sub: string
  points: DailyPoint[]
  color: string
}) {
  return (
    <AdminPanel>
      <SectionLabel>{title}</SectionLabel>
      <p className="-mt-2 mb-4 text-[12px] text-text-tertiary">{sub}</p>
      <div className="h-32">
        {points.length > 1 ? (
          <Sparkline id={id} points={points} color={color} height={128} />
        ) : (
          <p className="flex h-full items-center justify-center text-[12.5px] text-text-tertiary">
            Not enough data yet
          </p>
        )}
      </div>
      <div className="mt-1 flex justify-between">
        <span className="text-[10px] tabular-nums text-text-tertiary">{points[0]?.date}</span>
        <span className="text-[10px] tabular-nums text-text-tertiary">{points[points.length - 1]?.date}</span>
      </div>
    </AdminPanel>
  )
}

// ── Breakdown row (dot + label + count) ────────────────────────────────────

function BreakdownRow({ label, count, dotClass }: { label: string; count: number; dotClass: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-bg-overlay px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${dotClass}`} />
        <span className="text-[13px] text-text-secondary">{label}</span>
      </div>
      <span className="text-[13px] font-semibold tabular-nums text-text-primary">{fmt(count)}</span>
    </div>
  )
}

// ── Top sellers row ────────────────────────────────────────────────────────

function SellerRow({ rank, username, totalSales, lifetimeEarnings }: {
  rank: number; username: string; totalSales: number; lifetimeEarnings: number
}) {
  return (
    <div className="flex items-center gap-3 border-b border-border-subtle py-2.5 last:border-0">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-bg-overlay text-[11px] font-bold tabular-nums text-text-secondary">
        {rank}
      </span>
      <span className="flex-1 truncate text-[13.5px] font-semibold text-text-primary">@{username}</span>
      <span className="w-20 text-right text-[12px] tabular-nums text-text-tertiary">{fmt(totalSales)} sales</span>
      <span className="w-24 text-right text-[13px] font-semibold tabular-nums text-success">
        {fmtUSD(lifetimeEarnings)}
      </span>
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
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-error" />
          <p className="mb-1 font-semibold text-text-primary">Failed to load analytics</p>
          <p className="text-sm text-text-tertiary">{fetchError ?? 'Unknown error'}</p>
        </div>
      </div>
    )
  }

  const revPct    = pctChange(data.platformRevenueMtd, data.platformRevenuePrevMonth)
  const ordPct    = pctChange(data.ordersMtd,          data.ordersPrevMonth)
  const usersPct  = pctChange(data.usersNewMtd,        data.usersNewPrevMonth)

  return (
    <div className="space-y-6 pb-10">
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <PageHeader
        title="Analytics"
        description="Platform-wide performance metrics and revenue insights."
      />

      {/* ── KPI cards row ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Platform Revenue MTD"
          value={fmtUSD(data.platformRevenueMtd)}
          sub={`All-time: ${fmtUSD(data.platformRevenueTotal)}`}
          delta={revPct}
          icon={DollarSign}
          tone="success"
        />
        <StatCard
          label="GMV This Month"
          value={fmtUSD(data.gmvMtd)}
          sub={`All-time GMV: ${fmtUSD(data.gmvTotal)}`}
          icon={TrendingUp}
          tone="info"
        />
        <StatCard
          label="Orders MTD"
          value={fmt(data.ordersMtd)}
          sub={`Total all-time: ${fmt(data.ordersTotal)}`}
          delta={ordPct}
          icon={ShoppingCart}
          tone="lime"
        />
        <StatCard
          label="Avg Order Value"
          value={fmtUSD(data.avgOrderValue)}
          sub="Completed orders only"
          icon={Activity}
          tone="warning"
        />
        <StatCard
          label="New Users MTD"
          value={fmt(data.usersNewMtd)}
          sub={`Total users: ${fmt(data.usersTotal)}`}
          delta={usersPct}
          icon={Users}
          tone="info"
        />
        <StatCard
          label="Active Listings"
          value={fmt(data.listingsActive)}
          sub={`Total: ${fmt(data.listingsTotal)} · New MTD: ${fmt(data.listingsNewMtd)}`}
          icon={Package}
          tone="neutral"
        />
      </div>

      {/* ── Charts row ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartPanel
          id="daily-revenue"
          title="Daily Platform Revenue"
          sub="Last 30 days"
          points={data.dailyRevenue}
          color="var(--color-success)"
        />
        <ChartPanel
          id="daily-orders"
          title="Daily Orders"
          sub="Last 30 days"
          points={data.dailyOrders}
          color="var(--color-accent-default)"
        />
      </div>

      {/* ── Bottom row: orders breakdown + user stats + sellers ─────────── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">

        {/* Orders by status */}
        <AdminPanel>
          <SectionLabel>Orders by Status</SectionLabel>
          <p className="-mt-2 mb-4 text-[12px] text-text-tertiary">{fmt(data.ordersTotal)} total</p>
          <div className="space-y-2">
            <BreakdownRow label="Completed" count={data.ordersCompleted} dotClass="bg-success" />
            <BreakdownRow label="Disputed"  count={data.ordersDisputed}  dotClass="bg-error" />
            <BreakdownRow label="Refunded"  count={data.ordersRefunded}  dotClass="bg-warning" />
            <BreakdownRow label="Guest"     count={data.ordersGuest}     dotClass="bg-text-tertiary" />
          </div>
        </AdminPanel>

        {/* User & listing stats */}
        <AdminPanel>
          <SectionLabel>Users &amp; Listings</SectionLabel>
          <div className="space-y-2">
            <BreakdownRow label="Active Sellers"   count={data.sellersActive}  dotClass="bg-lime" />
            <BreakdownRow label="Buyers"           count={data.buyersTotal}    dotClass="bg-info" />
            <BreakdownRow label="Active Listings"  count={data.listingsActive} dotClass="bg-text-tertiary" />
            <BreakdownRow label="New Listings MTD" count={data.listingsNewMtd} dotClass="bg-success" />
          </div>
        </AdminPanel>

        {/* Top sellers */}
        <AdminPanel>
          <div className="mb-3 flex items-center justify-between">
            <SectionLabel className="mb-0">Top Sellers</SectionLabel>
            <IconChip icon={Star} tone="lime" size="sm" />
          </div>
          <p className="-mt-2 mb-2 text-[12px] text-text-tertiary">By lifetime earnings</p>
          {data.topSellers.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-tertiary">No seller data yet</p>
          ) : (
            <div>
              {data.topSellers.map((s, i) => (
                <SellerRow
                  key={s.username}
                  rank={i + 1}
                  username={s.username}
                  totalSales={s.totalSales}
                  lifetimeEarnings={s.lifetimeEarnings}
                />
              ))}
            </div>
          )}
        </AdminPanel>
      </div>

      {/* ── Promos & Disputes ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

        {/* Promo performance */}
        <AdminPanel>
          <div className="mb-3 flex items-center justify-between">
            <SectionLabel className="mb-0">Promo Code Performance</SectionLabel>
            <IconChip icon={Tag} size="sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border-subtle bg-bg-overlay p-3">
              <p className="mb-1 text-[11.5px] text-text-tertiary">Total Usages</p>
              <p className="text-xl font-extrabold tabular-nums text-text-primary">{fmt(data.promoUsages)}</p>
            </div>
            <div className="rounded-lg border border-border-subtle bg-bg-overlay p-3">
              <p className="mb-1 text-[11.5px] text-text-tertiary">Total Discounts Given</p>
              <p className="text-xl font-extrabold tabular-nums text-error">{fmtUSD(data.promoTotalDiscount)}</p>
            </div>
          </div>
          <p className="mt-3 text-[11.5px] text-text-tertiary">
            Discount cost absorbed by platform. Seller payouts unaffected.
          </p>
        </AdminPanel>

        {/* Disputes summary */}
        <AdminPanel>
          <div className="mb-3 flex items-center justify-between">
            <SectionLabel className="mb-0">Disputes</SectionLabel>
            <IconChip icon={AlertTriangle} tone="warning" size="sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-[rgba(255,92,92,0.25)] bg-error-bg p-3">
              <p className="mb-1 text-[11.5px] text-error">Open / Under Review</p>
              <p className="text-xl font-extrabold tabular-nums text-error">{fmt(data.disputesOpen)}</p>
            </div>
            <div className="rounded-lg border border-[rgba(63,217,134,0.25)] bg-success-bg p-3">
              <p className="mb-1 text-[11.5px] text-success">Resolved</p>
              <p className="text-xl font-extrabold tabular-nums text-success">
                <CheckCircle2 className="mb-0.5 mr-1 inline h-4 w-4" />
                {fmt(data.disputesResolved)}
              </p>
            </div>
          </div>
          {data.disputesOpen > 0 && (
            <a
              href="/admin/disputes"
              className="mt-3 block text-[12px] font-semibold text-warning transition-colors hover:text-text-primary"
            >
              → {data.disputesOpen} dispute{data.disputesOpen !== 1 ? 's' : ''} need attention
            </a>
          )}
        </AdminPanel>
      </div>
    </div>
  )
}
