import {
  IconBook2,
  IconBox,
  IconBolt,
  IconCoins,
  IconGift,
  IconRocket,
  IconUserCircle,
  type Icon,
} from '@tabler/icons-react'
import { cn } from '@/lib/utils'

/**
 * The bar's layout, shared with GameSubNavSkeleton so the loading state draws
 * the same strip.
 *
 * The strip sits flush under the navbar and scrolls away with the page: only
 * the navbar stays on screen (owner, 2026-11-03, reversing the fixed bar of
 * 2026-10-26).
 *
 * Slot (the <nav>): the strip's place in the flow, flush under the navbar on
 * every width. lg:-mt-5 lifts it out of the navbar spacer (84px at lg, the bar
 * itself 64px).
 *
 * 52px tall everywhere (owner, 2026-10-27: thinner, GameBoost).
 * `!z-40` beats `.has-backdrop > *` (z-index 1), which would otherwise paint
 * page content over the strip.
 */
export const SUBNAV_SLOT =
  'relative !z-40 flex justify-center pointer-events-none h-[52px] md:mb-5 lg:-mt-5'

/**
 * The strip: frosted, one step lighter than the navbar, no edge lines (owner,
 * 2026-10-26: "no outer white line") — a soft shadow carries the bottom edge.
 */
export const SUBNAV_STRIP = cn(
  'pointer-events-auto absolute inset-x-0 top-0 z-[45] w-full backdrop-blur-2xl backdrop-saturate-150',
  'md:shadow-[0_14px_30px_-22px_rgba(0,0,0,0.9)]',
  'h-[52px] max-md:flex max-md:items-center max-md:px-2 max-md:!bg-[#0b0f0c] max-md:shadow-[0_10px_24px_-14px_rgba(0,0,0,0.85)]',
  // Phones: pulling the page down past the top would open a gap under the fixed navbar; this fills it in the navbar's colour.
  "max-md:before:absolute max-md:before:inset-x-0 max-md:before:bottom-full max-md:before:h-40 max-md:before:bg-[#1C1D22] max-md:before:content-['']",
)

export const SUBNAV_BG = 'var(--subnav-bg, rgba(24, 25, 30, 0.74))'

/** Lockup left · tabs centred · content tab right on md+; one scroll row on phones. */
export const SUBNAV_ROW =
  'flex w-full items-center gap-0.5 max-md:px-0 md:mx-auto md:grid md:max-w-7xl md:grid-cols-[1fr_auto_1fr] md:gap-4 md:px-6 lg:px-8'

/** Game logo + name: GameBoost-sized on desktop, compact in the phone strip. */
export const SUBNAV_LOGO = 'h-5 w-5 shrink-0 rounded-md sm:h-7 sm:w-7 md:h-8 md:w-8'
export const SUBNAV_NAME = 'text-[13px] font-bold tracking-tight sm:text-[16px] md:text-[20px]'

/**
 * One tab style for the game sub-navbar (owner, 2026-10-26, GameBoost as the
 * reference): full-height tabs with an icon, muted until hovered; hover lays a
 * soft fill that fades upward (nothing moves); the active tab gets a green
 * icon and a short green bar with a soft glow at the bottom edge. Shared by
 * the category tabs (GameSubNav) and the content tab (hubNavExtras).
 */
export const SUBNAV_TAB = cn(
  'group relative flex shrink-0 items-center gap-2 whitespace-nowrap font-semibold transition-colors',
  'text-text-secondary hover:text-text-primary',
  // Desktop: the bar's full height, GameBoost-sized.
  'md:h-[52px] md:px-4 md:text-[15px]',
  'md:hover:bg-[linear-gradient(to_top,rgba(255,255,255,0.07),rgba(255,255,255,0))]',
  // Phone: the compact scroll strip.
  'max-md:h-10 max-md:rounded-md max-md:px-3 max-md:text-[13.5px]',
)

export const SUBNAV_TAB_ACTIVE = 'text-text-primary'

/** Icon colour: green on the active tab, else follows the label. */
export function subnavIconClass(active: boolean): string {
  return cn('relative z-10 h-[17px] w-[17px] shrink-0 md:h-[18px] md:w-[18px]', active ? 'text-lime-text' : 'opacity-80')
}

/** The active marker: a 2px green bar plus a blurred glow under it. */
export function SubnavActiveBar() {
  return (
    <>
      <span aria-hidden className="pointer-events-none absolute bottom-0 left-1/2 h-[2px] w-8 -translate-x-1/2 rounded-t-full bg-[linear-gradient(110deg,#56B87F,#39E37A)]" />
      <span aria-hidden className="pointer-events-none absolute -bottom-3 left-1/2 h-5 w-14 -translate-x-1/2 rounded-full bg-lime-text opacity-25 blur-md max-md:hidden" />
    </>
  )
}

const BY_TYPE: Record<string, Icon> = {
  currency: IconCoins,
  items: IconBox,
  account: IconUserCircle,
  top_up: IconBolt,
  service: IconRocket,
  gift_card: IconGift,
}

/** The icon for a category: by its type, else guessed from the slug. */
export function categoryIcon(cat: { type?: string | null; slug: string }): Icon {
  if (cat.type && BY_TYPE[cat.type]) return BY_TYPE[cat.type]
  const s = cat.slug
  if (s.includes('account')) return IconUserCircle
  if (s.includes('item')) return IconBox
  if (s.includes('boost')) return IconRocket
  if (s.includes('gift')) return IconGift
  if (s.includes('top-up')) return IconBolt
  return IconCoins
}

export const GuidesIcon = IconBook2
