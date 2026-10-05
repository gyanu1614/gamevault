'use client'

/**
 * V22 — Seller Dashboard (real data).
 *
 * Sections: KPI strip, Needs Your Attention, Earnings trend, Top offers,
 * Reputation, derived nudges. All fed by getSellerDashboard(), no dummy
 * data. Account card system (AccountSurface): fill-only cards, one stat
 * panel, cards rise in on load.
 */

import { useEffect, useMemo, useState } from 'react'
import Link from '@/components/navigation/AppLink'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  TrendingUp, TrendingDown,
  Package, MessageSquare, ShieldAlert, Star, Lightbulb, ChevronRight,
} from 'lucide-react'
import AccountPageHeader from '@/components/account/AccountPageHeader'
import { AccountPage, SettingsCard, StatStrip, accountRowCls } from '@/components/account/AccountSurface'
import { CardLink } from '@/components/account/CardLink'
import { RevealGroup, RevealItem } from '@/components/account/Reveal'
import { SegmentedTabs } from '@/components/account/SegmentedTabs'
import SellerOnboardingChecklist from '@/components/account/SellerOnboardingChecklist'
import { getSellerDashboard, type DashboardData } from '@/lib/actions/seller-dashboard-v2'
import { cn } from '@/lib/utils'

const usd = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: n >= 1000 ? 0 : 2 })

type WindowId = '7' | '30'
const WINDOWS: { id: WindowId; label: string }[] = [
  { id: '7', label: '7 Days' },
  { id: '30', label: '30 Days' },
]

