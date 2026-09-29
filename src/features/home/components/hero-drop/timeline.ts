/**
 * The Drop's timeline, in film progress `p` (0..1 over HeroFilm's scroll).
 *
 * Pure numbers and easing only: no three.js, so HeroFilm can import the
 * tile timing from here without pulling the 3D scene into the first bundle.
 * The tiles and the loot that lands on them read the SAME windows, which is
 * what keeps each object arriving on a tile that is already there.
 */

export type Span = readonly [start: number, end: number]

export const DROP = {
  /** The crate eases from its resting spot to centre stage. */
  drift: [0.02, 0.3],
  /** The camera leans in a little as the film starts. */
  push: [0, 0.45],
  /** The SafeDrop seal strains: brighter, bigger, a tremor. */
  sealCrack: [0.1, 0.2],
  /** ...then gives. Overlaps the lid so the seal is what lets it go. */
  sealFade: [0.18, 0.26],
  /** The lid swings back on its hinge. */
  lidOpen: [0.18, 0.4],
  /** Its job done, the crate sinks behind the statement and goes dark. */
  sink: [0.45, 0.8],
} as const satisfies Record<string, Span>

/** Beat 2's category tile `i` fades and rises in over this window. */
export const tileIn = (i: number): Span => [0.3 + i * 0.035, 0.42 + i * 0.035]

/** Loot `i` leaves the crate here: after the lid has started to open. */
export const lootEmerge = (i: number) => 0.24 + i * 0.03

/**
 * ...and has landed on its tile here: a beat after the tile has settled, so
 * the object is seen to arrive rather than the tile appearing around it.
 */
export const lootLand = (i: number) => tileIn(i)[1] + 0.1

/** Share of a loot's flight spent spiralling up out of the crate. */
export const LOOT_RISE = 0.38

/**
 * Flight progress at which the tile hands its flat glyph over to the
 * object. Just short of touchdown, so the glass has cleared by the time
 * the object is inside it.
 */
export const LOOT_HANDOFF = 0.82

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** 0 before the window, 1 after it, linear inside. */
export const ramp = (p: number, [a, b]: Span) => clamp01((p - a) / (b - a))

export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3
export const easeInCubic = (t: number) => t ** 3
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2)
/** Overshoots then settles: loot popping out of the crate. */
export const easeOutBack = (t: number) => {
  const c = 1.70158
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2
}
