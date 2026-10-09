'use server'

/**
 * A buyer reports a listing. The RPC does the checks (signed in, not own
 * listing, one report per buyer per listing, 10 a day) and auto-hides the
 * listing at the third open report; this just translates its answer.
 */
import { createClient } from '@/lib/supabase/server'
import { notifyAdmins } from '@/lib/utils/notifications'
import { REPORT_REASONS, type ReportReason } from '@/lib/listings/report-reasons'

export async function reportListing(input: { listingId: string; reason: ReportReason; details?: string }): Promise<{ success: boolean; error?: string; hidden?: boolean }> {
  if (!(input.reason in REPORT_REASONS)) return { success: false, error: 'Pick a reason.' }
  const details = (input.details ?? '').trim().slice(0, 500)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Sign in to report a listing.' }
  const { data, error } = await (supabase as any).rpc('listing_report_file', { p_listing: input.listingId, p_reason: input.reason, p_details: details || null })
  if (error) return { success: false, error: 'Could not send your report. Try again.' }
  if (!data?.ok) {
    const why: Record<string, string> = {
      own_listing: 'You cannot report your own listing.',
      already_reported: 'You already reported this listing. Thanks.',
      rate_limited: 'Too many reports today. Try again tomorrow.',
      not_found: 'This listing no longer exists.',
    }
    return { success: false, error: why[data?.reason] ?? 'Could not send your report.' }
  }
  try {
    await notifyAdmins({
      permission: 'listings.moderate',
      type: 'listing_reported',
      title: data.hidden ? 'Listing auto-hidden after 3 reports' : 'New listing report',
      message: `${REPORT_REASONS[input.reason]}${details ? `: ${details.slice(0, 120)}` : ''}`,
      link: '/admin/reports',
    })
  } catch {
    /* best effort */
  }
  return { success: true, hidden: Boolean(data.hidden) }
}
