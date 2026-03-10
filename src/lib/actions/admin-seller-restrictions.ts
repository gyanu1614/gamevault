'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from './admin-permissions'
import { revalidatePath } from 'next/cache'

export interface RestrictSellerParams {
  userId: string
  status: 'restricted' | 'banned' | 'active'
  reason?: string
}

/**
 * Restrict or ban a seller
 */
export async function restrictSeller(params: RestrictSellerParams): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = await requireAdmin()
    const supabase = await createClient()

    const { userId, status, reason } = params

    // Get seller info for notification
    const { data: seller } = await supabase
      .from('profiles')
      .select('username, email, seller_status')
      .eq('id', userId)
      .single()

    if (!seller) {
      return { success: false, error: 'Seller not found' }
    }

    // Update seller status
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        seller_status: status,
        seller_restriction_reason: reason || null,
        seller_restricted_at: status !== 'active' ? new Date().toISOString() : null,
        seller_restricted_by: status !== 'active' ? admin.userId : null,
      })
      .eq('id', userId)

    if (updateError) {
      console.error('Error restricting seller:', updateError)
      return { success: false, error: 'Failed to update seller status' }
    }

    // If restricting or banning, pause all active listings
    if (status !== 'active') {
      const { error: pauseError } = await supabase
        .from('listings')
        .update({ status: 'paused' })
        .eq('seller_id', userId)
        .in('status', ['active', 'pending_approval'])

      if (pauseError) {
        console.error('Error pausing listings:', pauseError)
        // Don't fail the whole operation if pausing fails
      }
    }

    // Track restriction history
    const { error: historyError } = await supabase
      .from('seller_restrictions')
      .insert({
        seller_id: userId,
        restricted_by: admin.userId,
        restriction_type: status === 'active' ? 'unrestricted' : status,
        reason: reason || null,
        metadata: {
          previous_status: seller.seller_status,
          admin_email: admin.email,
        }
      })

    if (historyError) {
      console.error('Error tracking restriction history:', historyError)
      // Don't fail the whole operation if history fails
    }

    // Create notification for seller
    const notificationTitle = status === 'restricted'
      ? 'Your Seller Account Has Been Restricted'
      : status === 'banned'
      ? 'Your Seller Account Has Been Banned'
      : 'Your Seller Account Restriction Has Been Lifted'

    const notificationMessage = status === 'restricted'
      ? `Your seller account has been restricted. You cannot create or publish new listings. Reason: ${reason || 'No reason provided'}. Contact support at test@gmail.com for assistance.`
      : status === 'banned'
      ? `Your seller account has been banned. You no longer have access to seller features. Reason: ${reason || 'No reason provided'}. Contact support at test@gmail.com for assistance.`
      : `Your seller account restriction has been lifted. You can now create and publish listings again.`

    const notificationType = status === 'restricted'
      ? 'seller_restricted'
      : status === 'banned'
      ? 'seller_banned'
      : 'seller_unrestricted'

    const { error: notifError } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type: notificationType,
        title: notificationTitle,
        message: notificationMessage,
        link: '/account/restrictions',
        metadata: {
          restriction_type: status,
          reason: reason,
          restricted_by: admin.userId,
          restricted_at: new Date().toISOString(),
        }
      })

    if (notifError) {
      console.error('Error creating notification:', notifError)
      // Don't fail the whole operation if notification fails
    }

    // Revalidate relevant paths
    revalidatePath('/admin/sellers')
    revalidatePath(`/admin/sellers/${userId}`)
    revalidatePath('/seller/dashboard')
    revalidatePath('/seller/listings')

    return { success: true }
  } catch (error: any) {
    console.error('Error in restrictSeller:', error)
    return { success: false, error: error.message || 'Failed to restrict seller' }
  }
}

/**
 * Unrestrict a seller (set back to active)
 */
export async function unrestrictSeller(userId: string): Promise<{ success: boolean; error?: string }> {
  return restrictSeller({ userId, status: 'active' })
}
