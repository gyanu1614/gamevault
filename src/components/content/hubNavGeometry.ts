/**
 * HubNav geometry — single source of truth for the fixed nav's height, split
 * into its own module so CLIENT components can import it too.
 *
 * `hubNav.ts` is `server-only` (it queries Supabase), so the calculator body
 * and any other client component can't import these from there.
 *
 * The HubNav is `fixed`, so every hub page pads its own content down to clear
 * it. Those offsets used to be hardcoded per page — three different values
 * across six files — which meant any change to the nav's height left some
 * pages overlapping it and others with a gap.
 *
 * Keep these in step with the header height in HubNav: h-[56px] sm:h-[68px].
 * (Each clear = nav height + the same comfortable gap; when the nav height
 * changes, shift these by the identical amount so the gap stays constant.)
 *
 * MOBILE (below sm) the nav is TWO rows — a 56px top row plus a ~41px tab
 * sub-row — so the mobile clear adds that sub-row height (92 + 41 = 133). From
 * sm up the nav is a single row again, so the sm: clears are unchanged.
 *
 * NOTE: this lives under src/components, not src/lib, on purpose — Tailwind's
 * `content` globs cover src/components but NOT src/lib, so arbitrary classes
 * written in src/lib are never generated and silently do nothing.
 */

/** Standard clearance: nav height + a comfortable gap. */
export const HUB_NAV_CLEAR = 'pt-[133px] sm:pt-[104px]'

/** Extra air, for the centred blog-hub hero where the H1 needs room. */
export const HUB_NAV_CLEAR_HERO = 'pt-[145px] sm:pt-[132px]'
