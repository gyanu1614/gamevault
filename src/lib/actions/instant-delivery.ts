/**
 * Instant Delivery Server Actions
 *
 * Handles encryption, storage, and delivery of instant delivery codes/credentials.
 * All operations are server-side only for security.
 */

'use server'

import { createClient } from '@/lib/supabase/server'
import {
  encryptDeliveryData,
  decryptDeliveryData,
  hashCode,
  parseCodesFromText,
  validateCodeFormat
} from '@/lib/crypto/delivery-encryption'

export type DeliveryType = 'code' | 'credentials' | 'key' | 'gift_card'

interface InstantDeliveryInventory {
  id: string
  listing_id: string
  delivery_type: DeliveryType
  delivery_data: string // encrypted
  status: 'available' | 'sold' | 'reserved' | 'invalid'
  sold_to_order_id?: string
  sold_at?: string
  created_at: string
  code_hash?: string
}

/**
 * Add instant delivery inventory for a listing
 * Encrypts and stores codes/credentials
 */
export async function addInstantDeliveryInventory(
  listingId: string,
  codes: string[],
  deliveryType: DeliveryType
): Promise<{
  success: boolean
  count?: number
  error?: string
  invalidCodes?: Array<{ code: string; error: string }>
}> {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Verify user owns this listing
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('id, seller_id, delivery_method')
      .eq('id', listingId)
      .single()

    if (listingError || !listing) {
      return { success: false, error: 'Listing not found' }
    }

    if (listing.seller_id !== user.id) {
      return { success: false, error: 'Unauthorized' }
    }

    if (listing.delivery_method !== 'instant') {
      return { success: false, error: 'Listing is not set for instant delivery' }
    }

    // Validate all codes
    const invalidCodes: Array<{ code: string; error: string }> = []
    const validCodes: string[] = []

    for (const code of codes) {
      const validation = validateCodeFormat(code, deliveryType)
      if (!validation.valid) {
        invalidCodes.push({ code, error: validation.error || 'Invalid format' })
      } else {
        validCodes.push(code)
      }
    }

    if (validCodes.length === 0) {
      return {
        success: false,
        error: 'No valid codes provided',
        invalidCodes
      }
    }

    // Encrypt and prepare inventory records
    const inventoryRecords = validCodes.map(code => ({
      listing_id: listingId,
      delivery_type: deliveryType,
      delivery_data: encryptDeliveryData(code),
      status: 'available' as const,
      created_by: user.id,
      code_hash: hashCode(code)
    }))

    // Insert inventory records
    const { data, error: insertError } = await supabase
      .from('instant_delivery_inventory')
      .insert(inventoryRecords)
      .select('id')

    if (insertError) {
      console.error('Error inserting inventory:', insertError)

      // Check if it's a duplicate error
      if (insertError.code === '23505') {
        return {
          success: false,
          error: 'Some codes already exist for this listing',
          invalidCodes
        }
      }

      return {
        success: false,
        error: 'Failed to save codes',
        invalidCodes
      }
    }

    return {
      success: true,
      count: data?.length || 0,
      invalidCodes: invalidCodes.length > 0 ? invalidCodes : undefined
    }

  } catch (error) {
    console.error('Error in addInstantDeliveryInventory:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

/**
 * Get available inventory count for a listing
 */
export async function getAvailableInventoryCount(
  listingId: string
): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const supabase = await createClient()

    const { count, error } = await supabase
      .from('instant_delivery_inventory')
      .select('*', { count: 'exact', head: true })
      .eq('listing_id', listingId)
      .eq('status', 'available')

    if (error) {
      console.error('Error getting inventory count:', error)
      return { success: false, error: 'Failed to get inventory count' }
    }

    return { success: true, count: count || 0 }

  } catch (error) {
    console.error('Error in getAvailableInventoryCount:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

/**
 * Get inventory for a listing (for seller to view available stock)
 * Does NOT return decrypted codes - only metadata
 */
export async function getListingInventory(
  listingId: string
): Promise<{
  success: boolean
  inventory?: Array<{
    id: string
    status: string
    deliveryType: DeliveryType
    createdAt: string
    soldAt?: string
  }>
  error?: string
}> {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Verify user owns this listing
    const { data: listing } = await supabase
      .from('listings')
      .select('seller_id')
      .eq('id', listingId)
      .single()

    if (!listing || listing.seller_id !== user.id) {
      return { success: false, error: 'Unauthorized' }
    }

    // Get inventory metadata (no decrypted data)
    const { data, error } = await supabase
      .from('instant_delivery_inventory')
      .select('id, status, delivery_type, created_at, sold_at')
      .eq('listing_id', listingId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error getting inventory:', error)
      return { success: false, error: 'Failed to get inventory' }
    }

    return {
      success: true,
      inventory: data?.map(item => ({
        id: item.id,
        status: item.status,
        deliveryType: item.delivery_type as DeliveryType,
        createdAt: item.created_at,
        soldAt: item.sold_at || undefined
      }))
    }

  } catch (error) {
    console.error('Error in getListingInventory:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

/**
 * Reserve and deliver code to buyer
 * Called when order is completed
 */
export async function deliverCodeToBuyer(
  orderId: string,
  buyerId: string
): Promise<{ success: boolean; code?: string; deliveryType?: DeliveryType; error?: string }> {
  try {
    console.log('[InstantDelivery] Starting delivery for order:', orderId, 'buyer:', buyerId)
    const supabase = await createClient()

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, listing_id, buyer_id, status, instant_delivery_inventory_id')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      console.error('[InstantDelivery] Order not found:', orderError)
      return { success: false, error: 'Order not found' }
    }

    console.log('[InstantDelivery] Order found:', {
      orderId: order.id,
      listingId: order.listing_id,
      status: order.status,
      hasInventoryId: !!order.instant_delivery_inventory_id
    })

    if (order.buyer_id !== buyerId) {
      console.error('[InstantDelivery] Unauthorized buyer:', order.buyer_id, 'vs', buyerId)
      return { success: false, error: 'Unauthorized' }
    }

    // Allow delivery for paid, completed, or delivering orders
    if (order.status !== 'completed' && order.status !== 'delivering' && order.status !== 'paid') {
      console.error('[InstantDelivery] Order not ready:', order.status)
      return { success: false, error: 'Order not ready for delivery' }
    }

    // Check if already delivered
    if (order.instant_delivery_inventory_id) {
      console.log('[InstantDelivery] Code already delivered, fetching existing...')
      // Fetch existing delivery
      const { data: existing } = await supabase
        .from('instant_delivery_inventory')
        .select('delivery_data, delivery_type')
        .eq('id', order.instant_delivery_inventory_id)
        .single()

      if (existing) {
        const decrypted = decryptDeliveryData(existing.delivery_data)
        console.log('[InstantDelivery] Returning existing code')
        return {
          success: true,
          code: decrypted,
          deliveryType: existing.delivery_type as DeliveryType
        }
      }
    }

    // Find an available inventory item for this listing
    console.log('[InstantDelivery] Finding available inventory for listing:', order.listing_id)
    const { data: availableInventory, error: inventoryError } = await supabase
      .from('instant_delivery_inventory')
      .select('id, delivery_data, delivery_type')
      .eq('listing_id', order.listing_id)
      .eq('status', 'available')
      .limit(1)
      .single()

    if (inventoryError || !availableInventory) {
      console.error('[InstantDelivery] No inventory available:', inventoryError)
      return { success: false, error: 'No codes available for this listing' }
    }

    console.log('[InstantDelivery] Found available inventory:', availableInventory.id)

    // Mark as sold
    console.log('[InstantDelivery] Marking inventory as sold...')
    const { error: updateError } = await supabase
      .from('instant_delivery_inventory')
      .update({
        status: 'sold',
        sold_to_order_id: orderId,
        sold_at: new Date().toISOString(),
        decrypted_at: new Date().toISOString(),
        decrypted_by_user_id: buyerId
      })
      .eq('id', availableInventory.id)

    if (updateError) {
      console.error('[InstantDelivery] Error marking inventory as sold:', updateError)
      return { success: false, error: 'Failed to reserve code' }
    }

    // Decrypt the code
    console.log('[InstantDelivery] Decrypting code...')
    const decryptedCode = decryptDeliveryData(availableInventory.delivery_data)

    // Update order with decrypted code
    console.log('[InstantDelivery] Updating order with decrypted code...')
    const { error: orderUpdateError } = await supabase
      .from('orders')
      .update({
        instant_delivery_code: decryptedCode,
        instant_delivery_inventory_id: availableInventory.id,
        instant_delivery_delivered_at: new Date().toISOString()
      })
      .eq('id', orderId)

    if (orderUpdateError) {
      console.error('[InstantDelivery] Error updating order with code:', orderUpdateError)
      // Code is marked as sold but order not updated - should be handled in error recovery
    } else {
      console.log('[InstantDelivery] ✅ Successfully delivered code to order')
    }

    return {
      success: true,
      code: decryptedCode,
      deliveryType: availableInventory.delivery_type as DeliveryType
    }

  } catch (error) {
    console.error('Error in deliverCodeToBuyer:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

/**
 * Parse and validate codes from textarea input
 * Used for preview/validation before saving
 */
export async function validateInstantDeliveryCodes(
  codes: string,
  deliveryType: DeliveryType
): Promise<{
  success: boolean
  validCount?: number
  invalidCodes?: Array<{ line: number; code: string; error: string }>
  duplicates?: string[]
  error?: string
}> {
  try {
    const { valid, invalid, duplicates } = parseCodesFromText(codes, deliveryType)

    return {
      success: true,
      validCount: valid.length,
      invalidCodes: invalid.length > 0 ? invalid : undefined,
      duplicates: duplicates.length > 0 ? duplicates : undefined
    }

  } catch (error) {
    console.error('Error in validateInstantDeliveryCodes:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

/**
 * Delete available inventory for a listing
 * Only works for unsold codes
 */
export async function deleteAvailableInventory(
  listingId: string,
  inventoryIds?: string[]
): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Verify user owns this listing
    const { data: listing } = await supabase
      .from('listings')
      .select('seller_id')
      .eq('id', listingId)
      .single()

    if (!listing || listing.seller_id !== user.id) {
      return { success: false, error: 'Unauthorized' }
    }

    // Build query
    let query = supabase
      .from('instant_delivery_inventory')
      .delete()
      .eq('listing_id', listingId)
      .eq('status', 'available')

    if (inventoryIds && inventoryIds.length > 0) {
      query = query.in('id', inventoryIds)
    }

    const { error, count } = await query

    if (error) {
      console.error('Error deleting inventory:', error)
      return { success: false, error: 'Failed to delete inventory' }
    }

    return { success: true, deletedCount: count || 0 }

  } catch (error) {
    console.error('Error in deleteAvailableInventory:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}
