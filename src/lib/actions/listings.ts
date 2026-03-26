/**
 * Listing Actions
 * Server actions for creating and managing listings with Phase 3 features:
 * - Template loading
 * - Image upload to Supabase Storage
 * - Pre-moderation handling
 * - Price history tracking (automatic via trigger)
 */

'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ============================================
// TYPES
// ============================================

export interface ListingTemplate {
  id: string
  game_id: string
  category_id: string
  template_name: string
  fields: TemplateField[]
  is_active: boolean
}

export interface TemplateField {
  name: string
  type: 'text' | 'number' | 'boolean' | 'select' | 'textarea'
  label: string
  required: boolean
  placeholder?: string
  min?: number
  max?: number
  maxLength?: number
  options?: { value: string; label: string }[]
  defaultValue?: any
}

export interface CreateListingInput {
  game_id: string
  category_id: string
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

export interface Category {
  id: string
  game_id: string
  name: string
  slug: string
  icon: string
  description?: string
  display_order: number
  is_active: boolean
  metadata: {
    type?: 'currency' | 'items' | 'account' | 'service' | 'gift_card'
    requires_region?: boolean
    requires_platform?: boolean
    available_regions?: Array<{ code: string; name: string; currency?: string }>
    available_platforms?: string[]
    unit_label?: string
    is_limited?: boolean
    is_modded?: boolean
  }
}

// ============================================
// CATEGORY ACTIONS
// ============================================

/**
 * Get game-specific categories
 */
export async function getGameCategories(
  gameId: string
): Promise<{ success: boolean; categories?: Category[]; error?: string }> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('game_id', gameId)
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .order('name', { ascending: true })

    if (error) throw error

    return { success: true, categories: data || [] }
  } catch (error: any) {
    console.error('Error fetching game categories:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get category by ID with metadata
 */
export async function getCategoryById(
  categoryId: string
): Promise<{ success: boolean; category?: Category; error?: string }> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('id', categoryId)
      .single()

    if (error) throw error

    return { success: true, category: data }
  } catch (error: any) {
    console.error('Error fetching category:', error)
    return { success: false, error: error.message }
  }
}

// ============================================
// TEMPLATE ACTIONS
// ============================================

/**
 * Get listing template for a game/category combination
 */
export async function getListingTemplate(
  gameId: string,
  categoryId: string
): Promise<{ success: boolean; template?: ListingTemplate; error?: string }> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('listing_templates')
      .select('*')
      .eq('game_id', gameId)
      .eq('category_id', categoryId)
      .eq('is_active', true)
      .single()

    if (error) {
      // No template found is not an error - just means no custom fields
      if (error.code === 'PGRST116') {
        return { success: true, template: undefined }
      }
      throw error
    }

    return { success: true, template: data }
  } catch (error: any) {
    console.error('Error fetching listing template:', error)
    return { success: false, error: error.message }
  }
}

// ============================================
// IMAGE UPLOAD ACTIONS
// ============================================

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
 * Check for spam/duplicate listings
 */
export async function checkListingSpam(
  userId: string,
  title: string,
  gameId: string,
  categoryId: string
): Promise<{ success: boolean; isSpam: boolean; reason?: string; error?: string }> {
  try {
    const supabase = await createClient()

    // 1. Rate limiting: Max 5 listings per hour for new sellers
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

    const { count: recentCount } = await supabase
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .eq('seller_id', userId)
      .gte('created_at', oneHourAgo)

    // Check seller tier to determine rate limit
    const { data: profile } = await supabase
      .from('profiles')
      .select('seller_tier, total_sales')
      .eq('id', userId)
      .single() as any

    const sellerTier = profile?.seller_tier || 'unverified'
    const totalSales = profile?.total_sales || 0

    // Rate limits by tier
    let maxListingsPerHour = 5
    if (sellerTier === 'bronze' || totalSales >= 10) maxListingsPerHour = 10
    if (sellerTier === 'silver' || totalSales >= 50) maxListingsPerHour = 20
    if (sellerTier === 'gold' || totalSales >= 100) maxListingsPerHour = 50
    if (sellerTier === 'platinum') maxListingsPerHour = 100

    if ((recentCount || 0) >= maxListingsPerHour) {
      return {
        success: true,
        isSpam: true,
        reason: `Rate limit: Maximum ${maxListingsPerHour} listings per hour for your tier`,
      }
    }

    // 2. Duplicate detection: Check for similar titles in same game/category
    const { data: similarListings } = await supabase
      .from('listings')
      .select('id, title')
      .eq('seller_id', userId)
      .eq('game_id', gameId)
      .eq('category_id', categoryId)
      .in('status', ['active', 'pending_approval'])
      .limit(50)

    if (similarListings && similarListings.length > 0) {
      // Use simple similarity check (can be enhanced with trigram later)
      const normalizedTitle = title.toLowerCase().trim()
      for (const listing of (similarListings as any)) {
        const existingTitle = (listing as any).title.toLowerCase().trim()
        if (normalizedTitle === existingTitle) {
          return {
            success: true,
            isSpam: true,
            reason: 'You already have an identical listing. Please update the existing one instead.',
          }
        }
      }
    }

    // 3. Check for too many similar listings in short time
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const { count: veryRecentCount } = await supabase
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .eq('seller_id', userId)
      .eq('game_id', gameId)
      .eq('category_id', categoryId)
      .gte('created_at', fiveMinutesAgo)

    if ((veryRecentCount || 0) >= 3) {
      return {
        success: true,
        isSpam: true,
        reason: 'Too many listings in this category. Please wait a few minutes.',
      }
    }

    return { success: true, isSpam: false }
  } catch (error: any) {
    console.error('Error checking listing spam:', error)
    return { success: false, isSpam: false, error: error.message }
  }
}

