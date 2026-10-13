/**
 * /[game]/blog/[slug] — one article (2026-10-12 revamp).
 *
 * Every post, old or new, is a block doc (readBody: legacy markdown is
 * converted) drawn by ONE server renderer (BlogDocView). Order: header
 * (breadcrumb, type, H1, answer line, byline) → 16:9 cover → body in a 700px
 * reading column (wide images up to 960px, never under the side columns) →
 * tools, seller band, more guides. Contents list: a sticky left column on
 * desktop, a slim bar under the nav on phones. Buy rails (growth point 2)
 * sit beside it from 1280px. Per-game accent from the content theme.
 */

import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import { createAnonClient } from '@/lib/supabase/anon'
import { getGamePost, getPostsTaggedForGame, getAllPublishedPosts, getPublishedPostBySlugAnyGame } from '@/lib/blog/db'
import { movedPostTarget } from '@/lib/blog/post-url'
import { readBody } from '@/lib/blog/doc/body'
import { BlogDocView } from '@/lib/blog/render/BlogDocView'
import { TOC_MIN_SECTIONS, collectHeadings, collectItemRefs, docReadMinutes, docWordCount } from '@/lib/blog/render/outline'
import { loadItemCards } from '@/lib/blog/render/items-server'
import { JsonLd, breadcrumbList, blogPosting } from '@/lib/seo/jsonld'
import { stripBrand, DEFAULT_OG_IMAGES } from '@/lib/seo/title'
import { SITE_URL } from '@/config/site'
import { seoMeta } from '@/lib/seo/fit'
import { HUB_GROUND } from '@/components/values/styles'
import { GameHeroBackdrop } from '@/components/marketplace/GameHeroBackdrop'
import { HubNav } from '@/components/content/HubNav'
import { HubFooter } from '@/components/content/HubFooter'
import { getHubNavData, HUB_NAV_CLEAR } from '@/lib/content/hubNav'
import { contentThemeVars, getGameContentTheme } from '@/lib/content/theme'
import { getGameRails, getRailSettings } from '@/lib/buy-rails/server'
import { barCard } from '@/lib/buy-rails/model'
import { BuyRail } from '@/components/buy-rails/BuyRail'
import { BuyBar } from '@/components/buy-rails/BuyBar'
import { RailCardView } from '@/components/buy-rails/RailCardView'
import { RAIL_GRID } from '@/components/buy-rails/geometry'
import { ArticleToc } from './_ArticleToc'
import { ArticleHeader } from '@/components/blog/ArticleHeader'
import { ArticleCover } from '@/components/blog/ArticleCover'
import { ArticleEnd, type RelatedTool } from './_ArticleEnd'

export const revalidate = 3600

/** Prerender every published game post; new ones render on demand into the same cache. */
export async function generateStaticParams() {
  const posts = await getAllPublishedPosts()
  return posts.filter((p) => p.primaryGameSlug).map((p) => ({ gameSlug: p.primaryGameSlug as string, slug: p.slug }))
}

const POST_TYPE_LABEL: Record<string, string> = { value: 'Value Guide', seller: 'Selling Guide', guide: 'Guide' }

async function getGame(gameSlug: string): Promise<{ name: string; slug: string } | null> {
  const { data } = await (createAnonClient() as any)
    .from('games')
    .select('name, slug')
    .eq('slug', gameSlug)
    .eq('is_active', true)
    .maybeSingle()
  return (data as { name: string; slug: string } | null) ?? null
}

/**
 * A post moved to another game in admin (e.g. MM2 Halloween from Adopt Me to
 * MM2): its old URL answers with a permanent redirect to the new one, so
 * links and search rankings follow. No per-move config.
 */
async function redirectIfMoved(gameSlug: string, slug: string): Promise<void> {
  const target = movedPostTarget(await getPublishedPostBySlugAnyGame(slug), gameSlug)
  if (target) permanentRedirect(target)
}

async function generateMetadataRaw({ params }: { params: Promise<{ gameSlug: string; slug: string }> }): Promise<Metadata> {
  const { gameSlug, slug } = await params
  const post = await getGamePost(gameSlug, slug)
  if (!post) {
    await redirectIfMoved(gameSlug, slug)
    notFound()
  }
  // The admin-written SEO title is reused for the social title; an editor may
  // have typed the brand into it, so the templated <title> gets it bare.
  const socialTitle = post.seoTitle || post.title
  return {
    title: stripBrand(socialTitle),
    description: post.seoDescription || post.excerpt,
    alternates: { canonical: `/${gameSlug}/blog/${slug}` },
    // Discover: allow the large image preview.
    robots: { 'max-image-preview': 'large' },
    openGraph: {
      title: socialTitle,
      description: post.seoDescription || post.excerpt,
      url: `${SITE_URL}/${gameSlug}/blog/${slug}`,
      type: 'article',
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      images: post.cover ? [post.cover] : DEFAULT_OG_IMAGES,
    },
  }
}

