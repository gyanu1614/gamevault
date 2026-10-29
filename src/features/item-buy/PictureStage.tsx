'use client'

import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { TraitMarks } from './TraitMarks'

/** Never blow the art up beyond this many times its own pixels (it blurs). */
const MAX_UPSCALE = 1.5

/**
 * The pet in a plain card (owner, 2026-10-27: "a normal image within a card,
 * like Eldorado"; 2026-10-28: half the left column, the spec card beside it).
 * Square on wider screens and as tall as the spec card next to it; no stage
 * lighting or float. The picture keeps near its real resolution once loaded
 * so small catalogue art stays sharp. The picked trait's badges sit top-right
 * and pop in on a change.
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
    <div className="relative grid aspect-[4/3] h-full w-full place-items-center overflow-hidden rounded-lg bg-[linear-gradient(180deg,#212228_0%,#1A1B1F_100%)] sm:aspect-square">
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
          className="h-[66%] w-auto object-contain"
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
            className="absolute right-3.5 top-3.5 sm:right-4 sm:top-4"
            initial={reduce ? false : { opacity: 0, scale: 0.8, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, scale: 0.9, transition: { duration: 0.12 } }}
            transition={{ type: 'spring', stiffness: 420, damping: 26 }}
          >
            <TraitMarks code={traitCode} size={26} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
