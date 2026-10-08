import { GamesDirectoryCollapse } from '@/components/games-directory-collapse'

/**
 * "All <Game> Values A–Z": every item page of a value list, as plain links
 * in the server HTML.
 *
 * Why (2026-10-06 audit): the value tables read the URL with
 * useSearchParams, so their prerendered HTML is only a Suspense fallback, and
 * they page 24 at a time anyway — Google found Adopt Me and Steal a Brainrot
 * item pages only through the sitemap (0 links on the list page). The sites
 * that rank for "<item> value" link every item from the list page.
 *
 * Collapsed to a few rows under a fade with "Show All" (the footer's game
 * directory pattern); the links are always in the HTML.
 */
export function ValueItemIndex({
  title,
  items,
  className,
}: {
  title: string
  items: Array<{ href: string; name: string }>
  className?: string
}) {
  if (items.length === 0) return null
  const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
  return (
    <section aria-labelledby="value-index-title" className={['mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8', className].filter(Boolean).join(' ')}>
      <h2 id="value-index-title" className="text-[22px] font-bold tracking-[-0.02em] text-text-primary sm:text-[26px]">
        {title}
      </h2>
      <div className="mt-5">
        <GamesDirectoryCollapse collapsed={220} fade="var(--color-bg-base)" label={`Show All ${items.length.toLocaleString('en-US')}`}>
          {/* Styled from the list, and plain <a>: 500 links each carrying their
              own classes and a client Link reference were ~150 KB of the page
              (2026-10-07, Bing "HTML size is too long"). */}
          <ul className="columns-2 gap-x-8 sm:columns-3 lg:columns-5 [&_a]:text-[13.5px] [&_a]:text-text-secondary [&_a]:transition-colors [&_a:hover]:text-text-primary [&_li]:break-inside-avoid [&_li]:py-1">
            {sorted.map((it) => (
              <li key={it.href}>
                <a href={it.href}>{it.name}</a>
              </li>
            ))}
          </ul>
        </GamesDirectoryCollapse>
      </div>
    </section>
  )
}
