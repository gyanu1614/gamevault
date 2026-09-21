'use server'

import { createClient } from '@/lib/supabase/server'
import { rateLimitAction } from '@/lib/security/rate-limit'
import { revalidateListingSurfaces } from '@/lib/revalidation/listings'

/**
 * Revalidate the category pages the CALLER has listings in (Step 7b).
 *
 * For browser-side listing writers (lib/api/seller-compatible writes under
 * RLS from account pages) that cannot call revalidateTag themselves. Takes no
 * ids from the client: a revalidation re-renders pages, which is CPU a client
 * could otherwise spend on anyone's categories. Session required; resolved
 * from the caller's own rows; rate-limited (`revalidate` budget).
 */
export async function revalidateMyListingSurfaces(): Promise<
  { ok: true; tags: string[] } | { ok: false; error: string }
> {
  const limited = await rateLimitAction('revalidate')
  if (limited) return { ok: false, error: limited.error }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  const { tags } = await revalidateListingSurfaces(supabase as never, { sellerIds: [user.id] })
  return { ok: true, tags: tags.sort() }
}
