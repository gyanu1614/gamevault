'use server'

/**
 * Settings → Notifications: read and change the signed-in user's email
 * switches. The table is service-role only (no anon/authenticated grants),
 * so the ONLY way in is these two actions, and each is pinned to the session
 * user's id; the column written is checked against the known switch names.
 */

import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { isEmailPrefKey, toEmailPrefs, type EmailPrefKey, type EmailPrefs } from '@/lib/email/preferences'

type Result<T> = ({ success: true } & T) | { success: false; error: string }

async function sessionUserId(): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

export async function getMyEmailPreferences(): Promise<Result<{ prefs: EmailPrefs }>> {
  const userId = await sessionUserId()
  if (!userId) return { success: false, error: 'Please sign in again.' }
  const { data, error } = await (createServiceRoleClient() as any)
    .from('email_preferences')
    .select('new_order, new_message, new_review, payout_processed, marketing')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) return { success: false, error: 'Couldn’t load your email settings.' }
  return { success: true, prefs: toEmailPrefs(data) }
}

export async function setMyEmailPreference(key: EmailPrefKey, value: boolean): Promise<Result<object>> {
  if (!isEmailPrefKey(key) || typeof value !== 'boolean') {
    return { success: false, error: 'Unknown setting.' }
  }
  const userId = await sessionUserId()
  if (!userId) return { success: false, error: 'Please sign in again.' }

  const { error } = await (createServiceRoleClient() as any)
    .from('email_preferences')
    .upsert({ user_id: userId, [key]: value, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  if (error) return { success: false, error: 'Couldn’t save that setting. Try again.' }
  return { success: true }
}
