import Link from '@/components/navigation/AppLink'
import { GameMark } from '@/components/content/GameMark'
import type { GuideGroup } from './_guides'

/**
 * Every game with guides, as pills: the game's blog home when it has one,
 * else its row further down. One line that swipes on phones, wraps from sm.
 */
export function GameSwitch({ games }: { games: GuideGroup[] }) {
  if (games.length === 0) return null
  return (
    <nav aria-label="Guides by game" className="mt-8">
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
        {games.map((g) => (
          <li key={g.key} className="shrink-0">
            <Link
              href={g.hubHref ?? `#guides-${g.key}`}
              className="flex h-11 items-center gap-2.5 rounded-md bg-bg-raised pl-2 pr-3.5 text-body-sm font-semibold text-text-primary shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] transition-colors hover:bg-bg-raised-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              <GameMark name={g.name} imageUrl={g.imageUrl} size="row" />
              {g.name}
              <span className="tabular-nums text-text-tertiary">{g.total}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
