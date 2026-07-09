/**
 * P6.4 — INFORM Consumers Act Seller Disclosure Page
 *
 * Server component: checks seller's inform_status and passes data to client.
 */

import { getMyInformStatus } from '@/lib/actions/inform-act'

// Display-only thresholds (match defaults in inform-act.ts)
const INFORM_SALES_THRESHOLD   = parseInt(process.env.INFORM_SALES_THRESHOLD   || '200')
const INFORM_REVENUE_THRESHOLD = parseFloat(process.env.INFORM_REVENUE_THRESHOLD || '5000')
import InformDisclosureClient from './InformDisclosureClient'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'INFORM Act Disclosure' }

export default async function InformDisclosurePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const result = await getMyInformStatus()

  return (
    <InformDisclosureClient
      status={result.status ?? 'not_required'}
      disclosure={result.disclosure ?? null}
      required={result.required ?? false}
      salesThreshold={INFORM_SALES_THRESHOLD}
      revenueThreshold={INFORM_REVENUE_THRESHOLD}
    />
  )
}
