'use server'

/**
 * Founding HQ invite — admin action to send a waitlist applicant their personal
 * magic-link into /founding. Builds the link (signup id + HMAC token via
 * foundingTokenFor), sends the "claim your spot" email, and marks the row
 * `contacted` so the admin table shows who's been reached.
 *
 * Single-send and batch ("everyone still 'new'") variants. Batch is capped and
 * sends sequentially — the founding cohort is small (first 100), so this is a
 * concierge tool, not a bulk-mail engine.
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { requireAdmin } from './admin-permissions'
import { foundingTokenFor } from '@/lib/founding/token'
import { sendFoundingHqInviteEmail } from '@/lib/email'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const BATCH_CAP = 100

export interface InviteResult {
  ok: boolean
  error?: string
  /** For batch sends: how many actually went out. */
  sent?: number
}

/** Build the personal HQ magic-link for a signup. */
function hqUrlFor(id: string, email: string): string {
  const token = foundingTokenFor(id, email)
  const url = new URL('/founding', APP_URL)
  url.searchParams.set('id', id)
  url.searchParams.set('token', token)
  return url.toString()
}

/** Compute a 1-based join number for a signup (oldest = #1). */
async function joinNumberFor(supabase: any, createdAt: string): Promise<number> {
  const { count } = await supabase
    .from('early_seller_signups')
    .select('id', { count: 'exact', head: true })
    .lte('created_at', createdAt)
  return count ?? 1
}

/** Send one applicant their Founding HQ invite and mark them contacted. */
export async function sendFoundingInvite(signupId: string): Promise<InviteResult> {
  try {
    await requireAdmin()
  } catch {
    return { ok: false, error: 'Not authorized.' }
  }

  const supabase = createServiceRoleClient() as any
  const { data: row, error } = await supabase
    .from('early_seller_signups')
    .select('id, username, email, created_at, status')
    .eq('id', signupId)
    .maybeSingle()

  if (error || !row) return { ok: false, error: 'Signup not found.' }

  const joinNumber = await joinNumberFor(supabase, row.created_at)
  const res = await sendFoundingHqInviteEmail({
    to: row.email,
    username: row.username,
    hqUrl: hqUrlFor(row.id, row.email),
    joinNumber,
  })

  if (!res.success) {
    console.error('[founding-invite] send failed:', res.error)
    return { ok: false, error: 'Email failed to send. Check the Resend key.' }
  }

  // Only advance 'new' → 'contacted'; never downgrade an approved/rejected row.
  if (row.status === 'new') {
    await supabase.from('early_seller_signups').update({ status: 'contacted' }).eq('id', row.id)
  }
  return { ok: true, sent: 1 }
}

/** Batch: invite every applicant still in 'new' status (capped). */
export async function sendFoundingInvitesToNew(): Promise<InviteResult> {
  try {
    await requireAdmin()
  } catch {
    return { ok: false, error: 'Not authorized.' }
  }

  const supabase = createServiceRoleClient() as any
  const { data: rows, error } = await supabase
    .from('early_seller_signups')
    .select('id, username, email, created_at')
    .eq('status', 'new')
    .order('created_at', { ascending: true })
    .limit(BATCH_CAP)

  if (error) return { ok: false, error: 'Could not load applicants.' }
  if (!rows?.length) return { ok: true, sent: 0 }

  let sent = 0
  for (const row of rows) {
    const joinNumber = await joinNumberFor(supabase, row.created_at)
    const res = await sendFoundingHqInviteEmail({
      to: row.email,
      username: row.username,
      hqUrl: hqUrlFor(row.id, row.email),
      joinNumber,
    })
    if (res.success) {
      await supabase.from('early_seller_signups').update({ status: 'contacted' }).eq('id', row.id)
      sent += 1
    } else {
      console.error('[founding-invite] batch item failed for', row.email, res.error)
    }
  }

  return { ok: true, sent }
}
