/**
 * P6.2 — Admin Analytics Dashboard
 *
 * Server component: fetches data, passes to AnalyticsClient.
 */

import { getAnalyticsData } from '@/lib/actions/admin-analytics'
import { getAdminUser } from '@/lib/actions/admin-permissions'
import { redirect } from 'next/navigation'
import AnalyticsClient from './AnalyticsClient'

export const metadata = { title: 'Analytics | Admin — GameVault' }

export default async function AdminAnalyticsPage() {
  // Pre-check admin status without redirect
  const admin = await getAdminUser()

  if (!admin || !admin.isActive) {
    redirect('/')
  }

  // Fetch analytics data
  const result = await getAnalyticsData()

  return (
    <AnalyticsClient
      data={result.success ? result.data ?? null : null}
      fetchError={result.success ? undefined : result.error}
    />
  )
}
