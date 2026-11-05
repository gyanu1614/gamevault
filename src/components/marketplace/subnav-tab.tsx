import {
  IconBook2,
  IconBox,
  IconBolt,
  IconBrandDiscordFilled,
  IconCoins,
  IconGift,
  IconRocket,
  IconUserCircle,
  type Icon,
} from '@tabler/icons-react'
import { DISCORD_INVITE_URL } from '@/lib/config/social'
import { cn } from '@/lib/utils'

/**
 * The bar's layout, shared with GameSubNavSkeleton so the loading state draws
 * the same strip.
 *
 * The strip is fixed flush under the navbar at --subnav-top (globals.css). It
 * slides up behind the navbar as the page scrolls down and comes back on a small
 * scroll up, on every game page (owner, 2026-11-04, GameBoost's items page;
 * useHideOnScroll). The filters scroll with the page.
 *
 * Slot (the <nav>): reserves the strip's height in the flow. lg:-mt-5 lifts it
 * out of the navbar spacer (84px at lg, the bar itself 64px).
 *
 * 52px tall everywhere (owner, 2026-10-27: thinner, GameBoost).
 * `!z-40` beats `.has-backdrop > *` (z-index 1), which would otherwise paint
 * page content over the strip.
 */
export const SUBNAV_SLOT =
  'relative !z-40 flex justify-center pointer-events-none h-[52px] md:mb-5 lg:-mt-5'

/**
 * The bar: the second row of one header, full width on the navbar's side edges, the
 * page clearly lighter underneath. One step darker than the navbar with a thin
 * neutral line between them, subtle but noticeable (owner, 2026-11-04, GameBoost's
 * bars as the reference). `--subnav-bg` on desktop; below lg the navbar is solid
 * #1C1D22, so the bar is the card tone one step under it.
 */
export const SUBNAV_STRIP = cn(
  'pointer-events-auto fixed inset-x-0 top-[var(--subnav-top)] z-[45] w-full backdrop-blur-2xl backdrop-saturate-150',
  'transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none',
  'md:shadow-[inset_0_-1px_0_rgba(255,255,255,0.08),0_16px_28px_-20px_rgba(0,0,0,0.8)]',
  "after:pointer-events-none after:absolute after:inset-x-0 after:top-0 after:h-px after:bg-white/[0.07] after:content-['']",
  'max-lg:!bg-[#16171B]',
  'h-[52px] max-md:flex max-md:items-center max-md:px-2 max-md:shadow-[0_10px_24px_-14px_rgba(0,0,0,0.85)]',
  // Phones: pulling the page down past the top would open a gap under the fixed navbar; this fills it in the navbar's colour.
  "max-md:before:absolute max-md:before:inset-x-0 max-md:before:bottom-full max-md:before:h-40 max-md:before:bg-[#1C1D22] max-md:before:content-['']",
)

export const SUBNAV_BG = 'var(--subnav-bg, rgba(24, 25, 30, 0.74))'

/** Slid up behind the navbar while the page scrolls down. Fades too, so it can't show through the navbar's glass. */
export const SUBNAV_HIDDEN = '-translate-y-full opacity-0 pointer-events-none'

/** The same from md up only: inside a listing, phones keep their back button on screen (owner, 2026-11-02/03). */
export const SUBNAV_HIDDEN_MD = 'md:-translate-y-full md:opacity-0 md:pointer-events-none'

/**
 * Join Discord, in Discord's own colour, on every game page's bar (owner,
 * 2026-11-04, GameBoost's as the reference). The words show from xl up; below
 * that the bar is full, so it is the mark alone. Hover lightens in place.
 */
export function SubnavDiscordButton({ className }: { className?: string }) {
  return (
    <a
      href={DISCORD_INVITE_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Join DropMarket on Discord"
      className={cn(
        'inline-flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-[#5865F2] text-[14px] font-semibold text-white transition-colors hover:bg-[#6B77F5]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
        'w-9 xl:w-auto xl:px-3.5',
        className,
      )}
    >
      <IconBrandDiscordFilled aria-hidden className="h-[18px] w-[18px] shrink-0" />
      <span className="hidden xl:inline">Join Discord</span>
    </a>
  )
}

/** Lockup left · tabs centred · content tab right on md+, on the navbar's side edges; one scroll row on phones. */
export const SUBNAV_ROW =
  'flex w-full items-center gap-0.5 max-md:px-0 md:grid md:grid-cols-[1fr_auto_1fr] md:gap-4 md:px-6'

/** Game logo + name: one step above the tabs on desktop (owner, 2026-11-03: "too big, shrink to match page"), compact in the phone strip. */
export const SUBNAV_LOGO = 'h-5 w-5 shrink-0 rounded-md sm:h-6 sm:w-6'
export const SUBNAV_NAME = 'text-[13px] font-bold tracking-tight sm:text-[16px]'

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
  // Desktop: the bar's full height; the same text as the navbar's links, one header.
  'md:h-[52px] md:px-4 md:text-[14px] md:font-medium md:text-white/75 md:hover:text-white',
  'md:hover:bg-[linear-gradient(to_top,rgba(255,255,255,0.07),rgba(255,255,255,0))]',
  // Phone: the compact scroll strip.
  'max-md:h-10 max-md:rounded-md max-md:px-3 max-md:text-[13px]',
)

export const SUBNAV_TAB_ACTIVE = 'text-text-primary md:text-white'

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
