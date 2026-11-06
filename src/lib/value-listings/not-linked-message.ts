import type { UnmatchedListing } from './link'

const MAX_NAMES = 8

/** The Discord line for new listings with no item page. Null when there are none. */
export function notLinkedMessage(rows: readonly UnmatchedListing[]): string | null {
  if (rows.length === 0) return null
  // In backticks: a seller's title can't become a masked link in the ops channel.
  const names = rows.slice(0, MAX_NAMES).map((r) => `• \`${r.title.replace(/`/g, "'").replace(/\s+/g, ' ').trim()}\` (${r.gameSlug})`).join('\n')
  const more = rows.length > MAX_NAMES ? `\nand ${rows.length - MAX_NAMES} more` : ''
  const head = rows.length === 1 ? 'A new listing has no item page' : `${rows.length} new listings have no item page`
  return `📝 ${head}. Add the item if it's real (Admin → Games → Values):\n${names}${more}`
}
