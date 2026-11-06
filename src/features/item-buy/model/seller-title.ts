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
  return saysNews(title, known) ? title.trim() : null
}

function saysNews(text: string, known: ReadonlySet<string>): boolean {
  return normalizeText(text).split(' ').some((w) => w && w !== 's' && w !== 'sec' && !known.has(w) && !FILLER_WORDS.has(w))
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * What the buyer needs from that title, under the item's name: "Rainbow 500M/s", not
 * "Rainbow Garama and Madundung 500M/s – Steal a Brainrot | Instant Delivery". The
 * name is already the heading and the rest is sales talk (owner, 2026-11-06).
 */
export function offerLine(
  gameSlug: string,
  title: string | null | undefined,
  context: { itemName: string; gameName: string; traitLabel?: string | null },
): string | null {
  const extra = sellerExtraTitle(gameSlug, title, context)
  if (!extra) return null
  const known = new Set(`${context.gameName}`.split(/\s+/).flatMap((w) => normalizeText(w).split(' ')))
  const parts = extra.split(/\s*[|–—]\s*|\s+-\s+/).filter((part) => saysNews(part, known))
  const line = parts.join(' ').replace(/\s+/g, ' ').trim()
  const withoutName = line.replace(new RegExp(escapeRegExp(context.itemName), 'i'), ' ').replace(/\s+/g, ' ').trim()
  return withoutName || line || null
}
