/**
 * /[game]/blogs/[slug] — a single content article in the Values-hub chrome.
 * Reads from the DB (blog_posts). Data-rich body, answer-first, dated; carries
 * the legal-safe ContentDisclaimer. Value/seller posts deep-link into the
 * marketplace (Eldorado model) via CTAs.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, ArrowLeft, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getGamePost } from '@/lib/blog/db'
import { formatDate } from '@/lib/sab/format'
import { JsonLd, breadcrumbList } from '@/lib/seo/jsonld'
import { SITE_URL } from '@/config/site'
import { ContentDisclaimer } from '@/components/content/ContentDisclaimer'
import { ValuesHeader } from '../../values/_ValuesHeader'
import { SabHeroBackdrop } from '../../values/_SabHeroBackdrop'
import { SabSubNav } from '../../values/_SabSubNav'

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
  params: Promise<{ gameSlug: string; slug: string }>
}): Promise<Metadata> {
  const { gameSlug, slug } = await params
  const post = await getGamePost(gameSlug, slug)
  if (!post) return { title: 'Not Found' }
  const url = `${SITE_URL}/${gameSlug}/blogs/${slug}`
  return {
    title: post.seoTitle || post.title,
    description: post.seoDescription || post.excerpt,
    alternates: { canonical: `/${gameSlug}/blogs/${slug}` },
    openGraph: {
      title: post.seoTitle || post.title,
      description: post.seoDescription || post.excerpt,
      url,
      type: 'article',
      ...(post.cover ? { images: [post.cover] } : {}),
    },
  }
}

export default async function GameBlogArticle({
  params,
}: {
  params: Promise<{ gameSlug: string; slug: string }>
}) {
  const { gameSlug, slug } = await params
  const [game, post] = await Promise.all([getGame(gameSlug), getGamePost(gameSlug, slug)])
  if (!game || !post) notFound()

  const kindLabel =
    post.postType === 'value' ? 'Value list' : post.postType === 'seller' ? 'Seller guide' : 'Guide'

  return (
    <main className="relative min-h-screen bg-[#0C0F0E] pb-24">
      <JsonLd
        data={breadcrumbList([
          { name: 'Home', path: '/' },
          { name: game.name, path: `/${gameSlug}` },
          { name: 'Guides', path: `/${gameSlug}/blogs` },
          { name: post.title, path: `/${gameSlug}/blogs/${slug}` },
        ])}
      />
      {/* Article schema — helps Google + AI understand the content + freshness. */}
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: post.title,
          description: post.excerpt,
          author: { '@type': 'Organization', name: post.author },
          publisher: { '@type': 'Organization', name: 'DropMarket' },
          datePublished: post.publishedAt,
          ...(post.cover ? { image: post.cover } : {}),
          mainEntityOfPage: `${SITE_URL}/${gameSlug}/blogs/${slug}`,
        }}
      />

      <SabHeroBackdrop>
        <ValuesHeader gameName={game.name} buyHref={`/${gameSlug}/buy-items`} />
        <SabSubNav />

        <article className="mx-auto w-full max-w-3xl px-4 pb-6 pt-8 sm:px-6 lg:px-8">
          <nav className="mb-4 flex items-center gap-1.5 text-[12.5px] text-[#6D7A72]">
            <Link href={`/${gameSlug}/blogs`} className="inline-flex items-center gap-1 transition-colors hover:text-[#F1F3F1]">
              <ArrowLeft className="h-3.5 w-3.5" />
              {game.name} guides
            </Link>
          </nav>

          <p className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-[#4FB477]">
            {kindLabel}
          </p>
          <h1 className="mt-1.5 text-[26px] font-semibold leading-tight tracking-tight text-[#F1F3F1] sm:text-[34px]">
            {post.title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-[#9BA8A0]">
            <span>{post.author}</span>
            <span className="text-[#3A463F]">·</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {post.readMinutes} min read
            </span>
            {post.publishedAt && (
              <>
                <span className="text-[#3A463F]">·</span>
                <span>Updated {formatDate(post.publishedAt)}</span>
              </>
            )}
          </div>
        </article>
      </SabHeroBackdrop>

      <div className="relative z-10 mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8">
        {post.cover && (
          <div className="mb-8 overflow-hidden rounded-lg border border-[#1E2723]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.cover} alt="" className="w-full object-cover" />
          </div>
        )}

        {/* Body — one <p> per paragraph. Kept plain server-rendered text so it's
            crawlable by search + AI engines (which run no JavaScript). */}
        <div className="space-y-5 text-[15px] leading-7 text-[#C6CEC9]">
          {post.body.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>

        {/* Deep-link CTAs into the marketplace + tools (the Eldorado model). */}
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href={`/${gameSlug}/values`}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1B6B3F] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1f7a48]"
          >
            See all {game.name} values
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href={`/${gameSlug}/buy-items`}
            className="inline-flex items-center gap-2 rounded-lg border border-[#26332C] bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-[#F1F3F1] transition hover:border-[#2A3A31] hover:bg-white/[0.06]"
          >
            Browse the marketplace
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <ContentDisclaimer
          gameName={game.name}
          gameSlug={gameSlug}
          includeValueNote={post.postType !== 'guide'}
        />
      </div>
    </main>
  )
}
