/** Joining words kept lower case inside a title ("Hatched From the Jungle Egg"). */
const SMALL = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to'])

/**
 * An item fact as a label: "unobtainable" → "Unobtainable" (owner,
 * 2026-10-14). Only a word's first letter moves, so "$400B", "1.5x", "NFR"
 * and "Traveler's" stay as written. Plain module (server + client).
 */
export function titleCaseValue(s: string): string {
  let first = true
  return s.replace(/[^\s-]+/g, (word) => {
    const isFirst = first
    first = false
    if (!isFirst && SMALL.has(word)) return word
    return word.charAt(0).toUpperCase() + word.slice(1)
  })
}
