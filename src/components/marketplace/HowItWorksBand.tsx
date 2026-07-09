'use client'

/**
 * V43 — "How it works" — PINNED scroll-story band (Flock-style), shared
 * across marketplace surfaces (item detail, currency, bundles).
 *
 * Desktop: the section wraps a tall scroll RUNWAY (`lg:h-[190vh]`); the
 * band is sticky and fills the viewport below the navbar, so the page
 * appears to stop while continued scrolling drives a lime comet along
 * the progress track — steps (3D icon, lime title, one-liner) brighten
 * in sequence, then the pin releases. Mobile: no pin, columns stack,
 * everything lit.
 *
 * Context adaptation: pass `steps` to override the copy per surface
 * (e.g. "Pick Your Amount" on currency pages) — the four 3D icons and
 * the scroll mechanics stay fixed. Pass `heading` to change the display
 * line. Icons live in `src/components/icons/how-it-works/`.
 */

import { useEffect, useRef, useState } from 'react'
import { motion, useScroll, useTransform, useMotionValueEvent } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  Step1ChooseItem,
  Step2SecurePayment,
  Step3Delivery,
  Step4Confirm,
} from '@/components/icons/how-it-works'
import { SectionHeading } from '@/components/marketplace/SectionHeading'

export interface HowItWorksStepCopy {
  title: string
  body: string
}

const DEFAULT_STEPS: HowItWorksStepCopy[] = [
  { title: 'Choose Your Item', body: 'Compare offers, buy with confidence.' },
  { title: 'Pay Securely', body: 'We hold your payment in escrow.' },
  { title: 'Get Your Delivery', body: 'Fast in-game delivery, tracked live.' },
  { title: 'Confirm & Release', body: 'Confirm receipt — or get a full refund.' },
]

const STEP_ICONS = [Step1ChooseItem, Step2SecurePayment, Step3Delivery, Step4Confirm]
const STEP_NUMS = ['01', '02', '03', '04']

