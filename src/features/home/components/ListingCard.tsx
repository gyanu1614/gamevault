'use client'

/**
 * ListingCard — one live listing in the Latest Listings rail.
 *
 * All text sits on one 24px inset, left-aligned; only the image is centred.
 *
 * The glow is two layers on the card's own ::after-equivalent divs: a radial
 * beam anchored bottom-centre, and a 1px edge line that fades out before the
 * corners. Both sit INSIDE the border, so the card's bottom border never
 * takes on the game's colour.
 *
 * Card art is NOT put through the hero's normalising filter — there is no
 * copy laid over it, so item images render at full strength.
 */

import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import { getGameGlow } from '../lib/game-icons'
import type { LatestListing } from '../lib/latest-listings'

/** 10000000 -> "10M", 1000 -> "1K". Currency cards lead with this. */
function compactAmount(n: number) {
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${+(n / 1_000).toFixed(1)}K`
  return String(n)
}

/**
 * Currency listings are priced per unit — Robux sells at $0.0052 each — so a
 * flat two decimals renders them as "$0.00". Sub-cent prices get the extra
 * precision they need; everything else stays at two places.
 */
function formatPrice(price: number) {
  if (price >= 0.01) return `$${price.toFixed(2)}`
  return `$${price.toFixed(4).replace(/0+$/, '')}`
}

export function ListingCard({ listing }: { listing: LatestListing }) {
  const reduceMotion = useReducedMotion()
  const [imgFailed, setImgFailed] = useState(false)

  // No `mark_bg` column exists; getGameGlow is the established per-game
  // accent map (game-icons.ts) and serves the same purpose.
  const glow = getGameGlow(listing.gameSlug)

  return (
    <Link
      href={listing.href}
      className="group block focus-visible:outline-none"
      // Declares the container so `100cqw` inside means the card's own
      // width, letting the image zone size against the card rather than
      // against the padded flex box inside it.
      style={{ containerType: 'inline-size' }}
    >
      {/* No lift on hover — same as PopularGameCard: the card stays put, the
          border picks up and the art brightens under the pointer. */}
      <motion.div
        whileTap={reduceMotion ? undefined : { scale: 0.985 }}
        transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.7 }}
        // pt-4 rather than pt-6: with the mark gone the game name is the only
        // thing in the top row, and it sits closer to the card's top edge.
        className="relative flex aspect-[1/1.1] flex-col overflow-hidden border border-border-subtle px-6 pb-5 pt-4 transition-colors duration-fast group-hover:border-border-default"
        // `isolation` keeps the glow's stacking inside the card rather than
        // letting it fall behind the section's grid backdrop.
        style={{
          borderRadius: 'var(--radius-lg)',
          isolation: 'isolate',
          // An opaque fill is load-bearing, not decoration: the section has a
          // grid backdrop, and a transparent card lets it show through the
          // card face. Set inline rather than via a utility so it doesn't
          // depend on a Tailwind rebuild.
          backgroundColor: 'var(--color-bg-well, #181D25)',
          // Recessed, not raised. A raised surface catches light on its TOP
          // edge and casts shadow below; a well does the opposite. Kept
          // deliberately shallow — the depth should register without the
          // card looking like it has a dark band painted across the top.
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.30)',
        }}
      >
        {/* Bottom inner highlight — the lit lip of the recess. Sits at the
            bottom because that's the edge facing the light in a well. */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-px"
          style={{ background: 'rgba(255,255,255,0.045)' }}
        />

        {/* Row 1 — game name only. No mark, no category tag: the item art is
            the identity, and a logo beside it was competing with that. */}
        <p className="relative truncate text-[13px] font-bold uppercase tracking-[0.08em] text-text-primary">
          {listing.gameName}
        </p>

        {/* Row 2 — the hero zone. Three treatments, because these listings
            are different KINDS of thing:
              item     — the art is the product
              currency — nothing to photograph; the amount is the product
              account  — not an object at all; the facts are the product
            All three occupy the same box, so cards stay the same height. */}
        <div
          data-card-art
          // 46% of the CARD height. Percentages here would resolve against
          // the padded content box (a different number), so this is expressed
          // against the card's own geometry via 100cqw — the card is aspect
          // 1/1.1, so its height is its width × 1.1.
          className="relative my-3 flex shrink-0 items-center justify-center transition-[filter] duration-200 ease-out"
          style={{
            // Near-full at rest: the item photo is the point of the card, and
            // dimming it on a recessed surface compounded into something that
            // read as murky. Hover lifts it the last step (globals.css).
            filter: 'brightness(0.96)',
            height: 'calc((100cqw) * 1.1 * 0.46)',
          }}
        >
          {listing.cardType === 'item' && !imgFailed && listing.image && (
            // 70% of the card width — the art reads better with room around
            // it than filling the zone edge to edge.
            <div className="relative h-full" style={{ width: 'calc(100cqw * 0.70)' }}>
              <Image
                src={listing.image}
                alt=""
                aria-hidden
                fill
                sizes="(min-width:1280px) 220px, (min-width:768px) 30vw, 45vw"
                className="object-contain"
                onError={() => setImgFailed(true)}
              />
            </div>
          )}

          {listing.cardType === 'currency' && (
            // The amount IS the hero. Mono here on purpose, unlike the price
            // below: this is a raw quantity, the kind of numeral the type
            // rules reserve mono for.
            <span className="text-center">
              <span className="block font-mono text-[30px] font-semibold leading-none tabular-nums text-text-primary">
                {listing.quantity ? compactAmount(listing.quantity) : '—'}
              </span>
              <span className="mt-2 block text-[12px] uppercase tracking-[0.08em] text-text-tertiary">
                {listing.categoryLabel}
              </span>
            </span>
          )}

          {listing.cardType === 'account' && (
            // A stat block, not a picture. Delivery is the one fact every
            // account listing actually carries.
            <span className="flex w-full flex-col gap-2">
              <span className="flex items-center justify-between border-b border-border-subtle pb-2">
                <span className="text-[12px] text-text-tertiary">Type</span>
                <span className="text-[13px] font-medium text-text-primary">Account</span>
              </span>
              <span className="flex items-center justify-between">
                <span className="text-[12px] text-text-tertiary">Delivery</span>
                <span className="truncate pl-2 text-[13px] font-medium text-text-primary">
                  {listing.deliveryTime || 'Contact seller'}
                </span>
              </span>
            </span>
          )}
        </div>

        {/* Row 3 — item name, then the price 4px beneath it. No divider. */}
        {/* mt-auto pins the name+price pair to the bottom inset, so the 12px
            gap under the image zone is a minimum rather than the whole
            remaining space. */}
        <p className="relative mt-auto truncate text-[15px] text-text-secondary">
          {listing.title}
        </p>

        <p className="relative mt-1 flex items-baseline gap-1.5">
          <span className="text-[12px] text-text-tertiary">From</span>
          {/* Inter, not JetBrains Mono, on this card only. tabular-nums is
              kept so prices still align column-to-column down the rail. */}
          <span className="text-[19px] font-semibold leading-none tabular-nums text-text-primary">
            {formatPrice(listing.price)}
          </span>
        </p>

        {/* Glow layer A — radial beam, light from below. Confined to the
            bottom quarter so it never rises past the price line. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-1/4"
          style={{
            background: `radial-gradient(ellipse 55% 42% at 50% 100%, ${glow}2E 0%, transparent 100%)`,
          }}
        />

        {/* Glow layer B — 1px edge line, bright at centre, invisible at the
            corners. Sits INSIDE the border so the border itself never tints. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
          style={{
            background: `linear-gradient(90deg, transparent 30%, ${glow}B3 50%, transparent 70%)`,
          }}
        />
      </motion.div>
    </Link>
  )
}
