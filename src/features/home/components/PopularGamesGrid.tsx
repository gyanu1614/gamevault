'use client'

/**
 * PopularGamesGrid — the Popular Games list.
 *
 * Phone (<sm): three per row, two and three-quarter rows shown; the rest sit
 * behind a centred "Show All" over a fade. Opening and closing SLIDES
 * (framer-motion height, owner 2026-09-28) instead of snapping. sm and up are
 * unchanged: every card visible, 3 / 4 / 6 per row.
 */

import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { PopularGameCard } from './PopularGameCard'
import type { PopularGameCard as GameCardData } from '../lib/popular-games'

/** Three rows of three on a phone. */
const PHONE_VISIBLE = 9

export function PopularGamesGrid({ games }: { games: GameCardData[] }) {
  const [expanded, setExpanded] = useState(false)
  const canCollapse = games.length > PHONE_VISIBLE
  const collapsed = canCollapse && !expanded
  const reduceMotion = useReducedMotion()

  // Phone width of the fold, for the collapsed height (null off phones and
  // before mount). Same formula as .popular-games--collapsed in globals.css:
  // the cut lands three quarters of the way down row three.
  const foldRef = useRef<HTMLDivElement>(null)
  const [phoneWidth, setPhoneWidth] = useState<number | null>(null)
  useEffect(() => {
    const el = foldRef.current
    if (!el) return
    const mq = window.matchMedia('(max-width: 639px)')
    const measure = () => setPhoneWidth(mq.matches ? el.clientWidth : null)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    mq.addEventListener?.('change', measure)
    return () => {
      ro.disconnect()
      mq.removeEventListener?.('change', measure)
    }
  }, [])
  const collapsedPx = phoneWidth != null ? ((phoneWidth - 20) * 4) / 9 * 2.75 + 88 : null
  const animated = canCollapse && collapsedPx != null

  return (
    // popular-games-fold is the size container the CSS fallback height is
    // computed against (globals.css) until the height is measured here.
    <div ref={foldRef} className="popular-games-fold mt-6 sm:mt-8">
      <motion.div
        initial={false}
        animate={{ height: animated && collapsed ? collapsedPx : 'auto' }}
        transition={{ duration: reduceMotion ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }}
        className={[
          animated ? 'overflow-hidden' : '',
          // Fade the cut edge while closed; before measuring, the CSS class
          // also clips (server render, first paint).
          collapsed ? (animated ? 'popular-games--mask' : 'popular-games--collapsed') : '',
        ].join(' ')}
      >
        {/* Row gap is larger than column gap: cards are portrait, so equal
            gaps read as cramped vertically. */}
        <ul className="grid grid-cols-3 gap-x-2.5 gap-y-5 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-8 lg:grid-cols-4 xl:grid-cols-6">
          {games.map((game) => (
            <li key={game.slug}>
              <PopularGameCard game={game} />
            </li>
          ))}
        </ul>
      </motion.div>

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
              className={`h-4 w-4 drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)] transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      )}
    </div>
  )
}
