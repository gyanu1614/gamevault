'use client'

/**
 * Shared content-hub background for every game's hub (values, calculators,
 * blog, methodology, price index).
 *
 * Two layers:
 *  1. A FULL-PAGE fixed background image, per game, heavily dimmed so it reads
 *     as rich atmosphere behind everything without fighting the content
 *     (~12% visible). The image is `/assets/heroes/{gameSlug}.avif`, chosen
 *     from the current path — so Adopt Me shows the Adopt Me art, SAB shows
 *     SAB's, etc. Missing files fall back to the SAB image, so a game with no
 *     art still looks finished.
 *  2. The original TOP hero band, more visible near the top so the hero has
 *     extra presence, fading into the fixed layer below.
 *
 * Renders both fixed layers + opens a `relative z-10` content wrapper, so wrap
 * the page's content in `<SabHeroBackdrop>{children}</SabHeroBackdrop>`.
 *
 * Client component: it reads the path to pick the per-game image and needs an
 * onError fallback. It only renders decorative layers + passes children
 * straight through, so server-rendered children still work unchanged.
 */

import { useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'

const FALLBACK = '/assets/heroes/steal-a-brainrot.avif'

export function SabHeroBackdrop({
  height = 480,
  children,
}: {
  /** Top-band height in px — taller for content-heavy pages. */
  height?: number
  children: React.ReactNode
}) {
  const pathname = usePathname() ?? ''

  // First path segment is the game slug (/adopt-me/blog → adopt-me).
  const initialSrc = useMemo(() => {
    const seg = pathname.split('/').filter(Boolean)[0]
    return seg ? `/assets/heroes/${seg}.avif` : FALLBACK
  }, [pathname])

  // Try the per-game hero; on 404 fall back to the SAB art so it's never blank.
  const [src, setSrc] = useState<string>(initialSrc)
  const onErr = () => {
    if (src !== FALLBACK) setSrc(FALLBACK)
  }

  return (
    <>
      {/* ── Full-page fixed background — the whole hub sits over this. Very
          subtle: desaturated + a heavy near-black wash so only rich detail
          bleeds through as atmosphere. `fixed` keeps it steady while the page
          scrolls. z-0: above the transparent page shell, below the z-10
          content wrapper. The HubFooter carries its own `relative z-10` so it
          isn't washed out by this layer. ── */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element -- decorative bg
            that needs an onError fallback for missing per-game files */}
        <img
          src={src}
          alt=""
          onError={onErr}
          className="absolute inset-0 h-full w-full object-cover opacity-[0.07] [filter:grayscale(0.45)]"
        />
        {/* Near-black wash so text stays crisp over any part of the image. */}
        <div className="absolute inset-0 bg-[#0C0F0E]/[0.80]" />
      </div>

      {/* ── Top hero band — the original treatment, slightly more visible at the
          very top for hero presence, fading into the fixed layer below. ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-0 overflow-hidden"
        style={{ height }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- decorative */}
        <img
          src={src}
          alt=""
          onError={onErr}
          className="absolute inset-0 h-full w-full bg-[center_top] object-cover opacity-[0.85] [filter:grayscale(0.35)]"
        />
        {/* Near-black scrim, lighter at the top so the image shows through, then
            deepening to solid so content stays crisp and it fades into the page. */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0C0F0E]/[0.45] via-[#0C0F0E]/[0.78] to-[#0C0F0E]" />
        {/* Soft edge vignette. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(120% 90% at 50% 15%, transparent 35%, rgba(12,15,14,0.45) 100%)',
          }}
        />
      </div>

      <div className="relative z-10">{children}</div>
    </>
  )
}
