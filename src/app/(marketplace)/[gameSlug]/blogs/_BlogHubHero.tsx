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

export function BlogHubHero({
  gameName,
  lead,
}: {
  gameName: string
  lead: string
}) {
  return (
    <section>
      {/* pt clears the fixed HubNav. The generous pb is intentional — it's the
          gap reserved for a hero image / editorial art between the title and
          the featured card. */}
      <div className="mx-auto w-full max-w-3xl px-4 pb-14 pt-[104px] text-center sm:px-6 sm:pb-20 sm:pt-[120px]">
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
