import 'server-only'

import { getValueItemRail } from '@/lib/buy-rails/server'
import type { RailCard } from '@/lib/buy-rails/model'
import type { ItemRef } from './outline'
import { findCatalogItems, type LinkedItem } from '@/lib/blog/item-catalog'

/**
 * Live data for a post's item cards: the same stock read the value pages'
 * buy rails use (cached under each item's stock tag, so a listing change
 * refreshes the card). One request per distinct item; a failed read just
 * leaves that card without its buy line.
 */
export async function loadItemCards(refs: readonly ItemRef[]): Promise<Map<string, RailCard>> {
  const entries = await Promise.all(
    refs.slice(0, 24).map(async (r) => {
      try {
        const card = await getValueItemRail(r.gameSlug, r.itemSlug, r.name, r.imageUrl || null)
        return [`${r.gameSlug}/${r.itemSlug}`, card] as const
      } catch {
        return null
      }
    }),
  )
  return new Map(entries.filter((e): e is NonNullable<typeof e> => e !== null))
}

/**
 * Pictures in tables (Blog v2): the value items named in the post's table
 * first columns (collectTableItemNames), each with its picture and value
 * page. One catalogue read per article render (ISR-cached); a failed read
 * just leaves the tables without pictures.
 */
export async function loadTableItems(gameSlug: string, names: readonly string[]): Promise<Map<string, LinkedItem>> {
  if (names.length === 0) return new Map()
  try {
    return await findCatalogItems(gameSlug, names)
  } catch {
    return new Map()
  }
}

