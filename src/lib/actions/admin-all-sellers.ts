'use server'

/**
 * Admin → Sellers (/admin/all-sellers): every person on the seller journey,
 * not only the ones who finished it.
 *
 * Open signup (2026-10-08) made `profiles.role = 'seller'` the LAST step, so
 * a list keyed on role alone can never show the funnel. One database call
 * (admin_all_sellers_page, migration 20261103142817) unions every
 * `seller_onboarding` row with every `profiles.role = 'seller'`, derives the
 * funnel stage per person by the rule /founding uses (`deriveStage`; a guard
 * test holds the two together), applies filters and search, and returns one
 * page plus the funnel over everyone.
 */
import { createServiceRoleClient } from '@/lib/supabase/service'
import { requireRole } from './admin-permissions'
import { timed } from '@/lib/admin/timing'
import { ilikeContains } from '@/lib/db/ilike'
import { sellsGames } from '@/lib/founding/onboarding'
import {
  SELLERS_PAGE_SIZE,
  type AllSellersFilters,
  type AllSellersResult,
  type SellerListRow,
} from '@/lib/admin/all-sellers'

/** "Stalled" = started but not live and no step for 3 days. */
const STALL_MS = 3 * 24 * 60 * 60 * 1000

function rowFromDb(r: any): SellerListRow {
  return {
    id: r.id,
    username: r.username ?? null,
    full_name: r.full_name ?? null,
    email: r.email ?? null,
    avatar_url: r.avatar_url ?? null,
    shop_name: r.shop_name ?? null,
    shop_slug: r.shop_slug ?? null,
    seller_tier: r.seller_tier ?? null,
    seller_status: r.seller_status ?? null,
    is_verified: r.is_verified === true,
    founding_seller: r.founding_seller === true,
    is_test: r.is_test === true,
    signed_up_at: r.signed_up_at,
    stage: r.stage,
    milestone: r.has_sale ? 'sold' : r.has_listing ? 'listed' : 'none',
    country: r.country ?? null,
    discord: r.discord ?? null,
    sells: sellsGames(r.sells),
    agreement_signed_at: r.agreement_signed_at ?? null,
    completed_at: r.completed_at ?? null,
    last_active_at: r.last_active_at ?? null,
    stats: {
      active_listings: Number(r.active_listings ?? 0),
      completed_sales: Number(r.completed_sales ?? 0),
      revenue: Number(r.revenue ?? 0),
      balance_usd: r.balance_minor == null ? null : Number(r.balance_minor) / 100,
    },
  }
}

export async function getAllSellers(filters: AllSellersFilters = {}): Promise<AllSellersResult> {
  // Emails, Discord handles and money for every signup: admins only.
  await requireRole(['admin', 'super_admin'])

  const q = (filters.q ?? '').trim()
  const stage = filters.stage ?? 'all'
  const trust = filters.trust ?? 'all'
  const { data, error } = await timed('admin_all_sellers_page', () => (createServiceRoleClient().rpc as any)('admin_all_sellers_page', {
    p_q: q ? ilikeContains(q) : null,
    p_stage: stage === 'all' ? null : stage,
    p_trust: trust === 'all' ? null : trust,
    p_founding: filters.founding === true,
    p_limit: SELLERS_PAGE_SIZE,
    p_page: Math.max(1, filters.page ?? 1),
    p_stalled_before: new Date(Date.now() - STALL_MS).toISOString(),
  })) as any
  if (error) throw new Error(`admin_all_sellers_page: ${error.message}`)

  return {
    rows: (data.rows as any[]).map(rowFromDb),
    total: Number(data.total ?? 0),
    page: Number(data.page ?? 1),
    pageSize: SELLERS_PAGE_SIZE,
    funnel: data.funnel,
  }
}
