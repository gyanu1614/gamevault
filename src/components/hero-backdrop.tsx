/**
 * HeroBackdrop — V21/P7.c
 *
 * Canonical hero backdrop wrapper. Codifies the contract from
 * memory:hero-backdrop-pattern so every page that wants a hero gets
 * the same correct setup without re-implementing the .has-backdrop
 * + .hero-backdrop + --page-hero-image + preload dance.
 *
 * Usage on any route's `page.tsx` (server component):
 *
 *   import { HeroBackdrop, HeroBackdropPreload } from '@/components/hero-backdrop'
 *
 *   export default function Page() {
 *     return (
 *       <>
 *         <HeroBackdropPreload name="marketplace" />
 *         <HeroBackdrop name="marketplace">
 *           ... page content ...
 *         </HeroBackdrop>
 *       </>
 *     )
 *   }
 *
 * Adding a new hero: drop the source AVIF at
 * `public/assets/heroes/{name}.avif` (2880×1600, focal subject in
 * the 30%–70% center band) and reference it via the `name` prop.
 * No CSS edits, no per-page overrides — that's the contract.
 */

import type { ReactNode, CSSProperties } from 'react'
import { cn } from '@/lib/utils'

interface HeroBackdropProps {
  /** Hero name. Resolves to `/assets/heroes/{name}.{ext}`. */
  name: string
  /** Source extension. Defaults to `avif` (production). Pass `svg`
   *  while a real AVIF isn't ready yet so we don't ship a broken
   *  404 in dev. */
  ext?: 'avif' | 'svg' | 'webp' | 'png' | 'jpg'
  /** Height of the navbar spacer that the hero extends behind.
   *  Stays at 80px almost everywhere; expose so the wizard / checkout
   *  can opt out (set to 0) if they hide the navbar. */
  navbarOffset?: number
  className?: string
  children?: ReactNode
}

export function HeroBackdrop({
  name,
  ext = 'avif',
  navbarOffset = 80,
  className,
  children,
}: HeroBackdropProps) {
  const style: CSSProperties = {
    ['--page-hero-image' as any]: `url('/assets/heroes/${name}.${ext}')`,
    ['--hero-offset' as any]: `${navbarOffset}px`,
  }
  return (
    <div
      className={cn('has-backdrop relative isolate min-h-screen', className)}
      style={style}
    >
      <div className="hero-backdrop" aria-hidden="true" />
      {children}
    </div>
  )
}

/**
 * Preload link for the hero AVIF. Drop ABOVE the route's content in
 * a server `page.tsx` so the image is in flight before CSS parses
 * the .hero-backdrop's background-image rule.
 *
 * Without this, the AVIF doesn't start downloading until CSS is
 * parsed AND the .hero-backdrop element mounts — visible pop-in on
 * every navigation. Same trick used on `src/app/page.tsx`.
 */
const EXT_MIME: Record<string, string> = {
  avif: 'image/avif',
  webp: 'image/webp',
  png: 'image/png',
  jpg: 'image/jpeg',
  svg: 'image/svg+xml',
}

export function HeroBackdropPreload({
  name,
  ext = 'avif',
  priority = 'high',
}: {
  name: string
  ext?: 'avif' | 'svg' | 'webp' | 'png' | 'jpg'
  /** Fetch priority. `high` for the route's main hero (drop in
   *  `page.tsx`). `low` for warm-loading other heroes from the
   *  root layout so they're cached for later navigations. */
  priority?: 'high' | 'low' | 'auto'
}) {
  return (
    <link
      rel="preload"
      as="image"
      href={`/assets/heroes/${name}.${ext}`}
      type={EXT_MIME[ext]}
      // @ts-expect-error — fetchpriority is valid HTML; React types lag.
      fetchpriority={priority}
    />
  )
}

/**
 * AllHeroesPreload — V21/P7.g
 *
 * Drop in the ROOT layout so every hero AVIF is fetched at app load
 * and cached for every subsequent SPA navigation. Without this, hero
 * preloads in route-level `page.tsx` only fire on *initial* HTML
 * render — SPA navigations to a different route show a black flash
 * while the new hero downloads. With this, the user sees the hero
 * instantly on every page after the first visit.
 *
 * Trade-off: ~1.2MB of upfront image data on first paint. Acceptable
 * for a content-heavy site, and most of it is `fetchpriority="low"`
 * so it doesn't compete with the LCP hero of the landing page.
 */
const ALL_HEROES = ['home', 'marketplace', 'order', 'account', 'sell'] as const

export function AllHeroesPreload() {
  return (
    <>
      {ALL_HEROES.map((name) => (
        <link
          key={name}
          rel="preload"
          as="image"
          href={`/assets/heroes/${name}.avif`}
          type="image/avif"
          // @ts-expect-error — fetchpriority is valid HTML; React types lag.
          fetchpriority="low"
        />
      ))}
    </>
  )
}
