/**
 * A seller's store banner: their uploaded image (Silver+, see
 * src/lib/shop/store-banner.ts) at the seller's chosen vertical focal point,
 * or the generated default art seeded by the seller id. Purely
 * presentational — used by the public shop header and the settings editor,
 * so both always show the same thing.
 *
 * The lower edge MELTS into the card below instead of ending on a line
 * (owner, 2026-10-05): a blurred copy of the banner, masked in with a
 * gradient so the blur grows toward the edge (a progressive blur), under an
 * eased scrim that lands exactly on the card's top colour. With
 * prefers-reduced-transparency the blur layer is dropped and the scrim alone
 * does the job.
 */

import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { bannerObjectPosition, defaultBannerArt, type ResolvedStoreBanner } from '@/lib/shop/store-banner'

/** MARKET_CARD's top colour (#212228): where the melt lands. */
export const BANNER_MELT_RGB = '33,34,40'

/**
 * An eased (not linear) ramp — a linear alpha ramp shows a visible band
 * where it starts. Alphas follow a smoothstep-like curve.
 */
function scrim(rgb: string): string {
  const stops: [number, number][] = [
    [0, 0], [0.012, 12], [0.05, 22], [0.11, 32], [0.19, 42], [0.29, 52],
    [0.41, 62], [0.55, 71], [0.69, 80], [0.82, 88], [0.93, 95], [1, 100],
  ]
  return `linear-gradient(180deg, ${stops.map(([a, p]) => `rgba(${rgb},${a}) ${p}%`).join(', ')})`
}

// Relative to the full banner height. Fully transparent until 50 %, i.e.
// below where the melt box (bottom 52 %) clips it, so the clip never shows.
const BLUR_MASK = 'linear-gradient(180deg, transparent 0%, transparent 50%, rgba(0,0,0,0.5) 76%, #000 100%)'
const blurMaskStyle: CSSProperties = { WebkitMaskImage: BLUR_MASK, maskImage: BLUR_MASK }

/**
 * The melt, on its own — the banner's bottom half softens and fades to the
 * card. `src` is the custom image (null for the generated art, where only
 * the scrim is needed).
 */
export function BannerMelt({
  src,
  focalY,
  rgb = BANNER_MELT_RGB,
  className,
}: {
  src: string | null
  focalY?: number
  rgb?: string
  className?: string
}) {
  return (
    <div aria-hidden className={cn('pointer-events-none absolute inset-x-0 bottom-0 h-[52%] overflow-hidden', className)}>
      {src && (
        // Blurred duplicate, aligned to the banner (same box, bottom-anchored),
        // masked in from transparent: the blur appears to deepen toward the
        // card. Same URL as the banner, so no second download.
        <div
          className="absolute inset-x-0 bottom-0 h-[192.3%] [@media(prefers-reduced-transparency:reduce)]:hidden"
          style={blurMaskStyle}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- images are served unoptimized (next.config) */}
          <img
            src={src}
            alt=""
            decoding="async"
            className="h-full w-full scale-[1.08] object-cover blur-[18px] saturate-[1.15]"
            style={{ objectPosition: bannerObjectPosition(focalY) }}
          />
        </div>
      )}
      <div className="absolute inset-0" style={{ background: scrim(rgb) }} />
    </div>
  )
}

export function StoreBannerArt({
  banner,
  seed,
  className,
  children,
  priority = false,
  melt = true,
  style,
}: {
  banner: ResolvedStoreBanner
  /** Seller id: keeps the default art stable per shop. */
  seed: string
  className?: string
  children?: ReactNode
  /** Above-the-fold on the shop page: load eagerly. */
  priority?: boolean
  /** Soften + fade the lower edge into the card (default on). */
  melt?: boolean
  style?: CSSProperties
}) {
  const custom = banner.kind === 'custom' ? banner : null
  return (
    <div className={cn('relative overflow-hidden bg-[#1A1B1F]', className)} style={style}>
      {custom ? (
        /* eslint-disable-next-line @next/next/no-img-element -- images are served unoptimized (next.config) */
        <img
          src={custom.url}
          alt=""
          aria-hidden
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: bannerObjectPosition(custom.focalY) }}
        />
      ) : (
        <div aria-hidden className="absolute inset-0" style={{ background: defaultBannerArt(seed).background }} />
      )}
      {melt && <BannerMelt src={custom?.url ?? null} focalY={custom?.focalY} />}
      {children}
    </div>
  )
}
