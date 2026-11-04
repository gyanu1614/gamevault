/**
 * P5.3 — Admin Promo Code Management
 *
 * Server component shell; delegates interactivity to PromoAdminClient.
 */

import { requireAdmin } from '@/lib/actions/admin-permissions'
import { isActionResponseRender } from '@/lib/admin/action-render'
import { getPromoCodes } from '@/lib/actions/promo'
import PromoAdminClient from './PromoAdminClient'

export const metadata = { title: 'Promo Codes' }

export default async function AdminPromosPage() {
  await requireAdmin()

  if (isActionResponseRender()) return <PromoAdminClient initialCodes={[]} />

  const result = await getPromoCodes()

  return (
    <PromoAdminClient
      initialCodes={result.success ? (result.promoCodes ?? []) : []}
      fetchError={result.success ? undefined : result.error}
    />
  )
}
