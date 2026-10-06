'use client'

/**
 * How It Works: a compact, full-bleed band shared by the currency, bundle,
 * game hub and listing detail pages.
 *
 * Owner, 2026-10-05: the old pinned 190vh runway with a skewed band, a
 * "— HOW IT WORKS —" eyebrow plus a second display line and 144px icons
 * was too big. Now:
 *   - ONE H2, written as the search phrase ("How to Buy Robux on DropMarket").
 *   - A raised band with CURVED top and bottom edges (SVG waves filled with
 *     the band colour over the page ground), no straight slants.
 *   - Four steps in one row on tablet/desktop, a vertical timeline on
 *     phones. The 3D icons sit in small discs on a progress line.
 *   - Scroll story without pinning: Framer's useScroll maps the band's trip
 *     through the viewport to a progress value; the line fills and each step
 *     lights up in turn (the current one gets a soft lime ring).
 *   - Reduced motion, and the server HTML: every step is lit and the line is
 *     full. Nothing is hidden before hydration, so every word is in the HTML.
 *
 * Copy per surface comes in through `title` and `steps` (exactly four).
 * Icons live in `src/components/icons/how-it-works/`.
 */

import { useEffect, useRef, useState } from 'react'
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  Step1ChooseItem,
  Step2SecurePayment,
  Step3Delivery,
  Step4Confirm,
} from '@/components/icons/how-it-works'

export interface HowItWorksStepCopy {
  title: string
  body: string
}

const DEFAULT_STEPS: HowItWorksStepCopy[] = [
  { title: 'Choose Your Item', body: 'Compare offers by price, delivery time and rating.' },
  { title: 'Pay at Checkout', body: 'Every order is covered by SafeDrop Protection.' },
  { title: 'Get Your Delivery', body: 'Delivered in-game, tracked in your order chat.' },
  { title: 'Confirm Delivery', body: 'Confirm and the order is complete, or get a full refund.' },
]

const STEP_ICONS = [Step1ChooseItem, Step2SecurePayment, Step3Delivery, Step4Confirm]

/** Band surface: a step above the page ground, same black family (no blue tint). */
const BAND = '#1F2025'
const EDGE = 'rgba(255,255,255,0.10)'

/**
 * Curved split line. Drawn in a 1440×64 box stretched to the band width; the
 * filled side is the band, the open side shows the page ground. The bottom
 * edge is the same curve rotated 180°, so the band reads as one shape.
 */
