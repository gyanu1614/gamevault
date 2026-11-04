/**
 * P6.2 — Admin Analytics Dashboard
 *
 * Server component: fetches data, passes to AnalyticsClient.
 */

import { getAnalyticsData } from '@/lib/actions/admin-analytics'
import { requireAdmin } from '@/lib/actions/admin-permissions'
import { redirect } from 'next/navigation'
import AnalyticsClient from './AnalyticsClient'

export const metadata = { title: 'Analytics' }

export default async function AdminAnalyticsPage() {
  // Support and moderators don't see this page in the sidebar; send a direct
  // visit back to the dashboard rather than an error.
  const admin = await requireAdmin()
  if (admin.role !== 'admin' && admin.role !== 'super_admin') {
    redirect('/admin')
  }

  const result = await getAnalyticsData()

  return (
    <AnalyticsClient
      data={result.success ? result.data ?? null : null}
      fetchError={result.success ? undefined : result.error}
    />
  )
}
