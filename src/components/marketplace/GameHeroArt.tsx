import type { CSSProperties } from 'react'
import type { GameHero } from '@/lib/games/hero'
import { cn } from '@/lib/utils'

/**
 * The painted hero band — markup only (no data, no hooks), so the server
 * backdrop and the admin preview draw the SAME layers. The look (night
 * filter, veil, light, fade, scroll push) lives in globals.css under
 * "Hero recipe"; see GameHeroBackdrop for how it is placed and loaded.
 */

/** "adopt-me" → "Adopt Me": enough for an image's alt text without a DB read. */
export function gameNameFromSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/** Band height per surface (globals.css `.game-hero[data-size]`). */
export type GameHeroSize = 'market' | 'hub' | 'tall'

export function GameHeroArt({
  hero,
  size,
  className,
  alt = 'Game background art',
}: {
  hero: GameHero
  size: GameHeroSize
  className?: string
  /** Short description of the art (the band itself stays aria-hidden). */
  alt?: string
}) {
  const style = { '--game-hero-focal': `${hero.focalY}%` } as CSSProperties
  return (
    <div aria-hidden className={cn('game-hero', className)} data-size={size} data-hero={hero.kind} style={style}>
      {hero.kind === 'upload' && hero.blur ? (
        // The LQIP, inlined: paints with the HTML, before any image request.
        <div className="game-hero__ground" style={{ backgroundImage: `url("${hero.blur}")` }} />
      ) : (
        <div className="game-hero__ground game-hero__ground--neutral" />
      )}
      {hero.kind !== 'none' && (
        // eslint-disable-next-line @next/next/no-img-element -- pre-sized WebPs served straight from storage; no optimizer on purpose
        <img
          className="game-hero__art"
          src={hero.src}
          srcSet={hero.kind === 'upload' ? hero.srcSet : undefined}
          sizes={hero.kind === 'upload' ? '100vw' : undefined}
          alt={alt}
          fetchPriority="high"
          decoding="async"
          draggable={false}
        />
      )}
      <GameHeroOverlays />
    </div>
  )
}

/** Veil + light + fade — the layers over the art (also used by the admin preview). */
export function GameHeroOverlays() {
  return (
    <>
      <div className="game-hero__veil" />
      <div className="game-hero__light" />
      <div className="game-hero__fade" />
    </>
  )
}
