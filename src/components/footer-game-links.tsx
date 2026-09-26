/**
 * FooterGameLinks — the game directory rendered INSIDE the footer (passed
 * to <Footer gameDirectory={...}> by layout-wrapper). It carries no heading
 * of its own: GameBoost, the pattern this copies, opens straight into the
 * game grid inside its footer. An earlier version of this comment claimed
 * GameBoost used a band ABOVE the footer — verified false against the live
 * site; no competitor surveyed does that. Each active game gets a logo + name heading linking
 * to its canonical landing, with its category links stacked beneath —
 * game-scoped anchor text written out in full ("Fortnite Accounts"), the
 * same interlinking GameBoost uses.
 *
 * Why a server component (not the client usePopularGames hook): these must
 * be real <a> links in the initial HTML on EVERY page so search engines see
 * the internal-link mesh directly — client-fetched links carry far less SEO
 * weight. This spreads ranking equity from every page to the money pages.
 */

import Link from 'next/link'
import { getCachedGameDirectory } from '@/lib/marketplace/gameDirectoryCache'
import { getGameIcon } from '@/features/home/lib/game-icons'
import { GamesDirectoryCollapse } from '@/components/games-directory-collapse'
import { getGameContentTheme } from '@/lib/content/theme'

type CategoryLink = { label: string; href: string }
type GameGroup = {
  slug: string
  name: string
  href: string
  icon: string
  cats: CategoryLink[]
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

/** Max category links shown per game — keeps the grid rows tidy. */
const MAX_CATS = 4

async function getDirectory(): Promise<GameGroup[]> {
  // Cookie-free + unstable_cache (see gameDirectoryCache.ts): this renders on
  // every route, so a cookie-bound read here would force the whole app dynamic.
  const { games, categories: cats } = await getCachedGameDirectory()

  const catsByGame = new Map<string, { slug: string; label: string }[]>()
  for (const c of cats ?? []) {
    const list = catsByGame.get(c.game_id) ?? []
    list.push({ slug: c.slug, label: categoryLabel(c.slug, c.name, undefined) })
    catsByGame.set(c.game_id, list)
  }

  return (games ?? []).map((g) => {
    const raw = catsByGame.get(g.id) ?? []
    let gameCats: CategoryLink[] = raw
      .slice(0, MAX_CATS)
      .map((c) => ({ label: c.label, href: `/${g.slug}/${c.slug}` }))
    // Flagship: surface the game's money tools alongside its marketplace
    // categories (high-intent, keyword-rich anchors). Config-driven via
    // `footerTools`, which is on for Steal a Brainrot only — so the rendered
    // footer is unchanged.
    const theme = getGameContentTheme(g.slug)
    if (theme.footerTools) {
      gameCats = [
        ...gameCats.slice(0, MAX_CATS - 2),
        { label: 'Value List', href: `/${g.slug}/values` },
        { label: 'Value Calculator', href: `/${g.slug}/calculator` },
      ]
    }
    return {
      slug: g.slug,
      name: g.name,
      // First active category is the canonical landing for the game link.
      href: raw[0] ? `/${g.slug}/${raw[0].slug}` : `/${g.slug}`,
      icon: getGameIcon(g.slug),
      cats: gameCats,
    }
  })
}

export async function FooterGameLinks() {
  const games = await getDirectory()
  if (games.length === 0) return null

  // GameBoost-style default: first row visible, the rest cut off under a
  // fade with a centered "Show All" button (GamesDirectoryCollapse). The
  // grid is server-rendered inside the client shell, so every <a href>
  // stays in the initial HTML and fully crawlable while collapsed.
  const collapsible = games.length > 6

  const grid = (
    <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          {games.map((g) => (
            <div key={g.slug} className="min-w-0">
              <Link href={g.href} className="group flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={g.icon}
                  alt=""
                  width={28}
                  height={28}
                  loading="lazy"
                  className="h-7 w-7 shrink-0 rounded-lg border border-white/10 object-cover"
                />
                <span className="truncate text-[14px] font-semibold text-white transition-colors group-hover:text-lime-text">
                  {g.name}
                </span>
              </Link>
              <ul className="mt-[7px] space-y-0">
                {g.cats.map((c) => (
                  <li key={c.href}>
                    <Link
                      href={c.href}
                      className="text-[12px] leading-[19.5px] text-text-secondary transition-colors hover:text-white"
                    >
                      {/* Visible, not sr-only: "Fortnite Accounts" is the
                          anchor text we want indexed AND the label a reader
                          scans. GameBoost writes it out in full for the same
                          reason — the interlinking is the whole point of this
                          block. */}
                      {g.name} {c.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
    </div>
  )

  return (
    // No heading, no "Browse all" link and no border: this renders INSIDE
    // the footer now, so a title row and a rule would read as a second
    // section. GameBoost's directory opens straight into the game grid.
    <nav aria-label="Game directory" className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
      {collapsible ? <GamesDirectoryCollapse>{grid}</GamesDirectoryCollapse> : grid}
    </nav>
  )
}
