import { normalizeText } from './match'

const STOP = new Set(['a', 'an', 'the', 'of', 'and', 'for', 'with', 'in', 'on'])

/**
 * The offers on an unfiltered buy page that share the most words with a search
 * that matched nothing ("Diamond Dragon Cannelloni" → the other Dragon
 * Cannelloni listings), cheapest first among equals. Client-side: the page is
 * static and the search is read after hydration.
 */
export function closestByName<T extends { name: string; pricePerUnit: number }>(offers: readonly T[], query: string, limit: number): T[] {
  const words = new Set(normalizeText(query).split(' ').filter((w) => w.length > 1 && !STOP.has(w)))
  if (words.size === 0) return []
  return offers
    .map((offer) => {
      const name = new Set(normalizeText(offer.name).split(' '))
      let score = 0
      for (const w of words) if (name.has(w)) score += 1
      return { offer, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.offer.pricePerUnit - b.offer.pricePerUnit)
    .slice(0, limit)
    .map((x) => x.offer)
}
