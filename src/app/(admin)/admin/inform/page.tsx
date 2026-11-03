/**
 * P6.4 — Admin INFORM Act Management
 *
 * Server component: loads disclosures and required sellers list.
 */

import { requireAdmin } from '@/lib/actions/admin-permissions'
import { getInformDisclosures, getInformRequiredSellers } from '@/lib/actions/inform-act'
import InformAdminClient from './InformAdminClient'

export const metadata = { title: 'INFORM Act' }

export default async function AdminInformPage() {
  await requireAdmin()

  const [discsResult, requiredResult] = await Promise.all([
    getInformDisclosures('submitted'),
    getInformRequiredSellers(),
  ])

  return (
    <InformAdminClient
      initialDisclosures={discsResult.success ? (discsResult.disclosures ?? []) : []}
      requiredSellers={requiredResult.success ? (requiredResult.sellers ?? []) : []}
      fetchError={discsResult.success ? undefined : discsResult.error}
    />
  )
}
