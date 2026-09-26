/**
 * Listing Actions
 * Server actions for managing existing listings:
 * - Image upload to Supabase Storage
 * - Pre-moderation handling
 * - Price / field updates (price history tracked automatically via trigger)
 *
 * Creation lives in sell-wizard.ts (publishListing / bulkPublishListings).
 */

'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { revalidateListingSurfaces } from '@/lib/revalidation/listings'
import { DEFAULT_TIER, tierByKey } from '@/lib/seller/tiers'
import { validateListingPatch } from '@/lib/listings/validate'
import { loadListingRuleContext } from '@/lib/listings/rule-context'

/** Editable listing fields (updateListing). Category is fixed once published. */
export interface ListingUpdateInput {
  title: string
  description: string
  price: number
  original_price?: number
  quantity: number
  min_quantity?: number
  delivery_method: 'instant' | 'manual'
  delivery_time?: string
  delivery_method_type?: string // Game-specific delivery method (e.g., 'game_pass', 'in_game_trade')
  images: string[] // Supabase Storage URLs
  template_data?: Record<string, any> // Dynamic field values
  /** draft | active | paused | archived — moderation states are review-only. */
  status?: 'draft' | 'active' | 'paused' | 'archived'
  region?: string | null // For region-specific items (gift cards, regional accounts)
  platform?: string | null // For platform-specific items (GTA, Fortnite, etc.)
}

/**
 * Upload listing image to Supabase Storage
 */
export async function uploadListingImage(
  formData: FormData
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    const file = formData.get('file') as File
    if (!file) {
      return { success: false, error: 'No file provided' }
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      return {
        success: false,
        error: 'Invalid file type. Only JPG, PNG, and WebP are allowed.',
      }
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      return { success: false, error: 'File size must be less than 5MB' }
    }

    // Generate unique filename
    const fileExt = file.name.split('.').pop()
    const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('listing-images')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (error) throw error

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from('listing-images').getPublicUrl(data.path)

    return { success: true, url: publicUrl }
  } catch (error: any) {
    console.error('Error uploading listing image:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Delete listing image from Supabase Storage
 */
export async function deleteListingImage(
  imageUrl: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    // Extract path from URL
    const urlParts = imageUrl.split('/listing-images/')
    if (urlParts.length < 2) {
      return { success: false, error: 'Invalid image URL' }
    }
    const filePath = urlParts[1]

    const { error } = await supabase.storage
      .from('listing-images')
      .remove([filePath])

    if (error) throw error

    return { success: true }
  } catch (error: any) {
    console.error('Error deleting listing image:', error)
    return { success: false, error: error.message }
  }
}

// ============================================
// SPAM PREVENTION
// ============================================

/**
 * Check if seller needs pre-moderation
 */
export async function checkSellerNeedsModeration(): Promise<{
  success: boolean
  needsModeration?: boolean
  approvedCount?: number
  requiredCount?: number
  sellerTier?: string
  error?: string
}> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Get seller profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('seller_tier')
      .eq('id', user.id)
      .single() as any

    const sellerTier = profile?.seller_tier || DEFAULT_TIER

    // Pre-moderation applies only while the seller has fewer approved listings
    // than their tier's pre_moderation_listings. Only the entry rank (bronze)
    // carries any (3); every higher rank is 0 → auto-approve. Mirrors
    // the DB's check_seller_needs_moderation / seller_tier_config.
    const requiredCount = tierByKey(sellerTier).preModerationListings
    if (requiredCount === 0) {
      return {
        success: true,
        needsModeration: false,
        approvedCount: 0,
        requiredCount: 0,
        sellerTier,
      }
    }

    // Count approved listings for entry-tier sellers still under moderation.
    const { count } = await supabase
      .from('listings')
      .select('*', { count: 'exact' })
      .eq('seller_id', user.id)
      .in('status', ['active', 'sold', 'archived'])
      .not('approved_at', 'is', null).limit(1)

    const approvedCount = count || 0

    return {
      success: true,
      needsModeration: approvedCount < requiredCount,
      approvedCount,
      requiredCount,
      sellerTier,
    }
  } catch (error: any) {
    console.error('Error checking moderation status:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get seller profile with tier information
 */
export async function getSellerProfile(): Promise<{
  success: boolean
  profile?: {
    id: string
    username: string
    seller_tier: string
    total_sales: number
    seller_rating: number
  }
  error?: string
}> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, seller_tier, total_sales, seller_rating')
      .eq('id', user.id)
      .single()

    if (error) throw error

    return { success: true, profile: data }
  } catch (error: any) {
    console.error('Error fetching seller profile:', error)
    return { success: false, error: error.message }
  }
}

