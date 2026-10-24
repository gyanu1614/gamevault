import type { HowItWorksHighlight } from '@/components/marketplace/HowItWorksBand'
import type { HubCard } from '@/app/(marketplace)/[gameSlug]/_hubModel'

/**
 * The live figure on the How It Works bento's first tile (the house section,
 * HowItWorksBand): the currency's "from" price with its icon (Robux from $X)
 * when the game sells one, else the live offer count. Moved from the old
 * game hub unchanged.
 */
export function howItWorksHighlight({
  spotlight,
  currencyIconUrl,
  gameImageUrl,
  totalOffers,
}: {
  spotlight: HubCard | null
  currencyIconUrl: string | null
  gameImageUrl: string | null
  totalOffers: number
}): HowItWorksHighlight | null {
  if (spotlight?.fromLabel) {
    const icon = currencyIconUrl || (spotlight.icon.startsWith('/icons/categories/') ? null : spotlight.icon)
    // "$0.0052/Robux" → "$0.0052" big, "per Robux" in the small line.
    const [price, per] = spotlight.fromLabel.split('/')
    const offers = `${spotlight.count.toLocaleString('en-US')} ${spotlight.count === 1 ? 'offer' : 'offers'} live now`
    return {
      label: `${spotlight.name} from`,
      value: price,
      note: per ? `per ${per} · ${offers}` : offers,
      iconUrl: icon,
      iconAlt: `${spotlight.name} icon`,
      backdropUrl: gameImageUrl,
    }
  }
  if (totalOffers <= 0) return null
  return {
    label: 'Live Now',
    value: `${totalOffers.toLocaleString('en-US')} ${totalOffers === 1 ? 'Offer' : 'Offers'} Live`,
    note: 'From ID-verified sellers',
    backdropUrl: gameImageUrl,
  }
}
