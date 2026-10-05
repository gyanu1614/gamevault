'use client'

/**
 * The storefront avatar's rank border (owner, 2026-10-05): a thin ring in the
 * seller's rank colour with a bright highlight that travels around it, and
 * now and then a small star sparkles on the edge — rare, never a shower.
 *
 *   ring      2px, a faint base ring plus a comet highlight (conic gradient)
 *             rotating once every 6 s; clipped to the rounded box
 *   gap       3px in the card colour, then the avatar
 *   sparkle   one four-point star every 3.5–7 s at a random point on the edge
 *
 * Reduced motion: the ring stands still (highlight parked top-right) and no
 * sparkles are scheduled. Hidden tabs skip sparkles too.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface Sparkle {
  id: number
  /** Position on the box, in % of its width / height. */
  left: number
  top: number
  size: number
}

/** A random point on the box's edge (sparkles sit ON the border). */
function edgePoint(): { left: number; top: number } {
  const t = Math.random() * 100
  switch (Math.floor(Math.random() * 4)) {
    case 0:
      return { left: t, top: 0 }
    case 1:
      return { left: 100, top: t }
    case 2:
      return { left: t, top: 100 }
    default:
      return { left: 0, top: t }
  }
}

export function RankAvatarRing({
  rgb,
  gapColor,
  className,
  children,
}: {
  /** Rank colour, "r,g,b" (rankRingRgb). */
  rgb: string
  /** The card colour behind the avatar — the gap between ring and image. */
  gapColor: string
  className?: string
  children: ReactNode
}) {
  const reduceMotion = useReducedMotion()
  const [sparkles, setSparkles] = useState<Sparkle[]>([])
  const nextId = useRef(0)

  useEffect(() => {
    if (reduceMotion) return
    let timer: ReturnType<typeof setTimeout>
    const schedule = (first = false) => {
      const wait = (first ? 1800 : 3500) + Math.random() * 3500
      timer = setTimeout(() => {
        if (document.visibilityState === 'visible') {
          const id = nextId.current++
          setSparkles((list) => [...list.slice(-1), { id, ...edgePoint(), size: 9 + Math.random() * 5 }])
        }
        schedule()
      }, wait)
    }
    schedule(true)
    return () => clearTimeout(timer)
  }, [reduceMotion])

  const conic = `conic-gradient(from 0deg, rgba(${rgb},0.38) 0deg, rgba(${rgb},0.38) 210deg, rgba(${rgb},0.95) 290deg, rgba(255,255,255,0.95) 318deg, rgba(${rgb},0.95) 336deg, rgba(${rgb},0.38) 360deg)`

  return (
    <div className={cn('relative w-fit', className)}>
      <div className="relative overflow-hidden rounded-[14px] p-[2px]">
        <motion.span
          aria-hidden
          className="absolute inset-[-50%]"
          style={{ background: conic }}
          initial={{ rotate: 45 }}
          animate={reduceMotion ? { rotate: 45 } : { rotate: 405 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 6, ease: 'linear', repeat: Infinity }}
        />
        <div className="relative rounded-[12px] p-[3px]" style={{ backgroundColor: gapColor }}>
          {children}
        </div>
      </div>

      <AnimatePresence>
        {sparkles.map((s) => (
          <motion.svg
            key={s.id}
            aria-hidden
            viewBox="0 0 24 24"
            width={s.size}
            height={s.size}
            className="pointer-events-none absolute"
            style={{
              left: `${s.left}%`,
              top: `${s.top}%`,
              marginLeft: -s.size / 2,
              marginTop: -s.size / 2,
              filter: `drop-shadow(0 0 4px rgba(${rgb},0.9))`,
            }}
            initial={{ opacity: 0, scale: 0, rotate: 0 }}
            animate={{ opacity: [0, 1, 0], scale: [0, 1, 0], rotate: 90 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
            onAnimationComplete={() => setSparkles((list) => list.filter((x) => x.id !== s.id))}
          >
            {/* Four-point star. */}
            <path d="M12 0c.6 6.2 5.8 11.4 12 12-6.2.6-11.4 5.8-12 12-.6-6.2-5.8-11.4-12-12C6.2 11.4 11.4 6.2 12 0z" fill="#fff" />
          </motion.svg>
        ))}
      </AnimatePresence>
    </div>
  )
}
