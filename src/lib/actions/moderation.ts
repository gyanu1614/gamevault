/**
 * Moderation Actions
 *
 * Server actions for admin listing moderation
 */

'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Get pending listings for moderation
 */
export async function getPendingListings(): Promise<{
  success: boolean
  listings?: any[]
  error?: string
}> {
  try {
    const supabase = await createClient()

    // Verify admin access
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return {
        success: false,
        error: 'Unauthorized',
      }
    }

    const { data: adminRole } = await supabase
      .from('admin_roles')
      .select('role, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single() as any

    if (!adminRole || ((adminRole as any).role !== 'admin' && (adminRole as any).role !== 'super_admin' && (adminRole as any).role !== 'moderator')) {
      return {
        success: false,
        error: 'Forbidden - Admin access required',
      }
    }

    // Get pending listings
    console.log('🔍 Fetching pending listings as admin:', user.id)

    const { data: listings, error } = await supabase
      .from('listings')
      .select(`
        *,
        seller:profiles!listings_seller_id_fkey(id, username, email, seller_tier),
        game:games!listings_game_id_fkey(name, slug),
        category:categories!listings_category_id_fkey(name, slug)
      `)
      .eq('status', 'pending_approval')
      .order('created_at', { ascending: false })

    console.log('📊 Query result:', {
      count: listings?.length || 0,
      error: error?.message,
      listings: listings?.map((l: any) => ({ id: l.id, title: l.title, status: l.status }))
    })

    if (error) {
      console.error('❌ Error fetching listings:', error)
      return {
        success: false,
        error: error.message,
      }
    }

    return {
      success: true,
      listings: listings || [],
    }
  } catch (error: any) {
    console.error('Error in getPendingListings:', error)
    return {
      success: false,
      error: error.message || 'Failed to get pending listings',
    }
  }
}

/**
 * Approve listing
 */
export async function approveListing(
  listingId: string,
  notes?: string
): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const supabase = await createClient()

    // Verify admin access
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return {
        success: false,
        error: 'Unauthorized',
      }
    }

    const { data: adminRole } = await supabase
      .from('admin_roles')
      .select('role, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single() as any

    if (!adminRole || ((adminRole as any).role !== 'admin' && (adminRole as any).role !== 'super_admin' && (adminRole as any).role !== 'moderator')) {
      return {
        success: false,
        error: 'Forbidden - Admin access required',
      }
    }

    // Use the database function to approve listing (bypasses the moderation trigger)
    console.log('🎯 Approving listing:', listingId, 'by admin:', user.id)

    const { error: approveError } = await (supabase.rpc as any)('approve_listing', {
      listing_id: listingId,
      admin_id: user.id,
    })

    console.log('✅ Approval result - error:', approveError)

    if (approveError) {
      console.error('❌ Error approving listing:', approveError)
      return {
        success: false,
        error: approveError.message,
      }
    }

    // Update moderation notes if provided
    if (notes) {
      await (supabase
        .from('listings')
        .update as any)({ moderation_notes: notes })
        .eq('id', listingId)
    }

    // TODO: Send approval notification email to seller
    // await sendListingApprovedEmail(listing.seller_id, listingId)

    revalidatePath('/admin/moderation')
    revalidatePath('/marketplace')

    return {
      success: true,
    }
  } catch (error: any) {
    console.error('Error in approveListing:', error)
    return {
      success: false,
      error: error.message || 'Failed to approve listing',
    }
  }
}

/**
 * Reject listing
 */
export async function rejectListing(
  listingId: string,
  reason: string
): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const supabase = await createClient()

    // Verify admin access
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return {
        success: false,
        error: 'Unauthorized',
      }
    }

    const { data: adminRole } = await supabase
      .from('admin_roles')
      .select('role, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single() as any

    if (!adminRole || ((adminRole as any).role !== 'admin' && (adminRole as any).role !== 'super_admin' && (adminRole as any).role !== 'moderator')) {
      return {
        success: false,
        error: 'Forbidden - Admin access required',
      }
    }

    // Use the database function to reject listing
    const { error: rejectError } = await (supabase.rpc as any)('reject_listing', {
      listing_id: listingId,
      admin_id: user.id,
      reason: reason,
    })

    if (rejectError) {
      return {
        success: false,
        error: rejectError.message,
      }
    }

    // TODO: Send rejection notification email to seller
    // await sendListingRejectedEmail(listing.seller_id, listingId, reason)

    revalidatePath('/admin/moderation')

    return {
      success: true,
    }
  } catch (error: any) {
    console.error('Error in rejectListing:', error)
    return {
      success: false,
      error: error.message || 'Failed to reject listing',
    }
  }
}

/**
 * Request changes to listing
 */
export async function requestListingChanges(
  listingId: string,
  changes: string
): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const supabase = await createClient()

    // Verify admin access
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return {
        success: false,
        error: 'Unauthorized',
      }
    }

    const { data: adminRole } = await supabase
      .from('admin_roles')
      .select('role, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single() as any

    if (!adminRole || ((adminRole as any).role !== 'admin' && (adminRole as any).role !== 'super_admin' && (adminRole as any).role !== 'moderator')) {
      return {
        success: false,
        error: 'Forbidden - Admin access required',
      }
    }

    // Update listing with change request
    const { error: updateError } = await (supabase
      .from('listings')
      .update as any)({
        moderation_notes: changes,
      })
      .eq('id', listingId)

    if (updateError) {
      return {
        success: false,
        error: updateError.message,
      }
    }

    // TODO: Send change request email to seller
    // await sendListingChangesRequestedEmail(listing.seller_id, listingId, changes)

    revalidatePath('/admin/moderation')

    return {
      success: true,
    }
  } catch (error: any) {
    console.error('Error in requestListingChanges:', error)
    return {
      success: false,
      error: error.message || 'Failed to request changes',
    }
  }
}

/**
 * Get moderation stats
 */
export async function getModerationStats(): Promise<{
  success: boolean
  stats?: {
    pending: number
    approved_today: number
    rejected_today: number
    total_approved: number
  }
  error?: string
}> {
  try {
    const supabase = await createClient()

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [
      { count: pending },
      { count: approved_today },
      { count: rejected_today },
      { count: total_approved },
    ] = await Promise.all([
      supabase
        .from('listings')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending_approval'),
      supabase
        .from('listings')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')
        .gte('approved_at', today.toISOString()),
      supabase
        .from('listings')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'rejected')
        .gte('approved_at', today.toISOString()),
      supabase
        .from('listings')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')
        .not('approved_at', 'is', null),
    ])

    return {
      success: true,
      stats: {
        pending: pending || 0,
        approved_today: approved_today || 0,
        rejected_today: rejected_today || 0,
        total_approved: total_approved || 0,
      },
    }
  } catch (error: any) {
    console.error('Error in getModerationStats:', error)
    return {
      success: false,
      error: error.message || 'Failed to get moderation stats',
    }
  }
}
