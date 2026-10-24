import 'server-only'
import { loadValueListRows, valueListKind } from '@/app/(marketplace)/[gameSlug]/values/_listRows'
import type { AdoptMePetItem } from '@/app/(marketplace)/[gameSlug]/values/_adoptMeListModel'
import type { BrainrotDirectoryItem } from '@/app/(marketplace)/[gameSlug]/values/_sabListModel'
import type { ValueListRow } from '@/app/(marketplace)/[gameSlug]/values/_generic/valueListModel'
import { getValueStock } from '@/lib/value-listings/stock-server'
import { getValuesFreshness } from '@/lib/values/data'
import type { FeedItem, ValuesFeed } from '../../types'
import { fromAdoptMe, fromGeneric, fromSab } from './map'

/**
 * A values game's feed for the home sections: the SAME rows its /values list
 * renders (loadValueListRows: cached under the list tags, so a pricing run's
 * revalidation refreshes the home page too) plus DropMarket's own live stock
 * per item (getValueStock: listing-tagged). A game with no value list → null.
 *
 * The values sections are decoration on a marketplace page: a failed read is
 * logged and the sections hide, rather than failing (and caching) the page.
 */
export async function getValuesFeed(gameSlug: string): Promise<ValuesFeed | null> {
  const kind = valueListKind(gameSlug)
  if (!kind) return null
  try {
    const [rows, stock, freshness] = await Promise.all([
      loadValueListRows(gameSlug),
      getValueStock(gameSlug),
      kind === 'generic' ? getValuesFreshness(gameSlug) : Promise.resolve(null),
    ])
    if (!rows) return null

    const items: FeedItem[] =
      kind === 'adopt-me'
        ? fromAdoptMe(rows as AdoptMePetItem[])
        : kind === 'steal-a-brainrot'
          ? fromSab(rows as BrainrotDirectoryItem[])
          : fromGeneric(rows as ValueListRow[])

    const counts: Record<string, number> = {}
    const buyHref: Record<string, string> = {}
    const minPrice: Record<string, number> = {}
    for (const [slug, s] of Object.entries(stock?.byItem ?? {})) {
      if (s.total <= 0) continue
      counts[slug] = s.total
      if (stock) buyHref[slug] = `/${gameSlug}/${stock.pair.categorySlug}/item/${slug}`
      if (s.minPriceUsd != null) minPrice[slug] = s.minPriceUsd
    }

    return { items, stock: counts, buyHref, minPrice, updatedAt: freshness?.lastChangedAt ?? null }
  } catch (e) {
    console.error(`[game-home] values feed unavailable for ${gameSlug}:`, e instanceof Error ? e.message : e)
    return null
  }
}
