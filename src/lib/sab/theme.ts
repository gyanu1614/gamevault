/**
 * Steal a Brainrot — "DropMarket Values" theme (single source of truth).
 *
 * Model (à la gameboost.com, adapted to our palette): a NEAR-BLACK base with
 * near-white text and dark hairline borders. Forest green is an ACCENT ONLY —
 * the Buy button, active states, the live/updated indicator, links — never a
 * green wash on the whole surface. Mutation colors provide the per-item pops.
 *
 * Geometry: rectangular, tight radius (rounded-lg = 8px), restrained shadow.
 * Anti-nesting: prefer floating elements; use `sabCard` for a real group and
 * `sabTile` (borderless faint fill) for sub-items — never border-in-border.
 *
 * Palette:
 *   base   #0C0F0E  page (near-black, faint green warmth)
 *   raise  #121613  card surface
 *   line   #1E2723  hairline border
 *   forest #1B6B3F / #14432A  accent (button, active)
 *   text   #F1F3F1 / #9BA8A0 / #6D7A72  primary / secondary / tertiary
 */

export const SAB_BASE = '#0C0F0E'

/** Group container card — near-black raised surface, hairline border. */
export const sabCard =
  'rounded-lg border border-[#1E2723] bg-[#121613] ' +
  'shadow-[0_8px_20px_-16px_rgba(0,0,0,0.8)]'

/** Floating sub-item inside a card — no border, faint fill (avoids nesting). */
export const sabTile = 'rounded-lg bg-white/[0.025]'

/** Hero surface — same near-black family, one hairline border, soft lift. */
export const sabHero =
  'relative overflow-hidden rounded-lg border border-[#1E2723] bg-[#101512] ' +
  'shadow-[0_16px_40px_-24px_rgba(0,0,0,0.85)]'

/** Interactive tile (hover lift) — clickable chips/cards. */
export const sabInteractive =
  'rounded-lg border border-[#1E2723] bg-[#111613] transition ' +
  'hover:-translate-y-0.5 hover:border-[#2A3A31] ' +
  'hover:shadow-[0_12px_24px_-14px_rgba(0,0,0,0.7)]'

/** Primary "Buy Now" button — forest accent, the one strong green. */
export const sabPrimaryBtn =
  'inline-flex items-center justify-center gap-1.5 rounded-lg ' +
  'bg-[#1B6B3F] px-4 py-2.5 text-sm font-bold text-white ' +
  'shadow-[0_6px_16px_-8px_rgba(27,107,63,0.6)] transition hover:bg-[#1f7a48]'

/** Muted pill/badge. */
export const sabPill =
  'rounded-md border border-[#26332C] bg-white/[0.03] px-2.5 py-1 text-xs font-semibold text-[#9BA8A0]'

/** Text colors — near-white primary, muted greys (not green). */
export const sabText = {
  primary: 'text-[#F1F3F1]',
  secondary: 'text-[#9BA8A0]',
  tertiary: 'text-[#6D7A72]',
  heading: 'text-[#F1F3F1]',
  accent: 'text-[#4FB477]',
} as const
