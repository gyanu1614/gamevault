/**
 * /admin/fees — fee configuration.
 *
 * Category base fees, per-game overrides, rank fee multipliers, and the
 * change audit log. All writes go through src/lib/actions/admin-fees.ts
 * (guardrails + audit + cache invalidation); order fees are snapshotted at
 * purchase, so nothing here is retroactive.
 */

import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/actions/admin-permissions'
import { getFeeAdminData } from '@/lib/actions/admin-fees'
import FeesPageClient from './_components/FeesPageClient'

export const metadata: Metadata = { title: 'Fees · Admin' }

export const dynamic = 'force-dynamic'

export default async function AdminFeesPage() {
  await requireAdmin()
  const data = await getFeeAdminData()
  return <FeesPageClient initialData={data} />
}
