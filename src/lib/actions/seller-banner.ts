'use server'

/**
 * The seller banner's two tiny server calls.
 *
 *   sellerListingCount(cap) — how many listings the signed-in seller has, up
 *   to `cap` (bounded select, no HEAD count — Kong keep-alive). The green
 *   "create your first listing" banner hides once they have three.
 *
 *   dismissSellerBanner() — the seller closed the banner: remember it on the
 *   account (auth user_metadata), so it stays gone on every device. No
 *   migration; the browser reads it back from the session's user object.
 */
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { SELLER_BANNER_DISMISSED_KEY, SELLER_BANNER_LISTING_CAP } from '@/lib/seller/banner-dismiss'

export async function sellerListingCount(cap = SELLER_BANNER_LISTING_CAP): Promise<number> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 0
    const { data } = await (createServiceRoleClient() as any)
      .from('listings')
      .select('id')
      .eq('seller_id', user.id)
      .limit(Math.max(1, Math.min(cap, 10)))
    return Array.isArray(data) ? data.length : 0
  } catch {
    return 0
  }
}

export async function dismissSellerBanner(): Promise<{ success: boolean }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false }
    const svc = createServiceRoleClient() as any
    const { error } = await svc.auth.admin.updateUserById(user.id, {
      user_metadata: { ...(user.user_metadata ?? {}), [SELLER_BANNER_DISMISSED_KEY]: new Date().toISOString() },
    })
    return { success: !error }
  } catch {
    return { success: false }
  }
}
