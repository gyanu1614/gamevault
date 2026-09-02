/**
 * /admin/seller-leads — the concierge outreach CRM.
 *
 * OUTBOUND counterpart to /admin/early-sellers (which is the inbound waitlist).
 * This is where you log sellers you found on EpicNPC / Sythe / G2G / Eldorado /
 * Discord and track them through the outreach pipeline. Auth enforced by the
 * (admin) layout; data via the admin-guarded action.
 */

import { getSellerLeads } from '@/lib/actions/seller-leads'
import SellerLeadsClient from './_SellerLeadsClient'

export const metadata = { title: 'Seller Leads' }

export default async function AdminSellerLeadsPage() {
  const result = await getSellerLeads()

  return (
    <SellerLeadsClient
      initialLeads={result.ok ? result.leads : []}
      fetchError={result.ok ? undefined : result.error}
    />
  )
}
