/**
 * Blog hub hero — a centred title block, nothing else.
 *
 * Deliberately minimal: the game icon and name already sit in the navbar, and
 * the earlier version's item-art grid and stat strip competed with the featured
 * card directly beneath it. Now it's just the headline and one line of context,
 * centred, with breathing room below for editorial art later.
 *
 * Shared by every game's blog hub, so the copy is composed from the game name.
 */

import { HubHero } from '@/components/content/HubHero'

export function BlogHubHero({
  gameName,
  title,
  lead,
}: {
  gameName: string
  /**
   * Intent-matched H1. Defaults to the per-game theme.heroTitle
   * ("{game} values, trading and cash-out guides") — the H1 is a primary SEO
   * signal, so it mirrors the search-intent metadata title rather than the old
   * generic "Blog & News" (which matched almost no query).
   */
  title?: string
  lead: string
}) {
  // Shared hub hero — identical type scale + spacing as Values / Calculator /
  // Sell, so every hub reads as one family (no bespoke 52px title or extra
  // top air here anymore).
  return (
    <section>
      <HubHero title={title ?? `${gameName} Guides & Values`} lead={lead} />
    </section>
  )
}
