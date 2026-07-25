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
import { requireAdmin } from '@/lib/actions/admin-permissions'

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

export type EarlySellerStatus = 'new' | 'contacted' | 'approved' | 'rejected'

export interface EarlySellerSignup {
  id: string
  username: string
  email: string
  discord: string | null
  sells: string | null
  note: string | null
  status: EarlySellerStatus
  created_at: string
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

// ── Admin ────────────────────────────────────────────────────────────────────

const VALID_STATUSES: EarlySellerStatus[] = ['new', 'contacted', 'approved', 'rejected']

export interface EarlySellerListResult {
  ok: boolean
  signups?: EarlySellerSignup[]
  error?: string
}

/** Admin-only — fetch every waitlist signup, newest first. */
export async function getEarlySellerSignups(): Promise<EarlySellerListResult> {
  try {
    await requireAdmin()
  } catch {
    return { ok: false, error: 'Not authorized.' }
  }

  try {
    const supabase = createServiceRoleClient()
    const { data, error } = await (supabase as any)
      .from('early_seller_signups')
      .select('id, username, email, discord, sells, note, status, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[early-seller] list failed:', error)
      return { ok: false, error: 'Failed to load signups.' }
    }

    return { ok: true, signups: (data ?? []) as EarlySellerSignup[] }
  } catch (err) {
    console.error('[early-seller] list error:', err)
    return { ok: false, error: 'Failed to load signups.' }
  }
}

/** Admin-only — move a signup through the review pipeline. */
export async function updateEarlySellerStatus(
  id: string,
  status: EarlySellerStatus,
): Promise<EarlySellerResult> {
  try {
    await requireAdmin()
  } catch {
    return { ok: false, error: 'Not authorized.' }
  }

  if (!VALID_STATUSES.includes(status)) {
    return { ok: false, error: 'Invalid status.' }
  }

  try {
    const supabase = createServiceRoleClient()
    const { error } = await (supabase as any)
      .from('early_seller_signups')
      .update({ status })
      .eq('id', id)

    if (error) {
      console.error('[early-seller] status update failed:', error)
      return { ok: false, error: 'Failed to update status.' }
    }

    return { ok: true }
  } catch (err) {
    console.error('[early-seller] status update error:', err)
    return { ok: false, error: 'Failed to update status.' }
  }
}
