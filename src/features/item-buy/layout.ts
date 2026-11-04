/**
 * One gap between the pet page's sections (offers, about, questions, the
 * popular carousel), set here once instead of a margin per section (owner,
 * 2026-11-02: consistent spacing, no one-off gaps). Tighter than the
 * landing pages' .page-rhythm: this is a product page, read top to bottom.
 */
export const ITEM_SECTION_GAP = 'mt-14 sm:mt-20'

/** Section headings on the pet page: one size (owner, 2026-11-02). */
export const ITEM_H2 = 'text-[20px] font-bold leading-tight tracking-[-0.01em] text-text-primary sm:text-[24px]'

/** About and the buyer questions: the title centred on top, their content in this centred column below (owner, 2026-11-03). */
export const ITEM_COLUMN = 'mx-auto mt-5 max-w-3xl'

/**
 * The pet page's desktop surface, `.glass-panel` in globals.css (owner,
 * 2026-11-03: transparent glass, even from top to bottom, no hover). Desktop only: on
 * phones the content floats on the page.
 */
export const GLASS = 'glass-panel lg:rounded-lg'

/**
 * An offer row on the page's lighter desktop ground (globals.css, with
 * `.glass-panel`): one step above it, top to bottom. The house
 * card's lower half would be darker than this ground and look sunk. A seller with
 * no picture keeps a visible circle on it.
 */
export const OFFER_ROW =
  'lg:bg-[linear-gradient(180deg,#27282E_0%,#24252B_100%)] lg:hover:bg-[linear-gradient(180deg,#2D2E35_0%,#2A2B31_100%)] lg:[--color-bg-overlay:rgba(255,255,255,0.1)]'
