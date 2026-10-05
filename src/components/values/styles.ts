/**
 * Values-hub surface + control classes (card-surface system, 2026-10-04).
 * One source for every values / calculator / methodology page so the hubs
 * can't drift from the marketplace: no outlines, 8px cards, 6px controls,
 * fill-only fields with the neutral focus ring.
 */
import { MARKET_CARD, MARKET_CARD_HOVER } from '@/lib/ui/surfaces'

/** Page ground for every hub page (same as the marketplace). */
export const HUB_GROUND = 'bg-bg-base'

/** Static section / panel card. */
export const VALUE_SURFACE = `rounded-lg ${MARKET_CARD}`

/** Clickable card (lifts one step on hover, nothing moves). */
export const VALUE_SURFACE_LINK = `rounded-lg ${MARKET_CARD} ${MARKET_CARD_HOVER}`

/** Flat sub-tile inside a card (never a card inside a card). */
export const VALUE_TILE = 'rounded-md bg-white/[0.04]'

/** Fill-only field: inputs, select triggers, popover triggers. */
export const VALUE_FIELD =
  'rounded-md border border-transparent bg-bg-overlay text-text-primary outline-none transition-colors ' +
  'hover:border-white/[0.08] focus-visible:border-focus-border focus-visible:ring-2 focus-visible:ring-focus-soft ' +
  'data-[state=open]:border-focus-border'

/** Floating panel (dropdowns / popovers): raised card, no outline. */
export const VALUE_PANEL =
  'rounded-lg border-0 bg-bg-raised shadow-[0_18px_40px_-14px_rgba(0,0,0,0.75)]'

/** Flat pill / chip (muted). */
export const VALUE_PILL =
  'inline-flex items-center gap-1.5 rounded-md bg-white/[0.06] px-2 py-0.5 text-[11px] font-semibold text-text-secondary'

/** Neutral secondary button (links like Methodology / Calculator). */
export const VALUE_BTN_SECONDARY =
  'inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-bg-overlay px-4 text-[13px] font-semibold text-text-primary ' +
  'transition-[background-color,transform] hover:bg-bg-overlay-2 active:scale-[0.98] ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring'

/** Primary (brand green) button — same fill as accountBtn.primary. */
export const VALUE_BTN_PRIMARY =
  'inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-lime px-4 text-[13px] font-semibold text-text-inverse ' +
  'transition-[background-color,transform] hover:bg-lime-hover active:scale-[0.98] ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring'

/** Small label above a value (Title Case, not uppercase tracking). */
export const VALUE_LABEL = 'text-[11px] font-medium text-text-tertiary'
