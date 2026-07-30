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

import { HUB_NAV_CLEAR_HERO } from '@/components/content/hubNavGeometry'

export function BlogHubHero({
  gameName,
  lead,
}: {
  gameName: string
  lead: string
}) {
  return (
    <section>
      {/* Clearance for the fixed HubNav comes from the shared constant, so a
          change to the nav's height can't leave this hero overlapping it. */}
      <div
        className={`mx-auto w-full max-w-3xl px-4 pb-10 text-center sm:px-6 sm:pb-12 ${HUB_NAV_CLEAR_HERO}`}
      >
        <h1 className="text-balance text-[32px] font-bold leading-[1.06] tracking-[-0.03em] text-[#F2F6F0] sm:text-[44px] lg:text-[52px]">
          {gameName} Blog &amp; News
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-pretty text-[15px] leading-7 text-[#98A398] sm:text-[17px]">
          {lead}
        </p>
      </div>
    </section>
  )
}
