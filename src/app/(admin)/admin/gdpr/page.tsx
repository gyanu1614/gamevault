/**
 * P6.5 — Admin GDPR Request Management
 */

import { requireAdmin } from '@/lib/actions/admin-permissions'
import { getGdprRequests } from '@/lib/actions/gdpr'
import GdprAdminClient from './GdprAdminClient'

export const metadata = { title: 'GDPR Requests' }

export default async function AdminGdprPage() {
  await requireAdmin()

  const result = await getGdprRequests('pending')

  return (
    <GdprAdminClient
      initialRequests={result.success ? (result.requests ?? []) : []}
      fetchError={result.success ? undefined : result.error}
    />
  )
}
