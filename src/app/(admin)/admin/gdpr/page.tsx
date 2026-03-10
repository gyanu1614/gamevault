/**
 * P6.5 — Admin GDPR Request Management
 */

import { getGdprRequests } from '@/lib/actions/gdpr'
import GdprAdminClient from './GdprAdminClient'

export const metadata = { title: 'GDPR Requests | Admin — GameVault' }

export default async function AdminGdprPage() {
  const result = await getGdprRequests('pending')

  return (
    <GdprAdminClient
      initialRequests={result.success ? (result.requests ?? []) : []}
      fetchError={result.success ? undefined : result.error}
    />
  )
}
