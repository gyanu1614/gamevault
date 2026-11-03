/**
 * Staff activity log. Server-only library code, not a server-action module: with
 * 'use server' here any staff member could post forged rows straight to it (the
 * same hole AUTH-012 closed in lib/audit.ts).
 */
import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/actions/admin-permissions'

export type ActionCategory =
  | 'application'
  | 'user'
  | 'seller'
  | 'moderation'
  | 'dispute'
  | 'team'
  | 'system'

export interface LogActivityParams {
  action: string
  actionCategory: ActionCategory
  resourceType: string
  resourceId?: string
  resourceName?: string
  previousState?: Record<string, any>
  newState?: Record<string, any>
  notes?: string
  metadata?: Record<string, any>
}

export async function logAdminActivity(params: LogActivityParams) {
  return logAdminActivities([params])
}

/** Several rows in one insert, for one staff decision that covers several things. */
export async function logAdminActivities(entries: LogActivityParams[]) {
  try {
    const admin = await requireAdmin()
    const supabase = await createClient()

    const { error } = await (supabase
      .from('admin_activity_log')
      .insert as any)(
        entries.map((params) => ({
          admin_id: admin.userId,
          action: params.action,
          action_category: params.actionCategory,
          resource_type: params.resourceType,
          resource_id: params.resourceId,
          resource_name: params.resourceName,
          previous_state: params.previousState,
          new_state: params.newState,
          notes: params.notes,
          metadata: params.metadata || {},
        })),
      )

    if (error) {
      console.error('Failed to log admin activity:', error)
    }

    return { success: !error }
  } catch (error) {
    console.error('Activity log error:', error)
    return { success: false }
  }
}
