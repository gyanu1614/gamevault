import { getGameContentTheme, hasGameContentTheme } from '@/lib/content/theme'
import { HUB_TOOL_PATH, type HubTool } from '@/lib/content/hub-tools'

/**
 * The money tools a hub game links to from its MARKETPLACE surfaces (the
 * footer game directory and the game sub-nav), in link order: the value list,
 * then its calculator — the WFL calculator, else the inventory worth tool.
 *
 * Why (crawl audit 2026-10-23, docs/handoff/seo-crawl-audit-2026-10-23.md):
 * the footer and the game sub-nav are how the home page and the game landings
 * reach the value hubs, and before this they pointed at /steal-a-brainrot/values
 * only. /adopt-me/values — the site's top search landing page — had no link
 * from the home page or from /adopt-me, so Google last crawled it on 2026-07-31.
 * Pure: the pages a game publishes come from its theme (HubPageSet).
 */
export interface HubToolLink {
  tool: Extract<HubTool, 'values' | 'calculator' | 'inventory'>
  href: string
  /** Footer directory label, shown after the game name ("Adopt Me Value List"). */
  footerLabel: string
  /** Game sub-nav tab label, next to the category tabs ("Values"). */
  tabLabel: string
}

const LABELS: Record<HubToolLink['tool'], { footerLabel: string; tabLabel: string }> = {
  values: { footerLabel: 'Value List', tabLabel: 'Values' },
  calculator: { footerLabel: 'Value Calculator', tabLabel: 'Calculator' },
  inventory: { footerLabel: 'Inventory Calculator', tabLabel: 'Inventory' },
}

/**
 * The ONE content tab a game's marketplace sub-nav shows after its category
 * tabs, behind the grey divider (owner, 2026-10-23): "Values & Guides" to the
 * game's blog hub (its values + guides home), else straight to the value list
 * when the game has no blog hub; "Guides" for a guides-only game; none for a
 * game without a content hub. The footer keeps the direct value-list links
 * (hubToolLinks), so search engines still reach /[game]/values from every page.
 */
export interface HubNavTab {
  href: string
  label: 'Values & Guides' | 'Guides'
}

export function hubNavTab(gameSlug: string): HubNavTab | null {
  if (!hasGameContentTheme(gameSlug)) return null
  const { pages } = getGameContentTheme(gameSlug)
  if (pages.values) return { href: `/${gameSlug}/${pages.blog ? 'blog' : 'values'}`, label: 'Values & Guides' }
  if (pages.blog) return { href: `/${gameSlug}/blog`, label: 'Guides' }
  return null
}

export function hubToolLinks(gameSlug: string): HubToolLink[] {
  if (!hasGameContentTheme(gameSlug)) return []
  const { pages } = getGameContentTheme(gameSlug)
  if (!pages.values) return []
  const tools: HubToolLink['tool'][] = ['values']
  if (pages.calculator) tools.push('calculator')
  else if (pages.inventory) tools.push('inventory')
  return tools.map((tool) => ({ tool, href: `/${gameSlug}/${HUB_TOOL_PATH[tool]}`, ...LABELS[tool] }))
}
