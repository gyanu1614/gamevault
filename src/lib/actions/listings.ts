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
import { revalidateListingSurfaces } from '@/lib/revalidation/listings'
import { DEFAULT_TIER, tierByKey } from '@/lib/seller/tiers'

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
  status?: 'draft' | 'active'
  region?: string // For region-specific items (gift cards, regional accounts)
  platform?: string // For platform-specific items (GTA, Fortnite, etc.)
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
      .select('*', { count: 'exact', head: true })
      .eq('seller_id', user.id)
      .in('status', ['active', 'sold', 'archived'])
      .not('approved_at', 'is', null)

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

/**
 * Update listing price
 */
export async function updateListingPrice(
  listingId: string,
  newPrice: number
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

    // Validate price
    if (!newPrice || newPrice <= 0) {
      return { success: false, error: 'Price must be greater than 0' }
    }

    // Verify ownership before updating
    const { data: listing } = await supabase
      .from('listings')
      .select('seller_id')
      .eq('id', listingId)
      .single() as any

    if (!listing) {
      return { success: false, error: 'Listing not found' }
    }

    if (listing.seller_id !== user.id) {
      return { success: false, error: 'Unauthorized - not your listing' }
    }

    // Update the price
    const { error: updateError } = await (supabase
      .from('listings')
      .update as any)({ price: newPrice, updated_at: new Date().toISOString() })
      .eq('id', listingId)

    if (updateError) throw updateError

    // Step 7b — the category page shows this price (24 h TTL).
    await revalidateListingSurfaces(supabase as never, { listingIds: [listingId] })

    return { success: true }
  } catch (error: any) {
    console.error('Error updating listing price:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Update a listing (full update)
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
    const { data: listing } = await supabase
      .from('listings')
      .select('seller_id, status')
      .eq('id', listingId)
      .single() as any

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

    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString(),
    }

    if (input.title) {
      if (input.title.trim().length < 5) {
        return { success: false, error: 'Title must be at least 5 characters' }
      }
      if (input.title.trim().length > 100) {
        return { success: false, error: 'Title must be less than 100 characters' }
      }
      updateData.title = input.title.trim()
    }

    if (input.description !== undefined) updateData.description = input.description?.trim() || ''
    if (input.price !== undefined) {
      if (input.price <= 0) {
        return { success: false, error: 'Price must be greater than 0' }
      }
      updateData.price = input.price
    }
    if (input.original_price !== undefined) updateData.original_price = input.original_price || null
    if (input.quantity !== undefined) {
      updateData.quantity = input.quantity
      // Auto-reactivate a sold-out listing when the seller restocks
      if (input.quantity > 0) {
        const { data: currentListing } = await supabase
          .from('listings')
          .select('status')
          .eq('id', listingId)
          .single() as any
        if (currentListing?.status === 'sold') {
          updateData.status = 'active'
        }
      }
    }
    if (input.min_quantity !== undefined) updateData.min_quantity = input.min_quantity
    if (input.delivery_method) updateData.delivery_method = input.delivery_method
    if (input.delivery_time) updateData.delivery_time = input.delivery_time
    if (input.delivery_method_type !== undefined) updateData.delivery_method_type = input.delivery_method_type
    if (input.images) {
      if (input.images.length === 0) {
        return { success: false, error: 'At least one image is required' }
      }
      updateData.images = input.images
    }
    if (input.template_data !== undefined) updateData.template_data = input.template_data
    if (input.region !== undefined) updateData.region = input.region || null
    if (input.platform !== undefined) updateData.platform = input.platform || null
    if (input.status !== undefined) updateData.status = input.status

    // Update the listing
    const { data, error: updateError } = await (supabase
      .from('listings')
      .update as any)(updateData)
      .eq('id', listingId)
      .select(`
        *,
        game:game_id (id, name, slug, image_url),
        category:game_categories!listings_game_category_id_fkey (id, name, slug, icon_emoji)
      `)
      .single()

    if (updateError) throw updateError

    revalidatePath('/account/listings')
    // V21/P7.d — Marketplace tree lives at `/{gameSlug}/...` now;
    // revalidate `/` (homepage features popular listings).
    revalidatePath('/')
    // Step 7b — and the category page itself (status/price/title changes).
    await revalidateListingSurfaces(supabase as never, { listingIds: [listingId] })

    return { success: true, listing: data }
  } catch (error: any) {
    console.error('Error updating listing:', error)
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
