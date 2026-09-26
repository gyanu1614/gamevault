/**
 * /notifications — server shell.
 *
 * STATE-008 — this route used to be a bare 'use client' page whose ONLY access
 * gate was a useEffect calling router.replace (Pass 0 flagged it as having no
 * server gate). The browser had to download the bundle, hydrate, resolve the
 * session and only then discover it should not be here — and only then start
 * fetching, a guaranteed two-hop cold start behind an auth-shaped spinner.
 *
 * The route is middleware-protected, so the server already knows who the user
 * is when the request arrives. Resolving the session here fixes the gate and
 * the waterfall in one move: anonymous visitors are redirected before any
 * markup ships, and the first page of notifications is fetched server-side and
 * handed to the client island as initial data, so the list paints immediately
 * instead of after a client round-trip.
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import NotificationsClient, { type InitialNotification } from './_NotificationsClient'

export default async function NotificationsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?redirect=${encodeURIComponent('/notifications')}`)
  }

  // Same shape the client query uses, so the island can seed react-query with
  // it and render the list on first paint. Chat messages live under the
  // Messages badge, not this inbox — mirrors the filter in the client query.
  const { data } = await supabase
    .from('notifications')
    .select('id, title, message, type, link, is_read, created_at')
    .eq('user_id', user.id)
    .neq('type', 'new_message')
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <NotificationsClient
      userId={user.id}
      initialNotifications={(data ?? []) as unknown as InitialNotification[]}
    />
  )
}
