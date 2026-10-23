import type { ReactNode } from 'react'
import Link from '@/components/navigation/AppLink'
import { hubToolLinks } from '@/lib/content/hub-links'
import { SwooshLink } from './_SwooshLink'

/** One tool tab: text-only, the same size and weight as the category tabs. */
const TAB =
  'relative flex flex-shrink-0 items-center whitespace-nowrap rounded-md px-3 py-2.5 text-[13px] font-semibold text-text-secondary transition-colors hover:text-text-primary sm:px-3.5 sm:py-2 sm:text-[13.5px]'

/**
 * Extra sub-nav tabs for the Steal a Brainrot section: Values + Calculator,
 * rendered after the marketplace category tabs (Accounts / Items) in the shared
 * `GameSubNav` pill. Text-only to match the category tabs (no icons). Each
 * enters the Values hub, so it plays the DropMarket brand-switch swoosh.
 */
export function SabNavExtras() {
  return (
    <>
      <SwooshLink
        href="/steal-a-brainrot/values"
        to="values"
        ariaLabel="Steal a Brainrot Values"
        className={TAB}
      >
        Values
      </SwooshLink>
      <SwooshLink
        href="/steal-a-brainrot/calculator"
        to="values"
        ariaLabel="Steal a Brainrot Calculator"
        className={TAB}
      >
        Calculator
      </SwooshLink>
    </>
  )
}

/**
 * `GameSubNav`'s `extraTabs` for any game: its hub tools (hubToolLinks — the
 * value list, then its calculator) after the category tabs, on the game landing
 * and every category page. Steal a Brainrot keeps its swoosh; the other hubs
 * are plain links. Undefined for a game without a value hub (no divider).
 *
 * Why every hub game (crawl audit 2026-10-23): /adopt-me had no link to
 * /adopt-me/values, the site's top search landing page.
 */
export function hubNavExtras(gameSlug: string, gameName: string): ReactNode | undefined {
  if (gameSlug === 'steal-a-brainrot') return <SabNavExtras />
  const tools = hubToolLinks(gameSlug)
  if (tools.length === 0) return undefined
  return (
    <>
      {tools.map((t) => (
        <Link key={t.href} href={t.href} aria-label={`${gameName} ${t.tabLabel}`} className={TAB}>
          {t.tabLabel}
        </Link>
      ))}
    </>
  )
}
