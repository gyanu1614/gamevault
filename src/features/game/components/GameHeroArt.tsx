'use client'

/**
 * GameHeroArt — the shared game-page hero art.
 *
 * One image, one three-stop fade. Identical on every game page: the only
 * per-game input is the art file, and games without bespoke art fall back to
 * a shared default. There is deliberately NO per-game layout variation.
 */

import Image from 'next/image'
import {
  HeroArtLayer,
  GAME_HERO_STOPS,
  HERO_ART_NORMALISE,
} from '@/features/home/components/HeroArtLayer'

/**
 * Hero art lives at `/public/hero/<slug>.avif` — one flat folder, filename
 * matches the game slug. Games without bespoke art fall back to this shared
 * plate, the way the reference falls back to its `default.webp`.
 *
 * Source files are AVIF: already compressed, so `unoptimized` is set on the
 * <Image> below. Running an AVIF back through Next's optimizer would re-encode
 * an already-lossy file for no gain.
 */
export const DEFAULT_GAME_HERO_ART = '/hero/default.avif'

/** Resolve a game's hero art by slug, falling back to the shared plate. */
export function gameHeroArtSrc(slug: string) {
  return `/hero/${slug}.avif`
}

interface GameHeroArtProps {
  /** Bespoke art for this game. Omit to use the shared default. */
  artSrc?: string
}

export function GameHeroArt({ artSrc }: GameHeroArtProps) {
  return (
    <HeroArtLayer height="60vh" maxHeight="550px" stops={GAME_HERO_STOPS}>
      <Image
        src={artSrc || DEFAULT_GAME_HERO_ART}
        alt=""
        aria-hidden
        fill
        sizes="100vw"
        priority
        unoptimized
        // Framing matches the audited reference: centred on phones, biased to
        // the upper-middle of the plate from sm up.
        className="object-cover object-center sm:[object-position:0_40%]"
        // Normalises whatever screenshot a game supplies, so the gradient
        // never needs tuning per game. See HERO_ART_NORMALISE.
        style={{ filter: HERO_ART_NORMALISE }}
      />
    </HeroArtLayer>
  )
}
