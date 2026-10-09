import 'server-only'
import { unstable_cache } from 'next/cache'
import { createAnonClient } from '@/lib/supabase/anon'
import { categoryListingsTag } from '@/lib/revalidation/listings'
import { getPausedSellerIds } from '@/lib/actions/seller-presence'
import { getTestSellerIds } from '@/lib/seo/public-hygiene'
import { valueItemPriceTag, valuesTag } from '@/lib/values/revalidation'
import { getItemsPair, getValueCatalog } from '@/lib/value-listings/stock-server'
import { readCurrencyOffers, readItemPrice } from './readers'
import { resolveMarketPriceHint, type HintDeps, type HintInput, type MarketPriceHint } from './resolve'

/**
 * Cached, cookie-free loaders for the sell wizard's market price helper.
 *
 *   - catalogue: the value pages' own cached catalogue (values:<game>).
 *   - item price: one row per (game, item, variant), tagged with the item's
 *     price tag, which the pricing run revalidates when that price moves.
 *   - currency offers: one read per (pair, bundle), tagged with the pair's
 *     listings tag, which every listing mutation revalidates.
 *
 * The windows below are safety nets; the tags are the refresh.
 */
const loaders: HintDeps = {
  loadCatalog: (gameSlug) => getValueCatalog(gameSlug),

  async loadItemPrice(gameSlug, itemSlug, variant) {
    const pair = await getItemsPair(gameSlug)
    if (!pair) return null
    return unstable_cache(
      () => readItemPrice(createAnonClient() as any, { gameSlug, gameId: pair.gameId, itemSlug, variant }),
      ['price-helper-item', gameSlug, itemSlug, variant ?? ''],
      { revalidate: 86400, tags: [valueItemPriceTag(gameSlug, itemSlug), valuesTag(gameSlug)] },
    )()
  },

  loadCurrencyOffers(gameCategoryId, bundleId) {
    return unstable_cache(
      async () => {
        const [paused, test] = await Promise.all([getPausedSellerIds(), getTestSellerIds()])
        return readCurrencyOffers(createAnonClient() as any, {
          gameCategoryId,
          bundleId,
          hiddenSellerIds: [...new Set([...paused, ...test])],
        })
      },
      ['price-helper-currency', gameCategoryId, bundleId ?? ''],
      { revalidate: 3600, tags: [categoryListingsTag(gameCategoryId)] },
    )()
  },
}

export function getMarketPriceHint(input: HintInput): Promise<MarketPriceHint | null> {
  return resolveMarketPriceHint(input, loaders)
}
