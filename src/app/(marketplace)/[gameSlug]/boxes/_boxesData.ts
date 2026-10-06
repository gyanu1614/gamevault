import { cache } from 'react'
import { getGameContentTheme, hasHubPage } from '@/lib/content/theme'
import { getValueItems } from '@/lib/values/data'
import { getValueEventNames } from '@/lib/values/events'
import { valueItemHasPage, valueListHub } from '@/lib/values/hub-config'
import { sharedWeaponBoxOdds } from '@/lib/values/shop-boxes'
import { MM2_ECONOMY } from '@/lib/values/free-guide'
import { allBoxes, boxView, mysteryKeyDiamonds, type BoxView, type PricedItem } from '@/lib/values/boxes'
import type { CopyCtx, ShopOdds } from './_boxesCopy'

/**
 * The Box Odds pages' data: the researched box seed (build time) joined to
 * live prices and art through the tagged values reads (`values:<game>`,
 * `price:<game>` — the values-revalidate route refreshes them after every
 * pricing run) and the published events (for the retired boxes' event links).
 */

export function boxesCopyCtx(gameSlug: string): CopyCtx {
  const theme = getGameContentTheme(gameSlug)
  return { gameName: theme.name, shortName: valueListHub(gameSlug)?.shortName ?? theme.initials }
}

/**
 * The figures every current Shop weapon box shares, plus the coin economy.
 * Null → the routes 404: without them the pages have nothing true to say.
 */
export function shopOddsFor(gameSlug: string): ShopOdds | null {
  const odds = sharedWeaponBoxOdds(gameSlug)
  const earn = valueListHub(gameSlug)?.earnRate
  if (!odds || !earn || allBoxes(gameSlug).length === 0) return null
  return {
    godlyPct: odds.godly,
    chromaPct: odds.chroma,
    spinCoins: MM2_ECONOMY.spinCoins,
    coinsPerRound: earn.perRound,
    keyDiamonds: mysteryKeyDiamonds(gameSlug),
  }
}

export interface BoxesData {
  views: BoxView[]
  /** Published event slug → name (retired boxes link only to these). */
  eventNames: Map<string, string>
}

/** One request's join (shared by metadata, the lead and the body). */
export const loadBoxes = cache(async (gameSlug: string): Promise<BoxesData> => {
  const [items, eventNames] = await Promise.all([
    getValueItems(gameSlug, { kinds: ['item'] }),
    hasHubPage(gameSlug, 'events') ? getValueEventNames(gameSlug) : Promise.resolve(new Map<string, string>()),
  ])
  const bySlug = new Map(items.map((i) => [i.slug, i]))
  const lookup = (slug: string): PricedItem | null => {
    const i = bySlug.get(slug)
    if (!i) return null
    const cheapestUsd = i.price?.cheapestUsd ?? null
    return {
      cheapestUsd,
      marketUsd: i.price?.averageUsd ?? null,
      imageUrl: i.imageUrl,
      href: valueItemHasPage(gameSlug, { rarity: i.rarity, priced: cheapestUsd != null }) ? `/${gameSlug}/values/${i.slug}` : null,
    }
  }
  return { views: allBoxes(gameSlug).map((b) => boxView(b, lookup)), eventNames }
})