export default function SellerDashboard({ username, userId }: { username: string; userId: string }) {
  const [windowDays, setWindowDays] = useState<WindowId>('7')
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    getSellerDashboard(Number(windowDays)).then((d) => {
      if (active) { setData(d); setLoading(false) }
    })
    return () => { active = false }
  }, [windowDays])

  const kpis = data?.kpis
  const days = Number(windowDays)

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
    <AccountPage>
      <AccountPageHeader
        title="Seller Dashboard"
        subtitle={`Welcome back, ${username}.`}
        actions={
          <SegmentedTabs
            tabs={WINDOWS}
            value={windowDays}
            onChange={setWindowDays}
            layoutId="dashboard-window-pill"
            ariaLabel="Time range"
          />
        }
      />

      <RevealGroup className="mt-6 space-y-4">
        {/* Get Started checklist: real completion signals, dismissible */}
        {data?.onboarding && (
          <RevealItem>
            <SellerOnboardingChecklist onboarding={data.onboarding} userId={userId} />
          </RevealItem>
        )}

        <RevealItem>
          <StatStrip
            loading={loading}
            stats={[
              {
                label: 'Net Earnings',
                value: kpis ? usd(kpis.netEarnings) : '—',
                hint: delta ? <Delta pct={delta.earnings} days={days} /> : null,
              },
              {
                label: 'Pending Payout',
                value: kpis ? usd(kpis.pendingPayout) : '—',
                hint: 'Awaiting delivery confirmation',
              },
              {
                label: 'Orders',
                value: kpis ? String(kpis.orders) : '—',
                hint: delta ? <Delta pct={delta.orders} days={days} /> : null,
              },
              {
                label: 'Conversion',
                value: kpis ? `${kpis.conversionRate.toFixed(1)}%` : '—',
                hint: kpis ? `${kpis.totalSales} sales from ${kpis.totalViews} views` : null,
              },
            ]}
          />
        </RevealItem>

        {/* Nudges */}
        {data && data.nudges.length > 0 && (
          <RevealItem className="space-y-2">
            {data.nudges.map((n, i) => (
              <div key={i} className="flex items-start gap-2.5 rounded-lg bg-lime-tint-bg px-4 py-3">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-lime-text" aria-hidden />
                <p className="text-[13px] text-text-primary">{n}</p>
              </div>
            ))}
          </RevealItem>
        )}

        {/* Main grid */}
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          {/* Left: trend + top offers */}
          <div className="space-y-4">
            <RevealItem>
              <SettingsCard title="Earnings Trend" description={`Net earnings over the last ${days} days.`}>
                {loading || !data ? (
                  <div aria-hidden>
                    <div className="skeleton h-8 w-28 rounded" />
                    <div className="skeleton mt-3 h-44 w-full rounded-md" />
                  </div>
                ) : (
                  <EarningsTrend trend={data.trend} />
                )}
              </SettingsCard>
            </RevealItem>

            <RevealItem>
              <SettingsCard title="Top Offers" aside={<CardLink href="/account/listings" />}>
                {loading || !data ? (
                  <SkeletonRows />
                ) : data.topOffers.length === 0 ? (
                  <Empty text="No offers yet. Create your first listing to start selling." />
                ) : (
                  <ul className="divide-y divide-white/[0.07]">
                    {data.topOffers.map((o) => (
                      <li key={o.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                        <span className="min-w-0 truncate text-sm font-medium text-text-primary">{o.title}</span>
                        <div className="flex shrink-0 items-center gap-4 text-[12.5px] tabular-nums text-text-secondary">
                          <span>{o.views} views</span>
                          <span>{o.sales} sold</span>
                          <span className="w-12 text-right font-semibold text-text-primary">{o.conversion.toFixed(1)}%</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </SettingsCard>
            </RevealItem>
          </div>

          {/* Right: attention queue + reputation */}
          <div className="space-y-4">
            <RevealItem>
              <SettingsCard title="Needs Your Attention">
                {loading || !data ? (
                  <SkeletonRows />
                ) : data.attention.length === 0 ? (
                  <Empty text="All caught up. Nothing needs action right now." />
                ) : (
                  <ul className="space-y-2">
                    {data.attention.map((a) => (
                      <li key={`${a.kind}-${a.id}`}>
                        <Link href={a.href} className={accountRowCls}>
                          <AttentionIcon kind={a.kind} overdue={a.overdue} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-text-primary">{a.title}</p>
                            <p className="truncate text-[12px] text-text-secondary">{a.detail}</p>
                          </div>
                          {a.overdue && (
                            <span className="shrink-0 rounded-full bg-error-bg px-2 py-0.5 text-[12px] font-semibold text-error">
                              Overdue
                            </span>
                          )}
                          <ChevronRight className="h-4 w-4 shrink-0 text-text-tertiary" aria-hidden />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </SettingsCard>
            </RevealItem>

            <RevealItem>
              <SettingsCard title="Reputation" aside={<CardLink href="/account/reviews" />}>
                {loading || !data ? <SkeletonRows /> : <Reputation rep={data.reputation} />}
              </SettingsCard>
            </RevealItem>
          </div>
        </div>
      </RevealGroup>
    </AccountPage>
  )
}

// ── Pieces ────────────────────────────────────────────────────────────────

function Delta({ pct, days }: { pct: number; days: number }) {
  const up = pct >= 0
  return (
    <span className={cn('inline-flex items-center gap-1 font-medium', up ? 'text-success' : 'text-error')}>
      {up ? <TrendingUp className="h-3 w-3" aria-hidden /> : <TrendingDown className="h-3 w-3" aria-hidden />}
      {Math.abs(pct).toFixed(0)}% vs previous {days} days
    </span>
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
              tick={{ fontSize: 12, fill: 'var(--color-text-tertiary, #8a8a92)' }}
              axisLine={false}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis
              tick={{ fontSize: 12, fill: 'var(--color-text-tertiary, #8a8a92)' }}
              axisLine={false}
              tickLine={false}
              width={48}
              tickFormatter={(v) => `$${v}`}
            />
            <Tooltip
              cursor={{ stroke: 'rgba(255,255,255,0.15)' }}
              contentStyle={{
                background: 'var(--color-bg-overlay, #262730)',
                border: 'none',
                borderRadius: 6,
                fontSize: 12,
                boxShadow: '0 10px 30px -12px rgba(0,0,0,0.6)',
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
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="skeleton h-12 rounded-md" />
      ))}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-md bg-bg-overlay px-4 py-6 text-center text-[13px] text-text-secondary">{text}</p>
}
