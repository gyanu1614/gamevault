import { PUBLISHER_FORBIDS_RMT, type CurrencyGuide as Guide, type OurPrices } from '@/lib/currency-guides'
import { getGameCategoriesWithOffers, getRelatedCurrencyPages } from '@/lib/currency-guides/server'
import { CurrencyGuide } from './CurrencyGuide'

/**
 * Server entry for the guide: reads the cached review stats and directory
 * links, then renders CurrencyGuide. The currency pages pass the element into
 * their client component as the `guide` slot, so it renders on the server
 * (static HTML, ISR) and the fact sheets never ship in a client bundle.
 */
export async function CurrencyGuideSection({
  guide,
  gameId,
  gameName,
  ours,
  iconUrl,
}: {
  guide: Guide
  gameId: string | null | undefined
  gameName: string
  ours: OurPrices
  iconUrl?: string | null
}) {
  const [categories, currencyPages] = await Promise.all([
    getGameCategoriesWithOffers(guide.game),
    getRelatedCurrencyPages(guide),
  ])
  return (
    <CurrencyGuide
      guide={guide}
      gameName={gameName}
      ours={ours}
      categories={categories}
      currencyPages={currencyPages}
      rmtPublisher={PUBLISHER_FORBIDS_RMT[guide.game] ?? null}
    />
  )
}
