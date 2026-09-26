'use client'

/**
 * HeroArtLayer — the shared hero-art mechanism.
 *
 * Owns the three things the game-page hero and the homepage hero genuinely
 * share, and nothing else:
 *
 *   1. A `-z-10` wrapper offset by the navbar height, sitting OUTSIDE the
 *      rhythm container as a sibling.
 *   2. A `relative overflow-hidden` clip.
 *   3. A SIBLING overlay div carrying a linear-gradient that never reaches
 *      transparent. The art is suppressed everywhere and merely least
 *      covered at the top; `overflow-hidden` then hard-clips it, and the
 *      clip edge is invisible because the gradient is already near-opaque
 *      by that point.
 *
 * Deliberately NOT mask-image and NOT a pseudo-element — a mask fades to
 * genuinely transparent, which exposes the clip edge as a visible seam.
 *
 * The art itself is passed as children so callers can stack one image
 * (game pages) or two (the homepage), without this file growing a branch
 * for each case.
 */

import type { ReactNode } from 'react'

interface HeroArtLayerProps {
  /** Art layers. Rendered inside the clip, beneath the fade. */
  children: ReactNode
  /** Clip height. Game pages: `60vh`, capped. Homepage runs taller. */
  height: string
  maxHeight: string
  /**
   * Gradient stops, bottom → top, as [position%, alpha] pairs.
   * Alpha never reaches 0: see the class comment above.
   */
  stops: ReadonlyArray<readonly [number, number]>
  /**
   * Bleed the fade past every edge, in px. The homepage's longer ramp needs
   * it so the gradient's own edges never land on a visible boundary.
   */
  bleed?: number
  /**
   * Decorative layers rendered ABOVE the fade — bloom, sheen, motes. They
   * have to sit above it, or the ramp buries them along with the art.
   */
  atmosphere?: ReactNode
}

/** Page ground as an rgb triplet, so stops can carry their own alpha. */
const GROUND = 'var(--color-bg-base-rgb, 23, 27, 33)'

/**
 * Normalising filter applied to every hero <img> BEFORE the gradient.
 *
 * Art is swapped per game, so without this the treatment scales with
 * whatever screenshot is supplied — a bright plate blows out, a dark one
 * disappears, and the gradient needs re-tuning each time. Pulling every
 * source to a similar value first makes the gradient input-independent:
 * drop in any screenshot and it lands in roughly the same place.
 *
 * `contrast(0.75)` is the important part and is easy to mistake for a look.
 * It compresses the image's own dynamic range, pulling darks and brights
 * toward each other. Without it an unevenly lit screenshot keeps its range
 * through a flat gradient, so one side of the frame disappears while the
 * other reads. Brightness alone cannot fix that — it moves the whole range,
 * it doesn't narrow it.
 *
 * If a plate still reads wrong, adjust THIS — never the gradient stops.
 */
export const HERO_ART_NORMALISE = 'brightness(0.5) contrast(0.75) saturate(0.6)'

export function HeroArtLayer({
  children,
  height,
  maxHeight,
  stops,
  bleed = 0,
  atmosphere,
}: HeroArtLayerProps) {
  const gradient = `linear-gradient(to top, ${stops
    .map(([pos, alpha]) => `rgba(${GROUND}, ${alpha}) ${pos}%`)
    .join(', ')})`

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 w-full"
    >
      <div className="relative w-full overflow-hidden" style={{ height, maxHeight }}>
        {children}

        {/* Fade — a sibling of the art, never a mask. */}
        <div
          className="absolute"
          style={{ inset: bleed ? `-${bleed}px` : 0, background: gradient }}
        />

        {/* Decorative layers sit ABOVE the fade, or the ramp buries them
            along with the art. */}
        {atmosphere}
      </div>
    </div>
  )
}

/**
 * Game-page fade: the reference's three stops, rebased on our ground.
 * Solid at the bottom, 90% even at the very top.
 */
export const GAME_HERO_STOPS = [
  [0, 1],
  [50, 0.95],
  [100, 0.9],
] as const

/**
 * Homepage fade: the same curve stretched over a much longer distance, so
 * three stops would band visibly. Generated as 15 stops on an ease curve
 * between the same endpoints — a dithered ramp, written as data rather than
 * fifteen hand-tuned literals.
 */
export const HOME_HERO_STOPS = Array.from({ length: 15 }, (_, i) => {
  const t = i / 14
  // Solid at the bottom so the art dissolves into the page with no seam,
  // never below 0.9 at the top — the art is heavily suppressed everywhere
  // and merely LEAST covered up here, never more than 10% visible.
  //
  // This ramp assumes a normalised input: the <img> carries its own
  // brightness/saturate filter (see HomeHeroArt / GameHeroArt) so bright and
  // dark screenshots both arrive at a similar value. Do NOT re-tune these
  // stops per image — fix the normalising filter instead, or every swapped
  // game plate needs its own gradient.
  const eased = t * t * (3 - 2 * t)
  const TOP_INK = 0.86
  return [
    Math.round(t * 1000) / 10,
    Math.round((1 - eased * (1 - TOP_INK)) * 1000) / 1000,
  ] as const
})
