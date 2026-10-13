'use server'

/**
 * /admin Trustpilot card: this week's invite outcomes and the review-count
 * switch that turns the public TrustBox on at 10+ reviews (no redeploy).
 * Admin-only; reads and writes as the service role after the role check.
 */
import { revalidatePath, revalidateTag } from 'next/cache'

import { requireRole } from '@/lib/actions/admin-permissions'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { TRUSTPILOT_SETTINGS_TAG } from '@/lib/revalidation/tags'
import { readReviewCount } from '@/lib/trustpilot/settings'

const ROLES = ['admin', 'super_admin'] as const
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export interface TrustpilotSummary {
  scheduled: number
  sent: number
  failed: number
  skipped: number
  reviewCount: number
  bccConfigured: boolean
}

export async function getTrustpilotSummary(): Promise<{ ok: true; summary: TrustpilotSummary } | { ok: false; error: string }> {
  await requireRole([...ROLES])
  const db = createServiceRoleClient() as any
  const since = new Date(Date.now() - WEEK_MS).toISOString()
  const [stats, reviewCount] = await Promise.all([db.rpc('trustpilot_invite_stats', { p_since: since }), readReviewCount(db)])
  if (stats.error) return { ok: false, error: 'Couldn’t load invite stats.' }
  const row = (Array.isArray(stats.data) ? stats.data[0] : stats.data) ?? {}
  return {
    ok: true,
    summary: {
      scheduled: Number(row.scheduled ?? 0),
      sent: Number(row.sent ?? 0),
      failed: Number(row.failed ?? 0),
      skipped: Number(row.skipped ?? 0),
      reviewCount,
      bccConfigured: Boolean(process.env.TRUSTPILOT_BCC_EMAIL?.trim()),
    },
  }
}

export async function setTrustpilotReviewCount(value: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await requireRole([...ROLES])
  if (!Number.isInteger(value) || value < 0 || value > 1_000_000) {
    return { ok: false, error: 'Enter a whole number of reviews.' }
  }
  const { error } = await (createServiceRoleClient() as any)
    .from('trustpilot_settings')
    .update({ review_count: value, updated_by: admin.userId, updated_at: new Date().toISOString() })
    .eq('id', 1)
  if (error) return { ok: false, error: 'Couldn’t save the review count. Try again.' }
  // Home, listing pages and /safedrop read the count under this tag.
  revalidateTag(TRUSTPILOT_SETTINGS_TAG)
  revalidatePath('/admin')
  return { ok: true }
}
