'use client'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ItemPicture } from '@/features/items-grid/ItemPicture'
import { TraitMarks } from './TraitMarks'

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
  const reduce = useReducedMotion()

  return (
    // One step lighter than the house card fill so the picture never melts into the page ground (owner, 2026-11-02).
    <div className="overflow-hidden rounded-lg bg-[linear-gradient(180deg,#2B2C33_0%,#232429_100%)] shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)]">
      <div className="relative grid h-[200px] w-full place-items-center sm:h-[240px] lg:aspect-square lg:h-auto">
        <ItemPicture
          src={imageUrl}
          name={name}
          size={512}
          priority
          placeholder="Picture Coming Soon"
          className="h-[74%] w-[74%] drop-shadow-[0_18px_22px_rgba(0,0,0,0.45)]"
        />

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
