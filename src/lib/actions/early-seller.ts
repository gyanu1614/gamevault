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
import {
  sendEarlySellerWelcomeEmail,
  sendEarlySellerAdminNotificationEmail,
} from '@/lib/email'
import {
  FOUNDING_SPOT_CAP,
  FOUNDING_CLAIMED_REVEAL_THRESHOLD,
  type FoundingProgress,
} from '@/lib/config/founding-seller'

export interface EarlySellerInput {
  username: string
  email: string
  discord?: string
  sells?: string
  note?: string
  /** ?src= funnel attribution (banner, footer, a game's blog sell-guide, …). */
  source?: string
}

export interface EarlySellerResult {
  ok: boolean
  error?: string
  /**
   * Set alongside `ok: false` when the rejection reason is specifically that
   * this address is already registered — so the form can style it as
   * reassurance ("you're already in") rather than a hard failure.
   */
  alreadyOnList?: boolean
}

export type EarlySellerStatus = 'new' | 'contacted' | 'approved' | 'rejected'

export interface EarlySellerSignup {
  id: string
  username: string
  email: string
  discord: string | null
  sells: string | null
  note: string | null
  /** Funnel attribution — which surface the signup came through. */
  source: string | null
  status: EarlySellerStatus
  created_at: string
}

// ── Founding-progress widget ─────────────────────────────────────────────────
// Consts + the FoundingProgress type live in @/lib/config/founding-seller
// (a plain module) — a 'use server' file may only export async functions.

/**
 * Real founding-programme progress for the /early-seller widget. Both numbers
 * come straight from the DB — no seeding, no inflation. Public + unauthenticated
 * (service-role because both tables are RLS-locked to reads). Never throws: on
 * any failure it returns null and the widget simply doesn't render.
 */
export async function getFoundingProgress(): Promise<FoundingProgress | null> {
  try {
    const supabase = createServiceRoleClient()

    // Granted founding sellers = the honest "claimed" number.
    const grantedRes = await (supabase as any)
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('founding_seller', true)

    const granted = grantedRes.count ?? 0

    if (granted >= FOUNDING_CLAIMED_REVEAL_THRESHOLD) {
      const count = Math.min(granted, FOUNDING_SPOT_CAP)
      return {
        mode: 'claimed',
        count,
        cap: FOUNDING_SPOT_CAP,
        percent: Math.min(100, Math.round((count / FOUNDING_SPOT_CAP) * 100)),
      }
    }

    // Early days: show real waitlist momentum instead of a near-zero claimed count.
    const waitlistRes = await (supabase as any)
      .from('early_seller_signups')
      .select('id', { count: 'exact', head: true })

    const waitlist = waitlistRes.count ?? 0
    // Nothing to brag about yet — hide the widget rather than show "0".
    if (waitlist <= 0) return null

    const count = Math.min(waitlist, FOUNDING_SPOT_CAP)
    return {
      mode: 'waitlist',
      count: waitlist,
      cap: FOUNDING_SPOT_CAP,
      percent: Math.min(100, Math.round((count / FOUNDING_SPOT_CAP) * 100)),
    }
  } catch (err) {
    console.error('[early-seller] founding progress failed:', err)
    return null
  }
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
    const row = {
      username,
      email,
      discord: clean(input.discord, 80),
      sells: clean(input.sells, 300),
      note: clean(input.note, 600),
      // Funnel attribution — capped; NULL for direct/untagged visits.
      source: clean(input.source, 120),
      ip,
      user_agent: userAgent,
    }

    // Insert first so a genuine duplicate surfaces as a unique violation
    // (23505) rather than being silently absorbed by an upsert. That's what
    // tells us to report `alreadyOnList` — and it's race-safe: two concurrent
    // submits of the same address can't both win the insert, the loser falls
    // through to the update below.
    const { error: insertError } = await (supabase as any)
      .from('early_seller_signups')
      .insert(row)

    if (!insertError) {
      // Fire both emails, but never let them affect the signup: the row is
      // already committed, so a Resend outage or a bad address must not turn a
      // successful signup into an error. Awaited (not detached) because a
      // serverless invocation can be frozen the moment the action returns,
      // which would silently drop an in-flight request. allSettled so one
      // failing address can't reject the other.
      const results = await Promise.allSettled([
        sendEarlySellerWelcomeEmail({ to: email, username }),
        sendEarlySellerAdminNotificationEmail({
          username,
          email,
          discord: row.discord,
          sells: row.sells,
          note: row.note,
        }),
      ])
      results.forEach((r, i) => {
        const which = i === 0 ? 'welcome' : 'admin-notification'
        if (r.status === 'rejected') {
          console.error(`[early-seller] ${which} email threw:`, r.reason)
        } else if (!r.value.success) {
          console.error(`[early-seller] ${which} email failed:`, r.value.error)
        }
      })

      return { ok: true }
    }

    // 23505 = unique violation on the email index: this address is already on
    // the waitlist. Reject it rather than upserting — one signup per address,
    // and the visitor gets told instead of seeing a second "you're on the
    // list" that implies a fresh entry.
    if (insertError.code === '23505') {
      return {
        ok: false,
        alreadyOnList: true,
        error: 'This email is already on the waitlist — you’re in. No need to sign up again.',
      }
    }

    console.error('[early-seller] insert failed:', insertError)
    return { ok: false, error: 'Something went wrong. Please try again.' }
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
      .select('id, username, email, discord, sells, note, source, status, created_at')
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
