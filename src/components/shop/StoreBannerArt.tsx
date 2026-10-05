/**
 * A seller's store banner: their uploaded image (Silver+, see
 * src/lib/shop/store-banner.ts) at the seller's chosen vertical focal point,
 * or the generated default art seeded by the seller id. Purely
 * presentational — used by the public shop header and the settings editor,
 * so both always show the same thing.
 *
 * The lower edge MELTS into the card below instead of ending on a line
 * (owner, 2026-10-05; softened + lengthened the same day): a blurred copy of the banner, masked in with a
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
  // Owner, 2026-10-05: the first melt went grey too quickly. The tint now
  // stays light for most of the melt (the blur does the softening) and only
  // closes to the card colour in the last stretch, so the edge still never
  // shows a seam.
  // An even S-curve over the whole melt: light at the top, no sprint at the
  // end, landing on the card colour slightly before the edge.
  const stops: [number, number][] = [
    [0, 0], [0.03, 10], [0.09, 20], [0.17, 30], [0.27, 40], [0.39, 50],
    [0.52, 60], [0.65, 70], [0.78, 80], [0.9, 89], [0.97, 95], [1, 100],
  ]
  return `linear-gradient(180deg, ${stops.map(([a, p]) => `rgba(${rgb},${a}) ${p}%`).join(', ')})`
}

// The melt covers the bottom 78 % of the banner: a long, gentle slope.
const MELT_PCT = 78
// Relative to the full banner height. Fully transparent until 24 %, i.e.
// below where the melt box starts (22 %), so the clip never shows; then the
// blur builds slowly and is complete well before the card.
const BLUR_MASK =
  'linear-gradient(180deg, transparent 0%, transparent 24%, rgba(0,0,0,0.3) 40%, rgba(0,0,0,0.7) 58%, #000 76%)'
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
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-x-0 bottom-0 overflow-hidden', className)}
      style={{ height: `${MELT_PCT}%` }}
    >
      {src && (
        // Blurred duplicate, aligned to the banner (same box, bottom-anchored),
        // masked in from transparent: the blur appears to deepen toward the
        // card. Same URL as the banner, so no second download.
        <div
          className="absolute inset-x-0 bottom-0 [@media(prefers-reduced-transparency:reduce)]:hidden"
          style={{ ...blurMaskStyle, height: `${(100 / MELT_PCT) * 100}%` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- images are served unoptimized (next.config) */}
          <img
            src={src}
            alt=""
            decoding="async"
            className="h-full w-full scale-[1.08] object-cover blur-[24px] saturate-[1.1]"
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
