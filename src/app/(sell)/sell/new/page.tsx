/**
 * /sell/new — server entry. Hands the wizard the category list.
 *
 * `?from=<listingId>` duplicates one of the seller's listings: it is loaded
 * here, on the server (lib/sell/wizard-prefill), and the wizard opens on the
 * filled-in Details step. If it can't be loaded the wizard starts empty and
 * says why.
 *
 * `?game=<slug>&category=<slug>` (the buy rails' "Sell" for sellers) opens
 * the wizard on that game's offer details instead; a game or category that
 * isn't on offer just starts it empty.
 */
import SellWizard from '../../_components/SellWizard'
import { fetchSellCategories, fetchSellGamesForCategory } from '@/lib/actions/sell-wizard'
import { loadWizardPrefill } from '@/lib/sell/wizard-prefill'
import { pickWizardStart, readWizardStartParams, type WizardStart } from '@/lib/sell/wizard-start'

export const dynamic = 'force-dynamic'

export default async function SellNewPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; game?: string; category?: string }>
}) {
  const q = await searchParams
  const { from } = q
  const want = from ? null : readWizardStartParams(q)
  const [categories, prefill, games] = await Promise.all([
    fetchSellCategories(),
    from ? loadWizardPrefill(from) : Promise.resolve(null),
    want ? fetchSellGamesForCategory(want.categorySlug) : Promise.resolve(null),
  ])
  const initialCategories = categories.success ? categories.data : []
  const start: WizardStart | null =
    want && games?.success ? pickWizardStart(want, initialCategories.map((c) => c.slug), games.data) : null
  return (
    <SellWizard
      initialCategories={initialCategories}
      prefill={prefill?.success ? prefill.data : null}
      prefillError={prefill && !prefill.success ? prefill.error : null}
      start={start}
    />
  )
}
