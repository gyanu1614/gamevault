'use server'

/**
 * P6.5 — GDPR Data Request Server Actions
 *
 * Implements:
 *  • Art. 17 — Right to Erasure: user requests account deletion
 *  • Art. 20 — Right to Data Portability: user exports all their data as JSON
 *  • Admin review of pending requests
 *
 * Data export collects: profile, orders, messages, reviews, listings,
 *   loyalty_credits, referral_earnings, promo_code_usages.
 *
 * Deletion: marks request as pending → admin processes → hard delete via
 *   Supabase Auth admin API (cascades to all profile data via FK ON DELETE CASCADE).
 */

import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/actions/admin-permissions'

// ── Types ──────────────────────────────────────────────────────────────────

export interface GdprRequest {
  id:               string
  user_id:          string
  type:             'export' | 'deletion'
  status:           'pending' | 'processing' | 'completed' | 'rejected'
  requested_at:     string
  completed_at:     string | null
  processed_by:     string | null
  rejection_reason: string | null
  export_url:       string | null
  notes:            string | null
  // Joined
  username?:        string | null
  email?:           string | null
}

// ── User: submit request ───────────────────────────────────────────────────

export async function submitGdprRequest(type: 'export' | 'deletion'): Promise<{
  success:   boolean
  requestId?: string
  error?:    string
}> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Prevent duplicate pending requests of same type
    const { count } = await supabase
      .from('gdpr_requests')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('type', type)
      .in('status', ['pending', 'processing'])

    if ((count ?? 0) > 0) {
      return { success: false, error: `A ${type} request is already pending. Please wait for it to be processed.` }
    }

    const { data, error } = await (supabase.from('gdpr_requests') as any).insert({
      user_id: user.id,
      type,
    }).select('id').single()

    if (error) throw new Error(error.message)
    return { success: true, requestId: (data as any)?.id }
  } catch (err: any) {
    console.error('[gdpr] submitGdprRequest error:', err)
    return { success: false, error: err.message }
  }
}

// ── User: export own data ─────────────────────────────────────────────────

/**
 * Collects all user data into a single JSON object.
 * Returns the JSON as a string — the client offers it as a file download.
 */
export async function exportMyData(): Promise<{
  success: boolean
  json?:   string
  error?:  string
}> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const uid = user.id

    // Collect data in parallel
    const [
      { data: profile },
      { data: orders },
      { data: listings },
      { data: messages },
      { data: reviews },
      { data: loyaltyCredits },
      { data: referralEarnings },
      { data: promoUsages },
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', uid).single(),
      supabase.from('orders').select('*').or(`buyer_id.eq.${uid},seller_id.eq.${uid}`),
      supabase.from('listings').select('*').eq('seller_id', uid),
      supabase.from('messages').select('*').eq('sender_id', uid),
      supabase.from('reviews').select('*').or(`buyer_id.eq.${uid},seller_id.eq.${uid}`),
      supabase.from('loyalty_credits').select('*').eq('user_id', uid),
      supabase.from('referral_earnings').select('*').eq('referrer_id', uid),
      supabase.from('promo_code_usages').select('*').eq('user_id', uid),
    ])

    const exportPayload = {
      exported_at:        new Date().toISOString(),
      gdpr_basis:         'Article 20 — Right to Data Portability',
      platform:           'DropMarket',
      user_id:            uid,
      email:              user.email,
      profile:            profile,
      orders:             orders             ?? [],
      listings:           listings           ?? [],
      messages:           messages           ?? [],
      reviews:            reviews            ?? [],
      loyalty_credits:    loyaltyCredits     ?? [],
      referral_earnings:  referralEarnings   ?? [],
      promo_code_usages:  promoUsages        ?? [],
    }

    // Mark a completed export request in the DB (fire-and-forget audit)
    ;(supabase.from('gdpr_requests') as any).insert({
      user_id:      uid,
      type:         'export',
      status:       'completed',
      completed_at: new Date().toISOString(),
      notes:        'Self-service export via account settings.',
    }).then(() => {}).catch(() => {})

    return { success: true, json: JSON.stringify(exportPayload, null, 2) }
  } catch (err: any) {
    console.error('[gdpr] exportMyData error:', err)
    return { success: false, error: err.message }
  }
}

// ── User: get own requests ─────────────────────────────────────────────────

export async function getMyGdprRequests(): Promise<{
  success:   boolean
  requests?: GdprRequest[]
  error?:    string
}> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('gdpr_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('requested_at', { ascending: false })

    if (error) throw new Error(error.message)
    return { success: true, requests: (data as GdprRequest[] | null) ?? [] }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

// ── Admin: list all pending requests ──────────────────────────────────────

export async function getGdprRequests(statusFilter = 'pending'): Promise<{
  success:   boolean
  requests?: GdprRequest[]
  error?:    string
}> {
  try {
    await requireAdmin()
    const supabase = await createClient()

    let query = supabase
      .from('gdpr_requests')
      .select('*')
      .order('requested_at', { ascending: false })
      .limit(200)

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    }

    const { data: rawReqs, error } = await query
    if (error) throw new Error(error.message)

    const reqs = (rawReqs as any[] | null) ?? []
    if (reqs.length === 0) return { success: true, requests: [] }

    const userIds = Array.from(new Set(reqs.map((r: any) => r.user_id)))
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, email')
      .in('id', userIds)

    const pm: Record<string, { username: string | null; email: string | null }> = {}
    for (const p of (profiles as any[] | null) ?? []) pm[p.id] = p

    const enriched: GdprRequest[] = reqs.map((r: any) => ({
      ...r,
      username: pm[r.user_id]?.username ?? null,
      email:    pm[r.user_id]?.email    ?? null,
    }))

    return { success: true, requests: enriched }
  } catch (err: any) {
    console.error('[gdpr] getGdprRequests error:', err)
    return { success: false, error: err.message }
  }
}

// ── Admin: process request ────────────────────────────────────────────────

export async function processGdprRequest(
  requestId:  string,
  action:     'completed' | 'rejected',
  opts?:      { rejectionReason?: string; notes?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin()
    const supabase = await createClient()

    const { data: req } = await supabase
      .from('gdpr_requests')
      .select('user_id, type')
      .eq('id', requestId)
      .single()

    if (!req) throw new Error('Request not found')

    const payload: Record<string, any> = {
      status:       action,
      completed_at: new Date().toISOString(),
    }
    if (opts?.rejectionReason) payload.rejection_reason = opts.rejectionReason
    if (opts?.notes)           payload.notes            = opts.notes

    const { error } = await (supabase.from('gdpr_requests') as any)
      .update(payload)
      .eq('id', requestId)

    if (error) throw new Error(error.message)

    // For deletion requests that are completed, the actual account deletion
    // must be performed by a super-admin via Supabase Auth admin API (service role).
    // We flag it here; the hard delete is a separate manual or automated step.
    if (action === 'completed' && (req as any).type === 'deletion') {
      // Hard-delete the auth user (cascades to profiles and all FK data)
      // This requires the service-role key — the createClient() above uses it.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: authErr } = await (supabase.auth as any).admin.deleteUser(
        (req as any).user_id
      )
      if (authErr) {
        console.error('[gdpr] deleteUser error:', authErr.message)
        // Log the failure but don't re-throw — the status was already updated.
        await (supabase.from('gdpr_requests') as any)
          .update({ notes: `Auth deletion failed: ${authErr.message}` })
          .eq('id', requestId)
      }
    }

    return { success: true }
  } catch (err: any) {
    console.error('[gdpr] processGdprRequest error:', err)
    return { success: false, error: err.message }
  }
}
