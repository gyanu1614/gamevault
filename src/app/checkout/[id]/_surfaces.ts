/**
 * Checkout surfaces (owner 2026-10-27): the page sits on the game's hero art
 * like the item page, so its panels read as solid, premium objects rather
 * than grey glass. Fill only, never an outline (house rule): depth comes
 * from a top highlight, a soft drop shadow, a faint brand-green sheen at the
 * top-left corner and a fine grain.
 *
 * Inline styles, not Tailwind arbitrary values: each fill is a stack of
 * background layers (grain + sheen + gradient) that a class string can't
 * carry readably. Hover stays a class (`bg-white/[…]` under the layers).
 */
import type { CSSProperties } from 'react'

/** Fine film grain, already faint (4.5% opacity inside the SVG), so it can
 *  sit in the background stack with no blend mode and no extra element. */
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.045'/%3E%3C/svg%3E\")"

/** Order summary, trust cards, How Your Order Works: near-opaque so the art
 *  behind never greys them out, with the brand-green sheen top-left. */
export const PANEL_STYLE: CSSProperties = {
  backgroundImage: [
    GRAIN,
    'radial-gradient(120% 70% at 0% 0%, rgba(57,227,122,0.085) 0%, rgba(57,227,122,0) 58%)',
    'linear-gradient(180deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0) 34%)',
    'linear-gradient(180deg, rgba(34,35,41,0.95) 0%, rgba(23,24,28,0.97) 100%)',
  ].join(', '),
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.09), 0 22px 50px -22px rgba(0,0,0,0.8)',
}

/** Rounded + blur for a panel; pair with PANEL_STYLE. */
export const PANEL_CLASS = 'rounded-lg backdrop-blur-xl'

/** A payment row: a glossy, see-through box (gloss band on top, grain), no
 *  outline. The picked row takes a green-tinted fill instead of a ring. */
export function rowStyle(checked: boolean): CSSProperties {
  return checked
    ? {
        backgroundImage: [
          GRAIN,
          'linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0) 45%)',
          'linear-gradient(180deg, rgba(86,184,127,0.24) 0%, rgba(86,184,127,0.10) 100%)',
        ].join(', '),
        boxShadow: 'inset 0 1px 0 rgba(160,240,190,0.28), 0 14px 32px -18px rgba(20,90,50,0.75)',
      }
    : {
        backgroundImage: [
          GRAIN,
          'linear-gradient(180deg, rgba(255,255,255,0.075) 0%, rgba(255,255,255,0.02) 100%)',
        ].join(', '),
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.10), 0 12px 28px -18px rgba(0,0,0,0.8)',
      }
}

/** Row base under the layers; hover lifts the fill one step in place. */
export const ROW_CLASS =
  'rounded-md backdrop-blur-md transition-[background-color,box-shadow] duration-150'
export const ROW_IDLE_CLASS = 'bg-[#1D1E23]/55 hover:bg-[#24252B]/70'
export const ROW_CHECKED_CLASS = 'bg-[#1D1E23]/60'

/** The logo tile at the right of a row: a filled chip, no ring. */
export const TILE_CLASS = 'grid h-9 w-[60px] shrink-0 place-items-center rounded-md bg-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
