'use client'

/**
 * ListingCardCompact — the phone card in the Latest Listings rail.
 *
 * Smaller than ListingCard (sm+ keeps that one). The listing's picture (the
 * currency's own icon, the item image, or the game logo; see bgImage in
 * latest-listings.ts) fills the card as a faded background instead of
 * sitting in a centred image zone, and the text sits on top: game name,
 * then what's for sale, then the starting price.
 */

import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import { formatPrice } from './ListingCard'
import type { LatestListing } from '../lib/latest-listings'

const WELL = 'var(--color-bg-well, #181D25)'

export function ListingCardCompact({ listing }: { listing: LatestListing }) {
  const reduceMotion = useReducedMotion()
  const [bgFailed, setBgFailed] = useState(false)
  const bg = !bgFailed ? listing.bgImage : null

  return (
    <Link href={listing.href} className="group block focus-visible:outline-none">
      <motion.div
        whileTap={reduceMotion ? undefined : { scale: 0.985 }}
        transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.7 }}
        className="relative flex aspect-[4/5] flex-col justify-between overflow-hidden border border-border-subtle p-3"
        style={{
          borderRadius: 'var(--radius-card)',
          isolation: 'isolate',
          backgroundColor: WELL,
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.30)',
        }}
      >
        {bg && (
          // Faded, slightly enlarged so the art's own edges never show.
          // unoptimized: sources are admin icons, listing images and game
          // logos from several hosts, and at this opacity the optimizer
          // buys nothing.
          <Image
            src={bg}
            alt=""
            aria-hidden
            fill
            unoptimized
            className="-z-20 scale-110 object-cover opacity-[0.28]"
            onError={() => setBgFailed(true)}
          />
        )}
        {/* Scrim: darker at the bottom where the name and price sit. */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background: `linear-gradient(to top, ${WELL} 12%, rgba(24,29,37,0.55) 55%, rgba(24,29,37,0.15) 100%)`,
          }}
        />

        <p className="truncate text-[10.5px] font-bold uppercase tracking-[0.08em] text-text-secondary">
          {listing.gameName}
        </p>

        <div className="min-w-0">
          <p className="line-clamp-2 text-[13.5px] font-semibold leading-snug text-text-primary">
            {listing.title}
          </p>
          <p className="mt-1.5 text-[10.5px] font-medium text-text-tertiary">Starting From</p>
          <p className="text-[15px] font-semibold leading-tight tabular-nums text-text-primary">
            {formatPrice(listing.price)}
          </p>
        </div>
      </motion.div>
    </Link>
  )
}
