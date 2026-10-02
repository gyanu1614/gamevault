/**
 * URL → page_type, derived from the app's route patterns.
 *
 * Two facts about src/app drive it, and both are guarded by
 * src/test/gsc/page-type.test.ts so a new route can't silently mislabel:
 *   · the first segment is a static route when it is in RESERVED_GAME_SLUGS
 *     (the same list that keeps a game slug from shadowing a route), else a game;
 *   · GAME_HUB_SEGMENTS are the static folders under /[gameSlug]; any other
 *     second segment is a category.
 */

import {
  GAME_SLUG_PATTERN,
  RESERVED_GAME_SLUGS,
} from '../../../src/lib/games/validate-game'
import { LEGAL_DOCS } from '../../../src/lib/legal/documents'

export type PageType =
  | 'home'
  | 'static'
  | 'legal'
  | 'blog_index'
  | 'blog_post'
  | 'buy_landing'
  | 'game_hub'
  | 'game_sell'
  | 'game_blog_index'
  | 'game_blog_post'
  | 'values_hub'
  | 'value_item'
  | 'values_methodology'
  | 'calculator'
  | 'price_index'
  | 'game_category'
  | 'listing'
  | 'other'

/** Static folders under src/app/(marketplace)/[gameSlug]/. */
export const GAME_HUB_SEGMENTS = [
  'blog',
  'calculator',
  'neon-calculator',
  'price-index',
  'sell',
  'values',
] as const

/** /safedrop is the marketing page; its legal doc lives at /safedrop-policy. */
const LEGAL_PATHS = new Set(
  LEGAL_DOCS.map((doc) => (doc.slug === 'safedrop' ? 'safedrop-policy' : doc.slug)),
)

const GAME_SECOND_SEGMENT_TYPES: Record<string, PageType> = {
  sell: 'game_sell',
  blog: 'game_blog_index',
  values: 'values_hub',
  calculator: 'calculator',
  'neon-calculator': 'calculator',
  'price-index': 'price_index',
}

function pathSegments(urlOrPath: string): string[] | null {
  let pathname: string
  try {
    pathname = new URL(urlOrPath, 'https://dropmarket.gg').pathname
  } catch {
    return null
  }
  return pathname.split('/').filter(Boolean)
}

export function classifyPageType(urlOrPath: string): PageType {
  const segs = pathSegments(urlOrPath)
  if (!segs) return 'other'
  if (segs.length === 0) return 'home'

  const [first, second, third] = segs

  if (RESERVED_GAME_SLUGS.has(first)) {
    if (segs.length === 1) {
      if (first === 'blog') return 'blog_index'
      return LEGAL_PATHS.has(first) ? 'legal' : 'static'
    }
    if (first === 'blog') return segs.length === 2 ? 'blog_post' : 'other'
    if (first === 'buy') return segs.length === 2 ? 'buy_landing' : 'other'
    return 'static'
  }

  // /[gameSlug]/… — a first segment that can't be a game slug is not a page we know
  if (!GAME_SLUG_PATTERN.test(first)) return 'other'
  if (segs.length === 1) return 'game_hub'
  const hubType = GAME_SECOND_SEGMENT_TYPES[second]

  if (segs.length === 2) return hubType ?? 'game_category'
  if (segs.length === 3) {
    if (second === 'blog') return 'game_blog_post'
    if (second === 'values') return third === 'methodology' ? 'values_methodology' : 'value_item'
    return hubType ? 'other' : 'listing'
  }
  return 'other'
}
