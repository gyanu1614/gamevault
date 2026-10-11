/**
 * Step 4 — the shapes the admin import screens read. Plain types, shared by
 * the server actions (`@/lib/actions/admin-imports`, `admin-import-apply`)
 * and the client components; a `'use server'` module may only export async
 * functions, so the types live here.
 */

export type Result<T> = { success: true; data: T } | { success: false; error: string }

export interface ImportableGame {
  id: string
  slug: string
  name: string
  itemNoun: string
  variantNoun: string | null
  categorySlug: string
  /** False when the (game, category) pair is not enabled in admin yet. */
  categoryEnabled: boolean
}

export interface StoreSellerOption {
  id: string
  username: string | null
  shopName: string | null
  tier: string | null
  activeListings: number
}

export interface BatchSummaryRow {
  id: string
  label: string | null
  status: string
  gameSlug: string
  gameName: string
  sellerName: string
  pricingMode: string
  undercutPct: number
  rowCount: number
  matched: number
  applied: number
  /** Listings this batch owns right now that are on sale (a later batch that
   *  re-imports a row takes it over; Pause / Remove take it off sale). */
  live: number
  failed: number
  needsReview: number
  createdAt: string
  appliedAt: string | null
}

export interface BatchDetail extends BatchSummaryRow {
  allowEstimated: boolean
  rows: BatchRowView[]
}

export interface BatchRowView {
  id: string
  rowNo: number
  status: string
  itemRef: string | null
  itemName: string | null
  variantRef: string | null
  variantLabel: string | null
  quantity: number | null
  priceMode: string | null
  resolvedPrice: number | null
  marketPrice: number | null
  imageUrl: string | null
  title: string | null
  candidates: Array<{ ref: string; name: string; score: number }>
  error: string | null
  action: string | null
  listingId: string | null
  /** The listing this row created or updated, as it is NOW (not as previewed). */
  listing: AppliedListingView | null
  raw: Record<string, string>
}

export interface AppliedListingView {
  title: string
  status: string
  price: number
  quantity: number
  imageUrl: string | null
  /** The live page when active, else the owner/admin preview. */
  href: string
}

export interface CreateBatchInput {
  sellerId: string
  gameId: string
  source: 'csv' | 'paste'
  label?: string | null
  pricingMode: 'auto' | 'explicit'
  undercutPct: number
  allowEstimated: boolean
  defaultQuantity?: number
  text: string
}

export interface ApplyProgress {
  processed: number
  created: number
  updated: number
  failed: number
  /** Rows still to go; 0 means the batch is done. */
  remaining: number
  images: { uploaded: number; reused: number }
}
