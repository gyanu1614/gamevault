'use client'

/**
 * FoundingRail — the fixed forest panel (~38% on desktop) for the Founding
 * Seller HQ. Deliberately inherits the seller application's left rail
 * (src/app/account/become-seller/_redesign/components/LeftRail.tsx): the same
 * sell.avif hero photo, the same 105deg forest scrim fading toward the far edge,
 * the same white DropMarket lockup — so HQ and the application read as one
 * continuous section (they are the same journey).
 *
 * Content differs: a personal greeting, the standout "#N of 100" spot figure
 * anchored between hairlines, and the three founding perks as an aligned list.
 * On mobile the rail collapses to a compact forest header (rendered by the page,
 * not here).
 */

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Percent, Zap, BadgeCheck } from 'lucide-react'
import { PALETTE } from '@/app/account/become-seller/_redesign/theme'

interface FoundingRailProps {
  /** Greeting name; null in generic mode (no personal data). */
  name: string | null
  /** Join order among all founders; null when unknown/generic. */
  joinNumber: number | null
  /** Total founding spots (100). */
  cap: number
  /** How many spots are claimed/waitlisted so far, for the progress bar. */
  claimed: number
}

const PERKS = [
  { icon: Percent, label: '2% lower fees, locked for life' },
  { icon: Zap, label: 'List before the public launch' },
  { icon: BadgeCheck, label: 'Founding badge on your storefront' },
] as const

export default function FoundingRail({ name, joinNumber, cap, claimed }: FoundingRailProps) {
  const percent = Math.min(100, Math.round((claimed / cap) * 100))

  return (
    <aside
      className="relative flex min-h-[280px] w-full flex-col justify-between overflow-hidden p-8 lg:h-screen lg:p-10 xl:p-12"
      style={{ backgroundColor: PALETTE.forest3 }}
    >
      {/* Hero photo — same asset as the seller application */}
      <Image
        src="/assets/heroes/sell.avif"
        alt=""
        fill
        priority
        sizes="(max-width: 1024px) 100vw, 38vw"
        className="object-cover"
      />
      {/* Forest scrim over the photo: strong on the content side, fading out. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `linear-gradient(105deg, ${PALETTE.forest} 0%, rgba(20,67,42,0.93) 44%, rgba(20,67,42,0.76) 74%, rgba(15,51,32,0.6) 100%)`,
        }}
      />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-1/3"
        style={{ background: `linear-gradient(to top, ${PALETTE.forest3} 0%, rgba(15,51,32,0) 100%)` }}
      />

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex h-full flex-col justify-between gap-8"
      >
        {/* Top: logo + greeting */}
        <div>
          <Link
            href="/"
            aria-label="DropMarket home"
            className="mb-7 inline-flex items-center gap-2.5 transition-opacity hover:opacity-80"
          >
            <Image
              src="/brand/logo-mark-white.png"
              alt="DropMarket"
              width={36}
              height={36}
              className="h-9 w-9 object-contain"
            />
            <span className="text-lg font-bold tracking-tight text-white">
              Drop<span className="text-white/65">Market</span>
            </span>
          </Link>
          <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: PALETTE.lime }}>
            Founding Seller
          </p>
          <h1 className="text-[26px] font-semibold leading-[1.15] tracking-tight text-white xl:text-[28px]">
            {name ? <>Welcome in, {name}.</> : <>You&rsquo;re early.<br />Claim your spot.</>}
          </h1>
          <p className="mt-3.5 max-w-xs text-sm leading-relaxed text-white/70">
            {name
              ? 'One of the first traders on DropMarket. Here’s where you stand, the latest from us, and the door to start selling.'
              : 'Be one of the first hundred sellers on DropMarket — lower fees for life, first dibs on listing, and a badge buyers can see.'}
          </p>
        </div>

        {/* Middle: the standout spot figure, centered between hairlines */}
        <div
          className="border-y py-5 text-center lg:py-6"
          style={{ borderColor: 'rgba(255,255,255,0.14)' }}
        >
          {joinNumber ? (
            <div className="text-[40px] font-bold leading-none tracking-tight text-white lg:text-[52px]">
              #{joinNumber}
            </div>
          ) : (
            <div className="text-[34px] font-bold leading-none tracking-tight text-white lg:text-[40px]">
              First {cap}
            </div>
          )}
          <div className="mt-2.5 text-[12.5px] text-white/65">
            {joinNumber ? 'of the first ' : 'founding sellers · '}
            {joinNumber && <span className="font-semibold" style={{ color: PALETTE.lime }}>{cap}</span>}
            {joinNumber ? ' founding spots' : `${claimed} claimed so far`}
          </div>
          <div className="mt-3.5 h-[5px] w-full overflow-hidden rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.14)' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${percent}%` }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.25 }}
              className="h-full rounded-full"
              style={{ backgroundColor: PALETTE.lime }}
            />
          </div>
        </div>

        {/* Bottom: perks — compact wrap-row on mobile, vertical list on desktop */}
        <ul className="flex flex-wrap gap-x-4 gap-y-2.5 lg:flex-col lg:gap-3">
          {PERKS.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-2 lg:gap-3">
              <Icon className="h-[17px] w-[17px] shrink-0 lg:h-[19px] lg:w-[19px]" style={{ color: PALETTE.lime }} strokeWidth={2} />
              <span className="text-[12.5px] text-white/90 lg:text-[13px]">{label}</span>
            </li>
          ))}
        </ul>
      </motion.div>
    </aside>
  )
}
