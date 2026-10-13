import 'server-only'

import { getValueItemRail } from '@/lib/buy-rails/server'
import type { RailCard } from '@/lib/buy-rails/model'
import type { ItemRef } from './outline'

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
