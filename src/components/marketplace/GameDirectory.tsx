'use client'

/**
 * GameDirectory — the "browse every game" block above the footer on
 * marketplace pages. Each game shows its logo + name and links to each of
 * its active subcategories (SEO: internal links to every game×category
 * page from every page). Collapsed to the first `previewRows` rows with a
 * "Show All" toggle (GameBoost pattern) — all links are in the HTML
 * regardless, so the collapse is purely visual.
 */

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface DirectoryGame {
  slug: string
  name: string
  imageUrl: string | null
  categories: { slug: string; label: string }[]
}

export default function GameDirectory({
  games,
  heading = 'Browse Every Game',
  /** Grid rows shown before "Show All". At 6 cols that's ~previewRows×6 games. */
  previewCount = 12,
}: {
  games: DirectoryGame[]
  heading?: string
  previewCount?: number
}) {
  const [expanded, setExpanded] = useState(false)
  const collapsible = games.length > previewCount

  return (
    <section
      aria-labelledby="game-directory-heading"
      className="mx-auto w-full max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8"
    >
      <div className="mb-5 flex items-center gap-3">
        <h2
          id="game-directory-heading"
          className="text-[13px] font-bold uppercase tracking-[0.14em] text-text-secondary"
        >
          {heading}
        </h2>
        <span className="h-px flex-1 bg-border-subtle" aria-hidden />
      </div>

      {/* Collapsed shell: the grid clips to a max height with a fade; all
          links stay in the DOM for crawlers. Expanded removes the clamp. */}
      <div className="relative">
        <div
          className={cn(
            'grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6',
            collapsible && !expanded && 'max-h-[420px] overflow-hidden',
          )}
        >
          {games.map((g) => (
            <div key={g.slug} className="min-w-0">
              <Link
                href={`/${g.slug}`}
                className="group mb-2.5 flex items-center gap-2.5"
              >
                {g.imageUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={g.imageUrl}
                    alt=""
                    loading="lazy"
                    className="h-8 w-8 shrink-0 rounded-lg object-cover ring-1 ring-white/[0.08]"
                  />
                ) : (
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-bg-overlay text-[10px] font-bold text-text-tertiary ring-1 ring-white/[0.08]">
                    {g.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
                <span className="min-w-0 truncate text-[14.5px] font-bold text-text-primary transition-colors group-hover:text-lime-text">
                  {g.name}
                </span>
              </Link>
              <ul className="space-y-1.5">
                {g.categories.map((c) => (
                  <li key={c.slug}>
                    <Link
                      href={`/${g.slug}/${c.slug}`}
                      className="text-[13px] text-text-tertiary transition-colors hover:text-text-primary"
                    >
                      {g.name} {c.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {collapsible && !expanded && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-32 items-end justify-center bg-gradient-to-t from-[var(--color-bg-base,#0A0A0F)] via-[var(--color-bg-base,#0A0A0F)]/80 to-transparent">
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-border-default bg-bg-overlay px-5 py-2.5 text-[13.5px] font-bold text-text-primary shadow-elevated transition-colors hover:border-lime-tint-border hover:bg-bg-raised-hover"
            >
              Show All Games
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
