import type { ReactNode } from 'react'
import Link from '@/components/navigation/AppLink'
import { hubNavTab } from '@/lib/content/hub-links'
import { GuidesIcon, SUBNAV_TAB, subnavIconClass } from '@/components/marketplace/subnav-tab'
import { SwooshLink } from './_SwooshLink'

/** The content tab: the category tabs' style and size, with a book icon. */
const TAB = SUBNAV_TAB

/**
 * `GameSubNav`'s `extraTabs` for any game: ONE tab after the category tabs,
 * behind the strip's grey divider (owner, 2026-10-23), "Values & Guides" to
 * the game's values + guides home (hubNavTab). Steal a Brainrot keeps the
 * DropMarket brand-switch swoosh into its forest-themed hub; the others are
 * plain links. Undefined for a game without a content hub (no divider).
 *
 * The value list itself stays linked from every page through the footer game
 * directory (hubToolLinks), so /[game]/values keeps its crawl path (crawl audit
 * 2026-10-23: /adopt-me/values is the site's top search landing page).
 */
export function hubNavExtras(gameSlug: string, gameName: string): ReactNode | undefined {
  const tab = hubNavTab(gameSlug)
  if (!tab) return undefined
  const ariaLabel = `${gameName} ${tab.label}`
  const icon = <GuidesIcon aria-hidden stroke={1.9} className={subnavIconClass(false)} />
  if (gameSlug === 'steal-a-brainrot') {
    return (
      <SwooshLink href={tab.href} to="values" ariaLabel={ariaLabel} className={TAB}>
        {icon}
        {tab.label}
      </SwooshLink>
    )
  }
  return (
    <Link href={tab.href} aria-label={ariaLabel} className={TAB}>
      {icon}
      {tab.label}
    </Link>
  )
}