export default async function GameBlogArticle({ params }: { params: Promise<{ gameSlug: string; slug: string }> }) {
  const { gameSlug, slug } = await params
  const [game, post] = await Promise.all([getGame(gameSlug), getGamePost(gameSlug, slug)])
  if (!post) await redirectIfMoved(gameSlug, slug)
  if (!game || !post) notFound()

  const { doc, cover } = readBody(post.rawBody)
  const toc = collectHeadings(doc).filter((h) => h.level === 2)
  const hasToc = toc.length >= TOC_MIN_SECTIONS
  const kindLabel = POST_TYPE_LABEL[post.postType] ?? 'Guide'
  const theme = getGameContentTheme(gameSlug)

  const [tagged, hubNav, railSettings, rails, items] = await Promise.all([
    getPostsTaggedForGame(gameSlug, 4),
    getHubNavData(gameSlug),
    getRailSettings(),
    getGameRails(gameSlug),
    loadItemCards(collectItemRefs(doc)),
  ])

  // Buy rails: live currency card left (under the contents list), items card
  // right, from 1280px; one bottom bar below that. Admin switch: /admin/buy-rails.
  const showRails = railSettings.blog && !!(rails.currency || rails.items)
  const bar = railSettings.blog ? barCard(rails) : null
  const currencyRail = showRails && rails.currency ? (
    <RailCardView card={rails.currency} surface="blog" position="left" size={hasToc ? 'short' : 'tall'} />
  ) : null

  // Money pages that match the post's intent, only where the game has them.
  const values: RelatedTool | null = hubNav.tools.includes('values')
    ? { label: `${game.name} Value List`, desc: `What every ${game.name} item sells for, from live listings.`, href: `/${gameSlug}/values` }
    : null
  const calculator: RelatedTool | null = hubNav.tools.includes('calculator')
    ? { label: 'Trade Calculator', desc: 'Price both sides of a trade before you accept.', href: `/${gameSlug}/calculator` }
    : null
  const sell: RelatedTool | null = hubNav.sellHref
    ? { label: `Sell ${game.name} Items`, desc: 'List your items and get paid when the buyer confirms.', href: hubNav.sellHref }
    : null
  const tools = (post.postType === 'seller' ? [sell, values] : [values, calculator]).filter((t): t is RelatedTool => !!t)
  const related = tagged
    .filter((p) => p.slug !== slug)
    .slice(0, 3)
    .map((p) => ({ slug: p.slug, title: p.title, kind: POST_TYPE_LABEL[p.postType] ?? 'Guide', primaryGameSlug: p.primaryGameSlug, publishedAt: p.publishedAt, updatedAt: p.updatedAt }))

  return (
    <main className={`relative min-h-screen ${HUB_GROUND}`} style={contentThemeVars(theme)}>
      <JsonLd
        data={breadcrumbList([
          { name: 'Home', path: '/' },
          { name: game.name, path: `/${gameSlug}` },
          { name: 'Guides', path: `/${gameSlug}/blog` },
          { name: post.title, path: `/${gameSlug}/blog/${slug}` },
        ])}
      />
      <JsonLd
        data={blogPosting({
          title: post.title,
          description: post.excerpt,
          url: `${SITE_URL}/${gameSlug}/blog/${slug}`,
          datePublished: post.publishedAt,
          dateModified: post.updatedAt,
          authorName: post.author,
          image: post.cover,
          wordCount: docWordCount(doc),
          section: kindLabel,
        })}
      />

      {/* The whole top of the page sits on the game's art: nav, then ONE grid
          whose middle column holds the header, cover and body — so the title,
          the text and the cover share one left edge (the old header was
          centred on the page, the text on the column: three left edges). */}
      <GameHeroBackdrop gameSlug={gameSlug} size="hub">
        <HubNav data={hubNav} />
        <div className={`relative mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${HUB_NAV_CLEAR} ${showRails ? 'xl:max-w-none xl:px-0' : ''}`}>
          <div
            // minmax(0,1fr): nothing inside (a table, the contents bar) may widen the column past the phone.
            className={`grid grid-cols-[minmax(0,1fr)] items-start gap-x-10 ${hasToc ? 'lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-x-12' : ''} ${showRails ? RAIL_GRID : ''}`}
          >
            {hasToc ? (
              <ArticleToc entries={toc} rail={currencyRail} variant="column" />
            ) : showRails ? (
              <BuyRail label={rails.currency?.title ?? 'Shop'}>{currencyRail}</BuyRail>
            ) : null}

            <article className="min-w-0">
              <ArticleHeader
                gameSlug={gameSlug}
                gameName={game.name}
                kindLabel={kindLabel}
                title={post.title}
                excerpt={post.excerpt}
                author={post.author}
                publishedAt={post.publishedAt}
                updatedAt={post.updatedAt}
                readMinutes={docReadMinutes(doc)}
              />
              <ArticleCover image={cover} url={post.cover} alt={post.title} />
              {/* No cover: the same gap the cover would leave under the byline. */}
              <div className={cover || post.cover ? undefined : 'mt-8'}>
                {hasToc && <ArticleToc entries={toc} variant="bar" />}
                <BlogDocView doc={doc} items={items} gameSlug={gameSlug} />
              </div>
              <ArticleEnd gameSlug={gameSlug} gameName={game.name} slug={slug} tools={tools} related={related} includeValueNote={post.postType !== 'guide'} />
            </article>

            {showRails && (
              <BuyRail label={rails.items?.title ?? 'Shop'}>
                {rails.items && <RailCardView card={rails.items} surface="blog" position="right" />}
              </BuyRail>
            )}
          </div>
        </div>
      </GameHeroBackdrop>
      {bar && <BuyBar card={bar} surface="blog" mode="scroll" closable />}
      <HubFooter
        gameName={hubNav.current.name}
        gameSlug={hubNav.current.slug}
        tools={hubNav.tools}
        itemsHref={hubNav.itemsHref}
        accountsHref={hubNav.accountsHref}
      />
    </main>
  )
}

/** Search-length rules (title ≤ 60, description ≤ 155) — see src/lib/seo/fit.ts. */
export async function generateMetadata(...args: Parameters<typeof generateMetadataRaw>): Promise<Metadata> {
  return seoMeta(await generateMetadataRaw(...args))
}
