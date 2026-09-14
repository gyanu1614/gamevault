'use client'

/**
 * PopularGameCard — one card in the Popular Games carousel.
 *
 * Card art only; the game name sits OUTSIDE and below the frame, centred.
 * No price or listing count — the card is a doorway to the game, not a
 * summary of its inventory.
 *
 * Aspect is 3/4 portrait, measured from the reference (190 × 253).
 *
 * Card art is deliberately NOT normalised the way hero art is: the hero's
 * filter exists to stop art competing with copy laid over it, and there is
 * no copy over a card. Game art renders at full colour here.
 */

import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import type { PopularGameCard as GameCardData } from '../lib/popular-games'

interface Props {
  game: GameCardData
}

export function PopularGameCard({ game }: Props) {
  const reduceMotion = useReducedMotion()
  // Art is optional per game — a missing file falls back to the placeholder
  // rather than a broken image.
  const [artFailed, setArtFailed] = useState(false)

  // A game with no listings is real but not yet open — shown quieter rather
  // than hidden, and never with an invented number attached.
  const isEmpty = game.listingCount === 0

  return (
    // The card art + name are one link; the category chips are their own
    // links, so they can't nest inside it — hence the wrapper.
    <div style={{ opacity: isEmpty ? 0.6 : 1 }}>
    {/* The game hub is /<slug>, NOT /games/<slug> — the latter 404s. */}
    <Link
      href={`/${game.slug}`}
      className="group block focus-visible:outline-none"
    >
      {/* No lift on hover — the card stays in place and simply reads as
          hovered: the border picks up, and the art's normalising filter
          relaxes so it brightens slightly under the pointer. */}
      <motion.div
        whileTap={reduceMotion ? undefined : { scale: 0.985 }}
        transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.7 }}
        className="relative aspect-[3/4] overflow-hidden border border-border-subtle transition-colors duration-fast group-hover:border-border-strong"
        style={{ borderRadius: 'var(--radius-lg)' }}
      >
        {/* ART PLACEHOLDER — replace the inner div with <Image fill>; the
            treatment and clip stay exactly as they are.
            The normalising filter relaxes on hover (brightness lifts, the
            rest holds), so the card responds without moving. */}
        {/* No normalising filter here. HERO_ART_NORMALISE exists to stop
            hero art fighting the copy laid over it — card art carries no
            text, so it renders at full strength and the game's own palette
            comes through. It dims slightly at REST and lifts to full on
            hover, which is the card's hover response. */}
        <div
          data-card-art
          className="absolute inset-0 transition-[filter] duration-200 ease-out"
          style={{ filter: 'brightness(0.88)' }}
        >
          {/* Placeholder sits underneath, so a game with no art file still
              reads as a card rather than an empty frame. */}
          <div
            aria-hidden
            className="grid h-full w-full place-items-center bg-bg-raised text-[10px] font-medium uppercase tracking-[0.14em] text-text-tertiary"
          >
            art
          </div>

          {!artFailed && (
            <Image
              src={`/games/art/${game.slug}.png`}
              alt=""
              aria-hidden
              fill
              sizes="(min-width:1280px) 190px, (min-width:1024px) 25vw, (min-width:640px) 33vw, 50vw"
              // Subject-anchored: the figure is meant to crop at the frame,
              // weighted to the top so faces survive the crop.
              className="object-cover object-top"
              onError={() => setArtFailed(true)}
            />
          )}
        </div>

        {/* 1px top-edge highlight — reads as a raised surface without a
            resting shadow. */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-px"
          style={{ background: 'rgba(255,255,255,0.10)' }}
        />
      </motion.div>

      {/* Name — tight to the frame so it binds to its own card rather than
          floating between rows. */}
      <p className="mt-2.5 truncate text-center text-[14px] font-semibold tracking-[-0.01em] text-text-primary">
        {game.name}
      </p>
    </Link>

      {/* Category chips — each links straight to that category's page, so a
          buyer can skip the game hub and land on Accounts or Items directly.
          Labels are the category's own name, so a game reads "V-Bucks" or
          "R6 Credits" rather than a generic "Currency". */}
      {/* Chips size to their labels (shrink-0 + nowrap) rather than sharing
          the row equally — equal shares squeezed three chips to 60px and
          truncated "Accounts" to "Accoun…". The row borrows the grid gutter
          (-mx-1) so three full-width chips fit; anything beyond the card
          edge clips rather than wrapping, which would make this card taller
          than its neighbours. Further categories aren't shown; the card
          links to the game hub, which carries the full list. */}
      {game.categories.length > 0 && (
        <div className="-mx-1 mt-2.5 flex items-center justify-center gap-1 overflow-hidden">
          {game.categories.map((category, i) => (
            <Link
              key={category.href}
              href={category.href}
              // Third chip hides below sm: cards are ~173px there and three
              // chips need ~187px. Categories are priority-ordered, so the
              // one dropped is the least-shopped.
              className={`h-7 shrink-0 items-center justify-center whitespace-nowrap rounded-[5px] border border-border-default bg-bg-overlay px-2 text-[12px] font-medium text-text-primary transition-colors duration-fast hover:border-border-strong hover:bg-bg-inset ${
                i === 2 ? 'hidden sm:inline-flex' : 'inline-flex'
              }`}
            >
              {category.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
