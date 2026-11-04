/**
 * One gap between the pet page's sections (offers, about, questions, the
 * popular carousel), set here once instead of a margin per section (owner,
 * 2026-11-02: consistent spacing, no one-off gaps). Tighter than the
 * landing pages' .page-rhythm: this is a product page, read top to bottom.
 */
export const ITEM_SECTION_GAP = 'mt-14 sm:mt-20'

/** Section headings on the pet page: left-aligned, one size (owner, 2026-11-02). */
export const ITEM_H2 = 'text-[20px] font-bold leading-tight tracking-[-0.01em] text-text-primary sm:text-[24px]'

/** About and the buyer questions: heading left, content right on desktop; stacked on phones. */
export const ITEM_SPLIT = 'lg:grid lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] lg:gap-x-12'
