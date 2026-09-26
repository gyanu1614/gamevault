/**
 * PopularGames — section 2 of the homepage. Server component.
 *
 * Sets no padding, margin, max-width or overflow: it opts into the page
 * measure and lets the rhythm container own the spacing around it, per the
 * section authoring contract in CLAUDE.md.
 */

import { getPopularGames } from '../lib/popular-games'
import { PopularGameCard } from './PopularGameCard'

export async function PopularGames() {
  // 12 = two rows of six. The allowlist in popular-games.ts is the real
  // gate; this just caps the grid at a whole number of rows.
  const games = await getPopularGames(12)

  // An empty section renders nothing, not an empty container.
  if (games.length === 0) return null

  return (
    <section className="page-measure">
      {/* `.section-title` (globals.css) owns the size, weight and centring
          for every page-level section title, so the homepage reads as one
          set. Do not re-declare the scale here. */}
      <h2 className="section-title">Popular Games</h2>

      {/* Two rows of six. A fixed grid rather than a carousel: the whole
          set is visible at once, so nothing is hidden behind a swipe. */}
      {/* Row gap is larger than column gap: cards are portrait, so equal
          gaps read as cramped vertically. */}
      <ul className="mt-6 grid grid-cols-2 gap-x-3 gap-y-7 sm:mt-8 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-8 lg:grid-cols-4 xl:grid-cols-6">
        {games.map((game) => (
          <li key={game.slug}>
            <PopularGameCard game={game} />
          </li>
        ))}
      </ul>
    </section>
  )
}
