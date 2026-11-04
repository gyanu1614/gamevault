/**
 * One type and spacing scale for the pet page and the all-pets page (owner,
 * 2026-11-04: "we dont want some text too big and some too small and less gap
 * somewhere but more gap somewhere else"). Change a value here, not per section.
 *
 *   Text: 34/28 page title · 24/20 section title · 18 sub-heading · 16 card title,
 *   question, key fact · 14 body · 13 label · 12 caption.
 *   Prices: 30 in the buy box, 20 on cards and rows.
 *   Space: 36 under the header · 80/56 between sections and above the footer ·
 *   24/20 from a title to its content · 16 between cards.
 */

/** The page's one H1. */
export const PAGE_TITLE = 'text-[28px] font-bold leading-[1.1] tracking-[-0.025em] text-text-primary sm:text-[34px]'

/** Every section's H2. */
export const SECTION_TITLE = 'text-[20px] font-bold leading-tight tracking-[-0.01em] text-text-primary sm:text-[24px]'

/** A section's distance from the one above it. */
export const SECTION_GAP = 'mt-14 sm:mt-20'

/** The same distance, for sections stacked in a flex column. */
export const SECTION_STACK = 'flex flex-col gap-14 sm:gap-20'

/** The space above the footer: this + the footer's own 24px margin = the one section gap, 80/56. */
export const PAGE_END = 'pb-8 sm:pb-14'

/** From a section's title to its content. */
export const TITLE_GAP = 'mt-5 sm:mt-6'

/** The same, as a margin under a title row. */
export const TITLE_GAP_BELOW = 'mb-5 sm:mb-6'

/** Under the fixed header: the sub-navbar slot's 20px margin + this = 36px on desktop; 28px on phones. */
export const PAGE_TOP = 'pt-7 md:pt-4'
