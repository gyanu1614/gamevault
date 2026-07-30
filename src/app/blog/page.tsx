/**
 * /blog — the site-wide guide index.
 *
 * Two jobs, in this order:
 *   1. Route readers into the per-game content hubs (/[game]/blogs), which is
 *      where every post actually lives now. That also sculpts internal links
 *      from one crawlable page into each hub.
 *   2. Show the newest posts across every game underneath, so the page still
 *      answers "what's new" without a click.
 *
 * Stays in the marketplace chrome (site navbar, lime accent) rather than the
 * forest hub theme — it spans every game, so it belongs to the marketplace, not
 * to one game's hub. Square edges on this page's own chrome; BlogCard is a
 * shared site-wide component and keeps its existing geometry.
 *
 * Game rows are data-gated: a game appears only if it has published posts, so
 * this never links to an empty hub.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { getAllPublishedPosts } from '@/lib/blog/db'
import { createClient } from '@/lib/supabase/server'
import { BlogCard } from '@/components/blog/BlogCard'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Blog — Trading Guides & Safety Tips',
  description:
    'Trading guides, item value breakdowns, and marketplace safety tips from the DropMarket team.',
  alternates: { canonical: '/blog' },
}

/** A post's canonical URL: nested under its game when it has one, else flat. */
function postHref(post: { slug: string; primaryGameSlug: string | null }): string {
  return post.primaryGameSlug ? `/${post.primaryGameSlug}/blogs/${post.slug}` : `/blog/${post.slug}`
}

interface GameRow {
  name: string
  slug: string
  image_url: string | null
}

/** Names + art for the games that actually have posts. */
async function getGames(slugs: string[]): Promise<Map<string, GameRow>> {
  if (slugs.length === 0) return new Map()
  const supabase = await createClient()
  const { data } = await (supabase as any)
    .from('games')
    .select('name, slug, image_url')
    .in('slug', slugs)
    .eq('is_active', true)
  return new Map(((data as GameRow[] | null) ?? []).map((g) => [g.slug, g]))
}

export default async function BlogIndexPage() {
  const posts = await getAllPublishedPosts()

  // Posts per game — drives both the ordering and the count on each row.
  const counts = new Map<string, number>()
  for (const post of posts) {
    if (!post.primaryGameSlug) continue
    counts.set(post.primaryGameSlug, (counts.get(post.primaryGameSlug) ?? 0) + 1)
  }
  const games = await getGames([...counts.keys()])

  const hubs = [...counts.entries()]
    .map(([slug, count]) => ({ game: games.get(slug), count }))
    .filter((hub): hub is { game: GameRow; count: number } => Boolean(hub.game))
    .sort((a, b) => b.count - a.count || a.game.name.localeCompare(b.game.name))

  return (
    <main className="min-h-screen pb-24">
      <div className="mx-auto w-full max-w-7xl px-4 pt-12 sm:px-6 sm:pt-16 lg:px-8">
        <div className="text-center">
          <div className="text-label font-bold uppercase tracking-[0.18em] text-lime-text">
            — Blog —
          </div>
          <h1 className="mt-1 text-[30px] font-extrabold leading-[1.05] tracking-tight text-text-primary sm:text-[40px]">
            Guides From The <span className="text-lime-text">Drop</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-body text-text-tertiary sm:text-body-lg">
            Trading guides, safety tips, and marketplace know-how from the team.
          </p>
        </div>

        {/* Hubs first — this page's main job is sending readers into a game. */}
        {hubs.length > 0 && (
          <section className="mt-12 sm:mt-14">
            <h2 className="text-caption font-bold uppercase tracking-[0.14em] text-text-tertiary">
              Browse By Game
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {hubs.map(({ game, count }) => (
                <Link
                  key={game.slug}
                  href={`/${game.slug}/blogs`}
                  className="group flex items-center gap-3 border border-border-default bg-[rgba(20,20,27,0.56)] p-3 backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:bg-[rgba(26,26,35,0.70)]"
                >
                  {/* Monogram fallback — several games have no art yet, and an
                      empty tile reads as a broken image. */}
                  <span className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden bg-white/[0.04] text-body-sm font-bold text-text-tertiary">
                    {game.image_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={game.image_url}
                        alt=""
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : (
                      game.name.charAt(0).toUpperCase()
                    )}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-body-sm font-bold text-text-primary transition-colors group-hover:text-lime-text">
                      {game.name}
                    </span>
                    <span className="text-caption text-text-tertiary">
                      {count} {count === 1 ? 'guide' : 'guides'} · values &amp; calculator
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-text-tertiary transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-lime-text" />
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="mt-12 sm:mt-16">
          <h2 className="text-caption font-bold uppercase tracking-[0.14em] text-text-tertiary">
            Latest Guides
          </h2>
          {posts.length === 0 ? (
            <div className="mt-4 border border-border-default bg-[rgba(20,20,27,0.56)] px-6 py-14 text-center backdrop-blur-md">
              <p className="text-body font-semibold text-text-primary">No guides yet</p>
              <p className="mt-2 text-body-sm text-text-tertiary">
                New guides land here as we publish them.
              </p>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post, i) => (
                <BlogCard key={post.id} post={post} index={i} href={postHref(post)} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
