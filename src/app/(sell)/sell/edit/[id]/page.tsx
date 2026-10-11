/**
 * /sell/edit/[id] — the canonical edit entry (the old /account/listings/[id]/edit
 * redirects here). It shares the no-sidebar wizard layout with /sell/new.
 *
 * The listing and everything its Details step needs load here, on the server,
 * in two parallel waves (lib/sell/wizard-prefill), so the wizard opens on the
 * filled-in Details step at once. A listing that is missing or not the
 * seller's is a 404.
 */
import { notFound } from 'next/navigation'

import SellWizard from '@/app/(sell)/_components/SellWizard'
import { fetchSellCategories } from '@/lib/actions/sell-wizard'
import { loadWizardPrefill } from '@/lib/sell/wizard-prefill'

export const dynamic = 'force-dynamic'

interface EditListingPageProps {
  params: Promise<{ id: string }>
}

export default async function SellEditPage({ params }: EditListingPageProps) {
  const { id } = await params
  const [categories, prefill] = await Promise.all([fetchSellCategories(), loadWizardPrefill(id)])
  if (!prefill.success) notFound()
  return <SellWizard initialCategories={categories.success ? categories.data : []} editListingId={id} prefill={prefill.data} />
}
