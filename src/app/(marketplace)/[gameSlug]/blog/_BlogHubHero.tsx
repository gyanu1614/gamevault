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
  lead,
}: {
  gameName: string
  lead: string
}) {
  // Shared hub hero — identical type scale + spacing as Values / Calculator /
  // Sell, so every hub reads as one family (no bespoke 52px title or extra
  // top air here anymore).
  return (
    <section>
      <HubHero title={`${gameName} Blog & News`} lead={lead} />
    </section>
  )
}
