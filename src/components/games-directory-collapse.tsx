/**
 * GamesDirectoryCollapse — client shell for the game directory inside the
 * footer (see footer-game-links.tsx). Collapsed by default: the first rows
 * show, the rest sits under a frosted fade with a centred bold "Show All". The
 * link grid arrives as server-rendered children, so every <a href> is in the
 * initial HTML regardless of this state — the collapse is height only and
 * never unmounts.
 *
 * Motion is framer-motion (owner 2026-09-30: show-all panels animate like
 * the account sidebar): the panel tweens between COLLAPSED and `auto`, which
 * framer measures, so the duration maps to the distance actually travelled
 * and late reflows are never clipped by a stale measurement. The fade is
 * always mounted and fades with the expansion, and the button stays in flow
 * under the panel, its pull-up margin animating with it rather than
 * teleporting between two positions.
 */

'use client'

import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { EXPAND_TRANSITION } from '@/components/ui/expand'

/** Collapsed height in px. One game block is ~98px (22px logo row + 4px +
    4 categories at 18px), rows 20px apart, so this shows the first row whole
    plus the top of the second under the fade. */
const COLLAPSED = 158


export function GamesDirectoryCollapse({
  children,
  collapsed = COLLAPSED,
  fade = 'var(--footer-bg)',
  label = 'Show All',
}: {
  children: React.ReactNode
  /** Collapsed height in px (the footer's default shows ~1.5 rows). */
  collapsed?: number
  /** The ground the fade melts into (the footer by default). */
  fade?: string
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const reduce = useReducedMotion()
  const transition = reduce ? { duration: 0 } : EXPAND_TRANSITION

  return (
    <div>
      <motion.div
        initial={false}
        animate={{ height: open ? 'auto' : collapsed }}
        transition={transition}
        className="relative overflow-hidden"
      >
        {children}

        {/* A blur that strengthens toward the bottom plus a fade to the
            ground, so the Show All text sits on frosted black. Explicit
            rgba: a `/60` modifier on a token colour emits no CSS. */}
        <motion.div
          aria-hidden
          initial={false}
          animate={{ opacity: open ? 0 : 1 }}
          transition={transition}
          className="pointer-events-none absolute inset-x-0 bottom-0 h-20"
          style={{
            background:
              // Fades to the FOOTER's ground (it lives in the footer panel).
              `linear-gradient(to top, ${fade} 12%, color-mix(in srgb, ${fade} 72%, transparent) 55%, transparent 100%)`,
            backdropFilter: 'blur(3px)',
            WebkitBackdropFilter: 'blur(3px)',
            maskImage: 'linear-gradient(to top, #000 40%, transparent)',
            WebkitMaskImage: 'linear-gradient(to top, #000 40%, transparent)',
          }}
        />
      </motion.div>

      {/* Plain bold text, no box. Collapsed it rides up onto the frosted
          fade (negative margin); open it sits just under the grid. */}
      <motion.div
        initial={false}
        animate={{ marginTop: open ? 12 : -30 }}
        transition={transition}
        className="relative flex justify-center"
      >
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-8 items-center gap-1.5 px-2 text-[14px] font-bold text-white transition-opacity duration-200 [text-shadow:0_1px_10px_rgba(0,0,0,0.8)] hover:opacity-80"
        >
          {open ? 'Show Less' : label}
          <ChevronDown
            aria-hidden
            className={`h-4 w-4 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </motion.div>
    </div>
  )
}