const WAVE = 'M0,54 C260,6 520,0 760,28 C1000,54 1220,60 1440,12'
function CurveEdge({ side }: { side: 'top' | 'bottom' }) {
  return (
    <svg
      aria-hidden
      focusable="false"
      viewBox="0 0 1440 64"
      preserveAspectRatio="none"
      className={cn('block h-8 w-full sm:h-12 lg:h-14', side === 'bottom' && 'rotate-180')}
    >
      <path d={`${WAVE} L1440,64 L0,64 Z`} style={{ fill: BAND }} />
      <path d={WAVE} fill="none" stroke={EDGE} strokeWidth="1" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export default function HowItWorksBand({
  title = 'How to Buy on DropMarket',
  sub,
  steps = DEFAULT_STEPS,
}: {
  /** The section's H2: write it as the search phrase. */
  title?: string
  /** Optional one-line subtitle. */
  sub?: string
  /** Copy per surface: exactly four entries. */
  steps?: HowItWorksStepCopy[]
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const reduce = useReducedMotion()
  const n = steps.length

  // 0 as the band's top enters the lower part of the screen, 1 as its
  // bottom passes the middle: the story plays while the band is in view,
  // with no pinning.
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.85', 'end 0.55'] })
  const smooth = useSpring(scrollYProgress, { stiffness: 160, damping: 28, mass: 0.35 })
  // Step i lights at progress i/n; the line reaches step i's centre then.
  const fill = useTransform(smooth, [0, (n - 1) / n], [0, 1], { clamp: true })

  const toStep = (v: number) => Math.max(0, Math.min(n - 1, Math.floor(v * n)))
  // Server render and reduced motion: everything lit.
  const [active, setActive] = useState(n - 1)
  const [live, setLive] = useState(false)
  useEffect(() => {
    if (reduce) {
      setLive(false)
      setActive(n - 1)
      return
    }
    setLive(true)
    setActive(toStep(scrollYProgress.get()))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce, n])
  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    if (!reduce) setActive(toStep(v))
  })

  const lineStyle = live ? { scaleX: fill } : undefined
  const lineStyleY = live ? { scaleY: fill } : undefined

  return (
    <section aria-labelledby="how-it-works-title" className="relative mt-12 sm:mt-16">
      <CurveEdge side="top" />
      <div ref={ref} className="relative -my-px" style={{ background: BAND }}>
        {/* A soft light from the top curve, nothing more. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(50%_100%_at_50%_0%,rgba(255,255,255,0.035),transparent_70%)]"
        />
        <div className="relative mx-auto w-full max-w-6xl px-4 pb-5 pt-3 sm:px-6 sm:pb-6 lg:px-8">
          <div className="text-center">
            <h2
              id="how-it-works-title"
              className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-text-primary sm:text-[28px]"
            >
              {title}
            </h2>
            {sub && <p className="mx-auto mt-2 max-w-xl text-[14px] text-text-secondary sm:text-[15px]">{sub}</p>}
          </div>

          {/* Steps: vertical timeline on phones, one row from sm up. */}
          <ol className="relative mt-7 grid grid-cols-1 gap-5 sm:mt-9 sm:grid-cols-4 sm:gap-4">
            {/* Progress line, horizontal (sm+): between the first and last disc centres. */}
            <span
              aria-hidden
              className="pointer-events-none absolute left-[12.5%] right-[12.5%] top-9 hidden h-px bg-white/[0.08] sm:block"
            >
              <motion.span
                style={lineStyle}
                className="absolute inset-0 origin-left bg-[linear-gradient(90deg,rgba(198,255,61,0.15),rgba(198,255,61,0.7))]"
              />
            </span>
            {/* Progress line, vertical (phones). */}
            <span
              aria-hidden
              className="pointer-events-none absolute bottom-7 left-7 top-7 w-px bg-white/[0.08] sm:hidden"
            >
              <motion.span
                style={lineStyleY}
                className="absolute inset-0 origin-top bg-[linear-gradient(180deg,rgba(198,255,61,0.15),rgba(198,255,61,0.7))]"
              />
            </span>

            {steps.map((s, i) => {
              const Icon = STEP_ICONS[i] ?? Step4Confirm
              const lit = i <= active
              const current = live && i === active
              return (
                <li
                  key={s.title}
                  className="relative flex items-center gap-4 sm:flex-col sm:items-center sm:gap-0 sm:text-center"
                >
                  <span
                    className={cn(
                      'relative grid h-14 w-14 shrink-0 place-items-center rounded-full transition-[box-shadow,background-color] duration-500 sm:h-[72px] sm:w-[72px]',
                      'bg-[#202127] shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]',
                      current &&
                        'shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_0_0_1px_rgba(198,255,61,0.45),0_0_28px_-6px_rgba(198,255,61,0.5)]',
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-10 w-10 object-contain transition-[opacity,filter,transform] duration-500 sm:h-[52px] sm:w-[52px]',
                        lit ? 'opacity-100' : 'scale-90 opacity-35 grayscale',
                      )}
                    />
                    <span
                      aria-hidden
                      className={cn(
                        'absolute -right-0.5 -top-0.5 grid h-5 w-5 place-items-center rounded-full text-[11px] font-semibold tabular-nums transition-colors duration-500',
                        lit ? 'bg-lime text-text-inverse' : 'bg-bg-overlay text-text-tertiary',
                      )}
                    >
                      {i + 1}
                    </span>
                  </span>
                  <div className={cn('min-w-0 transition-opacity duration-500 sm:mt-3.5', lit ? 'opacity-100' : 'opacity-45')}>
                    <h3 className="text-[15.5px] font-semibold leading-snug tracking-[-0.01em] text-text-primary sm:text-[16px]">
                      {s.title}
                    </h3>
                    <p className="mt-0.5 text-[13.5px] leading-snug text-text-secondary sm:mx-auto sm:mt-1 sm:max-w-[220px]">
                      {s.body}
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>

          {/* One slim callout: the guarantee, with the 3D shield. */}
          <p className="mx-auto mt-7 flex w-fit max-w-full items-start gap-2.5 sm:items-center rounded-md bg-white/[0.045] px-3 py-2 text-[13px] text-text-secondary sm:mt-8 sm:text-[13.5px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/safedrop-emblem-lg.png"
              alt=""
              aria-hidden
              width={20}
              height={20}
              loading="lazy"
              decoding="async"
              className="mt-px h-5 w-5 shrink-0 object-contain sm:mt-0"
            />
            <span>
              <span className="font-semibold text-lime-text">SafeDrop Protection</span>
              <span className="text-text-tertiary"> · </span>
              Item Guaranteed or Full Refund<span className="hidden sm:inline"> on every order</span>.
            </span>
          </p>
        </div>
      </div>
      <CurveEdge side="bottom" />
    </section>
  )
}
