import type { CSSProperties } from 'react'

/**
 * The blog's ONE shared background (Blog v2, P4, 2026-10-13): a still picture
 * behind the blog home and every article, the same for every game. Value
 * pages keep their per-game art (GameHeroBackdrop).
 *
 * Owner brief (Eldorado's one background, 2026-10-13): nothing behind the
 * text — a faint character cut-out in the empty strip beside the page box,
 * on wide screens only. The look lives in the stylesheet (blog-prose.css,
 * `.blog-backdrop`); smaller screens never fetch the picture.
 *
 * - A fixed layer, not `background-attachment: fixed` (iOS Safari ignores it),
 *   at -10 inside the page's `isolate` root: above the page ground, below
 *   everything else — no wrapper z-index that could beat the fixed header.
 * - The picture is a transparent cut-out (PNG/WebP with alpha), portrait,
 *   about 640 × 1100. To change it, replace the file; the stylesheet sizes,
 *   places and fades it. (Interim: the hooded figure from the marketplace
 *   hero, faded at the edges, until the owner's character PNG.)
 */
export const BLOG_BACKDROP_IMAGE = '/assets/blog/backdrop-art.webp'

export function BlogBackdrop() {
  return <div aria-hidden className="blog-backdrop" style={{ '--blog-backdrop': `url(${BLOG_BACKDROP_IMAGE})` } as CSSProperties} />
}
