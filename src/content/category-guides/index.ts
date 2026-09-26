import { ADOPT_ME_GUIDES } from './adopt-me'
import type { CategoryGuide } from './types'

export type { CategoryGuide, GuideBlock, GuideSection, GuideText } from './types'

/**
 * Registry: game slug → (category slug → guide). To add a game, write
 * `<game>.ts` beside this file and register it here. A page with no entry
 * still renders the shared "Why buy" and "How to buy" parts, just without
 * the game-specific editorial.
 */
const GUIDES: Record<string, Record<string, CategoryGuide>> = {
  'adopt-me': ADOPT_ME_GUIDES,
}

export function getCategoryGuide(gameSlug: string, categorySlug: string): CategoryGuide | null {
  return GUIDES[gameSlug]?.[categorySlug] ?? null
}
