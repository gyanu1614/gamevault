/**
 * FooterGameLinks — a SERVER component that renders a site-wide block of
 * internal links to every active game (and its categories) plus the flagship
 * Steal a Brainrot tools (Values / Calculator).
 *
 * Why a server component (not the client usePopularGames hook): these must be
 * real <a> links in the initial HTML on EVERY page so search engines see the
 * internal-link mesh directly — client-fetched links carry far less SEO weight.
 * This spreads ranking equity from every page to the money pages (the whole
 * point of a footer link block).
 */

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

type GameLink = {
  slug: string
  name: string
  href: string
}

/** Turn a category slug into a readable label ("buy-items" → "Items"). */
function categoryLabel(slug: string, name: string | null, metaLabel?: string | null): string {
  return (
    name ||
    metaLabel ||
    slug
      .replace(/^buy-/, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (ch) => ch.toUpperCase())
  )
}

async function getGameLinks(): Promise<{
  games: GameLink[]
  sabCategories: { label: string; href: string }[]
}> {
  const supabase = await createClient()

  const [{ data: games }, { data: cats }] = await Promise.all([
    supabase
      .from('games')
      .select('id, slug, name, is_active, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .limit(24) as unknown as Promise<{
      data: { id: string; slug: string; name: string; sort_order: number | null }[] | null
    }>,
    supabase
      .from('categories')
      .select('game_id, slug, name, metadata, display_order, is_active')
      .eq('is_active', true)
      .order('display_order', { ascending: true }) as unknown as Promise<{
      data: {
        game_id: string
        slug: string
        name: string | null
        metadata: { label?: string; type?: string } | null
      }[] | null
    }>,
  ])

  // First active category per game → the canonical landing URL for the link.
  const firstCatByGame = new Map<string, string>()
  const sabGameId = (games ?? []).find((g) => g.slug === 'steal-a-brainrot')?.id
  const sabCategories: { label: string; href: string }[] = []

  for (const c of cats ?? []) {
    if (!firstCatByGame.has(c.game_id)) firstCatByGame.set(c.game_id, c.slug)
    if (sabGameId && c.game_id === sabGameId) {
      sabCategories.push({
        label: categoryLabel(c.slug, c.name, c.metadata?.label),
        href: `/steal-a-brainrot/${c.slug}`,
      })
    }
  }

  const gameLinks: GameLink[] = (games ?? []).map((g) => {
    const firstCat = firstCatByGame.get(g.id)
    return {
      slug: g.slug,
      name: g.name,
      href: firstCat ? `/${g.slug}/${firstCat}` : `/${g.slug}`,
    }
  })

  return { games: gameLinks, sabCategories }
}

const linkClass =
  'text-xs text-text-secondary transition-colors hover:text-white'
const headingClass =
  'text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary'

export async function FooterGameLinks() {
  const { games, sabCategories } = await getGameLinks()
  if (games.length === 0) return null

  // Only collapse when the mesh is big enough that a full render would clutter
  // the footer. Below the threshold, show everything open (no toggle).
  const collapsible = games.length > 10

  // CSS-only collapse (no JS): a hidden checkbox toggles a max-height on the
  // grid. Google's rule — the <a href> links are ALL in the server-rendered
  // HTML on load and merely hidden by CSS, so they stay fully crawlable while
  // the UI shows ~2 rows until "Show more" is clicked. See competitor-seo memo.
  return (
    <nav aria-label="Browse games" className="w-full border-t border-white/[0.06] pt-8">
      {collapsible && (
        <input type="checkbox" id="footer-links-toggle" className="peer sr-only" />
      )}

      <div
        className={
          collapsible
            ? 'mx-auto grid w-full max-w-4xl grid-cols-2 gap-x-8 gap-y-8 overflow-hidden text-left transition-[max-height] duration-300 [max-height:150px] peer-checked:[max-height:1200px] sm:grid-cols-3 lg:grid-cols-4'
            : 'mx-auto grid w-full max-w-4xl grid-cols-2 gap-x-8 gap-y-8 text-left sm:grid-cols-3 lg:grid-cols-4'
        }
      >
        {/* Games — core mesh: every page links to every game. */}
        <div className="col-span-2 sm:col-span-2 lg:col-span-2">
          <h3 className={headingClass}>Popular Games</h3>
          <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5">
            {games.map((g) => (
              <li key={g.slug}>
                <Link href={g.href} className={linkClass}>
                  {g.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Steal a Brainrot — flagship: link its money pages + tools directly. */}
        {sabCategories.length > 0 && (
          <div>
            <h3 className={headingClass}>Steal a Brainrot</h3>
            <ul className="mt-3 space-y-1.5">
              {sabCategories.map((c) => (
                <li key={c.href}>
                  <Link href={c.href} className={linkClass}>
                    {c.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Free tools — high-intent, keyword-rich anchors to the flagship data. */}
        <div>
          <h3 className={headingClass}>Tools &amp; Values</h3>
          <ul className="mt-3 space-y-1.5">
            <li>
              <Link href="/steal-a-brainrot/values" className={linkClass}>
                Brainrot Values
              </Link>
            </li>
            <li>
              <Link href="/steal-a-brainrot/calculator" className={linkClass}>
                Value Calculator
              </Link>
            </li>
            <li>
              <Link href="/browse" className={linkClass}>
                Browse All Listings
              </Link>
            </li>
          </ul>
        </div>
      </div>

      {/* Show more / less — pure-CSS label toggle (following sibling of the peer
          checkbox, so `peer-checked:` swaps the two spans). No JavaScript. */}
      {collapsible && (
        <div className="mx-auto mt-4 w-full max-w-4xl text-center">
          <label
            htmlFor="footer-links-toggle"
            className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary transition-colors hover:text-white peer-checked:[&_.more]:hidden peer-checked:[&_.less]:inline"
          >
            <span className="more">Show more ↓</span>
            <span className="less hidden">Show less ↑</span>
          </label>
        </div>
      )}
    </nav>
  )
}