/** The row fragment every seller edit reads before it validates and writes. */
interface OwnedListingRow {
  seller_id: string
  status: string
  game_id: string
  game_category_id: string | null
  quantity: number
  min_quantity: number
  is_unlimited: boolean
  delivery_method: string
  bundle_id: string | null
  pair: { type: string } | null
}

const OWNED_LISTING_SELECT =
  'seller_id, status, game_id, game_category_id, quantity, min_quantity, is_unlimited, delivery_method, bundle_id, pair:game_categories!listings_game_category_id_fkey (type)'

/**
 * Update listing price — the offers-table inline price editor. Same validator
 * and write path as every other seller edit (ACC-03/06).
 */
export async function updateListingPrice(
  listingId: string,
  newPrice: number
): Promise<{ success: boolean; error?: string }> {
  const res = await updateListing(listingId, { price: newPrice })
  return res.success ? { success: true } : { success: false, error: res.error }
}

/**
 * Update a listing (partial edit).
 *
 * ACC-03 — UPDATE on listings is revoked for JWT callers (migration
 * 20260925204757); this action is the seller's only edit path outside the
 * wizard. It (1) checks ownership with the session client, (2) validates the
 * patch with the shared validator against the row's own pair/config,
 * (3) writes with the service role, pinning id AND seller_id.
 */
