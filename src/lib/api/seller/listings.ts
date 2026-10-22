/**
 * The seller's own listings: read, edit, bulk edit.
 *
 * Part of the browser seller API, split out of lib/api/seller-compatible.ts
 * (2026-10-20, files under ~400 lines). Import from '@/lib/api/seller-compatible'.
 */
import { revalidateMyListingSurfaces } from '@/lib/actions/revalidate-listing-surfaces'
import { supabase } from './client'
import { updateListing as updateListingAction, bulkUpdateListings as bulkUpdateListingsAction } from '@/lib/actions/listings'
import type { ListingStatus, Listing } from './types'

/**
 * Step 7b — after a listing write from the browser, ask the server to
 * revalidate the category pages this seller has listings in. Best-effort:
 * the write already happened; the action is session-scoped and rate-limited.
 */
function revalidateMine(): void {
  void revalidateMyListingSurfaces().catch((e) => console.error('[seller-api] revalidate failed:', e))
}

// =====================================================
// LISTINGS API
// =====================================================

export const listingsApi = {
  /**
   * Get all listings for the current seller
   */
  async getAll(filters?: {
    status?: ListingStatus
    game_id?: string
    category_id?: string
    search?: string
  }): Promise<Listing[]> {
    // CRITICAL: Get current user and filter by seller_id
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    let query = supabase
      .from('listings')
      .select(`
        *,
        game:game_id (id, name, slug, emoji, image_url),
        category:game_categories!listings_game_category_id_fkey (id, name, slug, type)
      `)
      .eq('seller_id', user.id)  // CRITICAL: Only show current user's listings
      .order('created_at', { ascending: false })

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }
    if (filters?.game_id) {
      query = query.eq('game_id', filters.game_id)
    }
    if (filters?.category_id) {
      query = query.eq('game_category_id', filters.category_id)
    }
    if (filters?.search) {
      query = query.ilike('title', `%${filters.search}%`)
    }

    const { data, error } = await query

    if (error) throw error
    return data || []
  },

  /**
   * Get a single listing by ID
   */
  async getById(id: string): Promise<Listing | null> {
    // CRITICAL: Verify ownership
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('listings')
      .select(`
        *,
        game:game_id (id, name, slug, emoji, image_url),
        category:game_categories!listings_game_category_id_fkey (id, name, slug, type)
      `)
      .eq('id', id)
      .eq('seller_id', user.id)  // CRITICAL: Only allow access to own listings
      .single()

    if (error) throw error
    return data
  },

  /**
   * Update a listing.
   *
   * ACC-03 — sellers no longer UPDATE listings through PostgREST (the grant
   * is revoked); the validated server action owns the write: ownership check,
   * shared validator, service-role write, category-page revalidation.
   */
  async update(id: string, updates: Partial<Listing>): Promise<Listing> {
    const res = await updateListingAction(id, updates as never)
    if (!res.success) throw new Error(res.error || 'Failed to update listing')
    return res.listing as Listing
  },

  /**
   * Delete a listing
   */
  async delete(id: string): Promise<void> {
    // CRITICAL: Verify ownership before deleting
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { error } = await supabase
      .from('listings')
      .delete()
      .eq('id', id)
      .eq('seller_id', user.id)  // CRITICAL: Only allow deleting own listings

    if (error) throw error
    revalidateMine()
  },

  /**
   * Bulk update listings — same validated server action path as `update`.
   */
  async bulkUpdate(ids: string[], updates: Partial<Listing>): Promise<void> {
    const res = await bulkUpdateListingsAction(ids, updates as never)
    if (!res.success) throw new Error(res.error || 'Failed to update listings')
  },

  /**
   * Bulk delete listings
   */
  async bulkDelete(ids: string[]): Promise<void> {
    // CRITICAL: Verify ownership before bulk deleting
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { error } = await supabase
      .from('listings')
      .delete()
      .in('id', ids)
      .eq('seller_id', user.id)  // CRITICAL: Only allow deleting own listings

    if (error) throw error
    revalidateMine()
  },
}
