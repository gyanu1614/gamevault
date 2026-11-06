import 'server-only'
import { loadValueListRows, valueListKind } from '@/app/(marketplace)/[gameSlug]/values/_listRows'
import type { AdoptMePetItem } from '@/app/(marketplace)/[gameSlug]/values/_adoptMeListModel'
import type { BrainrotDirectoryItem } from '@/app/(marketplace)/[gameSlug]/values/_sabListModel'
import type { ValueListRow } from '@/app/(marketplace)/[gameSlug]/values/_generic/valueListModel'
import { getValueCatalog, getValueStock } from '@/lib/value-listings/stock-server'
import { getValuesFreshness } from '@/lib/values/data'
import { amVariantCode, variantLabel } from '@/lib/value-listings/catalogs'
import type { FeedItem, FormStock, ValuesFeed } from './types'

export type { FeedItem, ValuesFeed } from './types'
import { fromAdoptMe, fromGeneric, fromSab, withMarketItems } from './map'
import { rethrowFailedRead } from '@/lib/supabase/failed-read'

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
    const forms: Record<string, string[]> = {}
    const formStock: Record<string, FormStock[]> = {}
    for (const [slug, s] of Object.entries(stock?.byItem ?? {})) {
      if (s.total <= 0) continue
      counts[slug] = s.total
      if (stock) buyHref[slug] = `/${gameSlug}/${stock.pair.categorySlug}/item/${slug}`
      if (s.minPriceUsd != null) minPrice[slug] = s.minPriceUsd
      const label = (key: string) => (gameSlug === 'adopt-me' ? amVariantCode(key) : variantLabel(gameSlug, key))
      const labels = Object.keys(s.byVariant)
        .map(label)
        .filter((l): l is string => !!l)
      if (labels.length > 0) forms[slug] = labels
      // Adopt Me's plain form has no badge but is still a form a buyer can search for.
      const known = Object.entries(s.byVariant)
        .map(([key, v]) => ({ variant: key, label: label(key) ?? (key === 'normal' ? 'Normal' : null), count: v.count, minPrice: v.minPriceUsd }))
        .filter((f): f is FormStock => !!f.label)
      if (known.length > 0) formStock[slug] = known.sort((a, b) => a.minPrice - b.minPrice)
    }

    return {
      items,
      stock: counts,
      buyHref,
      minPrice,
      forms,
      formStock,
      categorySlug: stock?.pair.categorySlug ?? null,
      updatedAt: freshness?.lastChangedAt ?? null,
    }
  } catch (e) {
    rethrowFailedRead(e)
    console.error(`[values-feed] values feed unavailable for ${gameSlug}:`, e instanceof Error ? e.message : e)
    return null
  }
}

/** The Items page's list: the values feed, plus what only the market sells (Adopt Me's eggs and potions). */
export async function getItemsGridFeed(gameSlug: string): Promise<ValuesFeed | null> {
  const [feed, catalog] = await Promise.all([getValuesFeed(gameSlug), gameSlug === 'adopt-me' ? getValueCatalog(gameSlug) : null])
  return feed && catalog ? withMarketItems(feed, catalog.items) : feed
}
