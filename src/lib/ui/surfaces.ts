/**
 * Marketplace card surface (card-surface system, owner 2026-09-28/30): the
 * near-black card gradient with a soft drop shadow and NO outline. One source
 * so the game hub, seller fees, shop, browse and the rest can't drift.
 * (Account pages use the flat `bg-bg-raised` AccountCard instead.)
 */
export const MARKET_CARD =
  'bg-[linear-gradient(180deg,#212228_0%,#1A1B1F_100%)] shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)]'

/** Hover for a clickable card: the gradient lifts one step, nothing moves. */
export const MARKET_CARD_HOVER =
  'transition-[background-image] duration-200 hover:bg-[linear-gradient(180deg,#27282F_0%,#1E1F25_100%)]'

/**
 * Toast card (custom `toast.custom` content). Mirrors the `.dm-toast` rules
 * in globals.css that style every standard sonner toast: a step lighter than
 * MARKET_CARD so it lifts off the cards it floats over, inner top edge, no
 * outline, 8px corners.
 */
export const TOAST_CARD =
  'rounded-[8px] bg-[linear-gradient(180deg,#26272D_0%,#1D1E23_100%)] ' +
  'shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_40px_-14px_rgba(0,0,0,0.75),0_2px_6px_-2px_rgba(0,0,0,0.4)]'
