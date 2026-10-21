/** /browse: the game directory's shape. Pure (the page does the read). */

export interface BrowseGame {
  id: string
  slug: string
  name: string
  image_url: string | null
  sort_order: number | null
  /** The game hub: it always exists for an active game. */
  href: string
}

/** Games an admin has ordered by hand (sort_order below this) are the popular ones. */
const UNRANKED = 99
const POPULAR_MAX = 12

export function popularGames(games: BrowseGame[]): BrowseGame[] {
  return games
    .filter((x) => x.sort_order != null && x.sort_order < UNRANKED)
    .sort((a, b) => (a.sort_order ?? UNRANKED) - (b.sort_order ?? UNRANKED))
    .slice(0, POPULAR_MAX)
}

export interface LetterGroup {
  letter: string
  games: BrowseGame[]
}

/** A to Z by first character; anything that is not a letter files under "#", first. */
export function gamesByLetter(games: BrowseGame[]): LetterGroup[] {
  const map = new Map<string, BrowseGame[]>()
  for (const x of games) {
    const first = x.name.trim().charAt(0).toUpperCase()
    const letter = /[A-Z]/.test(first) ? first : '#'
    map.set(letter, [...(map.get(letter) ?? []), x])
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a === '#' ? -1 : b === '#' ? 1 : a.localeCompare(b)))
    .map(([letter, list]) => ({ letter, games: list.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })) }))
}
