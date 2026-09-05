'use server'

/**
 * Admin — active sellers list.
 *
 * Sourced from `profiles` where role='seller' (NOT seller_applications: a
 * seller promoted outside the application flow would be invisible there),
 * then batch-enriched with real numbers via the service-role client using
 * the Map pattern from moderation.ts: listings counts by status, completed
 * revenue (SUM seller_payout) + sales counts, seller_presence
 * (store_paused, last_active_at) and pending withdrawal counts.
 */

import { createServiceRoleClient } from '@/lib/supabase/service'
import { requireAdmin } from './admin-permissions'

/** Latest of several ISO timestamps (nulls skipped); null when all missing. */
function latestIso(...values: (string | null | undefined)[]): string | null {
  let best: string | null = null
  let bestMs = -Infinity
  for (const v of values) {
    if (!v) continue
    const ms = new Date(v).getTime()
    if (Number.isFinite(ms) && ms > bestMs) {
      bestMs = ms
      best = v
    }
  }
  return best
}

export type ActiveSellerSort =
  | 'listings'
  | 'sales'
  | 'revenue'
  | 'joined'
  | 'last_active'
  | 'approved'
  | 'recent_listing'

export interface ActiveSeller {
  /** Profile id — the seller's user id (detail route param). */
  id: string
  username: string
  full_name: string | null
  email: string
  avatar_url: string | null
  shop_name: string | null
  seller_tier: string
  seller_status: string
  kyc_status: string | null
  founding_seller: boolean
  is_test: boolean
  created_at: string
  total_sales: number
  seller_rating: number | null
  total_reviews: number
  stats: {
    active_listings: number
    pending_listings: number
    /** Completed orders count (real, from orders). */
    completed_sales: number
    /** SUM(seller_payout) over completed orders. */
    revenue: number
    pending_withdrawals: number
  }
  store_paused: boolean
  last_active_at: string | null
  approved_at: string | null
  latest_listing_at: string | null
}

export interface ActiveSellersFilters {
  status?: 'active' | 'restricted' | 'banned'
  tier?: 'unverified' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'
  searchQuery?: string
  sortBy?: ActiveSellerSort
  sortOrder?: 'asc' | 'desc'
}

/**
 * Get all sellers (profiles.role='seller') with real listing/order stats.
 * Default sort: active listings DESC — the sellers with live inventory
 * float to the top.
 */
