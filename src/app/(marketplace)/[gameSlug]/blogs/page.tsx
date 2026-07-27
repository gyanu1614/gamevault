/**
 * /[game]/blogs — the game's content collection (value + seller guides).
 * Lives in the Values-hub chrome. Reads published posts from the DB
 * (blog_posts, scoped by primary_game_slug).
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { sabCard } from '@/lib/sab/theme'
import { createClient } from '@/lib/supabase/server'
import { getGamePosts } from '@/lib/blog/db'
import { JsonLd, breadcrumbList } from '@/lib/seo/jsonld'
import { ValuesHeader } from '../values/_ValuesHeader'
import { SabHeroBackdrop } from '../values/_SabHeroBackdrop'
import { SabSubNav } from '../values/_SabSubNav'

export const revalidate = 3600

async function getGame(gameSlug: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('games')
    .select('name, slug, is_active')
    .eq('slug', gameSlug)
    .eq('is_active', true)
    .maybeSingle()
  return data as { name: string; slug: string } | null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ gameSlug: string }>
}): Promise<Metadata> {
  const { gameSlug } = await params
  const game = await getGame(gameSlug)
  if (!game) return { title: 'Not Found' }
  return {
    title: `${game.name} Guides, Values & Trading Tips`,
    description: `Value lists, trading guides, and selling tips for ${game.name} — updated regularly with real DropMarket marketplace data.`,
    alternates: { canonical: `/${gameSlug}/blogs` },
  }
}

export default async function GameBlogIndex({
  params,
}: {
  params: Promise<{ gameSlug: string }>
}) {
  const { gameSlug } = await params
  const game = await getGame(gameSlug)
  if (!game) notFound()

  const posts = await getGamePosts(gameSlug)

  return (
    <main className="relative min-h-screen bg-[#0C0F0E] pb-24">
      <JsonLd
        data={breadcrumbList([
          { name: 'Home', path: '/' },
          { name: game.name, path: `/${gameSlug}` },
          { name: 'Guides', path: `/${gameSlug}/blogs` },
        ])}
      />
      <SabHeroBackdrop>
        <ValuesHeader gameName={game.name} buyHref={`/${gameSlug}/buy-items`} />
        <SabSubNav />

        <div className="mx-auto w-full max-w-5xl px-4 pb-6 pt-8 sm:px-6 lg:px-8">
          <p className="mb-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-[#4FB477]">
            DropMarket value database
          </p>
          <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-[#F1F3F1] sm:text-[32px]">
            {game.name} guides &amp; value lists
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#9BA8A0]">
            Value lists, trading guides, and selling tips for {game.name} — built from real
            marketplace data and refreshed regularly.
          </p>
        </div>
      </SabHeroBackdrop>

      <div className="relative z-10 mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8">
        {posts.length === 0 ? (
          <div className={cn(sabCard, 'px-6 py-14 text-center')}>
            <p className="text-[15px] font-semibold text-[#F1F3F1]">No guides yet</p>
            <p className="mt-2 text-[13px] text-[#9BA8A0]">
              Check back soon — {game.name} guides are on the way.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/${gameSlug}/blogs/${post.slug}`}
                className={cn(
                  sabCard,
                  'group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:border-[#2A3A31]',
                )}
              >
                {post.cover && (
                  <div className="aspect-[16/9] overflow-hidden bg-[#0E1211]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={post.cover}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                )}
                <div className="flex flex-1 flex-col p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#4FB477]">
                    {post.postType === 'value'
                      ? 'Value list'
                      : post.postType === 'seller'
                        ? 'Seller guide'
                        : 'Guide'}
                  </p>
                  <h2 className="mt-1.5 text-[16px] font-semibold leading-snug text-[#F1F3F1]">
                    {post.title}
                  </h2>
                  <p className="mt-2 line-clamp-2 flex-1 text-[13px] leading-relaxed text-[#9BA8A0]">
                    {post.excerpt}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#4FB477]">
                    Read guide
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
