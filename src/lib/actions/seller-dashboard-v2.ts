/**
 * V22 — Seller Dashboard (real data).
 *
 * One server action that returns everything the redesigned dashboard
 * renders, computed from real tables — no dummy data:
 *   - KPI strip: net earnings, pending payout, orders, conversion
 *   - "Needs Your Attention" action queue
 *   - Earnings trend (daily payout, last 30d)
 *   - Top offers + reputation snapshot
 *   - Derived nudges (rule-based tips from the data)
 *
 * Money figures use `seller_payout` (take-home), not gross.
 */

'use server'

import { createClient } from '@/lib/supabase/server'

export interface DashboardKpis {
  netEarnings: number        // completed payouts in window
  netEarningsPrev: number    // prior equal window (for Δ)
  pendingPayout: number      // held/in-escrow payouts
  orders: number             // orders in window
  ordersPrev: number
  conversionRate: number     // sales / views across listings (%)
  totalViews: number
  totalSales: number
}

export interface AttentionItem {
  kind: 'undelivered' | 'message' | 'dispute' | 'review'
  id: string
  title: string
  detail: string
  href: string
  overdue?: boolean
}

export interface TrendPoint {
  date: string   // YYYY-MM-DD
  amount: number // payout that day
}

export interface TopOffer {
  id: string
  title: string
  views: number
  sales: number
  conversion: number // %
  price: number
}

export interface ReputationSnapshot {
  avgRating: number
  totalReviews: number
  responseRate: number // % of reviews the seller replied to
  recent: { id: string; rating: number; comment: string | null; createdAt: string }[]
}

export interface DashboardData {
  kpis: DashboardKpis
  attention: AttentionItem[]
  trend: TrendPoint[]
  topOffers: TopOffer[]
  reputation: ReputationSnapshot
  nudges: string[]
  windowDays: number
}

const DAY = 86_400_000

