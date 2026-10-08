import 'server-only'
import { getValueItems, getValueTrends } from '@/lib/values/data'
import { valueItemHasPage } from '@/lib/values/hub-config'
import type { ValueListRow } from './valueListModel'

/**
 * Every row of a generic value list. ONE loader for the page (first page +
 * A–Z index + JSON-LD) and for `/[game]/values/rows.json` (the full list the
 * client fetches), so the two can never disagree. Both read through the
 * tagged value readers, so a price publish refreshes both.
 */
export async function getValueListRows(gameSlug: string): Promise<{ rows: ValueListRow[]; hasTrends: boolean }> {
  const [items, trends] = await Promise.all([getValueItems(gameSlug, { kinds: ['item'] }), getValueTrends(gameSlug, 7)])

  const rows: ValueListRow[] = items.map((i) => {
    const priced = i.price?.cheapestUsd != null
    return {
      id: i.id,
      slug: i.slug,
      name: i.name,
      rarity: i.rarity,
      itemType: i.itemType,
      imageUrl: i.imageUrl,
      href: valueItemHasPage(gameSlug, { rarity: i.rarity, priced }) ? `/${gameSlug}/values/${i.slug}` : null,
      cheapestUsd: i.price?.cheapestUsd ?? null,
      marketUsd: i.price?.averageUsd ?? null,
      listedNow: i.price?.sampleSize ?? 0,
      trendPct: trends.pctByItem[i.id] ?? null,
    }
  })
  return { rows, hasTrends: Object.keys(trends.pctByItem).length > 0 }
}
