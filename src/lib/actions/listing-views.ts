'use server'

import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { checkRateLimit, clientIp } from '@/lib/security/rate-limit'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type IncrementRpc = (
  fn: 'increment_listing_views',
  args: { listing_uuid: string },
) => PromiseLike<{ error: { message: string } | null }>

/**
 * Count one view of a listing page (ViewTracker calls this once the page is
 * open in a browser, so crawlers and prefetches don't count).
 *
 * Visitors cannot write `listings` (UPDATE is revoked from JWT callers), so
 * the count goes through the service-role-only `increment_listing_views`,
 * which bumps both `views` and `view_count` for an active listing (migration
 * 20261001181007). One count per visitor (IP) per listing per 6 hours, and a
 * seller opening their own listing is not a view.
 */
export async function trackListingView(listingId: string): Promise<{
  success: boolean
  counted?: boolean
  error?: string
}> {
  if (!UUID.test(listingId)) return { success: false, error: 'Invalid listing' }

  try {
    const admin = createServiceRoleClient()

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      const { data: row } = await admin.from('listings').select('seller_id').eq('id', listingId).maybeSingle()
      if ((row as { seller_id?: string } | null)?.seller_id === user.id) return { success: true, counted: false }
    }

    const seen = await checkRateLimit('listingView', `${listingId}:ip:${clientIp(headers())}`)
    if (seen.limited) return { success: true, counted: false }

    const { error } = await (admin.rpc as unknown as IncrementRpc)('increment_listing_views', {
      listing_uuid: listingId,
    })
    if (error) return { success: false, error: error.message }
    return { success: true, counted: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'View not recorded' }
  }
}