export async function getActiveSellers(filters?: ActiveSellersFilters): Promise<{
  success: boolean
  sellers?: ActiveSeller[]
  error?: string
}> {
  try {
    await requireAdmin()

    const service = createServiceRoleClient()

    const { data: profiles, error } = await (service
      .from('profiles')
      .select(
        'id, username, full_name, email, avatar_url, shop_name, seller_tier, seller_status, kyc_status, founding_seller, is_test, created_at, updated_at, total_sales, seller_rating, total_reviews',
      )
      .eq('role', 'seller') as any)

    if (error) {
      console.error('Error fetching active sellers:', error)
      return { success: false, error: error.message }
    }

    const rows: any[] = profiles || []
    if (rows.length === 0) return { success: true, sellers: [] }

    const sellerIds = rows.map((p) => p.id as string)

    // ── Batch enrichment (Map pattern from moderation.ts) ──
    const [listingsRes, ordersRes, presenceRes, withdrawalsRes, approvedAppsRes, authUsersRes] = await Promise.all([
      service
        .from('listings')
        .select('seller_id, status, created_at')
        .in('seller_id', sellerIds)
        .in('status', ['active', 'pending_approval']) as any,
      service
        .from('orders')
        .select('seller_id, seller_payout')
        .in('seller_id', sellerIds)
        .eq('status', 'completed') as any,
      service
        .from('seller_presence')
        .select('seller_id, store_paused, last_active_at, last_seen_at')
        .in('seller_id', sellerIds) as any,
      (service.from('withdrawal_requests' as any) as any)
        .select('user_id')
        .in('user_id', sellerIds)
        .eq('status', 'pending'),
      // Approval date — latest approved application per seller.
      service
        .from('seller_applications')
        .select('user_id, reviewed_at, created_at')
        .in('user_id', sellerIds)
        .eq('status', 'approved') as any,
      // Real last sign-in from auth — one paged call covers the whole roster
      // (revisit pagination if the platform grows past ~1000 sellers).
      service.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ])

    const activeListings = new Map<string, number>()
    const pendingListings = new Map<string, number>()
    const latestListingAt = new Map<string, string>()
    for (const l of listingsRes.data ?? []) {
      if (l.status === 'active') {
        activeListings.set(l.seller_id, (activeListings.get(l.seller_id) ?? 0) + 1)
      } else if (l.status === 'pending_approval') {
        pendingListings.set(l.seller_id, (pendingListings.get(l.seller_id) ?? 0) + 1)
      }
      const prev = latestListingAt.get(l.seller_id)
      if (l.created_at && (!prev || l.created_at > prev)) {
        latestListingAt.set(l.seller_id, l.created_at)
      }
    }

    // Latest approved-application date per seller.
    const approvedAt = new Map<string, string>()
    for (const a of approvedAppsRes.data ?? []) {
      const when = a.reviewed_at || a.created_at
      const prev = approvedAt.get(a.user_id)
      if (when && (!prev || when > prev)) approvedAt.set(a.user_id, when)
    }

    // Auth last sign-in — the truthful "last seen" signal.
    const lastSignIn = new Map<string, string>()
    for (const u of authUsersRes?.data?.users ?? []) {
      if (u.last_sign_in_at) lastSignIn.set(u.id, u.last_sign_in_at)
    }

    const completedSales = new Map<string, number>()
    const revenue = new Map<string, number>()
    for (const o of ordersRes.data ?? []) {
      completedSales.set(o.seller_id, (completedSales.get(o.seller_id) ?? 0) + 1)
      revenue.set(o.seller_id, (revenue.get(o.seller_id) ?? 0) + Number(o.seller_payout ?? 0))
    }

    const presence = new Map<string, { store_paused: boolean; last_active_at: string | null }>()
    for (const p of presenceRes.data ?? []) {
      presence.set(p.seller_id, {
        store_paused: !!p.store_paused,
        last_active_at: latestIso(p.last_active_at, p.last_seen_at),
      })
    }

    const pendingWithdrawals = new Map<string, number>()
    for (const w of withdrawalsRes.data ?? []) {
      pendingWithdrawals.set(w.user_id, (pendingWithdrawals.get(w.user_id) ?? 0) + 1)
    }

    let sellers: ActiveSeller[] = rows.map((p) => {
      const pres = presence.get(p.id)
      return {
        id: p.id,
        username: p.username || 'unknown',
        full_name: p.full_name ?? null,
        email: p.email || 'No email',
        avatar_url: p.avatar_url ?? null,
        shop_name: p.shop_name ?? null,
        seller_tier: p.seller_tier || 'unverified',
        seller_status: p.seller_status || 'active',
        kyc_status: p.kyc_status ?? null,
        founding_seller: p.founding_seller === true,
        is_test: p.is_test === true,
        created_at: p.created_at,
        total_sales: Number(p.total_sales ?? 0),
        seller_rating: p.seller_rating != null ? Number(p.seller_rating) : null,
        total_reviews: Number(p.total_reviews ?? 0),
        stats: {
          active_listings: activeListings.get(p.id) ?? 0,
          pending_listings: pendingListings.get(p.id) ?? 0,
          completed_sales: completedSales.get(p.id) ?? 0,
          revenue: revenue.get(p.id) ?? 0,
          pending_withdrawals: pendingWithdrawals.get(p.id) ?? 0,
        },
        store_paused: pres?.store_paused ?? false,
        // GREATEST(presence heartbeats, auth last_sign_in_at) — same truth the
        // detail page uses, batched via one listUsers call.
        last_active_at: latestIso(pres?.last_active_at, lastSignIn.get(p.id) ?? null),
        approved_at: approvedAt.get(p.id) ?? null,
        latest_listing_at: latestListingAt.get(p.id) ?? null,
      }
    })

    // ── Filters (also applied client-side; kept here so direct calls work) ──
    if (filters?.tier) {
      sellers = sellers.filter((s) => s.seller_tier === filters.tier)
    }
    if (filters?.status) {
      sellers = sellers.filter((s) => s.seller_status === filters.status)
    }
    if (filters?.searchQuery) {
      const q = filters.searchQuery.toLowerCase()
      sellers = sellers.filter(
        (s) =>
          s.username.toLowerCase().includes(q) ||
          (s.full_name || '').toLowerCase().includes(q) ||
          (s.shop_name || '').toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q),
      )
    }

    // ── Sort (default: active listings DESC) ──
    const sortBy: ActiveSellerSort = filters?.sortBy ?? 'listings'
    const dir = filters?.sortOrder === 'asc' ? 1 : -1
    const value = (s: ActiveSeller): number => {
      switch (sortBy) {
        case 'sales':
          return s.stats.completed_sales
        case 'revenue':
          return s.stats.revenue
        case 'joined':
          return new Date(s.created_at).getTime()
        case 'last_active':
          return s.last_active_at ? new Date(s.last_active_at).getTime() : 0
        case 'approved':
          return s.approved_at ? new Date(s.approved_at).getTime() : 0
        case 'recent_listing':
          return s.latest_listing_at ? new Date(s.latest_listing_at).getTime() : 0
        case 'listings':
        default:
          return s.stats.active_listings
      }
    }
    sellers.sort((a, b) => (value(a) - value(b)) * dir)

    return { success: true, sellers }
  } catch (error: any) {
    console.error('Error in getActiveSellers:', error)
    return { success: false, error: error.message || 'Failed to fetch active sellers' }
  }
}

export interface SellerStatsOverview {
  totalSellers: number
  totalActiveListings: number
  totalRevenue: number
  pendingWithdrawals: number
}

/**
 * Real platform-wide seller numbers for the header chips.
 */
export async function getSellerStats(): Promise<{
  success: boolean
  stats?: SellerStatsOverview
  error?: string
}> {
  try {
    await requireAdmin()

    const service = createServiceRoleClient()

    const [sellersRes, listingsRes, ordersRes, withdrawalsRes] = await Promise.all([
      service
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'seller') as any,
      service
        .from('listings')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active') as any,
      service.from('orders').select('seller_payout').eq('status', 'completed') as any,
      (service.from('withdrawal_requests' as any) as any)
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
    ])

    if (sellersRes.error) {
      return { success: false, error: sellersRes.error.message }
    }

    const totalRevenue = (ordersRes.data ?? []).reduce(
      (sum: number, o: any) => sum + Number(o.seller_payout ?? 0),
      0,
    )

    return {
      success: true,
      stats: {
        totalSellers: sellersRes.count ?? 0,
        totalActiveListings: listingsRes.count ?? 0,
        totalRevenue,
        pendingWithdrawals: withdrawalsRes.count ?? 0,
      },
    }
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to fetch stats' }
  }
}
