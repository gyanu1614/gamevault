import { createClient } from '@/lib/supabase/server'

/**
 * Create a navbar notification for a user
 *
 * @param userId - The user ID to send the notification to
 * @param type - Type of notification (new_order, dispute_opened, etc.)
 * @param title - Notification title
 * @param message - Notification message
 * @param link - Optional link to relevant page
 */
export async function createNotification({
  userId,
  type,
  title,
  message,
  link,
}: {
  userId: string
  type: string
  title: string
  message: string
  link?: string
}) {
  const supabase = await createClient()

  try {
    const { error } = await supabase.from('notifications').insert({
      user_id: userId,
      type,
      title,
      message,
      link,
      is_read: false,
    })

    if (error) {
      console.error('[Notifications] Failed to create:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('[Notifications] Unexpected error:', error)
    return { success: false, error: 'Unexpected error creating notification' }
  }
}

/**
 * Create notifications for both buyer and seller about a dispute
 *
 * @param buyerId - The buyer's user ID
 * @param sellerId - The seller's user ID
 * @param orderId - The order ID
 * @param orderNumber - Optional formatted order number
 */
export async function createDisputeNotifications({
  buyerId,
  sellerId,
  orderId,
  orderNumber,
}: {
  buyerId: string
  sellerId: string
  orderId: string
  orderNumber?: string
}) {
  const orderRef = orderNumber || orderId.slice(0, 8).toUpperCase()

  // Create notification for seller
  await createNotification({
    userId: sellerId,
    type: 'dispute_opened',
    title: 'Dispute Opened',
    message: `A dispute has been opened for order #${orderRef}. Please respond promptly.`,
    link: `/account/orders/${orderId}`,
  })

  // Create notification for buyer
  await createNotification({
    userId: buyerId,
    type: 'dispute_opened',
    title: 'Dispute Submitted',
    message: `Your dispute has been submitted for order #${orderRef}`,
    link: `/account/orders/${orderId}`,
  })
}

/**
 * Get all admin user IDs with a specific permission
 *
 * @param permission - The permission to check for (e.g., 'disputes.view')
 * @returns Array of admin user IDs
 */
export async function getAdminUserIdsWithPermission(permission: string): Promise<string[]> {
  const supabase = await createClient()

  try {
    // Get all roles that have this permission
    const { data: rolesWithPermission } = await supabase
      .from('role_permissions')
      .select('role')
      .eq('permission', permission)

    if (!rolesWithPermission || rolesWithPermission.length === 0) {
      return []
    }

    const roles = rolesWithPermission.map((r) => r.role)

    // Get all active admin users with these roles
    const { data: admins } = await supabase
      .from('admin_roles')
      .select('user_id')
      .in('role', roles)
      .eq('is_active', true)

    return admins?.map((a) => a.user_id) || []
  } catch (error) {
    console.error('[Notifications] Failed to get admin users:', error)
    return []
  }
}

/**
 * Notify all admins with a specific permission
 *
 * @param permission - The permission required to receive this notification
 * @param type - Type of notification
 * @param title - Notification title
 * @param message - Notification message
 * @param link - Optional link to relevant page
 */
export async function notifyAdmins({
  permission,
  type,
  title,
  message,
  link,
}: {
  permission: string
  type: string
  title: string
  message: string
  link?: string
}) {
  const adminIds = await getAdminUserIdsWithPermission(permission)

  if (adminIds.length === 0) {
    console.warn(`[Notifications] No admins found with permission: ${permission}`)
    return
  }

  // Create notifications for all admins in parallel
  await Promise.all(
    adminIds.map((adminId) =>
      createNotification({
        userId: adminId,
        type,
        title,
        message,
        link,
      })
    )
  )

  console.log(`[Notifications] Created ${adminIds.length} admin notifications for: ${type}`)
}
