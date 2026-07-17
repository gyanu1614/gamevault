/**
 * getGameCategories — server helper the Account & Games step uses to show, for
 * each selected game, the REAL category sections that game supports so the
 * seller can pick which ones they'll sell in.
 *
 * Categories come from the `categories` table; each row's metadata.type (with a
 * slug-regex fallback) classifies it into an offer section via classifyOfferType.
 * We de-dupe to the section level (Items / Accounts / Currency / Top-Up /
 * Boosting) so the seller picks sections, not every individual sub-category.
 */

import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { classifyOfferType, type OfferType } from '@/lib/utils/offer-type'

/**
 * The category SECTIONS the seller chooses between. Note: classifyOfferType
 * returns four buckets; boosting/services aren't one of them, so we detect
 * services separately from metadata.type === 'service'.
 */
export type SellerCategorySection = OfferType | 'boosting'

export const SECTION_LABELS: Record<SellerCategorySection, string> = {
  items: 'Items',
  accounts: 'Accounts',
  currency: 'Currency',
  'top-up': 'Top-Up',
  boosting: 'Boosting',
}

export interface GameCategoryOptions {
  gameId: string
  gameSlug: string
  gameName: string
  /** The distinct sections this game supports, in a stable display order. */
  sections: SellerCategorySection[]
}

const SECTION_ORDER: SellerCategorySection[] = [
  'items',
  'accounts',
  'currency',
  'top-up',
  'boosting',
]

function sectionFor(metaType: string | undefined, slug: string | undefined): SellerCategorySection {
  const t = (metaType || '').toLowerCase()
  if (t === 'service') return 'boosting'
  const s = (slug || '').toLowerCase()
  if (/boost|carry|coach|rank|elo|level(l)?ing/.test(s)) return 'boosting'
  return classifyOfferType(metaType, slug)
}

/**
 * Fetch category sections for the given game IDs in one round-trip. Returns one
 * entry per game that has at least one active category; games with none are
 * omitted (the UI can still let the seller keep the game via "Other").
 */
export async function getGameCategories(
  games: { id: string; slug: string; name: string }[],
): Promise<GameCategoryOptions[]> {
  if (games.length === 0) return []

  const supabase = await createClient()
  const gameIds = games.map((g) => g.id)

  const { data, error } = (await supabase
    .from('categories')
    .select('game_id, slug, metadata, is_active, display_order')
    .in('game_id', gameIds)
    .eq('is_active', true)
    .order('display_order', { ascending: true })) as unknown as {
    data:
      | {
          game_id: string | null
          slug: string
          metadata: { type?: string } | null
          display_order: number | null
        }[]
      | null
    error: unknown
  }

  if (error || !data) return []

  const byGame = new Map<string, Set<SellerCategorySection>>()
  for (const row of data) {
    if (!row.game_id) continue
    const section = sectionFor(row.metadata?.type, row.slug)
    if (!byGame.has(row.game_id)) byGame.set(row.game_id, new Set())
    byGame.get(row.game_id)!.add(section)
  }

  return games
    .map((g) => {
      const set = byGame.get(g.id)
      if (!set || set.size === 0) return null
      const sections = SECTION_ORDER.filter((s) => set.has(s))
      return { gameId: g.id, gameSlug: g.slug, gameName: g.name, sections }
    })
    .filter((x): x is GameCategoryOptions => x !== null)
}
