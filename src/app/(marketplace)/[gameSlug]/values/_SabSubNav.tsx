'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import CalculateOutlinedIcon from '@mui/icons-material/CalculateOutlined'
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined'
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined'
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined'
import NorthEastIcon from '@mui/icons-material/NorthEast'
import type { SvgIconComponent } from '@mui/icons-material'
import { SwooshLink } from './_SwooshLink'

type Tab = {
  label: string
  href: string
  Icon: SvgIconComponent
  /** Extra path prefixes that should also mark this tab active. */
  match?: (path: string) => boolean
  /** True = leaves the DropMarket Values hub into the storefront (shows ↗). */
  exits?: boolean
}

/**
 * Tabs are derived per game rather than hardcoded, so a second game's content
 * hub gets the same nav by passing its own slug. `buyHref` is separate because
 * the storefront category slug is canonicalised per game (see
 * `getCanonicalCategorySlug`) and is not always `buy-items`.
 */
function buildTabs(gameSlug: string, buyHref: string): Tab[] {
  const hub = `/${gameSlug}`
  return [
    {
      label: 'Blog',
      href: `${hub}/blog`,
      Icon: ArticleOutlinedIcon,
      match: (p) => p.startsWith(`${hub}/blog`),
    },
    {
      label: 'Values',
      href: `${hub}/values`,
      Icon: TableChartOutlinedIcon,
      match: (p) => p.startsWith(`${hub}/values`),
    },
    {
      label: 'Calculator',
      href: `${hub}/calculator`,
      Icon: CalculateOutlinedIcon,
      match: (p) => p.startsWith(`${hub}/calculator`),
    },
    {
      label: 'Buy Items',
      href: buyHref,
      Icon: StorefrontOutlinedIcon,
      match: (p) => p.startsWith(buyHref),
      exits: true,
    },
  ]
}

/**
 * Game sub-navigation for a game's content hub — Blog / Values / Calculator,
 * plus Buy Items which exits to the storefront. Sits under the DropMarket
 * Values header. Horizontally scrollable on mobile.
 *
 * Overview was dropped: it pointed at the same storefront landing that the
 * header's top-right CTA and the Buy Items tab already reach, so it was a
 * third exit competing with two others.
 */
export function SabSubNav({
  gameSlug = 'steal-a-brainrot',
  buyHref,
}: {
  gameSlug?: string
  buyHref?: string
} = {}) {
  const pathname = usePathname() ?? ''
  const TABS = buildTabs(gameSlug, buyHref ?? `/${gameSlug}/buy-items`)

  return (
    <div className="border-b border-[#161d19] bg-[#0C0F0E]/60 pt-[60px]">
      <nav className="mx-auto flex w-full max-w-7xl items-center justify-center gap-1 overflow-x-auto px-4 sm:gap-2 sm:px-6 lg:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((tab) => {
          const active = tab.match ? tab.match(pathname) : pathname === tab.href
          const cls = `relative flex shrink-0 items-center gap-2 whitespace-nowrap px-4 py-4 text-[14.5px] font-semibold transition sm:px-5 ${
            active ? 'text-[#F1F3F1]' : 'text-[#8B978F] hover:text-[#C6CEC9]'
          }`
          const inner = (
            <>
              <tab.Icon
                sx={{ fontSize: 19 }}
                className={active ? 'text-[#4FB477]' : tab.exits ? 'text-[#7Cd39a]' : ''}
              />
              {tab.exits ? (
                // Flowing animated gradient text — marks the tabs that leave
                // the Values hub for the storefront. Subtle, always-on sweep.
                <span className="bg-[linear-gradient(110deg,#7Cd39a_0%,#F1F3F1_35%,#4FB477_60%,#7Cd39a_100%)] bg-[length:200%_100%] bg-clip-text text-transparent animate-text-flow motion-reduce:animate-none motion-reduce:text-[#9fe0b6]">
                  {tab.label}
                </span>
              ) : (
                tab.label
              )}
              {tab.exits && (
                <NorthEastIcon sx={{ fontSize: 13 }} className="text-[#5E7A67]" aria-label="opens storefront" />
              )}
              {active && (
                <span className="absolute inset-x-3 bottom-0 h-[2.5px] rounded-full bg-[#4FB477]" />
              )}
            </>
          )
          // Exit tabs leave the forest hub → play the brand-switch swoosh into
          // the marketplace. (This sub-nav only renders on hub pages, so an
          // exit tab always crosses hub → marketplace.)
          return tab.exits ? (
            <SwooshLink
              key={tab.href}
              href={tab.href}
              to="marketplace"
              className={cls}
              ariaLabel={tab.label}
            >
              {inner}
            </SwooshLink>
          ) : (
            <Link key={tab.href} href={tab.href} className={cls}>
              {inner}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
