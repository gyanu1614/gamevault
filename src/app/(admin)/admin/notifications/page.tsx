/**
 * V54 — /admin/notifications server wrapper.
 *
 * Resolves the admin user and fetches the default "all" notification
 * list ON THE SERVER (same query shape the client uses) and seeds the
 * client component's react-query caches via initialData. The page ships
 * fully rendered — no client-side spinner pass on refresh — while tab
 * switches, mark-as-read, and the 15s polling refetch work unchanged.
 */

import { createClient } from '@/lib/supabase/server'
import NotificationsPageClient from './_components/NotificationsPageClient'

export const metadata = { title: 'Notifications' }

export default async function AdminNotificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // The admin layout already redirects unauthenticated users; this is a
  // type-safety fallback — render the unseeded client shell.
  if (!user) {
    return <NotificationsPageClient />
  }

  // Same query shape as the client's "all" tab fetch.
  const { data: notifications } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <NotificationsPageClient
      initialUserId={user.id}
      initialNotifications={notifications ?? []}
    />
  )
}