// ============================================
// LISTING CRUD ACTIONS
// ============================================

/**
 * Create a new listing with Phase 3 features
 */
export async function createListing(
  input: CreateListingInput
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

    // Get seller profile to check tier and status
    const { data: profile } = await supabase
      .from('profiles')
      .select('seller_tier, seller_status')
      .eq('id', user.id)
      .single() as any

    // Check if seller is restricted or banned
    if (profile?.seller_status && profile.seller_status !== 'active') {
      return {
        success: false,
        error: 'Your seller account is restricted. You cannot create listings at this time.'
      }
    }

    // Validate required fields
    if (!input.title || input.title.trim().length < 5) {
      return { success: false, error: 'Title must be at least 5 characters' }
    }
    if (input.title.trim().length > 100) {
      return { success: false, error: 'Title must be less than 100 characters' }
    }
    if (!input.price || input.price <= 0) {
      return { success: false, error: 'Price must be greater than 0' }
    }
    if (!input.images || input.images.length === 0) {
      return { success: false, error: 'At least one image is required' }
    }

    // Check category metadata for required fields
    const { data: category } = await supabase
      .from('categories')
      .select('metadata')
      .eq('id', input.category_id)
      .single() as any

    if (category) {
      const metadata = category.metadata as Category['metadata']

      // Validate region if required
      if (metadata.requires_region && !input.region) {
        return { success: false, error: 'Region is required for this category' }
      }

      // Validate platform if required
      if (metadata.requires_platform && !input.platform) {
        return { success: false, error: 'Platform is required for this category' }
      }
    }

    // Spam prevention check (skip for draft listings)
    if (input.status !== 'draft') {
      const spamCheck = await checkListingSpam(
        user.id,
        input.title,
        input.game_id,
        input.category_id
      )

      if (spamCheck.success && spamCheck.isSpam) {
        return { success: false, error: spamCheck.reason || 'Listing flagged as spam' }
      }
    }

    // Prepare listing data
    const listingData = {
      seller_id: user.id,
      game_id: input.game_id,
      category_id: input.category_id,
      title: input.title.trim(),
      description: input.description?.trim() || '',
      price: input.price,
      original_price: input.original_price || null,
      quantity: input.quantity || 1,
      min_quantity: input.min_quantity || 1,
      delivery_method: input.delivery_method,
      delivery_time: input.delivery_time || '1-24 hours',
      delivery_method_type: input.delivery_method_type || null,
      images: input.images,
      template_data: input.template_data || {},
      region: input.region || null,
      platform: input.platform || null,
      status: input.status || 'active', // Will be changed to pending_approval by trigger if needed
      currency: 'USD',
      views: 0,
      sales: 0,
    }

    // Insert listing
    const { data, error } = await (supabase
      .from('listings')
      .insert as any)([listingData])
      .select(`
        *,
        game:game_id (id, name, slug, image_url),
        category:category_id (id, name, slug, icon)
      `)
      .single()

    if (error) throw error

    // Check if status was changed to pending_approval by trigger
    const requiresModeration = data.status === 'pending_approval'

    revalidatePath('/account/listings')
    revalidatePath('/marketplace')

    return {
      success: true,
      listing: {
        ...data,
        requiresModeration,
      },
    }
  } catch (error: any) {
    console.error('Error creating listing:', error)
    return { success: false, error: error.message }
  }
}

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

    const sellerTier = profile?.seller_tier || 'unverified'

    // Verified tiers don't need moderation
    if (
      sellerTier === 'bronze' ||
      sellerTier === 'silver' ||
      sellerTier === 'gold' ||
      sellerTier === 'platinum'
    ) {
      return {
        success: true,
        needsModeration: false,
        approvedCount: 0,
        requiredCount: 0,
        sellerTier,
      }
    }

    // Count approved listings for unverified sellers
    const { count } = await supabase
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .eq('seller_id', user.id)
      .in('status', ['active', 'sold', 'archived'])
      .not('approved_at', 'is', null)

    const approvedCount = count || 0
    const requiredCount = 5

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
  input: Partial<CreateListingInput> & { status?: string }
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
      .select('seller_id')
      .eq('id', listingId)
      .single() as any

    if (!listing) {
      return { success: false, error: 'Listing not found' }
    }

    if (listing.seller_id !== user.id) {
      return { success: false, error: 'Unauthorized - not your listing' }
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
        category:category_id (id, name, slug, icon)
      `)
      .single()

    if (updateError) throw updateError

    revalidatePath('/account/listings')
    revalidatePath('/marketplace')

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
        category:category_id (id, name, slug, icon, metadata)
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
      .select('seller_id, images')
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

    return { success: true }
  } catch (error: any) {
    console.error('Error deleting listing:', error)
    return { success: false, error: error.message }
  }
}
