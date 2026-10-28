'use client'

import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { IconBolt, IconHeadset, IconShieldCheck, type Icon as TablerIcon } from '@tabler/icons-react'
import { cn } from '@/lib/utils'
import { TraitMarks } from './TraitMarks'

/** Never blow the art up beyond this many times its own pixels (it blurs). */
const MAX_UPSCALE = 1.5

/**
 * The pet in a plain card, the trust strip fixed to its foot (owner,
 * 2026-10-27: "a normal image within a card, like Eldorado"; design lab
 * version 1). No stage lighting or float: the picture at its own size,
 * capped near its real resolution once loaded so small catalogue art stays
 * sharp. The picked trait's badges sit top-right and pop in on a change. The
 * promises are the site's own (TrustBand copy), each in a blue tile;
 * `trustpilot` is the server-rendered row, shown only with 10+ reviews.
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
    <div className="overflow-hidden rounded-lg bg-[#18191D]">
      <div className="relative grid aspect-[16/11] place-items-center bg-[linear-gradient(180deg,#212228_0%,#1A1B1F_100%)] sm:aspect-[4/3] lg:aspect-[16/10]">
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
            className="h-[60%] w-auto object-contain"
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
              className="absolute right-4 top-4 sm:right-5 sm:top-5"
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

      <ul className="relative grid grid-cols-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
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
