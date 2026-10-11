/**
 * /sell/new — server entry. Hands the wizard the category list.
 *
 * `?from=<listingId>` duplicates one of the seller's listings: it is loaded
 * here, on the server (lib/sell/wizard-prefill), and the wizard opens on the
 * filled-in Details step. If it can't be loaded the wizard starts empty and
 * says why.
 */
import SellWizard from '../../_components/SellWizard'
import { fetchSellCategories } from '@/lib/actions/sell-wizard'
import { loadWizardPrefill } from '@/lib/sell/wizard-prefill'

export const dynamic = 'force-dynamic'

export default async function SellNewPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams
  const [categories, prefill] = await Promise.all([fetchSellCategories(), from ? loadWizardPrefill(from) : Promise.resolve(null)])
  return (
    <SellWizard
      initialCategories={categories.success ? categories.data : []}
      prefill={prefill?.success ? prefill.data : null}
      prefillError={prefill && !prefill.success ? prefill.error : null}
    />
  )
}
