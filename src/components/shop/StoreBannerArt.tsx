/**
 * A seller's store banner: their uploaded image (Silver+, see
 * src/lib/shop/store-banner.ts) or the generated default art seeded by the
 * seller id. Purely presentational — used by the public shop header and the
 * settings preview, so both always show the same thing.
 */

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { defaultBannerArt, type ResolvedStoreBanner } from '@/lib/shop/store-banner'

export function StoreBannerArt({
  banner,
  seed,
  className,
  children,
  priority = false,
}: {
  banner: ResolvedStoreBanner
  /** Seller id: keeps the default art stable per shop. */
  seed: string
  className?: string
  children?: ReactNode
  /** Above-the-fold on the shop page: load eagerly. */
  priority?: boolean
}) {
  return (
    <div className={cn('relative overflow-hidden bg-[#1A1B1F]', className)}>
      {banner.kind === 'custom' ? (
        /* eslint-disable-next-line @next/next/no-img-element -- images are served unoptimized (next.config) */
        <img
          src={banner.url}
          alt=""
          aria-hidden
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div aria-hidden className="absolute inset-0" style={{ background: defaultBannerArt(seed).background }} />
      )}
      {/* Fade into the card below so the overlapping avatar sits cleanly. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/45 to-transparent" />
      {children}
    </div>
  )
}
