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
 *  behind never greys them out. Neutral only (owner 2026-10-27: no green
 *  glow): a soft white light from the top-right corner, a top highlight,
 *  a fine grain. */
export const PANEL_STYLE: CSSProperties = {
  backgroundImage: [
    GRAIN,
    'radial-gradient(90% 60% at 100% 0%, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 60%)',
    'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 28%)',
    'linear-gradient(180deg, rgba(32,33,38,0.96) 0%, rgba(22,23,27,0.98) 100%)',
  ].join(', '),
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07), 0 18px 40px -24px rgba(0,0,0,0.85)',
}

/** Rounded + blur for a panel; pair with PANEL_STYLE. */
export const PANEL_CLASS = 'rounded-lg backdrop-blur-xl'

/** A payment row: a slim, glossy grey box, no outline and no green (owner
 *  2026-10-27). States climb in brightness, never sink: idle grey, hover one
 *  step lighter, picked clearly the lightest and raised (brighter top edge,
 *  soft drop shadow). Stripe's checkout guidance says the same: the active
 *  method must be the most noticeable, never equally weighted. */
export function rowStyle(checked: boolean): CSSProperties {
  return checked
    ? {
        backgroundImage: [GRAIN, 'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 100%)'].join(', '),
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.16), 0 10px 24px -14px rgba(0,0,0,0.9)',
      }
    : {
        backgroundImage: [GRAIN, 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.015) 100%)'].join(', '),
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07)',
      }
}

/** Row base under the layers: idle grey, hover lighter, picked lightest. */
export const ROW_CLASS = 'rounded-md backdrop-blur-md transition-[background-color,box-shadow] duration-150'
export const ROW_IDLE_CLASS = 'bg-[#1F2025]/75 hover:bg-[#28292F]/85'
export const ROW_CHECKED_CLASS = 'bg-[#33343B]/95'

/** The logo tile at the right of a row: a slim filled chip, no ring. */
export const TILE_CLASS =
  'grid h-7 w-[48px] shrink-0 place-items-center rounded-[5px] bg-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
