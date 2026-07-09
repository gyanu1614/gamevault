/**
 * P6.5 — GDPR Privacy & Data Controls Page
 *
 * Server component: loads user's existing GDPR requests, passes to client.
 */

import { getMyGdprRequests } from '@/lib/actions/gdpr'
import PrivacyClient from './PrivacyClient'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Privacy & Data' }

export default async function PrivacyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const result = await getMyGdprRequests()

  return (
    <PrivacyClient
      requests={result.success ? (result.requests ?? []) : []}
    />
  )
}
