/**
 * The blog article's page geometry (Blog v2, 2026-10-13, owner): ONE wide
 * reading column (up to 820px, `--blog-col-w`) CENTRED on the page "with
 * enough space left and right", and the sidebar (contents list, buy card
 * under it) on the page's right edge. Under src/components so Tailwind always
 * generates the classes.
 *
 *   xl+   [ empty · art ] [ column, centred ] [ … sidebar at the right edge ]
 *         The side tracks share the space; the right one never drops under
 *         the 300px sidebar, so on a laptop the column sits a little left of
 *         centre instead of squeezing the sidebar.
 *   lg    column + a 260px sidebar.
 *   < lg  the column alone (contents bar + bottom buy bar).
 *
 * The page box stops at `--blog-page-max` so an ultra-wide screen keeps the
 * sidebar within reach of the text. The shared background's art fills the
 * empty left track only (BlogBackdrop).
 */
export const BLOG_PAGE_BOX = 'max-w-[var(--blog-page-max)]'

/** minmax(0,…): nothing inside (a table, the contents bar) may widen the column past the phone. */
export const BLOG_PAGE_GRID =
  'grid grid-cols-[minmax(0,1fr)] items-start lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-x-10 ' +
  'xl:grid-cols-[minmax(0,1fr)_minmax(0,var(--blog-col-w))_minmax(300px,1fr)] xl:gap-x-12'

/** The article: the middle track from xl. */
export const BLOG_MAIN_CELL = 'min-w-0 xl:col-start-2'

/** The sidebar: the right track, pushed to its far (right) edge. */
export const BLOG_SIDE_CELL = 'xl:col-start-3 xl:w-[300px] xl:justify-self-end'
