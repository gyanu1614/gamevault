'use server'

/**
 * One tiny read for the seller banner: does the signed-in seller have any
 * listing yet? The green "create your first listing" banner hides once they
 * do. Session user only; a bounded select (no HEAD count — Kong keep-alive).
 */
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export async function sellerHasListing(): Promise<boolean> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false
    const { data } = await (createServiceRoleClient() as any)
      .from('listings')
      .select('id')
      .eq('seller_id', user.id)
      .limit(1)
    return Array.isArray(data) && data.length > 0
  } catch {
    return false
  }
}
