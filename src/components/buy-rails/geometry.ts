/**
 * Buy rail geometry. Lives under src/components (not src/lib) because
 * Tailwind's content globs skip src/lib — arbitrary classes written there are
 * never generated (see components/content/hubNavGeometry.ts).
 *
 * Rails show at xl (≥1280px) only; below that the phone/tablet bar takes over.
 * The sticky box is the whole screen under the fixed nav, and the card sits
 * centred in it (owner, 2026-10-11: "centred to the page on height"):
 *   hub   HubNav is 68px single-row from xl up (+ the iPhone safe area)
 *   site  the global Navbar (flat /blog posts): --navbar-bottom
 */
export const RAIL_TOP = {
  hub: 'top-[calc(var(--safe-top)+68px)] h-[calc(100vh-var(--safe-top)-68px)]',
  site: 'top-[var(--navbar-bottom)] h-[calc(100vh-var(--navbar-bottom))]',
} as const

export type RailTop = keyof typeof RAIL_TOP

/**
 * Three columns at xl across the FULL page width (owner, 2026-10-11: rails out
 * toward the edges, equal space both sides, more room for the content): 32px
 * page gutter · 220px rail · content · 220px rail · 32px gutter. The content
 * keeps its own max width and centres in the middle column; fixed rail widths
 * reserve the space (no shift). Put it on a full-width wrapper (no max-w-7xl).
 */
export const RAIL_GRID = 'xl:grid xl:grid-cols-[220px_minmax(0,1fr)_220px] xl:items-start xl:gap-10 xl:px-8'
