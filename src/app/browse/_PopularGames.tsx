import Link from '@/components/navigation/AppLink'
import { getGameIcon } from '@/features/home/lib/game-icons'
import { MARKET_CARD, MARKET_CARD_HOVER } from '@/lib/ui/surfaces'
import { cn } from '@/lib/utils'
import type { BrowseGame } from './_browse-model'

/**
 * The hand-ordered popular games as tiles: the game's logo over a soft,
 * blurred glow of the same logo, so every tile carries its game's colours
 * (most games have no hero art, every game has a logo). 6 across on desktop,
 * 4 on tablets, 3 on phones.
 */
export function PopularGames({ games }: { games: BrowseGame[] }) {
  return (
    <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 sm:gap-3 lg:grid-cols-6">
      {games.map((g) => {
        const src = g.image_url || getGameIcon(g.slug)
        return (
          <li key={g.slug}>
            <Link
              href={g.href}
              className={cn(
                'group relative isolate flex aspect-[4/5] flex-col items-center justify-end overflow-hidden rounded-lg p-3 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring sm:aspect-square sm:p-4',
                MARKET_CARD,
                MARKET_CARD_HOVER,
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- the logo's own colours as the glow */}
              <img
                src={src}
                alt=""
                aria-hidden
                width={160}
                height={160}
                loading="lazy"
                className="pointer-events-none absolute left-1/2 top-[38%] -z-10 h-[85%] w-[85%] -translate-x-1/2 -translate-y-1/2 scale-125 rounded-full object-cover opacity-35 blur-2xl"
              />
              {/* eslint-disable-next-line @next/next/no-img-element -- remote game logo */}
              <img
                src={src}
                alt={`${g.name} logo`}
                width={96}
                height={96}
                loading="lazy"
                className="mb-auto mt-[12%] h-[44%] w-auto rounded-xl object-cover shadow-[0_10px_24px_-10px_rgba(0,0,0,0.7)] transition-transform duration-300 group-hover:scale-[1.04] motion-reduce:transition-none"
              />
              <span className="mt-3 line-clamp-2 text-body-sm font-semibold leading-tight text-text-primary">{g.name}</span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
