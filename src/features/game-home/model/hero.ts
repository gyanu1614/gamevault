import { formatStatPrice } from '@/lib/seo/page-stats-format'

export interface HeroFactsInput {
  gameName: string
  /** Live offers across the game's categories. */
  offerCount: number
  /** Cheapest live non-currency offer (USD), or null. */
  lowPrice: number | null
  /** Average delivery label from the category stats ("1 hour", "under 1 hour"), or null. */
  avgDelivery: string | null
}

/**
 * The hero's one line of plain facts (owner, 2026-10-23): visible text, not a
 * stat box, so people and answer engines read the same numbers. A part we do
 * not know is left out, never guessed.
 */
export function heroFacts({ gameName, offerCount, lowPrice, avgDelivery }: HeroFactsInput): string | null {
  if (offerCount <= 0) return null
  const offers = `${offerCount.toLocaleString('en-US')} ${gameName} ${offerCount === 1 ? 'offer' : 'offers'}`
  const price = lowPrice != null && lowPrice > 0 ? ` from $${formatStatPrice(lowPrice)}` : ''
  const delivery = avgDelivery
    ? avgDelivery.startsWith('under ')
      ? `, delivered in ${avgDelivery}`
      : `, delivered in about ${avgDelivery}`
    : ''
  return price || delivery ? `${offers}${price}${delivery}.` : `${offers} live now.`
}
