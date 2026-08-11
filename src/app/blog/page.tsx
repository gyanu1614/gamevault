/**
 * /blog — the site-wide guide index.
 *
 * Two jobs, in this order:
 *   1. Route readers into the per-game content hubs (/[game]/blog), which is
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
  return post.primaryGameSlug ? `/${post.primaryGameSlug}/blog/${post.slug}` : `/blog/${post.slug}`
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

  // Group posts by game (newest-first within each — getAllPublishedPosts already
  // returns newest-first). Posts with no game fall under a "General" bucket.
  const GENERAL = '__general__'
  const byGame = new Map<string, typeof posts>()
  for (const post of posts) {
    const key = post.primaryGameSlug ?? GENERAL
    const list = byGame.get(key)
    if (list) list.push(post)
    else byGame.set(key, [post])
  }
  const games = await getGames([...byGame.keys()].filter((k) => k !== GENERAL))

  // Build a section per game, ordered by that game's NEWEST post (so the most
  // recently updated game leads). General goes last.
  const sections = [...byGame.entries()]
    .map(([slug, list]) => ({
      slug,
      game: slug === GENERAL ? null : games.get(slug) ?? null,
      posts: list,
      newest: list[0]?.publishedAt ?? '',
    }))
    // Drop game sections whose game row is missing (inactive), keep General.
    .filter((s) => s.slug === GENERAL || s.game)
    .sort((a, b) => {
      if (a.slug === GENERAL) return 1
      if (b.slug === GENERAL) return -1
      return b.newest.localeCompare(a.newest)
    })

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

        {posts.length === 0 ? (
          <div className="mt-12 border border-border-default bg-[rgba(20,20,27,0.56)] px-6 py-14 text-center backdrop-blur-md">
            <p className="text-body font-semibold text-text-primary">No guides yet</p>
            <p className="mt-2 text-body-sm text-text-tertiary">
              New guides land here as we publish them.
            </p>
          </div>
        ) : (
          <div className="mt-12 flex flex-col gap-12 sm:mt-14 sm:gap-14">
            {sections.map(({ slug, game, posts: gamePosts }) => {
              const name = game?.name ?? 'General'
              const hubHref = game ? `/${game.slug}/blog` : null
              // Show the newest 3 per game; "View all" links to the game hub.
              const shown = gamePosts.slice(0, 3)
              return (
                <section key={slug}>
                  {/* ── Section header: game icon + name + count · View all ── */}
                  <div className="mb-4 flex items-center justify-between gap-3 border-b border-border-default pb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="relative grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-md bg-white/[0.04] text-body-sm font-bold text-text-tertiary">
                        {game?.image_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={game.image_url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                        ) : (
                          name.charAt(0).toUpperCase()
                        )}
                      </span>
                      <h2 className="text-[17px] font-bold tracking-tight text-text-primary sm:text-[19px]">
                        {name}
                      </h2>
                      <span className="text-caption text-text-tertiary">
                        {gamePosts.length} {gamePosts.length === 1 ? 'guide' : 'guides'}
                      </span>
                    </div>
                    {hubHref && (
                      <Link
                        href={hubHref}
                        className="group inline-flex items-center gap-1 text-body-sm font-semibold text-lime-text transition hover:opacity-80"
                      >
                        View all
                        <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                      </Link>
                    )}
                  </div>

                  {/* ── Uniform card grid (fixed via BlogCard) ── */}
                  <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
                    {shown.map((post, i) => (
                      <BlogCard key={post.id} post={post} index={i} href={postHref(post)} />
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
