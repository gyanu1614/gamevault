/**
 * /[game]/blogs/[slug] — a single content article.
 *
 * Uses the content-design article layout (sticky TOC sidebar + prose column,
 * key-takeaways box, section headings, FAQ accordion, related grid, buy CTA)
 * rendered entirely in the Values forest palette. Only what a post actually
 * contains is shown — no synthesised tables, FAQs or takeaways.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getGamePost, getPostsTaggedForGame } from '@/lib/blog/db'
import { formatDate } from '@/lib/sab/format'
import { JsonLd, breadcrumbList } from '@/lib/seo/jsonld'
import { SITE_URL } from '@/config/site'
import { ContentDisclaimer } from '@/components/content/ContentDisclaimer'
import { SabHeroBackdrop } from '../../values/_SabHeroBackdrop'
import { HubNav } from '@/components/content/HubNav'
import { getHubNavData, HUB_NAV_CLEAR } from '@/lib/content/hubNav'
import { ArticleBody, extractToc } from './_articleBody'
import { ArticleToc } from './_ArticleToc'

export const revalidate = 3600

const POST_TYPE_LABEL: Record<string, string> = {
  value: 'Value list',
  seller: 'Seller guide',
  guide: 'Guide',
}

const RELATED_DATE = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

async function getGame(gameSlug: string) {
  const supabase = await createClient()
  const { data } = await (supabase as any)
    .from('games')
    .select('name, slug, image_url, is_active')
    .eq('slug', gameSlug)
    .eq('is_active', true)
    .maybeSingle()
  return (data as { name: string; slug: string; image_url: string | null } | null) ?? null
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
  const [game, post] = await Promise.all([
    getGame(gameSlug),
    getGamePost(gameSlug, slug),
  ])
  if (!game || !post) notFound()

  const kindLabel = POST_TYPE_LABEL[post.postType] ?? 'Guide'
  const toc = extractToc(post.body)
  // A TOC sidebar only earns its column when there are ≥2 sections. With
  // fewer, collapse to a single column so the prose aligns with the hero
  // instead of being pushed right by an empty 220px rail.
  const hasToc = toc.length >= 2
  const buyHref = `/${gameSlug}/buy-items`
  const formattedDate = post.publishedAt ? formatDate(post.publishedAt) : null
  const updatedLabel = formattedDate ? formattedDate.toUpperCase() : null

  // Related = other posts for this game, excluding the current one.
  const [tagged, hubNav] = await Promise.all([
    getPostsTaggedForGame(gameSlug, 4),
    getHubNavData(gameSlug),
  ])
  const related = tagged.filter((p) => p.slug !== slug).slice(0, 3)

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

      {/* Shared hub nav inside the backdrop so the scrim keeps it legible. */}
      <SabHeroBackdrop>
        <HubNav data={hubNav} />

        {/* HERO — category, title, lead, byline. No visible breadcrumb (the
            BreadcrumbList JSON-LD keeps the SERP trail) and no identity block
            (the game now lives in the HubNav switcher). pt clears the nav. */}
        <div className={`mx-auto w-full max-w-7xl px-4 pb-10 sm:px-6 lg:px-8 ${HUB_NAV_CLEAR}`}>
          <div className="max-w-3xl">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-[#4FB477]">
              {kindLabel}
            </p>
            {/* Title — heavier weight + tight tracking for a strong, crawlable
                H1; the article H1 is the primary on-page SEO signal. */}
            <h1 className="text-balance text-[30px] font-bold leading-[1.08] tracking-[-0.03em] text-[#F1F3F1] sm:text-[42px]">
              {post.title}
            </h1>
            <p className="mt-4 max-w-2xl text-pretty text-[15px] leading-7 text-[#B7C0B8] sm:text-[17px]">
              {post.excerpt}
            </p>

            {/* Byline */}
            <div className="mt-7 flex flex-wrap items-center gap-3.5 border-t border-[#191F19] pt-5">
              <span className="flex h-9 w-9 items-center justify-center border border-[#23331F] bg-[#0D140E] font-mono text-[11px] font-bold text-[#8FBF9C]">
                DM
              </span>
              <span className="flex flex-col gap-1">
                <span className="text-[13px] font-semibold text-[#D7DED4]">
                  {post.author}
                </span>
                <span className="font-mono text-[11px] text-[#5E685E]">
                  {updatedLabel ? `UPDATED ${updatedLabel} · ` : ''}
                  {post.readMinutes} MIN READ
                </span>
              </span>
            </div>
          </div>
        </div>
      </SabHeroBackdrop>

      {/* BODY — sticky TOC sidebar + prose column. */}
      <div className="relative mx-auto w-full max-w-7xl px-4 pt-10 sm:px-6 sm:pt-14 lg:px-8">
        <div
          className={`grid items-start gap-10 ${
            hasToc ? 'lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-14' : ''
          }`}
        >
          {hasToc && (
            <ArticleToc
              entries={toc}
              buyHref={buyHref}
              buyLabel={`Buy ${game.name} items`}
            />
          )}

          <div className="max-w-[720px]">
            {post.cover && (
              <div className="mb-10 overflow-hidden border border-[#1E2723]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={post.cover} alt="" className="w-full object-cover" />
              </div>
            )}

            <ArticleBody body={post.body} />

            {/* CTA */}
            <div className="mt-14 border border-[#23331F] bg-[#0D140E] p-6 sm:p-8">
              <h2 className="mb-3 text-[22px] font-semibold leading-tight tracking-tight text-[#F1F3F1]">
                Skip the grind — buy the {game.name} item you want
              </h2>
              <p className="mb-5 max-w-md text-sm leading-relaxed text-[#98A398]">
                Every order is covered by SafeDrop — the seller is paid only
                after you confirm delivery.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href={buyHref}
                  className="inline-flex items-center gap-1.5 bg-[#1B6B3F] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1f7a48]"
                >
                  Buy {game.name} items →
                </Link>
                <Link
                  href={`/${gameSlug}/values`}
                  className="inline-flex items-center gap-1.5 border border-[#26332C] bg-white/[0.03] px-5 py-3 text-sm font-semibold text-[#E6EAE7] transition hover:border-[#2A3A31] hover:bg-white/[0.06]"
                >
                  See all {game.name} values →
                </Link>
              </div>
            </div>

            {/* Related guides */}
            {related.length > 0 && (
              <section className="mt-14">
                <h2 className="mb-4 border-t border-[#1A211A] pt-8 text-[22px] font-bold tracking-tight text-[#F2F6F0]">
                  Related guides
                </h2>
                <div className="grid gap-px overflow-hidden border border-[#1A211A] bg-[#1A211A] sm:grid-cols-3">
                  {related.map((r) => (
                    <Link
                      key={r.slug}
                      href={`/${gameSlug}/blogs/${r.slug}`}
                      className="flex flex-col gap-2.5 bg-[#0B0F0C] p-5 transition-colors hover:bg-[#101710]"
                    >
                      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8FBF9C]">
                        {POST_TYPE_LABEL[r.postType] ?? 'Guide'}
                      </span>
                      <span className="text-[15px] font-semibold leading-snug text-[#E4EAE2]">
                        {r.title}
                      </span>
                      {r.publishedAt && (
                        <span className="font-mono text-[10px] text-[#5E685E]">
                          UPDATED{' '}
                          {RELATED_DATE.format(
                            new Date(r.publishedAt),
                          ).toUpperCase()}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <ContentDisclaimer
              gameName={game.name}
              gameSlug={gameSlug}
              includeValueNote={post.postType !== 'guide'}
            />
          </div>
        </div>
      </div>
    </main>
  )
}
