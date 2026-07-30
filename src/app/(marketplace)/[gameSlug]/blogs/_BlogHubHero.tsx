/**
 * Blog hub hero — follows the SAME rhythm as the Values page hero: a small
 * green kicker, a short punchy H1 ("<Game> Blog"), one concise subtext line,
 * with a stat block filling the right side. Long-form "about the game" copy is
 * kept but sits UNDER the headline as tight supporting text, not as the lead.
 *
 * Palette is the Values forest set (#F1F3F1 / #9BA8A0 / #6D7A72 / #4FB477).
 * Only the game-badge + hairline stat-grid layout come from the content design.
 */

import { HeroArtGrid, type HeroArtItem } from './_HeroArtGrid'

export interface BlogHubStat {
  label: string
  value: string
  accent?: boolean
}

export function BlogHubHero({
  gameSlug,
  kicker,
  title,
  lead,
  about,
  stats,
  artItems,
}: {
  gameSlug: string
  kicker: string
  title: string
  lead: string
  about?: string | null
  stats: BlogHubStat[]
  artItems: HeroArtItem[]
}) {
  const hasArt = artItems.filter((i) => i.imageUrl).length >= 4
  return (
    // pt clears the fixed single-row HubNav. No visible breadcrumb — the
    // BreadcrumbList JSON-LD schema (injected by the page) keeps the SERP
    // breadcrumb, so removing the visual costs nothing in Search.
    <section>
      <div className="mx-auto w-full max-w-7xl px-4 pb-10 pt-[92px] sm:px-6 lg:px-8">
        {/* Game identity now lives in the HubNav game switcher — the hero
            starts straight at the kicker + title. */}
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            {/* Kicker + short H1 + one-line subtext — Values' rhythm exactly. */}
            <p className="mb-3 text-[11.5px] font-bold uppercase tracking-[0.14em] text-[#4FB477]">
              {kicker}
            </p>
            <h1 className="text-[32px] font-bold leading-[1.06] tracking-[-0.03em] text-[#F1F3F1] sm:text-[38px] lg:text-[44px]">
              {title}
            </h1>
            <p className="mt-2 text-[13px] leading-6 text-[#9BA8A0] sm:text-sm">
              {lead}
            </p>
            {about && (
              <p className="mt-4 max-w-xl text-[13px] leading-relaxed text-[#7C877C]">
                {about}
              </p>
            )}
          </div>

          {/* Right side: item-art grid when we have renders, else the stat
              block so a game with no art (e.g. Adopt Me) still fills the space. */}
          {hasArt ? (
            <HeroArtGrid gameSlug={gameSlug} items={artItems} />
          ) : (
            stats.length > 0 && <StatBlock stats={stats} />
          )}
        </div>

        {/* When art takes the right side, the stats move to a slim strip below
            so we keep both without crowding the hero. */}
        {hasArt && stats.length > 0 && (
          <div className="mt-8">
            <StatBlock stats={stats} full />
          </div>
        )}
      </div>
    </section>
  )
}

function StatBlock({
  stats,
  full = false,
}: {
  stats: BlogHubStat[]
  full?: boolean
}) {
  return (
    <div
      className={`grid gap-px overflow-hidden border border-[#1E2723] bg-[#1E2723] ${
        full
          ? 'grid-cols-2 sm:grid-cols-4'
          : 'w-full grid-cols-2 sm:w-auto sm:min-w-[360px]'
      }`}
    >
      {stats.map((stat) => (
        <div key={stat.label} className="bg-[#121613] p-4 sm:p-5">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6D7A72]">
            {stat.label}
          </div>
          <div
            className={`text-[20px] font-bold sm:text-[24px] ${
              stat.accent ? 'text-[#4FB477]' : 'text-[#F1F3F1]'
            }`}
          >
            {stat.value}
          </div>
        </div>
      ))}
    </div>
  )
}
