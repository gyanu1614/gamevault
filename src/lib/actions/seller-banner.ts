'use server'

/**
 * sellerListingCount(cap) — how many listings the signed-in seller has, up
 * to `cap` (bounded select, no HEAD count — Kong keep-alive). The seller
 * prompt (src/components/seller/SellerPrompt.tsx) stops showing its lime
 * variant once they have SELLER_PROMPT_LISTING_CAP.
 */
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { SELLER_PROMPT_LISTING_CAP } from '@/lib/seller/seller-prompt'

export async function sellerListingCount(cap = SELLER_PROMPT_LISTING_CAP): Promise<number> {
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
