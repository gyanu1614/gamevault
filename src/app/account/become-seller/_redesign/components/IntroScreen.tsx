/**
 * IntroScreen — the branded landing shown at /account/become-seller BEFORE the
 * stepper, for sellers with no in-progress application. It shares the shell's
 * split-screen "Forest Ledger" world: a fixed left brand panel (the sell hero
 * photo under a forest scrim, DropMarket lime mark + heading + value line) and a
 * scrolling ivory right pane with the headline, the fintech "How It Works" row,
 * a "Watch How It Works" trigger, and the primary "Start Application" CTA that
 * enters the stepper.
 *
 * The intro deliberately does NOT render the vertical step rail — there is no
 * active step yet. It composes the same photo+scrim treatment as LeftRail so the
 * two screens read as one product. The VideoModal + its trigger are owned here;
 * the same modal stays reachable from inside the stepper shell (SellerAppLayout
 * exposes onWatchVideo), so the trigger is shared UX, not intro-only.
 *
 * Contract: this screen collects nothing and touches no server action. It only
 * calls back `onStart` to hand control to the stepper. The submit payload is
 * untouched.
 */

'use client'

import { useState } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { ArrowRight, PlayCircle, ShieldCheck, Clock, Wallet } from 'lucide-react'
import { PALETTE, PALETTE_VARS } from '../theme'
import HowItWorks from './HowItWorks'
import VideoModal from './VideoModal'

interface IntroScreenProps {
  /** Hands control to the stepper — the "Start Application" CTA. */
  onStart: () => void
}

/** Small reassurance chips under the headline — outcome language, no jargon. */
const ASSURANCES: { icon: typeof ShieldCheck; label: string }[] = [
  { icon: ShieldCheck, label: 'Buyer Funds Held Safe' },
  { icon: Clock, label: 'Live In Minutes' },
  { icon: Wallet, label: 'Paid On Confirmation' },
]

export default function IntroScreen({ onStart }: IntroScreenProps) {
  const [videoOpen, setVideoOpen] = useState(false)

  return (
    <div
      style={{ ...PALETTE_VARS, backgroundColor: PALETTE.ivory }}
      className="min-h-screen w-full lg:grid lg:h-screen lg:grid-cols-[37%_63%] lg:overflow-hidden"
    >
      {/* LEFT brand panel — photo + forest scrim, mirrors LeftRail. Fixed. */}
      <aside
        className="relative hidden h-full w-full overflow-hidden lg:flex lg:flex-col"
        style={{ backgroundColor: PALETTE.forest3 }}
      >
        <Image
          src="/assets/heroes/sell.avif"
          alt=""
          fill
          priority
          sizes="37vw"
          className="object-cover"
        />
        {/* Forest scrim OVER the photo — strong on the content side, fading out. */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background: `linear-gradient(105deg, ${PALETTE.forest} 0%, rgba(20,67,42,0.92) 42%, rgba(20,67,42,0.72) 72%, rgba(15,51,32,0.55) 100%)`,
          }}
        />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-1/3"
          style={{
            background: `linear-gradient(to top, ${PALETTE.forest3} 0%, rgba(15,51,32,0) 100%)`,
          }}
        />

        <div className="relative z-10 flex h-full flex-col justify-between p-10 xl:p-12">
          <div>
            <Image
              src="/brand/logo-mark-lime.png"
              alt="DropMarket"
              width={44}
              height={44}
              className="mb-8 h-11 w-11 object-contain"
            />
            <h1 className="text-3xl font-semibold tracking-tight text-white xl:text-[2rem]">
              Seller Application
            </h1>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-white/70">
              Join the marketplace where buyers trust every seller. A short,
              formal application — everything you enter stays encrypted.
            </p>
          </div>

          {/* Bottom trust note */}
          <div
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
                Why Apply
              </span>
            </div>
            <p className="text-sm leading-relaxed text-white/85">
              Approved sellers reach buyers instantly and get paid the moment an
              order is confirmed.
            </p>
          </div>
        </div>
      </aside>

      {/* RIGHT pane — ivory, scrolls. */}
      <div className="relative flex min-h-screen flex-col lg:h-screen lg:min-h-0 lg:overflow-y-auto">
        {/* Mobile brand strip (left panel is hidden on small screens). */}
        <div
          className="flex items-center gap-2.5 border-b px-6 py-4 lg:hidden"
          style={{ borderColor: PALETTE.line, backgroundColor: PALETTE.ivory }}
        >
          <Image
            src="/brand/logo-mark-lime.png"
            alt="DropMarket"
            width={28}
            height={28}
            className="h-7 w-7 object-contain"
            style={{ filter: 'none' }}
          />
          <span className="text-sm font-semibold" style={{ color: PALETTE.forest }}>
            Seller Application
          </span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          className="mx-auto w-full max-w-xl flex-1 px-6 py-10 sm:px-10 sm:py-14 lg:px-14"
        >
          {/* Headline + value line */}
          <div>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
              style={{
                backgroundColor: 'rgba(20,67,42,0.06)',
                color: PALETTE.forest2,
              }}
            >
              Become A Seller
            </span>
            <h2
              className="mt-4 text-3xl font-semibold leading-[1.15] tracking-tight sm:text-[2.4rem]"
              style={{ color: PALETTE.forest }}
            >
              Sell your games, items and top-ups with buyers who already trust you.
            </h2>
            <p className="mt-4 text-base leading-relaxed" style={{ color: PALETTE.ink2 }}>
              List what you sell, deliver to the buyer, and get paid the moment
              they confirm. We hold the buyer&apos;s funds safe in between — so
              every sale is protected on both sides.
            </p>
          </div>

          {/* Assurance chips */}
          <div className="mt-6 flex flex-wrap gap-2">
            {ASSURANCES.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium"
                style={{
                  borderColor: PALETTE.line,
                  color: PALETTE.forest,
                  backgroundColor: PALETTE.paper,
                }}
              >
                <Icon className="h-3.5 w-3.5" style={{ color: PALETTE.forest2 }} strokeWidth={2} />
                {label}
              </span>
            ))}
          </div>

          {/* How It Works */}
          <div className="mt-12">
            <h3
              className="mb-6 text-sm font-semibold uppercase tracking-wide"
              style={{ color: PALETTE.ink2 }}
            >
              How It Works
            </h3>
            <HowItWorks />
          </div>

          {/* CTAs */}
          <div className="mt-12 flex flex-col gap-3 sm:flex-row sm:items-center">
            <StartButton onClick={onStart} />
            <button
              type="button"
              onClick={() => setVideoOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border px-5 py-3 text-sm font-semibold transition-colors"
              style={{ borderColor: PALETTE.line, color: PALETTE.forest, backgroundColor: PALETTE.paper }}
            >
              <PlayCircle className="h-4 w-4" />
              Watch How It Works
            </button>
          </div>

          <p className="mt-4 text-xs" style={{ color: PALETTE.ink2 }}>
            Takes about 5 minutes. You can save and finish later.
          </p>
        </motion.div>
      </div>

      <VideoModal open={videoOpen} onClose={() => setVideoOpen(false)} />
    </div>
  )
}

/**
 * StartButton — the primary forest CTA with a lime lift on hover (the shell's
 * reserved lime accent). Kept local so the hover state can be self-contained.
 */
function StartButton({ onClick }: { onClick: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="group inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition-all"
      style={{
        backgroundColor: hover ? PALETTE.forest2 : PALETTE.forest,
        boxShadow: hover ? `0 0 0 2px ${PALETTE.lime}` : '0 1px 2px rgba(15,51,32,0.15)',
      }}
    >
      Start Application
      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
    </button>
  )
}
