/**
 * P6.4 — Admin INFORM Act Management
 *
 * Server component: loads disclosures and required sellers list.
 */

import { getInformDisclosures, getInformRequiredSellers } from '@/lib/actions/inform-act'
import InformAdminClient from './InformAdminClient'

export const metadata = { title: 'INFORM Act | Admin — GameVault' }

export default async function AdminInformPage() {
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