export async function updateListing(
  listingId: string,
  input: Partial<ListingUpdateInput> & { status?: string }
): Promise<{ success: boolean; listing?: any; error?: string }> {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Verify ownership before updating
    const { data: listingRaw } = await supabase
      .from('listings')
      .select(OWNED_LISTING_SELECT)
      .eq('id', listingId)
      .single() as any
    const listing = listingRaw as OwnedListingRow | null

    if (!listing) {
      return { success: false, error: 'Listing not found' }
    }

    if (listing.seller_id !== user.id) {
      return { success: false, error: 'Unauthorized - not your listing' }
    }

    // AUTH-034 — a moderation decision is only undone by review. The DB guard
    // rejects this transition too (42501); refusing here gives a clear message.
    if (
      input.status === 'active' &&
      ['rejected', 'changes_requested', 'pending_approval'].includes(listing.status)
    ) {
      return {
        success: false,
        error: 'This listing is under review or was rejected — resubmit it for moderation instead of re-activating it.',
      }
    }

    const rules = await loadListingRuleContext(supabase, listing.game_id, listing.pair?.type ?? 'items')
    const validated = validateListingPatch(input, rules, listing)
    if (!validated.ok) return { success: false, error: validated.error }
    const patch: Record<string, unknown> = { ...validated.value, updated_at: new Date().toISOString() }

    // Auto-reactivate a sold-out listing when the seller restocks
    if (patch.quantity !== undefined && (patch.quantity as number) > 0 && listing.status === 'sold' && patch.status === undefined) {
      patch.status = 'active'
    }

    // Update the listing (service role; the ownership check above is the gate)
    const { data, error: updateError } = await (createServiceRoleClient()
      .from('listings')
      .update as any)(patch)
      .eq('id', listingId)
      .eq('seller_id', user.id)
      .select(`
        *,
        game:game_id (id, name, slug, image_url),
        category:game_categories!listings_game_category_id_fkey (id, name, slug, icon_emoji)
      `)
      .single()

    if (updateError) throw updateError

    revalidatePath('/account/listings')
    // No revalidatePath('/'): every homepage shelf is a CLIENT react-query
    // hook (features/home/hooks/*), which server revalidation cannot reach.
    // Step 7b — the category page itself (status/price/title changes).
    await revalidateListingSurfaces(supabase as never, { listingIds: [listingId] })

    return { success: true, listing: data }
  } catch (error: any) {
    console.error('Error updating listing:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Apply ONE patch to several of the caller's listings (offers-table bulk
 * pause / activate / delivery window). Ids the caller does not own are
 * skipped, never errored — the response says how many were touched.
 */
export async function bulkUpdateListings(
  listingIds: string[],
  input: Partial<ListingUpdateInput> & { status?: string }
): Promise<{ success: boolean; updated?: number; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Not authenticated' }
    }
    const ids = Array.from(new Set(listingIds.filter((id) => typeof id === 'string' && id.length > 0)))
    if (ids.length === 0 || ids.length > 200) {
      return { success: false, error: 'Select between 1 and 200 offers' }
    }

    const { data: rowsRaw } = await supabase
      .from('listings')
      .select(`id, ${OWNED_LISTING_SELECT}`)
      .in('id', ids)
      .eq('seller_id', user.id) as any
    const rows = ((rowsRaw ?? []) as Array<OwnedListingRow & { id: string }>)
    if (rows.length === 0) return { success: false, error: 'No offers found' }

    // AUTH-034 — moderated-out rows cannot be bulk-activated; they are skipped.
    const eligible =
      input.status === 'active'
        ? rows.filter((r) => !['rejected', 'changes_requested', 'pending_approval'].includes(r.status))
        : rows
    if (eligible.length === 0) {
      return { success: false, error: 'These offers are under review or were rejected — resubmit them instead of re-activating.' }
    }

    // One validation per distinct pair/config (the patch is the same for all).
    const byContext = new Map<string, Array<OwnedListingRow & { id: string }>>()
    for (const r of eligible) {
      const key = `${r.game_id}:${r.pair?.type ?? 'items'}`
      byContext.set(key, [...(byContext.get(key) ?? []), r])
    }
    const service = createServiceRoleClient()
    let updated = 0
    for (const group of byContext.values()) {
      const rules = await loadListingRuleContext(supabase, group[0].game_id, group[0].pair?.type ?? 'items')
      for (const row of group) {
        const validated = validateListingPatch(input, rules, row)
        if (!validated.ok) return { success: false, error: validated.error }
        const { error } = await (service.from('listings').update as any)({
          ...validated.value,
          updated_at: new Date().toISOString(),
        })
          .eq('id', row.id)
          .eq('seller_id', user.id)
        if (error) throw error
        updated++
      }
    }

    revalidatePath('/account/listings')
    await revalidateListingSurfaces(supabase as never, { listingIds: eligible.map((r) => r.id) })
    return { success: true, updated }
  } catch (error: any) {
    console.error('Error bulk-updating listings:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get listing by ID (for editing)
 */
export async function getListingById(
  listingId: string
): Promise<{ success: boolean; listing?: any; error?: string }> {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data, error } = await supabase
      .from('listings')
      .select(`
        *,
        game:game_id (id, name, slug, image_url),
        category:game_categories!listings_game_category_id_fkey (id, name, slug, icon_emoji, type)
      `)
      .eq('id', listingId)
      .eq('seller_id', user.id) // Only allow sellers to view their own listings for editing
      .single()

    if (error) throw error

    return { success: true, listing: data }
  } catch (error: any) {
    console.error('Error fetching listing:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Delete a listing
 */
export async function deleteListing(
  listingId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Verify ownership before deleting
    const { data: listing } = await supabase
      .from('listings')
      // game_category_id: read BEFORE the delete so the category page can be
      // revalidated afterwards (Step 7b) — the row is gone by then.
      .select('seller_id, images, game_category_id')
      .eq('id', listingId)
      .single() as any

    if (!listing) {
      return { success: false, error: 'Listing not found' }
    }

    if (listing.seller_id !== user.id) {
      return { success: false, error: 'Unauthorized - not your listing' }
    }

    // Delete listing images from storage
    if (listing.images && Array.isArray(listing.images)) {
      for (const imageUrl of (listing.images as any)) {
        try {
          await deleteListingImage(imageUrl)
        } catch (err) {
          console.warn('Failed to delete image:', imageUrl, err)
          // Continue anyway - don't fail the whole deletion
        }
      }
    }

    // Delete the listing
    const { error: deleteError } = await supabase
      .from('listings')
      .delete()
      .eq('id', listingId)

    if (deleteError) throw deleteError

    if (listing.game_category_id) {
      await revalidateListingSurfaces(supabase as never, {
        gameCategoryIds: [listing.game_category_id],
      })
    }

    return { success: true }
  } catch (error: any) {
    console.error('Error deleting listing:', error)
    return { success: false, error: error.message }
  }
}
