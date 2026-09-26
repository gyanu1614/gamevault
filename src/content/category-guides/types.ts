/**
 * Curated SEO guides for marketplace category pages (`/[game]/[category]`).
 *
 * One guide per game × category, written by hand — the unique content that
 * makes a money page more than a grid of listings (the Eldorado / GameBoost
 * pattern: listings first, then an editorial guide at the bottom).
 *
 * AUTHORING RULES
 *   • Write in our own voice. Never paste a competitor's copy.
 *   • Facts only. No invented stats, stock counts, ratings or "24/7".
 *     Live numbers (listing count, price, delivery) come from the page's
 *     stats at render time — never hard-code them here.
 *   • Links: `[text](/path)` in any paragraph or list item. Link ONLY to
 *     pages you have confirmed return 200 — an unpublished values page is
 *     a 404, and a guide full of dead internal links hurts the page.
 *   • `**bold**` is supported for list lead-ins and variant codes.
 *   • COPY RULE (no-escrow memory): describe the ORDER and the guarantee,
 *     never when money moves ("the seller is paid after you confirm" is
 *     banned). "Confirm and the order is complete" is the approved form.
 */

/** A paragraph or list item. Supports `[text](/href)` and `**bold**`. */
export type GuideText = string

export type GuideBlock =
  | { type: 'p'; text: GuideText }
  | { type: 'list'; items: GuideText[] }

export interface GuideSection {
  heading: string
  blocks: GuideBlock[]
}

export interface CategoryGuide {
  /** H2 for the whole guide, e.g. "Adopt Me Pets & Items". */
  title: string
  /** Opening paragraph(s), before the first sub-heading. */
  intro: GuideText[]
  sections: GuideSection[]
  /**
   * Overrides for the 4-step "How to Buy" section. `title` replaces the
   * default "How to Buy {Game} {Category}" (e.g. "How to Buy Adopt Me
   * Pets"); `choose` is the short line under step 1 (e.g. "Choose Your
   * Pet" — Title Case, like every step line). Both optional.
   */
  howToBuy?: { title?: string; choose?: string }
  /** Related pages for the "Explore" links. Confirmed-200 paths only. */
  related?: Array<{ label: string; href: string }>
}
