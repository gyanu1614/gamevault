/**
 * Client-safe category-section types + labels for the Account & Games step.
 * Kept in a PLAIN module (no 'server-only') so client components can import the
 * labels/types; the server fetch (getGameCategories) lives in
 * ./game-categories and imports these.
 */

import { type OfferType } from '@/lib/utils/offer-type'

/**
 * The category SECTIONS the seller chooses between. classifyOfferType returns
 * four buckets; boosting/services aren't one of them, so it's detected
 * separately from metadata.type === 'service'.
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

export const SECTION_ORDER: SellerCategorySection[] = [
  'items',
  'accounts',
  'currency',
  'top-up',
  'boosting',
]
