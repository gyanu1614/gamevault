/**
 * Email preferences: the switches on Settings → Notifications, and the check
 * every optional email makes before it is sent.
 *
 * Stored in `public.email_preferences` (one row per user, service-role only;
 * read and written through src/lib/actions/email-preferences.ts). No row =
 * the defaults below. Only the emails a switch names are optional: receipts,
 * delivery, disputes, refunds and withdrawal requests/approvals/rejections
 * always go out.
 *
 *   new_order         → sendNewOrderNotificationEmail   (payments/notify.ts)
 *   new_message       → sendNewMessageEmail             (actions/message-notify.ts)
 *   new_review        → sendNewReviewEmail              (actions/review-notify.ts)
 *   payout_processed  → sendWithdrawalProcessedEmail, status 'completed' only
 *   marketing         → nothing sent yet; opt-in consent for future campaigns
 */

import { createServiceRoleClient } from '@/lib/supabase/service'

export const EMAIL_PREF_KEYS = ['new_order', 'new_message', 'new_review', 'payout_processed', 'marketing'] as const
export type EmailPrefKey = (typeof EMAIL_PREF_KEYS)[number]
export type EmailPrefs = Record<EmailPrefKey, boolean>

/** Service emails default on; marketing is opt-in (UK PECR / GDPR). */
export const EMAIL_PREF_DEFAULTS: EmailPrefs = {
  new_order: true,
  new_message: true,
  new_review: true,
  payout_processed: true,
  marketing: false,
}

export function isEmailPrefKey(value: unknown): value is EmailPrefKey {
  return typeof value === 'string' && (EMAIL_PREF_KEYS as readonly string[]).includes(value)
}

export function resolveEmailPref(row: Record<string, unknown> | null | undefined, key: EmailPrefKey): boolean {
  const value = row?.[key]
  return typeof value === 'boolean' ? value : EMAIL_PREF_DEFAULTS[key]
}

export function toEmailPrefs(row: Record<string, unknown> | null | undefined): EmailPrefs {
  return Object.fromEntries(EMAIL_PREF_KEYS.map((key) => [key, resolveEmailPref(row, key)])) as EmailPrefs
}

/**
 * May this optional email go to this user? Never throws: when the row can't
 * be read it answers with the default (service emails still go out,
 * marketing does not), so a hiccup here never silently drops an order email.
 */
export async function emailAllowed(userId: string | null | undefined, key: EmailPrefKey): Promise<boolean> {
  if (!userId) return EMAIL_PREF_DEFAULTS[key]
  try {
    const { data, error } = await (createServiceRoleClient() as any)
      .from('email_preferences')
      .select(key)
      .eq('user_id', userId)
      .maybeSingle()
    if (error) return EMAIL_PREF_DEFAULTS[key]
    return resolveEmailPref(data, key)
  } catch {
    return EMAIL_PREF_DEFAULTS[key]
  }
}
