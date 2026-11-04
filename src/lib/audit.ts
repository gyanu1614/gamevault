/**
 * Audit Logging Utility
 * Tracks all critical operations for security and debugging
 *
 * AUTH-012: this is server-only LIBRARY code, not a server-action module.
 * With `'use server'` here every export was a directly invokable action that
 * accepted a null session and wrote caller-controlled rows to `audit_logs`
 * under the service role. Now: no directive, a session is required, the
 * action/table shape is validated, and ip/user-agent come from the request.
 */

import 'server-only'

import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export interface AuditLogData {
  action: string
  table_name: string
  record_id?: string
  old_data?: any
  new_data?: any
  request_path?: string
  success?: boolean
  error_message?: string
}

/** lowercase snake_case token, 3–64 chars — every action name in the codebase fits. */
const ACTION_SHAPE = /^[a-z][a-z0-9_]{2,63}$/

/** Tables the app audits. Anything else is a forged/malformed call and is dropped. */
const AUDITED_TABLES = new Set([
  'listings',
  'orders',
  'profiles',
  'seller_applications',
  'reviews',
  'withdrawal_requests',
  'disputes',
  'promo_codes',
  'admin_roles',
])

/** First hop of x-forwarded-for + user-agent, from the live request. Null outside a request. */
async function requestIdentity(): Promise<{ ip: string | null; ua: string | null }> {
  try {
    const h = await headers()
    const fwd = h.get('x-forwarded-for')
    const ip = fwd ? fwd.split(',')[0].trim() : h.get('x-real-ip')
    return { ip: ip || null, ua: h.get('user-agent') }
  } catch {
    return { ip: null, ua: null }
  }
}

/**
 * Log an audit event
 */
export async function logAudit(data: AuditLogData): Promise<void> {
  try {
    if (!ACTION_SHAPE.test(data.action) || !AUDITED_TABLES.has(data.table_name)) {
      console.warn('[audit] dropped malformed audit event', { action: data.action, table_name: data.table_name })
      return
    }

    const supabase = await createClient()

    // A session is required — anonymous callers cannot write the audit trail.
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    // Get user profile for additional context
    let userEmail: string | null = null
    let userRole: string | null = null

    const { data: profile } = await supabase
      .from('profiles')
      .select('email, role')
      .eq('id', user.id)
      .single() as any

    if (profile) {
      userEmail = profile.email
      userRole = profile.role
    }

    const { ip, ua } = await requestIdentity()

    // Insert via service role: audit_logs has hardened RLS in some
    // environments (authenticated INSERT blocked), which made these
    // writes silently no-op through the cookie client. The acting user
    // is still captured from the session above.
    const service = createServiceRoleClient()
    await (service.from('audit_logs').insert as any)({
      user_id: user.id,
      user_email: userEmail,
      user_role: userRole,
      action: data.action,
      table_name: data.table_name,
      record_id: data.record_id || null,
      old_data: data.old_data || null,
      new_data: data.new_data || null,
      ip_address: ip,
      user_agent: ua,
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
