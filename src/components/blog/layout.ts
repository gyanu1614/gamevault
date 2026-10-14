/**
 * The blog article's page geometry (Blog v2, 2026-10-13 — Eldorado's layout,
 * owner: "the text is too narrow"): ONE wide reading column (up to 820px) and
 * ONE sidebar on the right (the contents list, the buy card under it), in a
 * centred page box. Under src/components so Tailwind always generates it.
 *
 * The box width is `--blog-page-w` (blog-prose.css): 820 column + 48 gap +
 * 300 sidebar + 2×32 gutter. The shared background places its art outside
 * that box (BlogBackdrop), so nothing is ever drawn behind the text.
 */
export const BLOG_PAGE_BOX = 'max-w-[var(--blog-page-w)]'

/** minmax(0,1fr): nothing inside (a table, the contents bar) may widen the column past the phone. */
export const BLOG_PAGE_GRID =
  'grid grid-cols-[minmax(0,1fr)] items-start lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-x-10 xl:grid-cols-[minmax(0,1fr)_300px] xl:gap-x-12'
