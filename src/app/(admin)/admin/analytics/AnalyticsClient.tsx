'use client'

/**
 * P6.2 — Admin Analytics Dashboard Client
 *
 * Sections:
 *  1. KPI stat cards — revenue, GMV, orders, avg order, users, listings
 *  2. 30-day revenue + orders sparkline charts (inline SVG, zero deps)
 *  3. Orders by status breakdown (pill grid)
 *  4. User & listing stats
 *  5. Top sellers table
 *  6. Promo code performance + disputes summary
 */

import { motion } from 'framer-motion'
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart, Users,
  Package, BarChart3, Tag, AlertTriangle, CheckCircle2, Star,
  Minus, ArrowUpRight, ArrowDownRight, Activity,
} from 'lucide-react'
import type { AnalyticsData, DailyPoint } from '@/lib/actions/admin-analytics'

// ── Animation variants ─────────────────────────────────────────────────────

const container = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { staggerChildren: 0.06 } },
}
const item = {
  hidden: { opacity: 0, y: 20 },
  show:   { opacity: 1, y: 0,  transition: { duration: 0.35 } },
}

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

function Sparkline({ points, color = '#22c55e', height = 60 }: {
  points: DailyPoint[]
  color?: string
  height?: number
}) {
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
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0"    />
        </linearGradient>
      </defs>
      <polygon
        points={fillPath}
        fill={`url(#grad-${color.replace('#', '')})`}
      />
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

// ── KPI Card ───────────────────────────────────────────────────────────────

interface KpiCardProps {
  label:      string
  value:      string
  sub?:       string
  pct?:       number | null
  icon:       React.ReactNode
  iconBg:     string
  sparkline?: DailyPoint[]
  sparkColor?: string
}

function KpiCard({ label, value, sub, pct, icon, iconBg, sparkline, sparkColor }: KpiCardProps) {
  const isPos  = pct !== null && pct !== undefined && pct > 0
  const isNeg  = pct !== null && pct !== undefined && pct < 0
  const isFlat = pct !== null && pct !== undefined && pct === 0

  return (
    <motion.div
      variants={item}
      className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-5 flex flex-col gap-3 hover:border-white/10 transition-colors"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-white/40 font-medium uppercase tracking-wider mb-1">{label}</p>
          <p className="text-2xl font-bold text-white font-mono">{value}</p>
          {sub && <p className="text-xs text-white/40 mt-0.5">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
      </div>

      {pct !== null && pct !== undefined && (
        <div className={`flex items-center gap-1 text-xs font-medium ${
          isPos ? 'text-green-400' : isNeg ? 'text-red-400' : 'text-white/40'
        }`}>
          {isPos && <ArrowUpRight className="w-3.5 h-3.5" />}
          {isNeg && <ArrowDownRight className="w-3.5 h-3.5" />}
          {isFlat && <Minus className="w-3.5 h-3.5" />}
          <span>{isPos ? '+' : ''}{pct.toFixed(1)}% vs prev month</span>
        </div>
      )}

      {sparkline && sparkline.length > 1 && (
        <div className="h-12 -mx-1">
          <Sparkline points={sparkline} color={sparkColor ?? '#22c55e'} height={48} />
        </div>
      )}
    </motion.div>
  )
}

// ── Status pill ────────────────────────────────────────────────────────────

function StatusPill({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex items-center justify-between gap-3 bg-white/[0.03] rounded-lg px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${color}`} />
        <span className="text-sm text-white/70">{label}</span>
      </div>
      <span className="text-sm font-mono font-semibold text-white">{fmt(count)}</span>
    </div>
  )
}

// ── Section header ─────────────────────────────────────────────────────────

function SectionHeader({ icon, title, sub }: { icon: React.ReactNode; title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className="w-8 h-8 bg-white/[0.06] rounded-lg flex items-center justify-center text-white/60">
        {icon}
      </div>
      <div>
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {sub && <p className="text-xs text-white/40">{sub}</p>}
      </div>
    </div>
  )
}

// ── Top sellers row ────────────────────────────────────────────────────────

function SellerRow({ rank, username, totalSales, lifetimeEarnings }: {
  rank: number; username: string; totalSales: number; lifetimeEarnings: number
}) {
  const medals = ['🥇', '🥈', '🥉']
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/[0.04] last:border-0">
      <span className="text-lg w-7 text-center">{medals[rank - 1] ?? rank}</span>
      <span className="flex-1 text-sm text-white font-medium truncate">@{username}</span>
      <span className="text-xs text-white/40 w-20 text-right">{fmt(totalSales)} sales</span>
      <span className="text-sm font-mono font-semibold text-green-400 w-24 text-right">
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
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-center">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-white font-semibold mb-1">Failed to load analytics</p>
          <p className="text-white/40 text-sm">{fetchError ?? 'Unknown error'}</p>
        </div>
      </div>
    )
  }

  const revPct    = pctChange(data.platformRevenueMtd, data.platformRevenuePrevMonth)
  const ordPct    = pctChange(data.ordersMtd,          data.ordersPrevMonth)
  const usersPct  = pctChange(data.usersNewMtd,        data.usersNewPrevMonth)

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-8 pb-10"
    >
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <motion.div variants={item}>
        <div className="flex items-center gap-3 mb-1">
          <BarChart3 className="w-6 h-6 text-violet-400" />
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
        </div>
        <p className="text-white/40 text-sm">Platform-wide performance metrics and revenue insights.</p>
      </motion.div>

      {/* ── KPI cards row ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <KpiCard
          label="Platform Revenue MTD"
          value={fmtUSD(data.platformRevenueMtd)}
          sub={`All-time: ${fmtUSD(data.platformRevenueTotal)}`}
          pct={revPct}
          icon={<DollarSign className="w-4 h-4 text-green-400" />}
          iconBg="bg-green-500/10"
          sparkline={data.dailyRevenue}
          sparkColor="#22c55e"
        />
        <KpiCard
          label="GMV This Month"
          value={fmtUSD(data.gmvMtd)}
          sub={`All-time GMV: ${fmtUSD(data.gmvTotal)}`}
          icon={<TrendingUp className="w-4 h-4 text-blue-400" />}
          iconBg="bg-blue-500/10"
        />
        <KpiCard
          label="Orders MTD"
          value={fmt(data.ordersMtd)}
          sub={`Total all-time: ${fmt(data.ordersTotal)}`}
          pct={ordPct}
          icon={<ShoppingCart className="w-4 h-4 text-violet-400" />}
          iconBg="bg-violet-500/10"
          sparkline={data.dailyOrders}
          sparkColor="#8b5cf6"
        />
        <KpiCard
          label="Avg Order Value"
          value={fmtUSD(data.avgOrderValue)}
          sub="Completed orders only"
          icon={<Activity className="w-4 h-4 text-amber-400" />}
          iconBg="bg-amber-500/10"
        />
        <KpiCard
          label="New Users MTD"
          value={fmt(data.usersNewMtd)}
          sub={`Total users: ${fmt(data.usersTotal)}`}
          pct={usersPct}
          icon={<Users className="w-4 h-4 text-cyan-400" />}
          iconBg="bg-cyan-500/10"
        />
        <KpiCard
          label="Active Listings"
          value={fmt(data.listingsActive)}
          sub={`Total: ${fmt(data.listingsTotal)} · New MTD: ${fmt(data.listingsNewMtd)}`}
          icon={<Package className="w-4 h-4 text-orange-400" />}
          iconBg="bg-orange-500/10"
        />
      </div>

      {/* ── Charts row ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Daily revenue chart */}
        <motion.div
          variants={item}
          className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-5"
        >
          <SectionHeader
            icon={<DollarSign className="w-4 h-4" />}
            title="Daily Platform Revenue"
            sub="Last 30 days"
          />
          <div className="h-32">
            <Sparkline points={data.dailyRevenue} color="#22c55e" height={128} />
          </div>
          {/* X-axis labels — first + last */}
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-white/25">{data.dailyRevenue[0]?.date}</span>
            <span className="text-[10px] text-white/25">{data.dailyRevenue[data.dailyRevenue.length - 1]?.date}</span>
          </div>
        </motion.div>

        {/* Daily orders chart */}
        <motion.div
          variants={item}
          className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-5"
        >
          <SectionHeader
            icon={<ShoppingCart className="w-4 h-4" />}
            title="Daily Orders"
            sub="Last 30 days"
          />
          <div className="h-32">
            <Sparkline points={data.dailyOrders} color="#8b5cf6" height={128} />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-white/25">{data.dailyOrders[0]?.date}</span>
            <span className="text-[10px] text-white/25">{data.dailyOrders[data.dailyOrders.length - 1]?.date}</span>
          </div>
        </motion.div>
      </div>

      {/* ── Bottom row: orders breakdown + user stats + sellers ─────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Orders by status */}
        <motion.div
          variants={item}
          className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-5"
        >
          <SectionHeader
            icon={<ShoppingCart className="w-4 h-4" />}
            title="Orders by Status"
            sub={`${fmt(data.ordersTotal)} total`}
          />
          <div className="space-y-2">
            <StatusPill label="Completed"  count={data.ordersCompleted} color="bg-green-400"  />
            <StatusPill label="Disputed"   count={data.ordersDisputed}  color="bg-red-400"    />
            <StatusPill label="Refunded"   count={data.ordersRefunded}  color="bg-amber-400"  />
            <StatusPill label="Guest"      count={data.ordersGuest}     color="bg-white/20"   />
          </div>
        </motion.div>

        {/* User & listing stats */}
        <motion.div
          variants={item}
          className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-5"
        >
          <SectionHeader
            icon={<Users className="w-4 h-4" />}
            title="Users & Listings"
          />
          <div className="space-y-2">
            <StatusPill label="Active Sellers" count={data.sellersActive}  color="bg-violet-400" />
            <StatusPill label="Buyers"          count={data.buyersTotal}    color="bg-cyan-400"   />
            <StatusPill label="Active Listings" count={data.listingsActive} color="bg-orange-400" />
            <StatusPill label="New Listings MTD" count={data.listingsNewMtd} color="bg-blue-400" />
          </div>
        </motion.div>

        {/* Top sellers */}
        <motion.div
          variants={item}
          className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-5"
        >
          <SectionHeader
            icon={<Star className="w-4 h-4" />}
            title="Top Sellers"
            sub="By lifetime earnings"
          />
          {data.topSellers.length === 0 ? (
            <p className="text-white/30 text-sm text-center py-6">No seller data yet</p>
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
        </motion.div>
      </div>

      {/* ── Promos & Disputes ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Promo performance */}
        <motion.div
          variants={item}
          className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-5"
        >
          <SectionHeader
            icon={<Tag className="w-4 h-4" />}
            title="Promo Code Performance"
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/[0.03] rounded-lg p-3">
              <p className="text-xs text-white/40 mb-1">Total Usages</p>
              <p className="text-xl font-bold font-mono text-white">{fmt(data.promoUsages)}</p>
            </div>
            <div className="bg-white/[0.03] rounded-lg p-3">
              <p className="text-xs text-white/40 mb-1">Total Discounts Given</p>
              <p className="text-xl font-bold font-mono text-red-400">{fmtUSD(data.promoTotalDiscount)}</p>
            </div>
          </div>
          <p className="text-xs text-white/25 mt-3">
            Discount cost absorbed by platform. Seller payouts unaffected.
          </p>
        </motion.div>

        {/* Disputes summary */}
        <motion.div
          variants={item}
          className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-5"
        >
          <SectionHeader
            icon={<AlertTriangle className="w-4 h-4" />}
            title="Disputes"
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-red-500/[0.06] border border-red-500/10 rounded-lg p-3">
              <p className="text-xs text-red-400/70 mb-1">Open / Under Review</p>
              <p className="text-xl font-bold font-mono text-red-400">{fmt(data.disputesOpen)}</p>
            </div>
            <div className="bg-green-500/[0.06] border border-green-500/10 rounded-lg p-3">
              <p className="text-xs text-green-400/70 mb-1">Resolved</p>
              <p className="text-xl font-bold font-mono text-green-400">
                <CheckCircle2 className="w-4 h-4 inline mr-1 mb-0.5" />
                {fmt(data.disputesResolved)}
              </p>
            </div>
          </div>
          {data.disputesOpen > 0 && (
            <a
              href="/admin/disputes"
              className="block mt-3 text-xs text-amber-400 hover:text-amber-300 transition-colors"
            >
              → {data.disputesOpen} dispute{data.disputesOpen !== 1 ? 's' : ''} need attention
            </a>
          )}
        </motion.div>
      </div>
    </motion.div>
  )
}
