/**
 * P5.3 — Admin Promo Code Management
 *
 * Server component shell; delegates interactivity to PromoAdminClient.
 */

import { getPromoCodes } from '@/lib/actions/promo'
import PromoAdminClient from './PromoAdminClient'

export const metadata = { title: 'Promo Codes' }

export default async function AdminPromosPage() {
  const result = await getPromoCodes()

  return (
    <PromoAdminClient
      initialCodes={result.success ? (result.promoCodes ?? []) : []}
      fetchError={result.success ? undefined : result.error}
    />
  )
}
