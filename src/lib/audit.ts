/**
 * Audit Logging Utility
 * Tracks all critical operations for security and debugging
 */

'use server'

import { createClient } from '@/lib/supabase/server'

export interface AuditLogData {
  action: string
  table_name: string
  record_id?: string
  old_data?: any
  new_data?: any
  ip_address?: string
  user_agent?: string
  request_path?: string
  success?: boolean
  error_message?: string
}

/**
 * Log an audit event
 */
export async function logAudit(data: AuditLogData): Promise<void> {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Get user profile for additional context
    let userEmail: string | null = null
    let userRole: string | null = null

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, role')
        .eq('id', user.id)
        .single()

      if (profile) {
        userEmail = profile.email
        userRole = profile.role
      }
    }

    // Insert audit log
    await supabase.from('audit_logs').insert({
      user_id: user?.id || null,
      user_email: userEmail,
      user_role: userRole,
      action: data.action,
      table_name: data.table_name,
      record_id: data.record_id || null,
      old_data: data.old_data || null,
      new_data: data.new_data || null,
      ip_address: data.ip_address || null,
      user_agent: data.user_agent || null,
      request_path: data.request_path || null,
      success: data.success !== undefined ? data.success : true,
      error_message: data.error_message || null,
    })
  } catch (error) {
    // Don't throw - audit logging failures shouldn't break the app
    console.error('Failed to log audit event:', error)
  }
}

/**
 * Log a listing action
 */
export async function logListingAction(
  action: 'created' | 'updated' | 'deleted' | 'published' | 'paused' | 'resumed',
  listingId: string,
  oldData?: any,
  newData?: any
): Promise<void> {
  await logAudit({
    action: `listing_${action}`,
    table_name: 'listings',
    record_id: listingId,
    old_data: oldData,
    new_data: newData,
  })
}

/**
 * Log an order action
 */
export async function logOrderAction(
  action: 'created' | 'paid' | 'delivered' | 'completed' | 'refunded' | 'disputed' | 'cancelled',
  orderId: string,
  oldData?: any,
  newData?: any
): Promise<void> {
  await logAudit({
    action: `order_${action}`,
    table_name: 'orders',
    record_id: orderId,
    old_data: oldData,
    new_data: newData,
  })
}

/**
 * Log a price change
 */
export async function logPriceChange(
  listingId: string,
  oldPrice: number,
  newPrice: number
): Promise<void> {
  await logAudit({
    action: 'price_updated',
    table_name: 'listings',
    record_id: listingId,
    old_data: { price: oldPrice },
    new_data: { price: newPrice },
  })
}

/**
 * Log a failed operation
 */
export async function logFailure(
  action: string,
  tableName: string,
  error: string,
  recordId?: string
): Promise<void> {
  await logAudit({
    action,
    table_name: tableName,
    record_id: recordId,
    success: false,
    error_message: error,
  })
}

/**
 * Log an unauthorized access attempt
 */
export async function logUnauthorizedAccess(
  action: string,
  tableName: string,
  recordId?: string
): Promise<void> {
  await logAudit({
    action: 'unauthorized_access',
    table_name: tableName,
    record_id: recordId,
    success: false,
    error_message: `Unauthorized attempt to ${action} on ${tableName}`,
  })
}

/**
 * Log admin action
 */
export async function logAdminAction(
  action: string,
  tableName: string,
  recordId?: string,
  details?: any
): Promise<void> {
  await logAudit({
    action: `admin_${action}`,
    table_name: tableName,
    record_id: recordId,
    new_data: details,
  })
}

/**
 * Get recent audit logs (admin only)
 */
export async function getRecentAuditLogs(
  limit: number = 100,
  filters?: {
    action?: string
    table_name?: string
    user_id?: string
    success?: boolean
  }
): Promise<{ success: boolean; logs?: any[]; error?: string }> {
  try {
    const supabase = await createClient()

    // Check if user is admin
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data: adminRole } = await supabase
      .from('admin_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (!adminRole) {
      return { success: false, error: 'Not authorized' }
    }

    // Build query
    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (filters?.action) {
      query = query.eq('action', filters.action)
    }

    if (filters?.table_name) {
      query = query.eq('table_name', filters.table_name)
    }

    if (filters?.user_id) {
      query = query.eq('user_id', filters.user_id)
    }

    if (filters?.success !== undefined) {
      query = query.eq('success', filters.success)
    }

    const { data, error } = await query

    if (error) throw error

    return { success: true, logs: data }
  } catch (error: any) {
    console.error('Error fetching audit logs:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get security events from last 24 hours (admin only)
 */
export async function getRecentSecurityEvents(): Promise<{
  success: boolean
  events?: any[]
  error?: string
}> {
  try {
    const supabase = await createClient()

    // Check if user is admin
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data: adminRole } = await supabase
      .from('admin_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (!adminRole) {
      return { success: false, error: 'Not authorized' }
    }

    const { data, error } = await supabase
      .from('recent_security_events')
      .select('*')
      .limit(100)

    if (error) throw error

    return { success: true, events: data }
  } catch (error: any) {
    console.error('Error fetching security events:', error)
    return { success: false, error: error.message }
  }
}
