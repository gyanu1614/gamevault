/**
 * /admin/early-sellers — founding-seller waitlist review.
 *
 * Server wrapper: fetches every early_seller_signups row on the server (via
 * the admin-guarded action) and hands it to the client table for filtering,
 * status changes, and CSV export. Auth is enforced by the (admin) layout.
 */

import { getEarlySellerSignups } from '@/lib/actions/early-seller'
import EarlySellersClient from './_EarlySellersClient'

export const metadata = { title: 'Founding Sellers' }

export default async function AdminEarlySellersPage() {
  const result = await getEarlySellerSignups()

  return (
    <EarlySellersClient
      initialSignups={result.ok ? result.signups ?? [] : []}
      fetchError={result.ok ? undefined : result.error}
    />
  )
}
