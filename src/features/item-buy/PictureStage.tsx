'use client'

import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { IconBolt, IconHeadset, IconShieldCheck, type Icon as TablerIcon } from '@tabler/icons-react'
import { cn } from '@/lib/utils'
import { TraitMarks } from './TraitMarks'

/** Never blow the art up beyond this many times its own pixels (it blurs). */
const MAX_UPSCALE = 1.5

/** One slow breath for the pet and its shadow. */
const FLOAT = { duration: 6, repeat: Infinity, ease: 'easeInOut' } as const

/**
 * The pet on a lit stage, with the trust strip fixed to its foot (owner,
 * 2026-10-27; Skinport's image stage + GameBoost's trust strip, given depth:
 * a studio light from above, a darker floor, the house matte grain). The pet
 * floats slowly over a contact shadow (still for reduced motion) and is
 * capped near its real resolution once loaded, so small catalogue art stays
 * sharp. The picked trait's badges sit bottom-right, where the game puts
 * them on an inventory tile. The promises are the site's own (TrustBand
 * copy), each in a blue tile; `trustpilot` is the server-rendered row, shown
 * only with 10+ reviews.
 */
export function PictureStage({
  imageUrl,
  name,
  traitCode,
  trustpilot,
}: {
  imageUrl: string | null
  name: string
  /** Adopt Me shorthand of the trait on show ("NFR"), drawn as the game's badges. */
  traitCode: string | null
  trustpilot: ReactNode
}) {
  const [cap, setCap] = useState<number | null>(null)
  const reduce = useReducedMotion()

  return (
    <div className="overflow-hidden rounded-lg bg-[#17181C] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_40px_80px_-48px_rgba(0,0,0,0.95)]">
      <div className="relative isolate grid aspect-[16/11] place-items-center bg-[linear-gradient(180deg,#23242B_0%,#18191E_58%,#111216_100%)] sm:aspect-[4/3] lg:aspect-[16/10]">
        <span aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(64%_58%_at_50%_0%,rgba(255,255,255,0.075),transparent_72%)]" />
        <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[36%] bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.32))]" />

        {imageUrl ? (
          <div className="relative flex h-[62%] w-full items-end justify-center">
            <motion.span
              aria-hidden
              className="absolute bottom-[-7%] h-[9%] w-[36%] rounded-[50%] bg-black/60 blur-[10px]"
              animate={reduce ? undefined : { scaleX: [1, 0.86, 1], opacity: [1, 0.7, 1] }}
              transition={FLOAT}
            />
            {/* eslint-disable-next-line @next/next/no-img-element -- catalogue art from storage, same as the value pages */}
            <motion.img
              src={imageUrl}
              alt={name}
              width={512}
              height={512}
              loading="eager"
              fetchPriority="high"
              decoding="async"
              onLoad={(e) => setCap(e.currentTarget.naturalWidth * MAX_UPSCALE)}
              style={cap ? { maxWidth: cap, maxHeight: cap } : undefined}
              animate={reduce ? undefined : { y: [0, -7, 0] }}
              transition={FLOAT}
              className="relative h-full w-auto object-contain"
            />
          </div>
        ) : (
          <span className="font-medium uppercase tracking-[0.14em] text-text-tertiary" style={{ fontSize: 'var(--fs-micro)' }}>
            Picture Coming Soon
          </span>
        )}

        <span aria-hidden className="seller-grain" />

        <AnimatePresence mode="popLayout" initial={false}>
          {traitCode ? (
            <motion.div
              key={traitCode}
              className="absolute bottom-4 right-4 z-[4] drop-shadow-[0_6px_10px_rgba(0,0,0,0.5)] sm:bottom-5 sm:right-5"
              initial={reduce ? false : { opacity: 0, scale: 0.8, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, scale: 0.9, transition: { duration: 0.12 } }}
              transition={{ type: 'spring', stiffness: 420, damping: 26 }}
            >
              <TraitMarks code={traitCode} size={30} />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <ul className="relative grid grid-cols-3 bg-[linear-gradient(180deg,#1D1E23_0%,#18191D_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
        <TrustItem icon={IconShieldCheck} label="Money-Back Guarantee" short="Money-Back" />
        <TrustItem icon={IconBolt} label="Quick Delivery" divider />
        <TrustItem icon={IconHeadset} label="24/7 Support" divider />
      </ul>
      {trustpilot}
    </div>
  )
}

/** One promise: its icon in a glossy blue tile and the label; phones stack them and show the short label (TrustBand's tile wording). */
function TrustItem({ icon: Icon, label, short, divider = false }: { icon: TablerIcon; label: string; short?: string; divider?: boolean }) {
  return (
    <li className="relative flex flex-col items-center justify-center gap-1.5 px-2 py-3 sm:min-h-[68px] sm:flex-row sm:gap-3 sm:px-4">
      {divider ? <span aria-hidden className="absolute inset-y-3 left-0 w-px bg-[linear-gradient(180deg,transparent,rgba(255,255,255,0.08),transparent)]" /> : null}
      <span
        className={cn(
          'grid h-7 w-7 shrink-0 place-items-center rounded-md text-white sm:h-9 sm:w-9',
          'bg-[linear-gradient(180deg,#6AABFF_0%,#2F6BDE_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),inset_0_-1px_0_rgba(0,0,0,0.2),0_8px_14px_-8px_rgba(24,72,170,0.95)]',
        )}
      >
        <Icon aria-hidden size={17} stroke={2} />
      </span>
      <span className="whitespace-nowrap text-[12px] font-semibold leading-tight text-text-primary sm:text-[13px]">
        {short ? (
          <>
            <span className="sm:hidden">{short}</span>
            <span className="hidden sm:inline">{label}</span>
          </>
        ) : (
          label
        )}
      </span>
    </li>
  )
}