export default function HowItWorksBand({
  heading,
  steps = DEFAULT_STEPS,
}: {
  heading?: { kicker?: string; title: string; accent?: string }
  /** Copy override per surface — exactly 4 entries expected. */
  steps?: HowItWorksStepCopy[]
}) {
  const runwayRef = useRef<HTMLDivElement | null>(null)

  // Progress spans EXACTLY the pinned phase: 0 when the runway's top
  // reaches 96px below the viewport top (where the sticky engages —
  // matching lg:top-24, clear of the fixed navbar), 1 when its bottom
  // meets the viewport bottom (sticky releases).
  const { scrollYProgress } = useScroll({
    target: runwayRef,
    offset: ['start 96px', 'end end'],
  })
  const fill = useTransform(scrollYProgress, [0, 1], ['0%', '100%'])

  const [active, setActive] = useState(0)
  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    setActive(Math.max(0, Math.min(3, Math.floor(v * 4))))
  })

  // Below lg there is no pin — every step renders lit.
  const [isDesktop, setIsDesktop] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const update = () => setIsDesktop(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  const activeIdx = isDesktop ? active : 3

  const h = heading ?? {
    kicker: 'How it works',
    title: 'Buy Safely, Understand',
    accent: 'How',
  }

  return (
    // Full-bleed ANGLED BAND (Eldorado-style "split look") — render this
    // OUTSIDE any max-w wrapper. bg-bg-base masks the violet backdrop's
    // edge in the wedges above/below the skewed panel.
    <section className="mt-8 bg-bg-base sm:mt-10">
      {/* Scroll runway — the extra height IS the pinned scroll distance.
          V49 — trimmed from 280vh: the 01→04 ride took too much scroll. */}
      <div ref={runwayRef} className="lg:h-[190vh]">
        <div className="lg:sticky lg:top-24 lg:flex lg:min-h-[calc(100vh-6rem)] lg:flex-col lg:justify-center">
          {/* overflow-x-clip: the emblem bleeds past the right viewport
              edge — clip horizontally only (`clip` keeps sticky working). */}
          <div className="relative overflow-x-clip py-12 sm:py-14 lg:py-16">
            {/* Angled band surface with ambient underglow along the seam. */}
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-4 top-4 -skew-y-2 overflow-hidden border-t border-border-subtle bg-bg-raised/90"
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-72">
                <span className="absolute inset-x-0 top-0 h-56 bg-[radial-gradient(55%_100%_at_50%_0%,rgba(255,255,255,0.05),transparent_70%)] animate-pulse [animation-duration:12s]" />
                <span className="absolute -top-16 left-[12%] h-72 w-[36rem] -rotate-6 bg-gradient-to-b from-white/[0.03] to-transparent blur-2xl" />
                <span className="absolute -top-16 right-[10%] h-72 w-[32rem] rotate-6 bg-gradient-to-b from-white/[0.025] to-transparent blur-2xl" />
              </div>
            </div>
            {/* SafeDrop emblem — big, right side, behind the final column. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/safedrop-emblem-lg.png"
              alt=""
              aria-hidden
              className="pointer-events-none absolute -right-44 top-1/2 hidden h-[30rem] w-[30rem] -translate-y-1/2 rotate-12 select-none opacity-30 lg:block"
            />

            {/* Content — constrained back to the page width. */}
            <div className="relative mx-auto w-full max-w-7xl px-3 sm:px-6 lg:px-8">
              <SectionHeading kicker={h.kicker} title={h.title} accent={h.accent} />

              {/* Step columns */}
              <div className="mt-10 grid grid-cols-1 gap-y-12 sm:mt-12 sm:grid-cols-2 sm:gap-y-14 lg:grid-cols-4 lg:gap-y-0">
                {steps.map((s, i) => {
                  const on = i <= activeIdx
                  const Icon = STEP_ICONS[i] ?? Step4Confirm
                  // Split-tone title: only the LAST word carries lime,
                  // the rest stays primary.
                  const words = s.title.trim().split(/\s+/)
                  const accent = words.length > 1 ? words[words.length - 1] : null
                  const head = accent ? words.slice(0, -1).join(' ') : s.title
                  return (
                    <div
                      key={STEP_NUMS[i] ?? i}
                      className="flex flex-col items-center px-2 text-center"
                    >
                      <Icon
                        className={cn(
                          '-mt-2 mb-5 h-28 w-28 object-contain transition-all duration-500 sm:h-36 sm:w-36',
                          on ? 'opacity-100' : 'opacity-40 grayscale',
                        )}
                      />
                      <h3
                        className={cn(
                          'relative text-[22px] font-bold leading-tight text-text-primary transition-opacity duration-500 sm:text-[24px]',
                          on ? 'opacity-100' : 'opacity-40',
                        )}
                      >
                        {head}
                        {accent && (
                          <>
                            {' '}
                            <span className="text-lime-text">{accent}</span>
                          </>
                        )}
                      </h3>
                      <p
                        className={cn(
                          'relative mt-1.5 max-w-[260px] text-[14.5px] leading-relaxed transition-colors duration-500 sm:text-[15px]',
                          on ? 'text-text-secondary' : 'text-text-disabled',
                        )}
                      >
                        {s.body}
                      </p>
                    </div>
                  )
                })}
              </div>

              {/* Progress track — travelling lime comet + bare step numbers
                  that ignite as the comet passes. Desktop only. */}
              <div className="relative mt-10 hidden h-[3px] w-full rounded-full bg-border-subtle lg:block">
                <div className="absolute inset-0 overflow-hidden rounded-full">
                  <motion.div
                    style={{ left: fill, x: '-100%' }}
                    className="absolute inset-y-0 w-48 bg-[linear-gradient(to_right,transparent,#C6FF3D)]"
                  />
                </div>
                {STEP_NUMS.map((num, i) => (
                  <span
                    key={num}
                    style={{ left: `${i * 25 + 12.5}%` }}
                    className={cn(
                      'absolute top-full mt-2.5 -translate-x-1/2 text-[15px] font-extrabold tabular-nums tracking-wide transition-all duration-300',
                      active >= i
                        ? 'text-lime-text opacity-100 drop-shadow-[0_0_8px_rgba(198,255,61,0.45)]'
                        : 'text-text-tertiary opacity-60',
                    )}
                  >
                    {num}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
