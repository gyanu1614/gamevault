/**
 * Types + constants for Admin → Listings (plain module: the 'use server'
 * loader may only export async functions).
 */
export const ADMIN_LISTINGS_PAGE_SIZE = 25

export const ADMIN_LISTING_STATUSES = [
  { value: 'active', label: 'Live' },
  { value: 'pending_approval', label: 'Under Review' },
  { value: 'changes_requested', label: 'Changes Requested' },
  { value: 'suspended', label: 'Taken Down' },
  { value: 'rejected', label: 'Not Approved' },
  { value: 'paused', label: 'Paused' },
  { value: 'sold', label: 'Sold' },
] as const

export type AdminListingStatus = (typeof ADMIN_LISTING_STATUSES)[number]['value']

export type AdminListingsFilters = {
  q?: string
  status?: AdminListingStatus
  page?: number
}

export type AdminListingRow = {
  id: string
  title: string
  slug: string | null
  image: string | null
  price: number
  status: string
  created_at: string
  /** Why staff acted on it, while it is not live. */
  note: string | null
  seller: { id: string | null; name: string | null; status: string | null }
  game: { name: string; slug: string } | null
  category: { name: string; slug: string } | null
}

export type AdminListingsResult = {
  rows: AdminListingRow[]
  total: number
  page: number
  pageSize: number
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Pasting a listing id finds exactly that listing. */
export function listingIdFromSearch(q: string): string | null {
  return UUID.test(q) ? q.toLowerCase() : null
}

/** The public page, when the listing has everything its address needs. */
export function publicListingHref(row: Pick<AdminListingRow, 'slug' | 'game' | 'category'>): string | null {
  if (!row.slug || !row.game?.slug || !row.category?.slug) return null
  return `/${row.game.slug}/${row.category.slug}/${row.slug}`
}
