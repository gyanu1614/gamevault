import { PUBLISHER_FORBIDS_RMT, type CurrencyGuide as Guide, type OurPrices } from '@/lib/currency-guides'
import { getGameReviewStats, getGuideLinks } from '@/lib/currency-guides/server'
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
  const [reviews, links] = await Promise.all([getGameReviewStats(gameId), getGuideLinks(guide, gameName)])
  return (
    <CurrencyGuide
      guide={guide}
      gameName={gameName}
      ours={ours}
      reviews={reviews}
      links={links}
      iconUrl={iconUrl}
      rmtPublisher={PUBLISHER_FORBIDS_RMT[guide.game] ?? null}
    />
  )
}
