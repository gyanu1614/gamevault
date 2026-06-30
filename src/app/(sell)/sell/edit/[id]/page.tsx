/**
 * V19/P11 — Canonical edit-listing entry. Lives under the (sell) route
 * group so it shares the no-sidebar wizard layout with /sell/new.
 *
 * The seller wizard supports both new and edit via the editListingId
 * prop; this route just passes the id through. Old URL
 * /account/listings/[id]/edit redirects here so existing links keep
 * working.
 */

import { fetchSellCategories } from '@/lib/actions/sell-wizard'
import SellWizard from '@/app/(sell)/_components/SellWizard'

export const dynamic = 'force-dynamic'

interface EditListingPageProps {
  params: Promise<{ id: string }>
}

export default async function SellEditPage({ params }: EditListingPageProps) {
  const [{ id }, res] = await Promise.all([
    params,
    fetchSellCategories(),
  ])
  const categories = res.success ? res.data : []
  return <SellWizard initialCategories={categories} editListingId={id} />
}
