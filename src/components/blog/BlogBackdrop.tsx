import type { CSSProperties } from 'react'

/**
 * The blog's ONE shared background (Blog v2, P4, 2026-10-13): a still picture
 * behind the blog home and every article, the same for every game. Value
 * pages keep their per-game art (GameHeroBackdrop).
 *
 * Owner brief: normal colours, only dimmed; the picture shows on the SIDES and
 * the centre, where the text is, stays clean. So the stylesheet
 * (blog-prose.css, `.blog-backdrop`) lays a scrim over the picture that is
 * solid ground across the reading column and fades out toward the edges.
 *
 * - A fixed layer, not `background-attachment: fixed` (iOS Safari ignores it),
 *   at -10 inside the page's `isolate` root: above the page ground, below
 *   everything else — no wrapper z-index that could beat the fixed header.
 * - The picture is a CSS background set only from md up: phones (all reading
 *   column, nothing at the sides) never download it.
 * - The file is pre-dimmed (brightness 0.6), 1920 × 1080 AVIF. To change the
 *   picture, replace the file — the scrim does the rest.
 */
export const BLOG_BACKDROP_IMAGE = '/assets/blog/backdrop-1920.avif'

export function BlogBackdrop() {
  return <div aria-hidden className="blog-backdrop" style={{ '--blog-backdrop': `url(${BLOG_BACKDROP_IMAGE})` } as CSSProperties} />
}
