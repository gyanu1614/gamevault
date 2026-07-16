/**
 * Buyer Dashboard — real data.
 *
 * Fed by getBuyerDashboard() (orders / wishlist / reviews). No mock data,
 * no purple gradients. Dark + lime design system: rounded-lg, card-frost,
 * grey hovers, lime reserved for the primary Browse CTA.
 */

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ShoppingBag,
  Package,
  Heart,
  Clock,
  CheckCircle2,
  ArrowRight,
  DollarSign,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import BecomeSellerCta from '@/components/account/BecomeSellerCta'
import AccountPageHeader from '@/components/account/AccountPageHeader'
import { getBuyerDashboard, type BuyerDashboardData } from '@/lib/actions/buyer-dashboard'

interface BuyerDashboardProps {
  user: any
}

const usd = (n: number) =>
  (n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return '1 day ago'
  if (days < 30) return `${days} days ago`
  const months = Math.floor(days / 30)
  return months === 1 ? '1 month ago' : `${months} months ago`
}

export default function BuyerDashboard({ user }: BuyerDashboardProps) {
  const [data, setData] = useState<BuyerDashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    getBuyerDashboard().then((d) => {
      if (active) { setData(d); setLoading(false) }
    })
    return () => { active = false }
  }, [])

  const stats = [
    { label: 'Total Spent', value: data ? usd(data.totalSpent) : '—', icon: DollarSign },
    { label: 'Active Orders', value: data ? String(data.activeOrders) : '—', icon: Package },
    { label: 'Completed Orders', value: data ? String(data.completedOrders) : '—', icon: CheckCircle2 },
    { label: 'Wishlist', value: data ? String(data.wishlistItems) : '—', icon: Heart },
  ]

  return (
    <div className="min-h-screen pb-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <AccountPageHeader
          icon="dashboard"
          title="Dashboard"
          subtitle={`Welcome back, ${user?.profile?.username || user?.username || 'there'}.`}
        />

        {/* Stats strip */}
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((s) => {
            const Icon = s.icon
            return (
              <div key={s.label} className="rounded-lg border border-border-default bg-bg-raised px-4 py-3">
                <div className="flex items-center gap-2 text-text-secondary">
                  <Icon className="h-4 w-4" />
                  <span className="text-[12px] font-medium">{s.label}</span>
                </div>
                {loading ? (
                  <div className="mt-1.5 h-6 w-20 animate-pulse rounded bg-white/[0.06]" />
                ) : (
                  <div className="mt-0.5 text-2xl font-bold leading-tight text-text-primary">{s.value}</div>
                )}
              </div>
            )
          })}
        </div>

        {/* Main grid */}
        <div className="mt-6 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          {/* Left: active orders + favorite games */}
          <div className="space-y-4">
            <div className="rounded-lg border border-border-default bg-bg-raised p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider text-text-secondary">Active Orders</h2>
                <Link href="/account/orders" className="flex items-center gap-1 text-[12px] font-medium text-lime-text hover:underline">
                  View All <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              {loading ? (
                <div className="space-y-2">
                  {[0, 1].map((i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-bg-overlay" />)}
                </div>
              ) : !data || data.active.length === 0 ? (
                <p className="py-6 text-center text-sm text-text-secondary">
                  No active orders. <Link href="/browse" className="text-lime-text hover:underline">Browse the marketplace</Link> to get started.
                </p>
              ) : (
                <div className="space-y-2">
                  {data.active.map((order) => (
                    <Link
                      key={order.id}
                      href={`/account/orders/${order.id}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-white/[0.02] px-4 py-3 transition-colors hover:bg-white/[0.05]"
                    >
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-semibold text-text-primary">{order.title}</h3>
                        <p className="mt-0.5 text-xs text-text-secondary">
                          {order.seller} · {timeAgo(order.createdAt)}
                        </p>
                        <div className="mt-1.5">
                          {order.status === 'delivered' ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-lime-tint-border bg-lime/10 px-2 py-0.5 text-[11px] font-medium text-lime-text">
                              <CheckCircle2 className="h-3 w-3" /> Delivered
                            </span>
                          ) : order.status === 'disputed' ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-error/20 bg-error-bg px-2 py-0.5 text-[11px] font-medium text-error">
                              <Clock className="h-3 w-3" /> Disputed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-warning/20 bg-warning-bg px-2 py-0.5 text-[11px] font-medium text-warning">
                              <Clock className="h-3 w-3" /> Processing
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-bold text-text-primary">{usd(order.amount)}</p>
                        <span className="text-[11px] text-text-tertiary">View details</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-border-default bg-bg-raised p-5">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-text-secondary">Your Favorite Games</h2>
              {loading ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => <div key={i} className="h-8 animate-pulse rounded-lg bg-bg-overlay" />)}
                </div>
              ) : !data || data.favoriteGames.length === 0 ? (
                <p className="py-6 text-center text-sm text-text-secondary">
                  Complete a purchase and your top games will show up here.
                </p>
              ) : (
                <div className="space-y-2">
                  {data.favoriteGames.map((g, index) => (
                    <div key={g.game} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-bg-overlay text-xs font-bold text-text-secondary">
                          #{index + 1}
                        </span>
                        <span className="text-sm text-text-primary">{g.game}</span>
                      </div>
                      <span className="text-sm text-text-secondary">{g.count} {g.count === 1 ? 'item' : 'items'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: quick actions + seller CTA + stats */}
          <div className="space-y-4">
            <div className="rounded-lg border border-border-default bg-bg-raised p-5">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-text-secondary">Quick Actions</h2>
              <div className="space-y-2">
                <Link
                  href="/browse"
                  className="flex items-center gap-3 rounded-lg bg-lime px-4 py-3 text-sm font-semibold text-text-inverse transition-colors hover:bg-lime-hover"
                >
                  <ShoppingBag className="h-4 w-4" />
                  Browse Marketplace
                </Link>
                <Link
                  href="/account/wishlist"
                  className="flex items-center gap-3 rounded-lg border border-border-subtle bg-bg-overlay px-4 py-3 text-sm font-medium text-text-primary transition-colors hover:bg-bg-raised-hover"
                >
                  <Heart className="h-4 w-4" />
                  View Wishlist
                </Link>
                <Link
                  href="/account/orders"
                  className="flex items-center gap-3 rounded-lg border border-border-subtle bg-bg-overlay px-4 py-3 text-sm font-medium text-text-primary transition-colors hover:bg-bg-raised-hover"
                >
                  <Package className="h-4 w-4" />
                  My Orders
                </Link>
              </div>
            </div>

            {/* Seller CTA — reactive, flips to "Application Pending" and
                disappears on approval without a refresh (Beta C). */}
            <BecomeSellerCta variant="card" />

            <div className="rounded-lg border border-border-default bg-bg-raised p-5">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-text-secondary">Your Stats</h2>
              <div className="space-y-2.5">
                <StatRow label="Completed Orders" value={loading || !data ? '—' : String(data.completedOrders)} />
                <StatRow label="Reviews Given" value={loading || !data ? '—' : String(data.reviewsGiven)} />
                <StatRow label="Wishlist Items" value={loading || !data ? '—' : String(data.wishlistItems)} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className={cn('text-sm font-medium text-text-primary tabular-nums')}>{value}</span>
    </div>
  )
}
