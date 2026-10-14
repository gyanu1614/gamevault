/**
 * The blog's ONE card surface (Blog v2, 2026-10-13) for the article's boxes:
 * codes, item cards, the contents box (Tip / Note boxes are tinted: nodes.tsx). Tables use the same values
 * in blog-prose.css (`.blog-table`); keep the two in step.
 *
 * Solid, always: the shared background (BlogBackdrop) must never show
 * through a card (owner: "why is the table transparent"). The card-surface
 * system's near-black gradient (MARKET_CARD) + an 8% hairline + the inner
 * top edge + a soft drop shadow, so a card lifts off the dimmed picture.
 * Rectangular (8px), like the site's cards (owner).
 */
export const BLOG_CARD =
  'rounded-[8px] border border-white/[0.08] bg-[linear-gradient(180deg,#212228_0%,#1A1B1F_100%)] ' +
  'shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_10px_30px_-12px_rgba(0,0,0,0.6)]'
