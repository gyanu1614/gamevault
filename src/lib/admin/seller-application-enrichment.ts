/**
 * Seller-application enrichment helpers shared by the admin fetch actions
 * (admin-sellers.ts + admin-seller-review.ts).
 *
 * Plain TS on purpose: 'use server' modules may only export async server
 * actions, so the synchronous parsing/lookup logic lives here and both
 * action modules import it.
 */

import type { Game } from '@/lib/utils/games'
import {
  findDiditEvidence,
  diditSessionIdFromPath,
  type SellerDocument,
} from '@/lib/utils/seller-verification'

/**
 * One entry of the seller_applications.games_categories jsonb column:
 * a game the applicant selected plus the category sections they intend
 * to sell in (slugs from that game's live category map).
 */
export interface GameCategorySelection {
  gameId: string
  gameSlug: string
  categorySlugs: string[]
}

/**
 * Real game record for rendering logos in admin review surfaces.
 * Mirrors the games table columns (image_url is the logo; emoji + the
 * colored-initial tile are the fallbacks when it is null).
 */
export interface GameLookupEntry {
  id: string
  slug: string
  name: string
  emoji: string | null
  image_url: string | null
}

/**
 * Lookup for the games an application references. Each referenced game is
 * inserted under EVERY key it can be addressed by — its uuid, its slug and
 * (for legacy rows that stored 1-based indexes in primary_games) that
 * index as a string — so consumers resolve entries directly:
 *   games_lookup[gc.gameId] ?? games_lookup[gc.gameSlug]
 *   games_lookup[primaryGameIdOrLegacyIndex]
 */
export type GamesLookup = Record<string, GameLookupEntry>

/**
 * Normalize the games_categories jsonb value: keep only well-formed
 * entries; empty/invalid payloads collapse to null so the UI can fall
 * back to primary_games.
 */
export function parseGamesCategories(raw: unknown): GameCategorySelection[] | null {
  if (!Array.isArray(raw)) return null
  const entries = raw
    .filter(
      (e: any): e is GameCategorySelection =>
        !!e &&
        typeof e === 'object' &&
        typeof e.gameId === 'string' &&
        typeof e.gameSlug === 'string' &&
        Array.isArray(e.categorySlugs)
    )
    .map((e: any) => ({
      gameId: e.gameId as string,
      gameSlug: e.gameSlug as string,
      categorySlugs: (e.categorySlugs as unknown[]).filter(
        (s): s is string => typeof s === 'string'
      ),
    }))
  return entries.length > 0 ? entries : null
}

/**
 * Build the games lookup for one application: every game referenced by
 * primary_games (uuid or legacy 1-based index) or games_categories
 * (gameId/gameSlug), inserted under all of its addressable keys.
 */
export function buildGamesLookup(
  allGames: Game[],
  primaryGames: string[] | null | undefined,
  gamesCategories: GameCategorySelection[] | null | undefined
): GamesLookup {
  const refs = new Set<string>()
  for (const id of primaryGames || []) refs.add(String(id))
  for (const gc of gamesCategories || []) {
    refs.add(gc.gameId)
    refs.add(gc.gameSlug)
  }

  const lookup: GamesLookup = {}
  if (refs.size === 0) return lookup

  allGames.forEach((game, index) => {
    const legacyKey = String(index + 1) // legacy rows stored 1-based indexes
    if (!refs.has(game.id) && !refs.has(game.slug) && !refs.has(legacyKey)) return

    const entry: GameLookupEntry = {
      id: game.id,
      slug: game.slug,
      name: game.name,
      emoji: game.emoji,
      image_url: game.image_url,
    }
    lookup[game.id] = entry
    lookup[game.slug] = entry
    if (refs.has(legacyKey)) lookup[legacyKey] = entry
  })

  return lookup
}

export interface ApplicationGamesEnrichment {
  games_categories: GameCategorySelection[] | null
  games_lookup: GamesLookup
  didit_session_id: string | null
}

/**
 * Derived fields every admin application row/detail gets:
 * normalized games_categories, the games logo lookup, and the Didit
 * session id from the synthetic evidence document (if present).
 */
export function buildApplicationGamesEnrichment(input: {
  allGames: Game[]
  rawGamesCategories: unknown
  primaryGames: string[] | null | undefined
  documents: SellerDocument[] | null | undefined
}): ApplicationGamesEnrichment {
  const games_categories = parseGamesCategories(input.rawGamesCategories)
  return {
    games_categories,
    games_lookup: buildGamesLookup(input.allGames, input.primaryGames, games_categories),
    didit_session_id: diditSessionIdFromPath(
      findDiditEvidence(input.documents)?.file_path
    ),
  }
}
