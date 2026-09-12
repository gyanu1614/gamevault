'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { requireRole } from './admin-permissions'
import { logAdminActivity } from '@/lib/admin/activity-log'
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
    const admin = await requireRole(['admin', 'super_admin'])
    const supabase = await createClient()

    const { userId, status, reason } = params

    // Get seller info for notification
    const { data: seller } = await supabase
      .from('profiles')
      .select('username, shop_name, email, seller_status')
      .eq('id', userId)
      .single() as any

    if (!seller) {
      return { success: false, error: 'Seller not found' }
    }

    // Update seller status. AUTH-005: seller_status / seller_restriction_* are
    // trigger-protected columns; the admin session (already gated by
    // requireRole above) cannot set them through PostgREST, so write via the
    // service role.
    const { error: updateError } = await (createServiceRoleClient()
      .from('profiles')
      .update as any)({
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
      const { error: pauseError } = await (supabase
        .from('listings')
        .update as any)({ status: 'paused' })
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
      } as any)

    if (historyError) {
      console.error('Error tracking restriction history:', historyError)
      // Don't fail the whole operation if history fails
    }

    // Admin activity log (fire-and-forget — logging never fails the action)
    await logAdminActivity({
      action:
        status === 'active'
          ? 'seller_unrestricted'
          : status === 'banned'
            ? 'seller_banned'
            : 'seller_restricted',
      actionCategory: 'seller',
      resourceType: 'profile',
      resourceId: userId,
      resourceName: seller.shop_name || seller.username || undefined,
      previousState: { seller_status: seller.seller_status },
      newState: { seller_status: status },
      notes: reason || undefined,
    }).catch((err) => console.error('Activity log failed:', err))

    // Create notification for seller
    const notificationTitle = status === 'restricted'
      ? 'Your Seller Account Has Been Restricted'
      : status === 'banned'
      ? 'Your Seller Account Has Been Banned'
      : 'Your Seller Account Restriction Has Been Lifted'

    const notificationMessage = status === 'restricted'
      ? `Your seller account has been restricted. You cannot create or publish new listings. Reason: ${reason || 'No reason provided'}. Contact support at support@dropmarket.gg for assistance.`
      : status === 'banned'
      ? `Your seller account has been banned. You no longer have access to seller features. Reason: ${reason || 'No reason provided'}. Contact support at support@dropmarket.gg for assistance.`
      : `Your seller account restriction has been lifted. You can now create and publish listings again.`

    const notificationType = status === 'restricted'
      ? 'seller_restricted'
      : status === 'banned'
      ? 'seller_banned'
      : 'seller_unrestricted'

    // NOTE: the notifications table has NO metadata column — passing one made
    // this insert silently fail, so sellers were never told. Message text
    // carries all the context they need.
    const { error: notifError } = await (supabase
      .from('notifications')
      .insert as any)({
        user_id: userId,
        type: notificationType,
        title: notificationTitle,
        message: notificationMessage,
        link: '/account/restrictions',
        is_read: false,
      })

    if (notifError) {
      console.error('Error creating notification:', notifError)
      // Don't fail the whole operation if notification fails
    }

    // Revalidate relevant paths
    revalidatePath('/admin/sellers')
    revalidatePath(`/admin/sellers/${userId}`)
    revalidatePath('/admin/active-sellers')
    revalidatePath(`/admin/active-sellers/${userId}`)
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