export async function getSellerDashboard(windowDays = 7): Promise<DashboardData | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const now = Date.now()
  const winStart = new Date(now - windowDays * DAY).toISOString()
  const prevStart = new Date(now - 2 * windowDays * DAY).toISOString()

  // Pull everything in parallel.
  const [ordersRes, listingsRes, reviewsRes, convosRes] = await Promise.all([
    supabase
      .from('orders')
      .select('id, order_number, status, escrow_status, seller_payout, total_amount, created_at, completed_at, auto_release_at, seller_marked_delivered_at, delivered_at, listing:listings!orders_listing_id_fkey(title)')
      .eq('seller_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('listings')
      .select('id, title, price, views, view_count, sales, status')
      .eq('seller_id', user.id),
    supabase
      .from('reviews')
      .select('id, rating, comment, seller_response, created_at')
      .eq('seller_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('conversations')
      .select('id, order_id, last_message_at')
      .eq('seller_id', user.id),
  ])

  const orders = (ordersRes.data ?? []) as any[]
  const listings = (listingsRes.data ?? []) as any[]
  const reviews = (reviewsRes.data ?? []) as any[]

  // ── KPIs ──────────────────────────────────────────────────────────────
  const inWindow = (iso: string | null, start: string) => !!iso && iso >= start
  const completed = orders.filter((o) => o.status === 'completed')

  const netEarnings = completed
    .filter((o) => inWindow(o.completed_at ?? o.created_at, winStart))
    .reduce((s, o) => s + Number(o.seller_payout ?? 0), 0)
  const netEarningsPrev = completed
    .filter((o) => {
      const t = o.completed_at ?? o.created_at
      return t >= prevStart && t < winStart
    })
    .reduce((s, o) => s + Number(o.seller_payout ?? 0), 0)

  // Pending = still in escrow (held / not released, not refunded/frozen-lost).
  const pendingPayout = orders
    .filter((o) => o.escrow_status === 'held' || (o.status !== 'completed' && o.status !== 'cancelled' && o.status !== 'refunded'))
    .reduce((s, o) => s + Number(o.seller_payout ?? 0), 0)

  const ordersCount = orders.filter((o) => inWindow(o.created_at, winStart)).length
  const ordersPrev = orders.filter((o) => o.created_at >= prevStart && o.created_at < winStart).length

  const totalViews = listings.reduce((s, l) => s + Number(l.view_count ?? l.views ?? 0), 0)
  const totalSales = listings.reduce((s, l) => s + Number(l.sales ?? 0), 0)
  const conversionRate = totalViews > 0 ? (totalSales / totalViews) * 100 : 0

  // ── Needs Your Attention ──────────────────────────────────────────────
  const attention: AttentionItem[] = []

  // Undelivered: paid but not yet marked delivered.
  for (const o of orders) {
    if (o.status === 'paid' && !o.seller_marked_delivered_at) {
      const overdue = o.auto_release_at ? o.auto_release_at < new Date().toISOString() : false
      attention.push({
        kind: 'undelivered',
        id: o.id,
        title: o.listing?.title ?? 'Order',
        detail: `#${o.order_number} · awaiting delivery`,
        href: `/account/orders/${o.id}`,
        overdue,
      })
    }
  }
  // Open disputes.
  for (const o of orders) {
    if (o.status === 'disputed') {
      attention.push({
        kind: 'dispute',
        id: o.id,
        title: o.listing?.title ?? 'Order',
        detail: `#${o.order_number} · dispute open`,
        href: `/account/orders/${o.id}`,
        overdue: true,
      })
    }
  }
  // Reviews awaiting a response.
  for (const r of reviews) {
    if (!r.seller_response) {
      attention.push({
        kind: 'review',
        id: r.id,
        title: `${r.rating}★ review`,
        detail: r.comment ? r.comment.slice(0, 60) : 'Awaiting your reply',
        href: '/account/reviews',
      })
    }
  }

  // ── Earnings trend (daily payout, full window) ────────────────────────
  const buckets = new Map<string, number>()
  for (let i = windowDays - 1; i >= 0; i--) {
    const d = new Date(now - i * DAY).toISOString().slice(0, 10)
    buckets.set(d, 0)
  }
  for (const o of completed) {
    const t = (o.completed_at ?? o.created_at)?.slice(0, 10)
    if (t && buckets.has(t)) buckets.set(t, buckets.get(t)! + Number(o.seller_payout ?? 0))
  }
  const trend: TrendPoint[] = Array.from(buckets, ([date, amount]) => ({ date, amount }))

  // ── Top offers ────────────────────────────────────────────────────────
  const topOffers: TopOffer[] = listings
    .map((l) => {
      const v = Number(l.view_count ?? l.views ?? 0)
      const s = Number(l.sales ?? 0)
      return {
        id: l.id,
        title: l.title,
        views: v,
        sales: s,
        conversion: v > 0 ? (s / v) * 100 : 0,
        price: Number(l.price ?? 0),
      }
    })
    .sort((a, b) => b.sales - a.sales || b.views - a.views)
    .slice(0, 5)

  // ── Reputation ────────────────────────────────────────────────────────
  const totalReviews = reviews.length
  const avgRating = totalReviews
    ? reviews.reduce((s, r) => s + Number(r.rating ?? 0), 0) / totalReviews
    : 0
  const responded = reviews.filter((r) => r.seller_response).length
  const responseRate = totalReviews ? (responded / totalReviews) * 100 : 0
  const reputation: ReputationSnapshot = {
    avgRating,
    totalReviews,
    responseRate,
    recent: reviews.slice(0, 3).map((r) => ({
      id: r.id,
      rating: Number(r.rating ?? 0),
      comment: r.comment ?? null,
      createdAt: r.created_at,
    })),
  }

  // ── Derived nudges (rule-based, real data) ────────────────────────────
  const nudges: string[] = []
  const deadOffers = listings.filter(
    (l) => l.status === 'active' && Number(l.view_count ?? l.views ?? 0) >= 50 && Number(l.sales ?? 0) === 0,
  )
  if (deadOffers.length > 0) {
    nudges.push(`${deadOffers.length} active offer${deadOffers.length > 1 ? 's have' : ' has'} 50+ views but no sales — try adjusting price or delivery time.`)
  }
  if (responseRate < 80 && totalReviews >= 3) {
    nudges.push(`You've replied to ${Math.round(responseRate)}% of reviews — responding builds buyer trust.`)
  }
  const undeliveredCount = attention.filter((a) => a.kind === 'undelivered').length
  if (undeliveredCount > 0) {
    nudges.push(`${undeliveredCount} paid order${undeliveredCount > 1 ? 's are' : ' is'} waiting on delivery — fast delivery boosts your ranking.`)
  }

  return {
    kpis: {
      netEarnings,
      netEarningsPrev,
      pendingPayout,
      orders: ordersCount,
      ordersPrev,
      conversionRate,
      totalViews,
      totalSales,
    },
    attention: attention.slice(0, 8),
    trend,
    topOffers,
    reputation,
    nudges,
    windowDays,
  }
}
