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

import { ilikeContains } from '@/lib/db/ilike'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { DEFAULT_TIER, type SellerTier } from '@/lib/seller/tiers'
import { requireAdmin } from './admin-permissions'

/** Latest of several ISO timestamps (nulls skipped); null when all missing. */
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
  /** profiles.is_verified — false = an open-signup seller who has not verified yet. */
  is_verified: boolean
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
  tier?: SellerTier
  verified?: boolean
  pausedOnly?: boolean
  searchQuery?: string
  sortBy?: ActiveSellerSort
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export interface ActiveSellersPage {
  success: boolean
  sellers?: ActiveSeller[]
  total?: number
  page?: number
  pageSize?: number
  error?: string
}

const ACTIVE_SELLERS_PAGE_SIZE = 25
/** One CSV download. Enough for today's roster; the file says nothing past it. */
const ACTIVE_SELLERS_EXPORT_CAP = 5000

function activeSellerFromRow(row: any): ActiveSeller {
  return {
    id: row.id,
    username: row.username || 'unknown',
    full_name: row.full_name ?? null,
    email: row.email || 'No email',
    avatar_url: row.avatar_url ?? null,
    shop_name: row.shop_name ?? null,
    seller_tier: row.seller_tier || DEFAULT_TIER,
    seller_status: row.seller_status || 'active',
    kyc_status: row.kyc_status ?? null,
    is_verified: row.is_verified === true,
    founding_seller: row.founding_seller === true,
    is_test: row.is_test === true,
    created_at: row.created_at,
    total_sales: Number(row.total_sales ?? 0),
    seller_rating: row.seller_rating != null ? Number(row.seller_rating) : null,
    total_reviews: Number(row.total_reviews ?? 0),
    stats: {
      active_listings: Number(row.active_listings ?? 0),
      pending_listings: Number(row.pending_listings ?? 0),
      completed_sales: Number(row.completed_sales ?? 0),
      revenue: Number(row.revenue ?? 0),
      pending_withdrawals: Number(row.pending_withdrawals ?? 0),
    },
    store_paused: row.store_paused === true,
    // GREATEST(presence heartbeats, auth last_sign_in_at) — same truth the
    // detail page uses.
    last_active_at: row.last_active_at ?? null,
    approved_at: row.approved_at ?? null,
    latest_listing_at: row.latest_listing_at ?? null,
  }
}

async function readActiveSellers(filters: ActiveSellersFilters, limit: number, offset: number) {
  const search = filters.searchQuery?.trim()
  const { data, error } = await (createServiceRoleClient().rpc as any)('admin_active_sellers_page', {
    p_search: search ? ilikeContains(search) : null,
    p_status: filters.status ?? null,
    p_tier: filters.tier ?? null,
    p_default_tier: DEFAULT_TIER,
    p_verified: filters.verified ?? null,
    p_paused: filters.pausedOnly === true,
    p_sort: filters.sortBy ?? 'listings',
    p_ascending: filters.sortOrder === 'asc',
    p_limit: limit,
    p_offset: offset,
  })
  if (error) throw new Error(error.message)
  return { total: Number(data.total ?? 0), sellers: (data.rows as any[]).map(activeSellerFromRow) }
}

/**
 * One page of sellers (profiles.role='seller') with real listing/order stats,
 * filtered and sorted in the database. Default sort: active listings DESC — the
 * sellers with live inventory float to the top.
 */
export async function getActiveSellers(filters: ActiveSellersFilters = {}): Promise<ActiveSellersPage> {
  try {
    await requireAdmin()

    const pageSize = filters.pageSize ?? ACTIVE_SELLERS_PAGE_SIZE
    const page = Math.max(1, filters.page ?? 1)
    const { sellers, total } = await readActiveSellers(filters, pageSize, (page - 1) * pageSize)
    return { success: true, sellers, total, page, pageSize }
  } catch (error: any) {
    console.error('Error in getActiveSellers:', error)
    return { success: false, error: error.message || 'Failed to fetch active sellers' }
  }
}

/** Every row the current filters match, for the CSV. */
export async function exportActiveSellers(filters: ActiveSellersFilters = {}): Promise<ActiveSellersPage> {
  try {
    await requireAdmin()
    const { sellers, total } = await readActiveSellers(filters, ACTIVE_SELLERS_EXPORT_CAP, 0)
    return { success: true, sellers, total }
  } catch (error: any) {
    console.error('Error in exportActiveSellers:', error)
    return { success: false, error: error.message || 'Failed to export sellers' }
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

    const { data, error } = await (createServiceRoleClient().rpc as any)('admin_seller_totals')
    if (error) return { success: false, error: error.message }

    return {
      success: true,
      stats: {
        totalSellers: Number(data.total_sellers ?? 0),
        totalActiveListings: Number(data.active_listings ?? 0),
        totalRevenue: Number(data.revenue ?? 0),
        pendingWithdrawals: Number(data.pending_withdrawals ?? 0),
      },
    }
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to fetch stats' }
  }
}
