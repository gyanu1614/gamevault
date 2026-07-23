'use server'

/**
 * Early-seller waitlist submission (beta "first 100 sellers" campaign).
 *
 * Public + unauthenticated: anyone landing from the beta banner CTA can
 * register interest. Writes through the service-role client because the
 * `early_seller_signups` table is RLS-locked with no anon policies (see
 * migration 20260724). Repeat submits from the same email upsert the row
 * rather than erroring, so someone can fix a typo without a duplicate.
 */

import { headers } from 'next/headers'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export interface EarlySellerInput {
  username: string
  email: string
  discord?: string
  sells?: string
  note?: string
}

export interface EarlySellerResult {
  ok: boolean
  error?: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function clean(v: string | undefined, max: number): string | null {
  const t = (v ?? '').trim()
  if (!t) return null
  return t.slice(0, max)
}

export async function submitEarlySeller(
  input: EarlySellerInput,
): Promise<EarlySellerResult> {
  const username = clean(input.username, 60)
  const email = clean(input.email, 160)?.toLowerCase() ?? null

  if (!username) return { ok: false, error: 'Please enter a username.' }
  if (!email || !EMAIL_RE.test(email)) {
    return { ok: false, error: 'Please enter a valid email address.' }
  }

  // Light request context for abuse review — never shown publicly.
  let ip: string | null = null
  let userAgent: string | null = null
  try {
    const h = headers()
    ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
    userAgent = h.get('user-agent')?.slice(0, 300) ?? null
  } catch {
    // headers() unavailable in some contexts — non-fatal.
  }

  try {
    const supabase = createServiceRoleClient()
    const { error } = await (supabase as any)
      .from('early_seller_signups')
      .upsert(
        {
          username,
          email,
          discord: clean(input.discord, 80),
          sells: clean(input.sells, 300),
          note: clean(input.note, 600),
          ip,
          user_agent: userAgent,
        },
        { onConflict: 'email', ignoreDuplicates: false },
      )

    if (error) {
      console.error('[early-seller] insert failed:', error)
      return { ok: false, error: 'Something went wrong. Please try again.' }
    }

    return { ok: true }
  } catch (err) {
    console.error('[early-seller] unexpected error:', err)
    return { ok: false, error: 'Something went wrong. Please try again.' }
  }
}
