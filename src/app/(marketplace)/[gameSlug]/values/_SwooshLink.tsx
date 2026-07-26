'use client'

/**
 * SwooshLink — a link that plays a full-screen brand "switch" wipe before it
 * navigates between the marketplace storefront and the forest Values hub.
 * Built on framer-motion (already a dep) — no hand-rolled animation.
 *
 * The transition reads as a deliberate SWITCH, not just a loader:
 *   1. a diagonal panel wipes in across the viewport,
 *   2. it HOLDS while the DropMarket logo + name (contextual: "| Values" when
 *      entering the hub) fades in with a spinner beneath,
 *   3. the panel wipes out to reveal the destination that mounted behind it.
 *
 * The route push happens during the hold so the new page is already painting.
 * `to` picks the destination brand lockup + tint. Honours reduced-motion
 * (navigates immediately, no overlay).
 */

import { useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

type Destination = 'marketplace' | 'values'

// Timing (ms) — slow enough to register as a switch, snappy enough to not drag.
const WIPE_IN = 620
const HOLD = 560
const PUSH_AT = 560 // push during the hold, behind the cover
const CLEAR_AT = WIPE_IN + HOLD // when to unmount → triggers the wipe-out

export function SwooshLink({
  href,
  to,
  className,
  children,
  ariaLabel,
}: {
  href: string
  /** Destination context → which brand lockup + tint the cover shows. */
  to: Destination
  className?: string
  children: React.ReactNode
  ariaLabel?: string
}) {
  const router = useRouter()
  const reduce = useReducedMotion()
  const [playing, setPlaying] = useState(false)

  const onClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      // Respect new-tab / modifier clicks — let the browser handle them.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
      e.preventDefault()
      if (reduce) {
        router.push(href)
        return
      }
      router.prefetch(href)
      setPlaying(true)
      window.setTimeout(() => router.push(href), PUSH_AT)
      window.setTimeout(() => setPlaying(false), CLEAR_AT)
    },
    [href, reduce, router],
  )

  // Values-bound cover leans forest-green; marketplace-bound stays near-black.
  const background =
    to === 'values'
      ? 'linear-gradient(120deg, #0C0F0E 0%, #10231A 48%, #1B6B3F 100%)'
      : 'linear-gradient(120deg, #060807 0%, #0C0F0E 55%, #141a17 100%)'

  return (
    <>
      <a href={href} onClick={onClick} className={className} aria-label={ariaLabel}>
        {children}
      </a>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {playing && (
              <motion.div
                key="swoosh"
                aria-hidden
                className="pointer-events-none fixed inset-0 z-[200] flex items-center justify-center"
                // Wipe in from the left, hold full-cover, then (on exit) wipe
                // out to the right — a smooth directional switch.
                initial={{ clipPath: 'polygon(-35% 0, 0 0, 0 100%, -35% 100%)' }}
                animate={{ clipPath: 'polygon(0 0, 135% 0, 100% 100%, 0 100%)' }}
                exit={{ clipPath: 'polygon(100% 0, 135% 0, 135% 100%, 100% 100%)' }}
                transition={{
                  duration: WIPE_IN / 1000,
                  ease: [0.83, 0, 0.17, 1],
                }}
                style={{ background }}
              >
                {/* Subtle vignette so the lockup reads crisply. */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      'radial-gradient(60% 60% at 50% 50%, transparent 40%, rgba(0,0,0,0.35) 100%)',
                  }}
                />

                <motion.div
                  className="relative flex flex-col items-center gap-5"
                  initial={{ opacity: 0, y: 10, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.18 } }}
                  transition={{ delay: 0.16, duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
                >
                  {/* Brand lockup — DropMarket logo + name, contextual suffix. */}
                  <div className="flex items-center gap-3">
                    <Image
                      src="/brand/logo-mark-white.png"
                      alt=""
                      width={44}
                      height={44}
                      priority
                      className="h-10 w-10 drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] sm:h-11 sm:w-11"
                    />
                    <span className="inline-flex items-center whitespace-nowrap text-[22px] font-bold tracking-tight text-white sm:text-[26px]">
                      DropMarket
                      {to === 'values' && (
                        <>
                          <span className="mx-2.5 font-normal text-white/25">|</span>
                          <span className="text-[#4FB477]">Values</span>
                        </>
                      )}
                    </span>
                  </div>

                  {/* Thin progress shimmer under the lockup. */}
                  <span className="relative h-[3px] w-28 overflow-hidden rounded-full bg-white/12">
                    <motion.span
                      className="absolute inset-y-0 left-0 w-1/2 rounded-full bg-white/85"
                      initial={{ x: '-120%' }}
                      animate={{ x: '240%' }}
                      transition={{ duration: 0.9, ease: 'easeInOut', repeat: Infinity }}
                    />
                  </span>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  )
}
