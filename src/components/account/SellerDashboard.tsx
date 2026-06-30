'use client'

/**
 * V22 — Seller Dashboard (real data).
 *
 * Sections: KPI strip · Needs Your Attention · Earnings trend ·
 * Top offers + Reputation · derived nudges. All fed by
 * getSellerDashboard() — no dummy data.
 */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  TrendingUp, TrendingDown, Wallet, ShoppingBag, Percent,
  Package, MessageSquare, ShieldAlert, Star, Lightbulb, ArrowRight, ChevronRight,
} from 'lucide-react'
import AccountPageHeader from '@/components/account/AccountPageHeader'
import { getSellerDashboard, type DashboardData } from '@/lib/actions/seller-dashboard-v2'
import { cn } from '@/lib/utils'

const usd = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: n >= 1000 ? 0 : 2 })

const WINDOWS = [
  { days: 7, label: '7 Days' },
  { days: 30, label: '30 Days' },
] as const

export default function SellerDashboard({ username }: { username: string }) {
  const [windowDays, setWindowDays] = useState<number>(7)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    getSellerDashboard(windowDays).then((d) => {
      if (active) { setData(d); setLoading(false) }
    })
    return () => { active = false }
  }, [windowDays])

  const kpis = data?.kpis

  const delta = useMemo(() => {
    if (!kpis) return null
    const e = kpis.netEarningsPrev > 0
      ? ((kpis.netEarnings - kpis.netEarningsPrev) / kpis.netEarningsPrev) * 100
      : kpis.netEarnings > 0 ? 100 : 0
    const o = kpis.ordersPrev > 0
      ? ((kpis.orders - kpis.ordersPrev) / kpis.ordersPrev) * 100
      : kpis.orders > 0 ? 100 : 0
    return { earnings: e, orders: o }
  }, [kpis])

  return (
    <div className="min-h-screen pb-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <AccountPageHeader
          icon="dashboard"
          title="Seller Dashboard"
          subtitle={`Welcome back, ${username}.`}
          actions={
            <div className="flex gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
              {WINDOWS.map((w) => (
                <button
                  key={w.days}
                  onClick={() => setWindowDays(w.days)}
                  className={cn(
                    'rounded-md px-4 py-2 text-sm font-medium transition-all',
                    windowDays === w.days
                      ? 'bg-lime text-text-inverse'
                      : 'text-text-secondary hover:text-white',
                  )}
                >
                  {w.label}
                </button>
              ))}
            </div>
          }
        />

        {/* KPI strip */}
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            icon={Wallet}
            label={`Net Earnings · ${windowDays}d`}
            value={kpis ? usd(kpis.netEarnings) : '—'}
            deltaPct={delta?.earnings}
            loading={loading}
          />
          <KpiCard
            icon={ShoppingBag}
            label="Pending Payout"
            value={kpis ? usd(kpis.pendingPayout) : '—'}
            hint="In escrow"
            loading={loading}
          />
          <KpiCard
            icon={Package}
            label={`Orders · ${windowDays}d`}
            value={kpis ? String(kpis.orders) : '—'}
            deltaPct={delta?.orders}
            loading={loading}
          />
          <KpiCard
            icon={Percent}
            label="Conversion"
            value={kpis ? `${kpis.conversionRate.toFixed(1)}%` : '—'}
            hint={kpis ? `${kpis.totalSales} sales · ${kpis.totalViews} views` : undefined}
            loading={loading}
          />
        </div>

        {/* Nudges */}
        {data && data.nudges.length > 0 && (
          <div className="mt-4 space-y-2">
            {data.nudges.map((n, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-start gap-2.5 rounded-lg border border-lime-tint-border bg-lime-tint-bg px-4 py-2.5"
              >
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-lime-text" />
                <p className="text-[13px] text-text-primary">{n}</p>
              </motion.div>
            ))}
          </div>
        )}

        {/* Main grid */}
        <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          {/* Left: trend + top offers */}
          <div className="space-y-4">
            <Card title="Earnings Trend">
              {loading || !data ? (
                <div className="h-48 animate-pulse rounded-lg card-frost" />
              ) : (
                <EarningsTrend trend={data.trend} />
              )}
            </Card>

            <Card title="Top Offers" href="/account/listings">
              {loading || !data ? (
                <SkeletonRows />
              ) : data.topOffers.length === 0 ? (
                <Empty text="No offers yet. Create your first listing to start selling." />
              ) : (
                <ul className="divide-y divide-border-subtle">
                  {data.topOffers.map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="min-w-0 truncate text-sm font-medium text-text-primary">{o.title}</span>
                      <div className="flex shrink-0 items-center gap-4 text-[12px] text-text-secondary tabular-nums">
                        <span>{o.views} views</span>
                        <span>{o.sales} sold</span>
                        <span className="font-semibold text-lime-text">{o.conversion.toFixed(1)}%</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {/* Right: attention queue + reputation */}
          <div className="space-y-4">
            <Card title="Needs Your Attention">
              {loading || !data ? (
                <SkeletonRows />
              ) : data.attention.length === 0 ? (
                <Empty text="All caught up — nothing needs action right now." />
              ) : (
                <ul className="space-y-2">
                  {data.attention.map((a) => (
                    <li key={`${a.kind}-${a.id}`}>
                      <Link
                        href={a.href}
                        className="flex items-center gap-3 rounded-lg border border-border-subtle bg-white/[0.02] px-3 py-2.5 transition-colors hover:bg-white/[0.05]"
                      >
                        <AttentionIcon kind={a.kind} overdue={a.overdue} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-text-primary">{a.title}</p>
                          <p className="truncate text-[12px] text-text-secondary">{a.detail}</p>
                        </div>
                        {a.overdue && (
                          <span className="shrink-0 rounded-full bg-error-bg px-2 py-0.5 text-[10px] font-bold uppercase text-error">
                            Overdue
                          </span>
                        )}
                        <ChevronRight className="h-4 w-4 shrink-0 text-text-tertiary" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title="Reputation" href="/account/reviews">
              {loading || !data ? (
                <SkeletonRows />
              ) : (
                <Reputation rep={data.reputation} />
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Pieces ────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon, label, value, deltaPct, hint, loading,
}: {
  icon: React.ElementType; label: string; value: string
  deltaPct?: number; hint?: string; loading?: boolean
}) {
  const up = (deltaPct ?? 0) >= 0
  return (
    <div className="rounded-lg border border-border-default bg-bg-raised px-4 py-3">
      <div className="flex items-center gap-2 text-text-secondary">
        <Icon className="h-4 w-4" />
        <span className="text-[12px] font-medium">{label}</span>
      </div>
      {loading ? (
        <div className="mt-1.5 h-6 w-24 animate-pulse rounded bg-white/[0.06]" />
      ) : (
        <div className="mt-0.5 text-2xl font-bold leading-tight text-text-primary">{value}</div>
      )}
      {!loading && deltaPct !== undefined && (
        <div className={cn('mt-0.5 flex items-center gap-1 text-[11px] font-medium', up ? 'text-success' : 'text-error')}>
          {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {Math.abs(deltaPct).toFixed(0)}% vs prev
        </div>
      )}
      {!loading && hint && <div className="mt-0.5 text-[11px] text-text-tertiary">{hint}</div>}
    </div>
  )
}

function Card({ title, href, children }: { title: string; href?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border-default bg-bg-raised p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-text-secondary">{title}</h2>
        {href && (
          <Link href={href} className="flex items-center gap-1 text-[12px] font-medium text-lime-text hover:underline">
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
      {children}
    </div>
  )
}

function EarningsTrend({ trend }: { trend: { date: string; amount: number }[] }) {
  const total = trend.reduce((s, t) => s + t.amount, 0)
  return (
    <div>
      <div className="mb-2 text-2xl font-bold text-text-primary">{usd(total)}</div>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trend} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="earn" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-lime, #c6ff3d)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--color-lime, #c6ff3d)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              tick={{ fontSize: 11, fill: 'var(--color-text-tertiary, #8a8a92)' }}
              axisLine={false}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--color-text-tertiary, #8a8a92)' }}
              axisLine={false}
              tickLine={false}
              width={48}
              tickFormatter={(v) => `$${v}`}
            />
            <Tooltip
              cursor={{ stroke: 'rgba(255,255,255,0.15)' }}
              contentStyle={{
                background: 'rgba(10,10,15,0.95)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12,
                fontSize: 12,
              }}
              labelFormatter={(d) => new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              formatter={(v) => [usd(Number(v) || 0), 'Earnings'] as [string, string]}
            />
            <Area type="monotone" dataKey="amount" stroke="var(--color-lime, #c6ff3d)" strokeWidth={2} fill="url(#earn)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function AttentionIcon({ kind, overdue }: { kind: string; overdue?: boolean }) {
  const map: Record<string, React.ElementType> = {
    undelivered: Package,
    message: MessageSquare,
    dispute: ShieldAlert,
    review: Star,
  }
  const Icon = map[kind] ?? Package
  return (
    <span className={cn(
      'grid h-9 w-9 shrink-0 place-items-center rounded-lg',
      overdue ? 'bg-error-bg text-error' : 'bg-white/[0.06] text-text-secondary',
    )}>
      <Icon className="h-4 w-4" />
    </span>
  )
}

function Reputation({ rep }: { rep: DashboardData['reputation'] }) {
  return (
    <div>
      <div className="flex items-center gap-4">
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-text-primary">{rep.avgRating.toFixed(1)}</span>
            <Star className="h-5 w-5 fill-lime text-lime" />
          </div>
          <div className="text-[12px] text-text-secondary">{rep.totalReviews} reviews</div>
        </div>
        <div className="h-10 w-px bg-border-subtle" />
        <div>
          <div className="text-3xl font-bold text-text-primary">{rep.responseRate.toFixed(0)}%</div>
          <div className="text-[12px] text-text-secondary">Response rate</div>
        </div>
      </div>
      {rep.recent.length > 0 && (
        <ul className="mt-3 space-y-2 border-t border-border-subtle pt-3">
          {rep.recent.map((r) => (
            <li key={r.id} className="text-[12px]">
              <span className="font-semibold text-lime-text">{r.rating}★</span>{' '}
              <span className="text-text-secondary">{r.comment ? r.comment.slice(0, 80) : 'No comment'}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function SkeletonRows() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-lg card-frost" />
      ))}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-text-secondary">{text}</p>
}
