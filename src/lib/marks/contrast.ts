/**
 * Fill selection for GameMark tiles.
 *
 * The silhouette is a single flat colour: white at 92% or near-black. Which one
 * a game gets is decided by contrast against its own tile background, so a new
 * game only needs one hex picked and the mark stays legible automatically.
 *
 * Uses WCAG relative luminance (linearised channels, weighted 0.2126/0.7152/
 * 0.0722) and compares the actual contrast ratio against both candidates rather
 * than thresholding a weighted average. The cheap (r*299+g*587+b*114)/1000 > 128
 * trick flips the wrong way on saturated mid-value colours — a strong green
 * reads "light" to it and gets a dark mark it cannot support.
 */

/** White at 92% — the light silhouette. */
export const MARK_FILL_LIGHT = 'rgba(255,255,255,0.92)'
/** Near-black — the dark silhouette. */
export const MARK_FILL_DARK = '#0B0B0C'

/** Tile background used when a game has no `mark_bg` set. */
export const MARK_BG_FALLBACK = '#1A1A1D'

export type MarkFill = 'light' | 'dark'

/** Parse `#rgb` / `#rrggbb` into 0–255 channels. Returns null if unparseable. */
function parseHex(hex: string): [number, number, number] | null {
  const raw = hex.trim().replace(/^#/, '')
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw
  if (!/^[0-9a-f]{6}$/i.test(full)) return null
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ]
}

/** WCAG relative luminance of an 8-bit channel triple. */
function relativeLuminance([r, g, b]: [number, number, number]): number {
  const lin = [r, g, b].map((channel) => {
    const c = channel / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
}

/** WCAG contrast ratio between two luminances, 1–21. */
function contrastRatio(a: number, b: number): number {
  const [hi, lo] = a > b ? [a, b] : [b, a]
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * Pick the silhouette fill for a tile background.
 *
 * The light candidate is compared at full white: the 92% alpha sits on top of
 * the tile, so its effective luminance is close enough to white that scoring it
 * as white keeps the comparison honest without compositing.
 */
export function fillForBackground(bg: string | null | undefined): MarkFill {
  const rgb = bg ? parseHex(bg) : null
  if (!rgb) return 'light' // fallback tile is dark

  const tile = relativeLuminance(rgb)
  const againstLight = contrastRatio(tile, 1)
  const againstDark = contrastRatio(tile, relativeLuminance(parseHex(MARK_FILL_DARK)!))

  return againstLight >= againstDark ? 'light' : 'dark'
}

/**
 * Resolve a game's fill. An explicit `mark_fill` wins outright — no blending
 * with the computed value.
 */
export function resolveMarkFill(
  bg: string | null | undefined,
  override: string | null | undefined,
): string {
  const choice: MarkFill =
    override === 'light' || override === 'dark' ? override : fillForBackground(bg)
  return choice === 'light' ? MARK_FILL_LIGHT : MARK_FILL_DARK
}
