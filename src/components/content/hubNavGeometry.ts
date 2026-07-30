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
 * Keep these in step with the header height in HubNav: h-[64px] sm:h-[76px].
 *
 * NOTE: this lives under src/components, not src/lib, on purpose — Tailwind's
 * `content` globs cover src/components but NOT src/lib, so arbitrary classes
 * written in src/lib are never generated and silently do nothing.
 */

/** Standard clearance: nav height + a comfortable gap. */
export const HUB_NAV_CLEAR = 'pt-[100px] sm:pt-[112px]'

/** Extra air, for the centred blog-hub hero where the H1 needs room. */
export const HUB_NAV_CLEAR_HERO = 'pt-[112px] sm:pt-[140px]'
