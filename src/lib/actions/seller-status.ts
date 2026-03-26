'use server'

import { createClient } from '@/lib/supabase/server'

/**
 * Check if the current user has an approved seller application
 */
export async function isApprovedSeller(): Promise<boolean> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return false

    const { data } = await supabase
      .from('seller_applications')
      .select('status')
      .eq('user_id', user.id)
      .eq('status', 'approved')
      .single() as any

    return !!data
  } catch (error) {
    console.error('Error checking seller status:', error)
    return false
  }
}

/**
 * Get seller application status for the current user
 */
export async function getSellerApplicationStatus(): Promise<{
  hasApplication: boolean
  status: 'pending' | 'under_review' | 'approved' | 'rejected' | null
  applicationId: string | null
}> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { hasApplication: false, status: null, applicationId: null }
    }

    const { data } = await supabase
      .from('seller_applications')
      .select('id, status')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single() as any

    if (!data) {
      return { hasApplication: false, status: null, applicationId: null }
    }

    return {
      hasApplication: true,
      status: data.status as any,
      applicationId: data.id
    }
  } catch (error) {
    return { hasApplication: false, status: null, applicationId: null }
  }
}
