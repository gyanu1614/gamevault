'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/actions/admin-permissions'

export type ActionCategory =
  | 'application'
  | 'user'
  | 'seller'
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
  try {
    const admin = await requireAdmin()
    const supabase = await createClient()

    const { error } = await supabase
      .from('admin_activity_log')
      .insert({
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
      })

    if (error) {
      console.error('Failed to log admin activity:', error)
    }

    return { success: !error }
  } catch (error) {
    console.error('Activity log error:', error)
    return { success: false }
  }
}

export async function getActivityLogs(filters?: {
  adminId?: string
  actionCategory?: ActionCategory
  resourceType?: string
  resourceId?: string
  startDate?: string
  endDate?: string
  page?: number
  limit?: number
}) {
  await requireAdmin()
  const supabase = await createClient()

  const page = filters?.page || 1
  const limit = filters?.limit || 50
  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = supabase
    .from('admin_activity_log')
    .select(`
      *,
      admin:admin_id (
        username,
        full_name,
        avatar_url
      )
    `, { count: 'exact' })

  if (filters?.adminId) {
    query = query.eq('admin_id', filters.adminId)
  }

  if (filters?.actionCategory) {
    query = query.eq('action_category', filters.actionCategory)
  }

  if (filters?.resourceType) {
    query = query.eq('resource_type', filters.resourceType)
  }

  if (filters?.resourceId) {
    query = query.eq('resource_id', filters.resourceId)
  }

  if (filters?.startDate) {
    query = query.gte('created_at', filters.startDate)
  }

  if (filters?.endDate) {
    query = query.lte('created_at', filters.endDate)
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    return { success: false, error: error.message }
  }

  return {
    success: true,
    logs: data || [],
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    }
  }
}
