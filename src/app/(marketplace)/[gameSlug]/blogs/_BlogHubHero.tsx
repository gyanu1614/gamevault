/**
 * Blog hub hero — follows the SAME rhythm as the Values page hero: a small
 * green kicker, a short punchy H1 ("<Game> Blog"), one concise subtext line,
 * with a stat block filling the right side. Long-form "about the game" copy is
 * kept but sits UNDER the headline as tight supporting text, not as the lead.
 *
 * Palette is the Values forest set (#F1F3F1 / #9BA8A0 / #6D7A72 / #4FB477).
 * Only the game-badge + hairline stat-grid layout come from the content design.
 */

import Link from 'next/link'
import { HeroArtGrid, type HeroArtItem } from './_HeroArtGrid'

export interface BlogHubStat {
  label: string
  value: string
  accent?: boolean
}

export function BlogHubHero({
  gameSlug,
  gameName,
  logoUrl,
  kicker,
  title,
  lead,
  about,
  stats,
  artItems,
}: {
  gameSlug: string
  gameName: string
  logoUrl?: string | null
  kicker: string
  title: string
  lead: string
  about?: string | null
  stats: BlogHubStat[]
  artItems: HeroArtItem[]
}) {
  const hasArt = artItems.filter((i) => i.imageUrl).length >= 4
  return (
    <section>
      <div className="mx-auto w-full max-w-7xl px-4 pb-10 pt-8 sm:px-6 lg:px-8">
        {/* Breadcrumb — brighter than the Values grey so it stays legible on
            the hero backdrop; current crumb is near-white. */}
        <nav className="mb-6 flex flex-wrap items-center gap-1.5 text-[12.5px] text-[#9BA8A0]">
          <Link href="/" className="transition-colors hover:text-[#F1F3F1]">
            DropMarket
          </Link>
          <span aria-hidden className="text-[#4C564E]">
            /
          </span>
          <Link
            href={`/${gameSlug}`}
            className="transition-colors hover:text-[#F1F3F1]"
          >
            {gameName}
          </Link>
          <span aria-hidden className="text-[#4C564E]">
            /
          </span>
          <span className="font-medium text-[#F1F3F1]">Blog</span>
        </nav>

        {/* Game identity block — accent square (logo or initials) beside the
            game name and its platform. Bigger and bolder than a chip so the
            game reads as the owner of the hub. */}
        <div className="mb-7 flex items-center gap-4">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote game logo
            <img
              src={logoUrl}
              alt=""
              className="h-[52px] w-[52px] shrink-0 object-cover"
            />
          ) : (
            <span
              aria-hidden
              className="flex h-[52px] w-[52px] shrink-0 items-center justify-center bg-[#1B6B3F] font-mono text-[15px] font-bold text-white"
            >
              {gameName.slice(0, 3).toUpperCase()}
            </span>
          )}
          <span className="flex flex-col gap-1.5">
            <span className="text-[18px] font-bold leading-none tracking-tight text-[#F1F3F1]">
              {gameName}
            </span>
            <span className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-[#8FBF9C]">
              Roblox
            </span>
          </span>
        </div>

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
