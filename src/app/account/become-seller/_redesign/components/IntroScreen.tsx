/**
 * IntroScreen — the branded landing shown at /account/become-seller BEFORE the
 * stepper, for sellers with no in-progress application. Shares the shell's
 * split-screen "Forest Ledger" world: fixed left brand panel (sell hero photo
 * under a forest scrim + logo + heading), and a MINIMAL centered ivory right
 * pane: "Become a Seller." title, one quiet line, the four-step How It Works
 * (big custom pictograms, no body text), a large Start Application CTA, and a
 * video THUMBNAIL card (not a bare button) that opens the VideoModal.
 *
 * Contract: collects nothing, touches no server action — only calls `onStart`.
 */

'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ArrowRight, Play } from 'lucide-react'
import { PALETTE, PALETTE_VARS } from '../theme'
import HowItWorks from './HowItWorks'
import VideoModal from './VideoModal'

interface IntroScreenProps {
  /** Hands control to the stepper — the "Start Application" CTA. */
  onStart: () => void
}

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
              A short, formal application. Everything you enter stays encrypted.
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

      {/* RIGHT pane — ivory, scrolls, MINIMAL + CENTERED. */}
      <div className="relative flex min-h-screen flex-col lg:h-screen lg:min-h-0 lg:overflow-y-auto">
        {/* Mobile brand strip (left panel is hidden on small screens). */}
        <div
          className="flex items-center gap-2.5 border-b px-6 py-4 lg:hidden"
          style={{ borderColor: PALETTE.line, backgroundColor: PALETTE.ivory }}
        >
          <Image
            src="/brand/logo-mark-ink.png"
            alt="DropMarket"
            width={28}
            height={28}
            className="h-7 w-7 object-contain"
          />
          <span className="text-sm font-semibold" style={{ color: PALETTE.forest }}>
            Seller Application
          </span>
        </div>

        {/* CSS entrance (animate-fade-in, opacity-only) — NOT framer (rAF stalls) and
            NOT fade-up: its translateY offset bleeds into the scroll pane and
            causes a phantom 16px scroll on the no-scroll intro. */}
        <div className="animate-fade-in mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-4 text-center sm:px-10 lg:px-14">
          {/* Title */}
          <h2
            className="text-4xl font-bold leading-tight tracking-tight sm:text-[2.6rem]"
            style={{ color: PALETTE.forest, textWrap: 'balance' }}
          >
            Become a Seller<span style={{ color: PALETTE.lime }}>.</span>
          </h2>
          <p className="mx-auto mt-3 text-base" style={{ color: PALETTE.ink2 }}>
            Five quick steps. Live in minutes.
          </p>

          {/* How It Works — centered, big custom icons, no body text */}
          <div className="mt-8">
            <HowItWorks />
          </div>

          {/* Big primary CTA */}
          <div className="mt-8 flex flex-col items-center gap-3.5">
            <StartButton onClick={onStart} />

            {/* Video thumbnail card — a real media preview, not a bare button */}
            <button
              type="button"
              onClick={() => setVideoOpen(true)}
              aria-label="Watch how selling works"
              className="group relative mx-auto block w-full max-w-xs overflow-hidden rounded-2xl text-left transition-transform hover:-translate-y-0.5 focus-visible:outline-none"
              style={{ boxShadow: `0 1px 2px rgba(15,51,32,0.12), inset 0 0 0 1px ${PALETTE.line}` }}
            >
              <div className="relative aspect-video w-full">
                <Image
                  src="/assets/heroes/sell.avif"
                  alt=""
                  fill
                  sizes="(max-width: 640px) 100vw, 320px"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
                {/* Forest wash so the play affordance reads */}
                <div
                  aria-hidden
                  className="absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(to top, rgba(15,51,32,0.82) 0%, rgba(15,51,32,0.35) 45%, rgba(15,51,32,0.25) 100%)',
                  }}
                />
                {/* Play button */}
                <span className="absolute inset-0 flex items-center justify-center">
                  <span
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-lg transition-transform group-hover:scale-105"
                    style={{ color: PALETTE.forest }}
                  >
                    <Play className="ml-0.5 h-6 w-6" fill="currentColor" strokeWidth={0} />
                  </span>
                </span>
                {/* Caption */}
                <span className="absolute inset-x-0 bottom-0 flex items-center justify-between px-4 py-3">
                  <span className="text-sm font-semibold text-white">
                    Watch How It Works
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    style={{ backgroundColor: PALETTE.lime, color: PALETTE.forest3 }}
                  >
                    90 sec
                  </span>
                </span>
              </div>
            </button>

            <p className="text-xs" style={{ color: PALETTE.ink2 }}>
              Takes about 5 minutes. You can save and finish later.
            </p>
          </div>
        </div>
      </div>

      <VideoModal open={videoOpen} onClose={() => setVideoOpen(false)} />
    </div>
  )
}

/**
 * StartButton — the primary forest CTA, LARGE, with the shell's reserved lime
 * accent on hover. Kept local so the hover state stays self-contained.
 */
function StartButton({ onClick }: { onClick: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="group inline-flex w-full max-w-sm items-center justify-center gap-2.5 rounded-2xl px-10 py-4 text-base font-semibold text-white transition-all"
      style={{
        backgroundColor: hover ? PALETTE.forest2 : PALETTE.forest,
        boxShadow: hover ? `0 0 0 2px ${PALETTE.lime}` : '0 1px 2px rgba(15,51,32,0.15)',
      }}
    >
      Start Application
      <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
    </button>
  )
}
