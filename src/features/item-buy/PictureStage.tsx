'use client'

import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { MARKET_CARD } from '@/lib/ui/surfaces'
import { cn } from '@/lib/utils'
import { TraitMarks } from './TraitMarks'

/** Never blow the art up beyond this many times its own pixels (it blurs). */
const MAX_UPSCALE = 1.5

/**
 * The pet in a plain card (owner, 2026-10-27: "a normal image within a card,
 * like Eldorado"; 2026-11-02: a 260px square tile on desktop with the title
 * and facts beside it, a short box on phones). No stage lighting or float.
 * The picture keeps near its real resolution once loaded so small catalogue
 * art stays sharp. The picked trait's badges sit top-right and pop in on a
 * change.
 */
export function PictureStage({
  imageUrl,
  name,
  traitCode,
}: {
  imageUrl: string | null
  name: string
  /** Adopt Me shorthand of the trait on show ("NFR"), drawn as the game's badges. */
  traitCode: string | null
}) {
  const [cap, setCap] = useState<number | null>(null)
  const reduce = useReducedMotion()

  return (
    <div className={cn('overflow-hidden rounded-lg', MARKET_CARD)}>
      <div className="relative grid h-[200px] w-full place-items-center sm:h-[240px] lg:aspect-square lg:h-auto">
        {imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element -- catalogue art from storage, same as the value pages */
          <img
            src={imageUrl}
            alt={name}
            width={512}
            height={512}
            loading="eager"
            fetchPriority="high"
            decoding="async"
            onLoad={(e) => setCap(e.currentTarget.naturalWidth * MAX_UPSCALE)}
            style={cap ? { maxWidth: cap, maxHeight: cap } : undefined}
            className="h-[74%] w-auto object-contain drop-shadow-[0_18px_22px_rgba(0,0,0,0.45)]"
          />
        ) : (
          <span className="font-medium uppercase tracking-[0.14em] text-text-tertiary" style={{ fontSize: 'var(--fs-micro)' }}>
            Picture Coming Soon
          </span>
        )}

        <AnimatePresence mode="popLayout" initial={false}>
          {traitCode ? (
            <motion.div
              key={traitCode}
              className="absolute right-3 top-3"
              initial={reduce ? false : { opacity: 0, scale: 0.8, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, scale: 0.9, transition: { duration: 0.12 } }}
              transition={{ type: 'spring', stiffness: 420, damping: 26 }}
            >
              <TraitMarks code={traitCode} size={24} />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  )
}
