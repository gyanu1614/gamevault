import type { CSSProperties } from 'react'

/**
 * The blog's ONE shared background (Blog v2, P4, 2026-10-13): the whole
 * wallpaper behind the blog home and every article, the same for every game,
 * really dimmed (owner). Value pages keep their per-game art
 * (GameHeroBackdrop). The look lives in the stylesheet (blog-prose.css,
 * `.blog-backdrop`: hero vignette over a heavy scrim over the picture).
 *
 * - A fixed layer, not `background-attachment: fixed` (iOS Safari ignores it),
 *   at -10 inside the page's `isolate` root: above the page ground, below
 *   everything else — no wrapper z-index that could beat the fixed header.
 * - The picture is the marketplace hero (the hooded figure over the city),
 *   shared with the marketplace pages so the browser caches it once. Never
 *   pre-dim the file; the scrim does that.
 */
export const BLOG_BACKDROP_IMAGE = '/assets/heroes/marketplace.avif'

export function BlogBackdrop() {
  return <div aria-hidden className="blog-backdrop" style={{ '--blog-backdrop': `url(${BLOG_BACKDROP_IMAGE})` } as CSSProperties} />
}
