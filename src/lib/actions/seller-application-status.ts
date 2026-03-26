/**
 * Seller Application Status Actions
 *
 * Handles:
 * - Checking reapply eligibility
 * - Withdrawing applications
 * - Getting application status with rejection/cooldown info
 */

'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface ApplicationStatusResult {
  status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'withdrawn' | 'none'
  canReapply: boolean
  rejection?: {
    reason: string
    category: string
    rejectedAt: string
    rejectedBy?: string
    rejectionCount: number
    canReapplyAt?: string
    secondsRemaining?: number
    isPermanentBan: boolean
  }
  withdrawal?: {
    withdrawnAt: string
    withdrawalCount: number
  }
  application?: any
}

/**
 * Get current application status for authenticated user
 */
export async function getApplicationStatus(): Promise<{
  success: boolean
  data?: ApplicationStatusResult
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

    // Get latest application
    const { data: application, error: appError } = await supabase
      .from('seller_applications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single() as any

    if (appError && appError.code !== 'PGRST116') {
      throw appError
    }

    if (!application) {
      return {
        success: true,
        data: {
          status: 'none',
          canReapply: true,
        },
      }
    }

    // Check if can reapply using database function
    const { data: reapplyCheck, error: reapplyError } = await (supabase.rpc as any)(
      'can_seller_reapply',
      { user_id_param: user.id }
    )

    if (reapplyError) {
      console.error('Reapply check error:', reapplyError)
    }

    const result: ApplicationStatusResult = {
      status: application.status,
      canReapply: reapplyCheck?.can_reapply ?? true,
      application,
    }

    // Add rejection details if rejected
    if (application.status === 'rejected') {
      const canReapplyAt = application.can_reapply_at
        ? new Date(application.can_reapply_at)
        : null
      const now = new Date()
      const secondsRemaining = canReapplyAt
        ? Math.max(0, Math.floor((canReapplyAt.getTime() - now.getTime()) / 1000))
        : 0

      result.rejection = {
        reason: application.rejection_reason || 'No reason provided',
        category: application.rejection_category || 'other',
        rejectedAt: application.rejected_at,
        rejectionCount: application.rejection_count || 0,
        canReapplyAt: application.can_reapply_at,
        secondsRemaining,
        isPermanentBan: (application.rejection_count || 0) >= 4,
      }
    }

    // Add withdrawal details if withdrawn
    if (application.status === 'withdrawn') {
      result.withdrawal = {
        withdrawnAt: application.withdrawn_at,
        withdrawalCount: application.withdrawal_count || 0,
      }
    }

    return { success: true, data: result }
  } catch (error: any) {
    console.error('Error getting application status:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Withdraw seller application (seller action)
 */
export async function withdrawApplication(): Promise<{
  success: boolean
  data?: { withdrawal_count: number; flagged_for_spam: boolean }
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

    // Get current application
    const { data: application } = await supabase
      .from('seller_applications')
      .select('id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single() as any

    if (!application) {
      return { success: false, error: 'No application found' }
    }

    // Call database function to withdraw
    const { data, error } = await (supabase.rpc as any)('withdraw_seller_application', {
      application_id_param: application.id,
      user_id_param: user.id,
    })

    if (error) throw error

    revalidatePath('/account/application-status')
    revalidatePath('/account/register')

    return {
      success: true,
      data: {
        withdrawal_count: data.withdrawal_count,
        flagged_for_spam: data.flagged_for_spam,
      },
    }
  } catch (error: any) {
    console.error('Error withdrawing application:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Reject seller application (admin action)
 */
export async function rejectApplication(
  applicationId: string,
  reason: string,
  category: string
): Promise<{
  success: boolean
  data?: {
    rejection_count: number
    can_reapply_at: string
    cooldown_days: number
    is_permanent_ban: boolean
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

    // Verify user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single() as any

    if (!profile || !['admin', 'super_admin'].includes((profile as any).role)) {
      return { success: false, error: 'Unauthorized - admin access required' }
    }

    // Call database function to reject
    const { data, error } = await (supabase.rpc as any)('reject_seller_application', {
      application_id_param: applicationId,
      admin_id_param: user.id,
      rejection_reason_param: reason,
      rejection_category_param: category,
    })

    if (error) throw error

    revalidatePath('/admin/sellers')
    revalidatePath('/account/application-status')

    return {
      success: true,
      data: {
        rejection_count: data.rejection_count,
        can_reapply_at: data.can_reapply_at,
        cooldown_days: data.cooldown_days,
        is_permanent_ban: data.is_permanent_ban,
      },
    }
  } catch (error: any) {
    console.error('Error rejecting application:', error)
    return { success: false, error: error.message }
  }
}

