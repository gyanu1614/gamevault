'use client'

import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { MARKET_CARD } from '@/lib/ui/surfaces'
import { cn } from '@/lib/utils'
import { TraitMarks } from './TraitMarks'

/** Never blow the art up beyond this many times its own pixels (it blurs). */
const MAX_UPSCALE = 1.5

/**
 * The pet in a plain card (owner, 2026-10-27: "a normal image within a card,
 * like Eldorado"; 2026-11-02: one card, the facts in a strip under the
 * picture instead of a spec card beside it). No stage lighting or float. The
 * picture keeps near its real resolution once loaded so small catalogue art
 * stays sharp. The picked trait's badges sit top-right and pop in on a change.
 */
export function PictureStage({
  imageUrl,
  name,
  traitCode,
  children,
}: {
  imageUrl: string | null
  name: string
  /** Adopt Me shorthand of the trait on show ("NFR"), drawn as the game's badges. */
  traitCode: string | null
  /** The facts strip, inside the same card under the picture. */
  children?: ReactNode
}) {
  const [cap, setCap] = useState<number | null>(null)
  const reduce = useReducedMotion()

  return (
    <div className={cn('overflow-hidden rounded-lg', MARKET_CARD)}>
      <div className="relative grid aspect-[4/3] w-full place-items-center sm:aspect-[16/10] lg:aspect-auto lg:h-[420px] xl:h-[440px]">
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
            className="h-[70%] w-auto object-contain drop-shadow-[0_18px_22px_rgba(0,0,0,0.45)]"
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
              className="absolute right-3.5 top-3.5 sm:right-5 sm:top-5"
              initial={reduce ? false : { opacity: 0, scale: 0.8, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, scale: 0.9, transition: { duration: 0.12 } }}
              transition={{ type: 'spring', stiffness: 420, damping: 26 }}
            >
              <TraitMarks code={traitCode} size={28} />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
      {children}
    </div>
  )
}
