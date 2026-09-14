'use client'

/**
 * HomeHeroArt — the homepage's longer-reach hero art.
 *
 * A separate component from GameHeroArt rather than a variant prop on it,
 * because the two differ in kind, not degree: this one stacks two images and
 * lets the character overhang its parent, and its fade is a 15-stop dithered
 * ramp with an edge bleed. Expressing that as flags on a shared component
 * would mean four conditionals that together spell "different component".
 * What IS shared — wrapper, clip, sibling-overlay fade — lives in
 * HeroArtLayer, which both compose.
 *
 * Reach: ~435px more than a game page, matching the audited reference.
 *   backdrop  0 → 808px
 *   character overhangs the backdrop by 168px, ending at 976px
 */

import Image from 'next/image'
import { HeroArtLayer, HOME_HERO_STOPS, HERO_ART_NORMALISE } from './HeroArtLayer'
import { HeroAtmosphere } from './HeroAtmosphere'

interface HomeHeroArtProps {
  /** Full-width environment plate behind everything. */
  backdropSrc: string
  /** Centred character plate. Overhangs the backdrop on purpose. */
  characterSrc?: string
}

export function HomeHeroArt({ backdropSrc, characterSrc }: HomeHeroArtProps) {
  return (
    <HeroArtLayer
      height="700px"
      maxHeight="700px"
      stops={HOME_HERO_STOPS}
      // Bleeds past every edge so the ramp's own edges never land on a
      // visible boundary over this longer distance.
      bleed={20}
      atmosphere={<HeroAtmosphere />}
    >
      {/* Layer 1 — full-width backdrop. `unoptimized` because the source is
          already AVIF; re-encoding it through the optimizer would only
          degrade an already-lossy file. */}
      <Image
        src={backdropSrc}
        alt=""
        aria-hidden
        fill
        sizes="100vw"
        priority
        unoptimized
        className="object-cover object-center"
        // NORMALISING filter — not a look. Art is swapped per game, and
        // without this the treatment scales with whatever screenshot is
        // supplied (a bright plate blew out, a dark one vanished). Pulling
        // every source down to a similar value first means the gradient
        // above does the same job regardless of input, with no re-tuning.
        style={{ filter: HERO_ART_NORMALISE }}
      />

      {/* Layer 2 — centred character, taller than the clip so it overhangs
          and carries the composition further down the page. */}
      {characterSrc && (
        <Image
          src={characterSrc}
          alt=""
          aria-hidden
          width={1336}
          height={976}
          priority
          unoptimized
          className="pointer-events-none absolute left-1/2 top-0 h-[845px] w-[1157px] max-w-none -translate-x-1/2 select-none object-contain opacity-95"
          // Same normalisation as the backdrop, or the two layers land at
          // different values and the composite reads as two separate images.
          style={{ filter: HERO_ART_NORMALISE }}
        />
      )}
    </HeroArtLayer>
  )
}
