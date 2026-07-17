/**
 * Lightweight admin ↔ seller message channel, transported over the existing
 * notifications table (no new tables):
 *   • admin → seller: messageApplicant inserts type 'admin_message' rows
 *     (title from the team, link deep-opens the status-page chat).
 *   • seller → admin: sendMessageToTeam fans out a 'seller_message'
 *     notification to every admin with sellers.review permission AND stores a
 *     self copy (type 'admin_message_sent', pre-read) so the seller's thread
 *     shows both sides.
 * The status page's TeamMessages bubble renders the thread from these rows.
 */

'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { notifyAdmins } from '@/lib/utils/notifications'

export interface TeamThreadMessage {
  id: string
  from: 'team' | 'me'
  body: string
  at: string
  read: boolean
}

/** The seller's message thread with the DropMarket team, oldest first. */
export async function getTeamThread(): Promise<{
  success: boolean
  messages: TeamThreadMessage[]
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, messages: [] }

  const { data } = (await supabase
    .from('notifications')
    .select('id, type, message, created_at, is_read')
    .eq('user_id', user.id)
    .in('type', ['admin_message', 'admin_message_sent'])
    .order('created_at', { ascending: true })
    .limit(100)) as any

  const messages: TeamThreadMessage[] = (data ?? []).map((n: any) => ({
    id: n.id,
    from: n.type === 'admin_message' ? 'team' : 'me',
    body: n.message ?? '',
    at: n.created_at,
    read: !!n.is_read,
  }))
  return { success: true, messages }
}

/** Seller reply — lands in every seller-review admin's bell + self copy. */
export async function sendMessageToTeam(text: string): Promise<{
  success: boolean
  error?: string
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not signed in' }

  const trimmed = text.trim()
  if (!trimmed) return { success: false, error: 'Message is empty' }
  if (trimmed.length > 500) return { success: false, error: 'Keep it under 500 characters' }

  // Route admins to this seller's application when one exists.
  const { data: app } = (await supabase
    .from('seller_applications')
    .select('id')
    .eq('user_id', user.id)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle()) as any

  const { data: profile } = (await supabase
    .from('profiles')
    .select('username, full_name')
    .eq('id', user.id)
    .single()) as any
  const who = profile?.username || profile?.full_name || 'A seller'

  try {
    await notifyAdmins({
      permission: 'sellers.review',
      type: 'seller_message',
      title: `Message From ${who}`,
      message: trimmed,
      link: app?.id ? `/admin/sellers/${app.id}` : '/admin/sellers',
    })

    // Self copy so the seller's thread shows their side (pre-read).
    const service = createServiceRoleClient()
    await (service.from('notifications').insert as any)({
      user_id: user.id,
      type: 'admin_message_sent',
      title: 'You',
      message: trimmed,
      link: '/account/seller-status',
      is_read: true,
    })
    return { success: true }
  } catch (e: any) {
    console.error('[sendMessageToTeam] failed:', e?.message)
    return { success: false, error: 'Could not send — try again in a moment' }
  }
}

/** Mark the team's messages read (called when the chat opens). */
export async function markTeamThreadRead(): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return
  await (supabase.from('notifications').update as any)({ is_read: true })
    .eq('user_id', user.id)
    .eq('type', 'admin_message')
    .eq('is_read', false)
}
