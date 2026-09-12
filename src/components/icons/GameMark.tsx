/**
 * GameMark — a game's mark on its own coloured tile.
 *
 * Two sizes, chosen by role rather than by pixel value: `sm` (24px) for lists,
 * filters and search rows, `md` (40px) for game cards.
 *
 * The mark is drawn as a CSS mask rather than an <img>, so whatever colours
 * live inside /public/marks/[slug].svg are irrelevant — only its alpha matters
 * and the fill is always the single flat colour we choose. That keeps a
 * multi-colour source file from ever leaking a gradient onto a tile.
 */

import { cn } from '@/lib/utils'
import { resolveMarkFill, MARK_BG_FALLBACK } from '@/lib/marks/contrast'

/** Tile edge lengths. */
const SIZES = {
  sm: 24,
  md: 40,
} as const

export type GameMarkSize = keyof typeof SIZES

/** The mark occupies 56% of the tile width. */
const MARK_SCALE = 0.56

export default function GameMark({
  slug,
  size = 'md',
  bg,
  fill,
  name,
  className,
}: {
  /** Game slug; resolves to /public/marks/[slug].svg. */
  slug: string
  /** `sm` (24px) for lists, filters, search. `md` (40px) for game cards. */
  size?: GameMarkSize
  /** Tile background hex, from games.mark_bg. */
  bg?: string | null
  /** Optional fill override from games.mark_fill; wins over the computed pick. */
  fill?: string | null
  /**
   * Accessible name. Omit for decorative use beside a visible game title —
   * the tile is then hidden from assistive tech rather than read twice.
   */
  name?: string
  className?: string
}) {
  const px = SIZES[size]
  const tileBg = bg || MARK_BG_FALLBACK
  const markFill = resolveMarkFill(bg, fill)
  const maskUrl = `url("/marks/${encodeURIComponent(slug)}.svg")`

  return (
    <span
      className={cn(
        // rounded-lg (14px) is one step tighter than the card's rounded-xl (20px).
        'relative grid shrink-0 place-items-center overflow-hidden rounded-lg',
        className,
      )}
      style={{ width: px, height: px, backgroundColor: tileBg }}
      role={name ? 'img' : undefined}
      aria-label={name}
      aria-hidden={name ? undefined : true}
    >
      {/* The mark. Optically centred: nudged up by a hair so it sits on the
          visual centre rather than the geometric one, which reads low. */}
      <span
        aria-hidden="true"
        style={{
          // Left unrounded: 24 and 40 both give a fractional 56% (13.44 /
          // 22.4), and rounding drifts to 54.2% / 55%. The mark is a scaled
          // mask, not a bitmap, so a sub-pixel box costs nothing.
          width: px * MARK_SCALE,
          height: px * MARK_SCALE,
          transform: 'translateY(-1.5%)',
          backgroundColor: markFill,
          maskImage: maskUrl,
          WebkitMaskImage: maskUrl,
          maskRepeat: 'no-repeat',
          WebkitMaskRepeat: 'no-repeat',
          maskPosition: 'center',
          WebkitMaskPosition: 'center',
          maskSize: 'contain',
          WebkitMaskSize: 'contain',
        }}
      />

      {/* 1px inner top highlight. Inset so it follows the tile's radius
          instead of cutting a straight line across the corners. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-lg"
        style={{ boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,.10)' }}
      />
    </span>
  )
}
