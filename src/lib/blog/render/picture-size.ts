/**
 * One picture size system for every blog picture (owner, 2026-10-13: "my photos
 * might be big or small, but the blog should match — no weird big photos and
 * some very small ones"). Used by the public renderer and the editor preview,
 * so both show a picture the same way.
 *
 *  - photo  (640px+ wide, or size unknown): fills the column, height capped
 *           (560px in the column, 640px when Wide) so a tall photo never
 *           takes the whole screen; rounded corners + blur placeholder.
 *  - small  (under 640px wide): one standard height (240px), centred — but
 *           never blown up past 1.5× its own size (that would look soft).
 *  - cutout (transparent PNG/WebP, e.g. an item with its background removed):
 *           sized like the above, but with no rounded box and no placeholder,
 *           so it sits straight on the page (the Eldorado look).
 *  - two side by side: equal boxes (PAIR_BOX), each picture contained.
 *  - table pictures: one fixed square (TABLE_PICTURE).
 */
export const PHOTO_MIN_WIDTH = 640
export const SMALL_HEIGHT = 240
const MAX_UPSCALE = 1.5
const MAX_HEIGHT = { column: 560, wide: 640 } as const

export interface PictureFit {
  kind: 'photo' | 'small' | 'cutout'
  /** Inline size: a height cap for photos, a fixed height for small pictures. */
  style: { maxHeight: number } | { height: number }
  rounded: boolean
  placeholder: boolean
}

export function pictureFit(
  image: { width?: number | null; height?: number | null; alpha?: boolean | null },
  layout: 'column' | 'wide',
): PictureFit {
  const w = image.width ?? 0
  const h = image.height ?? 0
  const cutout = image.alpha === true
  const small = w > 0 && h > 0 && w < PHOTO_MIN_WIDTH
  const style = small ? { height: Math.round(Math.min(SMALL_HEIGHT, h * MAX_UPSCALE)) } : { maxHeight: MAX_HEIGHT[layout] }
  return {
    kind: cutout ? 'cutout' : small ? 'small' : 'photo',
    style,
    rounded: !cutout,
    placeholder: !cutout && !small,
  }
}

/** Each side of a two-picture row: the same box on both, the picture contained in it. */
export const PAIR_BOX = 'flex h-[220px] items-center justify-center sm:h-[260px]'

/** A picture inside a table cell: one fixed square, contained. */
export const TABLE_PICTURE = 'inline-block h-10 w-10 shrink-0 object-contain align-middle'
