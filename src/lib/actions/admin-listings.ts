'use server'

/**
 * Admin → Listings: find any listing. One database call per read
 * (`admin_listings_page`); Take Down and Restore are the existing actions in
 * admin-moderation-tools.ts.
 */
import { requireRole } from '@/lib/actions/admin-permissions'
import { ADMIN_LISTINGS_PAGE_SIZE, listingIdFromSearch, type AdminListingsFilters, type AdminListingsResult } from '@/lib/admin/admin-listings'
import { timed } from '@/lib/admin/timing'
import { ilikeContains } from '@/lib/db/ilike'
import { createServiceRoleClient } from '@/lib/supabase/service'

export async function getAdminListings(filters: AdminListingsFilters = {}): Promise<AdminListingsResult> {
  await requireRole(['admin', 'moderator', 'super_admin'])

  const q = (filters.q ?? '').trim()
  const id = listingIdFromSearch(q)
  const { data, error } = (await timed('admin_listings_page', () =>
    (createServiceRoleClient().rpc as any)('admin_listings_page', {
      p_q: q && !id ? ilikeContains(q) : null,
      p_id: id,
      p_status: filters.status ?? null,
      p_limit: ADMIN_LISTINGS_PAGE_SIZE,
      p_page: Math.max(1, filters.page ?? 1),
    }),
  )) as any
  if (error) throw new Error(`admin_listings_page: ${error.message}`)

  return {
    rows: data.rows,
    total: Number(data.total ?? 0),
    page: Number(data.page ?? 1),
    pageSize: ADMIN_LISTINGS_PAGE_SIZE,
  }
}
