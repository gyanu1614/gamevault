'use client'

/**
 * PopularGamesGrid — the Popular Games list.
 *
 * Phone (<sm): three per row, two and three-quarter rows shown; the rest sit
 * behind a centred "Show All" over a fade. sm and up are unchanged: every card
 * visible, 3 / 4 / 6 per row.
 */

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { PopularGameCard } from './PopularGameCard'
import type { PopularGameCard as GameCardData } from '../lib/popular-games'

/** Three rows of three on a phone. */
const PHONE_VISIBLE = 9

export function PopularGamesGrid({ games }: { games: GameCardData[] }) {
  const [expanded, setExpanded] = useState(false)
  const canCollapse = games.length > PHONE_VISIBLE
  const collapsed = canCollapse && !expanded

  return (
    // popular-games-fold is the size container the collapsed height is
    // computed against (globals.css), so the cut always lands three quarters
    // of the way down row three.
    <div className="popular-games-fold mt-6 sm:mt-8">
      {/* Row gap is larger than column gap: cards are portrait, so equal
          gaps read as cramped vertically. */}
      <ul
        className={`grid grid-cols-3 gap-x-2.5 gap-y-5 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-8 lg:grid-cols-4 xl:grid-cols-6${
          collapsed ? ' popular-games--collapsed' : ''
        }`}
      >
        {games.map((game, i) => (
          <li key={game.slug} className={collapsed && i >= PHONE_VISIBLE ? 'max-sm:hidden' : undefined}>
            <PopularGameCard game={game} />
          </li>
        ))}
      </ul>

      {canCollapse && (
        // Plain text, no button chrome. Collapsed, it sits up over the faded
        // half-row so the fade reads as "there's more below".
        <div className={`relative z-[1] flex justify-center sm:hidden ${collapsed ? '-mt-9' : 'mt-4'}`}>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="inline-flex min-h-[44px] items-center gap-1.5 px-3 text-[14.5px] font-bold tracking-[-0.01em] text-text-primary transition-opacity duration-fast [text-shadow:0_1px_2px_rgba(0,0,0,0.6),0_4px_18px_rgba(0,0,0,0.85)] active:opacity-70"
          >
            {expanded ? 'Show Less' : 'Show All'}
            <ChevronDown
              aria-hidden
              strokeWidth={2.5}
              className={`h-4 w-4 drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)] transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      )}
    </div>
  )
}
