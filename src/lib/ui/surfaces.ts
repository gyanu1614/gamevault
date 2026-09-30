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
