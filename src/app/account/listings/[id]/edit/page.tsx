/**
 * V14k — Edit listing entry point.
 *
 * Replaces the legacy standalone edit form with the canonical SellWizard
 * running in edit mode. The wizard pre-fills from the existing listing,
 * lands the seller on Step 3 (details / pricing / delivery), and submits
 * via updateListingFromWizard on save.
 *
 * The route shape (/account/listings/<id>/edit) is unchanged so existing
 * "Edit" links from the listings table still work.
 */

import { fetchSellCategories } from '@/lib/actions/sell-wizard'
import SellWizard from '@/app/(sell)/_components/SellWizard'

export const dynamic = 'force-dynamic'

interface EditListingPageProps {
  params: Promise<{ id: string }>
}

export default async function EditListingPage({ params }: EditListingPageProps) {
  const [{ id }, res] = await Promise.all([
    params,
    fetchSellCategories(),
  ])
  const categories = res.success ? res.data : []
  return <SellWizard initialCategories={categories} editListingId={id} />
}
