/**
 * Buyer Dashboard — real data.
 *
 * Fed by getBuyerDashboard() (orders / reviews). No mock data. Account card
 * system (AccountSurface): one stat panel, fill-only cards, lime reserved for
 * the Browse CTA. (Buyers reach this since 2026-09-29: middleware no longer
 * gates /account/dashboard to sellers.)
 */

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, ShoppingBag } from 'lucide-react'
import { AccountPage, SettingsCard, StatStrip, accountBtn, accountRowCls } from '@/components/account/AccountSurface'
import { CardLink } from '@/components/account/CardLink'
import { OrderStatusPill } from '@/components/account/OrderStatusPill'
import { RevealGroup, RevealItem } from '@/components/account/Reveal'
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
    { label: 'Total Spent', value: data ? usd(data.totalSpent) : '—' },
    { label: 'Active Orders', value: data ? String(data.activeOrders) : '—' },
    { label: 'Completed Orders', value: data ? String(data.completedOrders) : '—' },
    { label: 'Reviews Given', value: data ? String(data.reviewsGiven) : '—' },
  ]

  return (
    <AccountPage>
      <AccountPageHeader
        title="Dashboard"
        subtitle={`Welcome back, ${user?.profile?.username || user?.username || 'there'}.`}
        actions={
          <Link href="/browse" className={accountBtn.primary}>
            <ShoppingBag className="h-4 w-4" aria-hidden />
            Browse Marketplace
          </Link>
        }
      />

      <RevealGroup className="mt-6 space-y-4">
        <RevealItem>
          <StatStrip stats={stats} loading={loading} />
        </RevealItem>

        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <div className="space-y-4">
            <RevealItem>
              <SettingsCard title="Active Orders" aside={<CardLink href="/account/orders" />}>
                {loading ? (
                  <div className="space-y-2" aria-hidden>
                    {[0, 1].map((i) => <div key={i} className="skeleton h-[68px] rounded-md" />)}
                  </div>
                ) : !data || data.active.length === 0 ? (
                  <p className="rounded-md bg-bg-overlay px-4 py-6 text-center text-[13px] text-text-secondary">
                    No active orders.{' '}
                    <Link href="/browse" className="font-semibold text-text-primary hover:underline">
                      Browse the marketplace
                    </Link>{' '}
                    to get started.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {data.active.map((order) => (
                      <li key={order.id}>
                        <Link href={`/account/orders/${order.id}`} className={accountRowCls}>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-text-primary">{order.title}</p>
                            <p className="mt-0.5 truncate text-[12px] text-text-secondary">
                              {order.seller} · {timeAgo(order.createdAt)}
                            </p>
                          </div>
                          <OrderStatusPill status={order.status} className="hidden sm:inline-flex" />
                          <span className="w-20 shrink-0 text-right text-sm font-bold tabular-nums text-text-primary">
                            {usd(order.amount)}
                          </span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-text-tertiary" aria-hidden />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </SettingsCard>
            </RevealItem>

            <RevealItem>
              <SettingsCard title="Your Favorite Games" description="The games you buy for most.">
                {loading ? (
                  <div className="space-y-3" aria-hidden>
                    {[0, 1, 2].map((i) => <div key={i} className="skeleton h-7 rounded" />)}
                  </div>
                ) : !data || data.favoriteGames.length === 0 ? (
                  <p className="rounded-md bg-bg-overlay px-4 py-6 text-center text-[13px] text-text-secondary">
                    Complete a purchase and your top games will show up here.
                  </p>
                ) : (
                  <ul className="divide-y divide-white/[0.07]">
                    {data.favoriteGames.map((g, index) => (
                      <li key={g.game} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bg-overlay text-[12px] font-bold tabular-nums text-text-secondary">
                            {index + 1}
                          </span>
                          <span className="truncate text-sm text-text-primary">{g.game}</span>
                        </div>
                        <span className="shrink-0 text-[13px] tabular-nums text-text-secondary">
                          {g.count} {g.count === 1 ? 'item' : 'items'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </SettingsCard>
            </RevealItem>
          </div>

          <div className="space-y-4">
            {/* Seller CTA: reactive, flips to "Application Pending" and
                disappears on approval without a refresh (Beta C). */}
            <RevealItem>
              <BecomeSellerCta variant="card" />
            </RevealItem>
          </div>
        </div>
      </RevealGroup>
    </AccountPage>
  )
}
