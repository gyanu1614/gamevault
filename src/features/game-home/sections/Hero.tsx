import { PackageIcon } from '@phosphor-icons/react/dist/ssr'
import type { HeroModel } from '../types'

/**
 * The game-home hero: centred over the game's art (GameHeroBackdrop paints
 * the band behind it). Logo, the H1 the page ranks for, one pitch line and
 * one line of plain facts (owner, 2026-10-23): no buttons, no stat boxes,
 * the offers start right below. The facts are real text so people and
 * answer engines read the same numbers.
 */
export function Hero({ hero }: { hero: HeroModel }) {
  return (
    <header className="gh-hero-in flex flex-col items-center px-1 pb-2 pt-8 text-center sm:pt-12">
      {hero.gameImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={hero.gameImageUrl}
          alt={`${hero.gameName} logo`}
          width={84}
          height={84}
          fetchPriority="high"
          className="h-[72px] w-[72px] rounded-[18px] object-cover shadow-[0_18px_40px_-12px_rgba(0,0,0,0.75),0_0_0_1px_rgba(255,255,255,0.08)] sm:h-[84px] sm:w-[84px]"
        />
      ) : (
        <span aria-hidden className="grid h-[72px] w-[72px] place-items-center rounded-[18px] bg-white/[0.06] sm:h-[84px] sm:w-[84px]">
          <PackageIcon size={30} weight="bold" className="text-text-secondary" />
        </span>
      )}

      {/* "<Game> Marketplace": the phrase the page ranks for (2026-10-06 audit). */}
      <h1
        className="mt-5 text-balance text-[32px] font-extrabold leading-[1.05] tracking-[-0.03em] text-text-primary sm:mt-6 sm:text-[46px]"
      >
        {hero.gameName} Marketplace
      </h1>

      <p className="mt-3 max-w-2xl text-balance text-[15px] leading-relaxed text-[#C9CDC6] sm:text-[17px]">{hero.pitch}</p>

      {hero.facts && (
        <p className="mt-2 max-w-2xl text-balance text-[13.5px] font-medium tabular-nums text-text-secondary sm:text-[14.5px]">{hero.facts}</p>
      )}
    </header>
  )
}
