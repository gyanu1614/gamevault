/**
 * The blog's ONE shared background (Blog v2, P4, 2026-10-13 — "islands at
 * night"): a still, dimmed picture behind the blog home and every article,
 * the same for every game. Value pages keep their per-game art
 * (GameHeroBackdrop); the blog reads as one magazine.
 *
 * A fixed layer, not `background-attachment: fixed` (iOS Safari ignores it).
 * It sits at -z-10 inside the page's `isolate` root, so it paints above the
 * page ground and below everything else — no wrapper z-index that could beat
 * the fixed header. Pre-made AVIFs (~7 KB / ~4 KB, made from
 * heroes/home.avif: blurred, dimmed, blue-shifted): a landscape crop, and a
 * portrait crop for phones so they don't upscale a sliver of the wide one.
 */
export const BLOG_BACKDROP = {
  landscape: '/assets/blog/backdrop-night-1600.avif',
  portrait: '/assets/blog/backdrop-night-720.avif',
} as const

export function BlogBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <picture className="contents">
        <source media="(orientation: portrait)" srcSet={BLOG_BACKDROP.portrait} type="image/avif" />
        {/* eslint-disable-next-line @next/next/no-img-element -- pre-made, decorative */}
        <img src={BLOG_BACKDROP.landscape} alt="" decoding="async" className="h-full w-full object-cover" />
      </picture>
      {/* Edges fall off into the page ground, so text never sits on the brightest part. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,transparent_45%,rgba(var(--color-bg-base-rgb),0.85)_100%)]" />
    </div>
  )
}
