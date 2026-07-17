/**
 * LeftRail — the fixed left panel (~37% on desktop). Background is the sell hero
 * photo with a forest-green scrim OVER it (like the homepage hero): the photo is
 * "half visible, half fading" — strong forest on the content side, thinning out
 * toward the far edge. On top: the DropMarket lime logo mark, a "Seller
 * Application" heading, the vertical Stepper, and a rotating "why we ask" trust
 * block at the bottom that cross-fades to match the active step.
 *
 * The rail does NOT scroll; it's a sticky/fixed column. On mobile it isn't
 * rendered — SellerAppLayout swaps in a thin top progress bar instead.
 */

'use client'

import Image from 'next/image'
import { AnimatePresence, motion } from 'framer-motion'
import { PALETTE, TRUST_BY_STEP } from '../theme'
import Stepper from './Stepper'

interface LeftRailProps {
  currentStep: number
  onStepClick?: (step: number) => void
}

export default function LeftRail({ currentStep, onStepClick }: LeftRailProps) {
  const trust = TRUST_BY_STEP[currentStep] ?? TRUST_BY_STEP[1]

  return (
    <aside
      className="relative hidden h-full w-full overflow-hidden lg:flex lg:flex-col"
      style={{ backgroundColor: PALETTE.forest3 }}
    >
      {/* Hero photo */}
      <Image
        src="/assets/heroes/sell.avif"
        alt=""
        fill
        priority
        sizes="37vw"
        className="object-cover"
      />

      {/* Forest scrim OVER the photo — strong on the content (left) side,
          fading toward the far (right) edge so the photo stays half visible. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `linear-gradient(105deg, ${PALETTE.forest} 0%, rgba(20,67,42,0.92) 42%, rgba(20,67,42,0.72) 72%, rgba(15,51,32,0.55) 100%)`,
        }}
      />
      {/* Subtle bottom vignette to seat the trust block. */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-1/3"
        style={{
          background: `linear-gradient(to top, ${PALETTE.forest3} 0%, rgba(15,51,32,0) 100%)`,
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex h-full flex-col justify-between p-10 xl:p-12">
        {/* Top: logo + heading */}
        <div>
          <div className="mb-8 flex items-center gap-2.5">
            <Image
              src="/brand/logo-mark-white.png"
              alt="DropMarket"
              width={40}
              height={40}
              className="h-10 w-10 object-contain"
            />
            <span className="text-xl font-bold tracking-tight text-white">
              Drop<span className="text-white/70">Market</span>
            </span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-white xl:text-[2rem]">
            Seller Application
          </h1>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-white/70">
            A short, formal application. Everything you enter stays encrypted and
            private.
          </p>
        </div>

        {/* Middle: stepper */}
        <div className="my-10">
          <Stepper currentStep={currentStep} onStepClick={onStepClick} />
        </div>

        {/* Bottom: rotating trust block, cross-fades per step */}
        <div className="min-h-[92px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
              className="rounded-xl border p-4"
              style={{
                borderColor: 'rgba(255,255,255,0.12)',
                backgroundColor: 'rgba(255,255,255,0.06)',
              }}
            >
              <div className="mb-1 flex items-center gap-2">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: PALETTE.lime }}
                />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-white/60">
                  {trust.title}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-white/85">{trust.body}</p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </aside>
  )
}
