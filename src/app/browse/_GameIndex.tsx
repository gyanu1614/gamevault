'use client'

import { useMemo, useState } from 'react'
import { MagnifyingGlassIcon } from '@phosphor-icons/react/dist/csr/MagnifyingGlass'
import { XIcon } from '@phosphor-icons/react/dist/csr/X'
import Link from '@/components/navigation/AppLink'
import { MARKET_CARD } from '@/lib/ui/surfaces'
import { cn } from '@/lib/utils'
import type { LetterGroup } from './_browse-model'

const anchor = (letter: string) => (letter === '#' ? 'num' : letter)

/**
 * Every game, A to Z, as plain links in columns (the SEO directory: every
 * link is in the server HTML), with a letter bar and a quick filter. The
 * filter only hides rows; nothing is fetched.
 */
export function GameIndex({ groups, total }: { groups: LetterGroup[]; total: number }) {
  const [q, setQ] = useState('')
  // A preview of the list until "Show All" (owner: the page must not run
  // long); every link is still in the HTML, only clipped. A search opens it.
  const [open, setOpen] = useState(false)

  // A letter in the clipped part: open the list first, then scroll to it.
  function jump(e: React.MouseEvent<HTMLAnchorElement>, letter: string) {
    if (open) return
    e.preventDefault()
    setOpen(true)
    setTimeout(() => document.getElementById(`az-${anchor(letter)}`)?.scrollIntoView({ block: 'start' }), 0)
  }
  const needle = q.trim().toLowerCase()
  const shown = useMemo(
    () =>
      needle
        ? groups.map((g) => ({ ...g, games: g.games.filter((x) => x.name.toLowerCase().includes(needle)) })).filter((g) => g.games.length > 0)
        : groups,
    [groups, needle],
  )

  return (
    <div className={cn('rounded-lg p-4 sm:p-6', MARKET_CARD)}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <label className="relative block lg:w-80">
          <span className="sr-only">Find a game</span>
          <MagnifyingGlassIcon size={16} weight="bold" aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="search"
            name="game"
            autoComplete="off"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find a Game"
            className="h-11 w-full rounded-md bg-bg-overlay pl-9 pr-9 text-[16px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring sm:text-body-sm"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ('')}
              aria-label="Clear the game filter"
              className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded text-text-tertiary hover:bg-white/[0.06] hover:text-text-primary"
            >
              <XIcon size={14} weight="bold" />
            </button>
          )}
        </label>
        {!needle && (
          <nav aria-label="Jump to letter" className="-mx-1 flex flex-wrap gap-0.5">
            {groups.map((g) => (
              <a
                key={g.letter}
                href={`#az-${anchor(g.letter)}`}
                onClick={(e) => jump(e, g.letter)}
                className="grid h-8 min-w-8 place-items-center rounded px-1.5 text-caption font-semibold text-text-secondary transition-colors hover:bg-white/[0.06] hover:text-text-primary"
              >
                {g.letter}
              </a>
            ))}
          </nav>
        )}
      </div>

      {shown.length === 0 ? (
        <p aria-live="polite" className="mt-8 pb-4 text-center text-body-sm text-text-tertiary">{`No game matches "${q.trim()}".`}</p>
      ) : (
        <div className="relative">
        <div
          id="all-games-list"
          className={cn('mt-6 columns-2 gap-x-6 sm:columns-3 lg:columns-4 xl:columns-5', !open && !needle && 'max-h-[520px] overflow-hidden')}
        >
          {shown.map((g) => (
            <section
              key={g.letter}
              id={`az-${anchor(g.letter)}`}
              aria-label={`Games starting with ${g.letter}`}
              className="mb-5 break-inside-avoid scroll-mt-[calc(var(--navbar-bottom)+24px)]"
            >
              <h3 className="mb-1.5 text-body-sm font-bold text-text-primary">{g.letter}</h3>
              <ul className="space-y-0.5">
                {g.games.map((x) => (
                  <li key={x.slug}>
                    <Link href={x.href} className="block truncate rounded py-1 text-body-sm text-text-secondary transition-colors hover:text-text-primary">
                      {x.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        {!open && !needle && (
          <div className="absolute inset-x-0 bottom-0 flex h-36 items-end justify-center bg-gradient-to-t from-[#1A1B1F] via-[#1A1B1F]/90 to-transparent pb-1">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-expanded={false}
              aria-controls="all-games-list"
              className="h-11 rounded-md bg-bg-overlay px-5 text-body-sm font-semibold text-text-primary transition-colors hover:bg-bg-overlay-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              {`Show All ${total} Games`}
            </button>
          </div>
        )}
        </div>
      )}
    </div>
  )
}
