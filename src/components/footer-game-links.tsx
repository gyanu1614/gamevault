/**
 * FooterGameLinks — GameBoost-style "Popular Games" directory that sits in
 * its own section ABOVE the footer (rendered by layout-wrapper, not inside
 * the footer itself). Each active game gets a logo + name heading linking
 * to its canonical landing, with its category links stacked beneath —
 * game-scoped anchor text ("Fortnite Accounts") via an sr-only prefix, the
 * same SEO trick GameBoost uses (visible label stays short).
 *
 * Why a server component (not the client usePopularGames hook): these must
 * be real <a> links in the initial HTML on EVERY page so search engines see
 * the internal-link mesh directly — client-fetched links carry far less SEO
 * weight. This spreads ranking equity from every page to the money pages.
 */

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getGameIcon } from '@/features/home/lib/game-icons'
import { GamesDirectoryCollapse } from '@/components/games-directory-collapse'

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

  const catsByGame = new Map<string, { slug: string; label: string }[]>()
  for (const c of cats ?? []) {
    const list = catsByGame.get(c.game_id) ?? []
    list.push({ slug: c.slug, label: categoryLabel(c.slug, c.name, c.metadata?.label) })
    catsByGame.set(c.game_id, list)
  }

  return (games ?? []).map((g) => {
    const raw = catsByGame.get(g.id) ?? []
    let gameCats: CategoryLink[] = raw
      .slice(0, MAX_CATS)
      .map((c) => ({ label: c.label, href: `/${g.slug}/${c.slug}` }))
    // Flagship: surface the Steal a Brainrot money tools alongside its
    // marketplace categories (high-intent, keyword-rich anchors).
    if (g.slug === 'steal-a-brainrot') {
      gameCats = [
        ...gameCats.slice(0, MAX_CATS - 2),
        { label: 'Value List', href: '/steal-a-brainrot/values' },
        { label: 'Value Calculator', href: '/steal-a-brainrot/calculator' },
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
    <div className="grid grid-cols-2 gap-x-6 gap-y-9 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          {games.map((g) => (
            <div key={g.slug} className="min-w-0">
              <Link href={g.href} className="group flex items-center gap-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={g.icon}
                  alt=""
                  width={36}
                  height={36}
                  loading="lazy"
                  className="h-9 w-9 shrink-0 rounded-lg border border-white/10 object-cover"
                />
                <span className="truncate text-[13px] font-semibold text-white transition-colors group-hover:text-lime-text">
                  {g.name}
                </span>
              </Link>
              <ul className="mt-3 space-y-1.5">
                {g.cats.map((c) => (
                  <li key={c.href}>
                    <Link
                      href={c.href}
                      className="text-xs text-text-secondary transition-colors hover:text-white"
                    >
                      <span className="sr-only">{g.name} </span>
                      {c.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
    </div>
  )

  return (
    <section aria-label="Popular games" className="border-t border-border-subtle bg-bg-base">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-7 flex items-baseline justify-between gap-4">
          <h2 className="text-[15px] font-bold tracking-tight text-white">Popular Games</h2>
          <Link
            href="/browse"
            className="shrink-0 text-xs font-semibold text-text-tertiary transition-colors hover:text-lime-text"
          >
            Browse All Listings →
          </Link>
        </div>

        {collapsible ? <GamesDirectoryCollapse>{grid}</GamesDirectoryCollapse> : grid}
      </div>
    </section>
  )
}
