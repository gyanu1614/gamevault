import { FILLER_WORDS, normalizeText } from '@/lib/value-listings/match'

/** Owner, 2026-11-05: Adopt Me and MM2 items have proper names; a brainrot's title carries its income. */
const GAMES_WITH_SELLER_TITLE: ReadonlySet<string> = new Set(['steal-a-brainrot'])

/**
 * The seller's title, when it says more than the page already does: anything past
 * the item, its trait, the game and filler words. "Candy Dragon Cannelloni 1B/s -
 * Quick Delivery" says the income; "Dragon Gingerini" or "67 - Instant Delivery"
 * says nothing new, so it isn't repeated.
 */
export function sellerExtraTitle(
  gameSlug: string,
  title: string | null | undefined,
  context: { itemName: string; gameName: string; traitLabel?: string | null },
): string | null {
  if (!GAMES_WITH_SELLER_TITLE.has(gameSlug) || !title?.trim()) return null
  const known = new Set(`${context.itemName} ${context.gameName} ${context.traitLabel ?? ''}`.split(/\s+/).flatMap((w) => normalizeText(w).split(' ')))
  // "/s" of an income is never the only news: "125M/s" still leaves "125m".
  const says = normalizeText(title).split(' ').filter((w) => w && w !== 's' && w !== 'sec' && !known.has(w) && !FILLER_WORDS.has(w))
  return says.length > 0 ? title.trim() : null
}
