'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createPromoCode(data: {
  code: string
  type: 'percentage' | 'flat'
  value: number
  description: string
  min_order_amount?: number
  max_discount?: number | null
  usage_limit?: number | null
  per_user_limit?: number
  expires_at?: string | null
}) {
  try {
    const supabase = await createClient()

    // Check if user is admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single() as any

    if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
      return { success: false, error: 'Not authorized - admin only' }
    }

    // Create promo code
    const { data: promoCode, error } = await (supabase
      .from('promo_codes')
      .insert as any)({
        ...data,
        created_by: user.id
      })
      .select()
      .single()

    if (error) {
      console.error('[PromoCode] Creation error:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/admin/promo-codes')
    return { success: true, data: promoCode }
  } catch (err: any) {
    console.error('[PromoCode] Unexpected error:', err)
    return { success: false, error: err.message }
  }
}
