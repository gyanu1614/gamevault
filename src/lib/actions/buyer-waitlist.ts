'use server'

/**
 * Buyer notify-me capture for the "Buying Opens Soon" gate. Mirrors the
 * early_seller_signups pattern: public (works logged-out), sanitized input,
 * service-role write (table has no public RLS policies), and a duplicate email
 * is treated as "already on the list" rather than an error.
 */

import { headers } from 'next/headers'
import { createServiceRoleClient } from '@/lib/supabase/service'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function clean(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim().slice(0, max)
  return s || null
}

export async function submitBuyerWaitlist(input: {
  email: string
  listingId?: string | null
  gameSlug?: string | null
  source?: string | null
}): Promise<{ success: boolean; alreadyOnList?: boolean; error?: string }> {
  try {
    const email = clean(input.email, 200)?.toLowerCase()
    if (!email || !EMAIL_RE.test(email)) {
      return { success: false, error: 'Enter a valid email address.' }
    }

    const h = await headers()
    const ip =
      h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null
    const userAgent = h.get('user-agent')?.slice(0, 400) || null

    const service = createServiceRoleClient()
    const { error } = await (service.from('buyer_waitlist').insert as any)({
      email,
      listing_id: clean(input.listingId, 60),
      game_slug: clean(input.gameSlug, 80),
      source: clean(input.source, 80),
      ip,
      user_agent: userAgent,
    })

    if (error) {
      if (error.code === '23505') return { success: true, alreadyOnList: true }
      console.error('buyer_waitlist insert failed:', error.message)
      return { success: false, error: 'Something went wrong — please try again.' }
    }
    return { success: true }
  } catch (err) {
    console.error('submitBuyerWaitlist:', err)
    return { success: false, error: 'Something went wrong — please try again.' }
  }
}
