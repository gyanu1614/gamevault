/**
 * /[game]/blog/[slug] — a single content article.
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
import { SabSellerCta } from '../../_SabSellerCta'
import { formatDate } from '@/lib/sab/format'
import { JsonLd, breadcrumbList, blogPosting } from '@/lib/seo/jsonld'
import { SITE_URL } from '@/config/site'
import { IconListDetails, IconCalculator, IconTag, IconArrowRight, IconArrowUpRight } from '@tabler/icons-react'
import { SpotlightCard } from '@/components/ui/spotlight-card'
import { ContentDisclaimer } from '@/components/content/ContentDisclaimer'
import { SabHeroBackdrop } from '../../values/_SabHeroBackdrop'
import { HubNav } from '@/components/content/HubNav'
import { HubFooter } from '@/components/content/HubFooter'
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

  const base = 'name, slug, image_url, is_active, cover_url'

  // blog_cta_image_url ships in a migration that has to be applied by hand, so
  // the page must work either side of it. Selecting a column that doesn't
  // exist yet fails the whole query — which 404'd every article until the
  // migration ran. Ask for it, and quietly fall back if the schema is behind.
  const withBanner = await (supabase as any)
    .from('games')
    .select(`${base}, blog_cta_image_url`)
    .eq('slug', gameSlug)
    .eq('is_active', true)
    .maybeSingle()

  if (!withBanner.error) {
    return (withBanner.data as GameRow | null) ?? null
  }

  const { data } = await (supabase as any)
    .from('games')
    .select(base)
    .eq('slug', gameSlug)
    .eq('is_active', true)
    .maybeSingle()
  return (data as GameRow | null) ?? null
}

type GameRow = {
  name: string
  slug: string
  image_url: string | null
  cover_url?: string | null
  blog_cta_image_url?: string | null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ gameSlug: string; slug: string }>
}): Promise<Metadata> {
  const { gameSlug, slug } = await params
  const post = await getGamePost(gameSlug, slug)
  if (!post) return { title: 'Not Found' }
  const url = `${SITE_URL}/${gameSlug}/blog/${slug}`
  return {
    title: post.seoTitle || post.title,
    description: post.seoDescription || post.excerpt,
    alternates: { canonical: `/${gameSlug}/blog/${slug}` },
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

  // Per-game CTA banner. blog_cta_image_url is the dedicated wide asset (see
  // the games_blog_cta_image migration); cover_url is the card art, used as a
  // stand-in until a banner is uploaded for that game.
  const ctaImage = game.blog_cta_image_url || game.cover_url || null
  const buyHref = `/${gameSlug}/buy-items`
  // Honest date byline: show "Updated {date}" only when the post was actually
  // edited after publishing (updatedAt > publishedAt); otherwise "Published".
  // Previously this always said "Updated" using the publish date — a soft
  // freshness misrepresentation. `updatedAt` is trigger-maintained in the DB.
  const wasEdited = !!post.updatedAt && post.updatedAt > post.publishedAt
  const bylineDate = wasEdited ? post.updatedAt : post.publishedAt
  const formattedDate = bylineDate ? formatDate(bylineDate) : null
  const dateVerb = wasEdited ? 'Updated' : 'Published'
  const updatedLabel = formattedDate ? formattedDate.toUpperCase() : null

  // Related = other posts for this game, excluding the current one.
  const [tagged, hubNav] = await Promise.all([
    getPostsTaggedForGame(gameSlug, 4),
    getHubNavData(gameSlug),
  ])
  const related = tagged.filter((p) => p.slug !== slug).slice(0, 3)

  // "Related tools" links — routes a reader to the money page matching their
  // intent, keyed by post type. Gated on the game actually having that route
  // (hubNav.tools / sellHref) so no link is ever dead; distinct keyword anchors.
  const hasValues = hubNav.tools.includes('values')
  const hasCalculator = hubNav.tools.includes('calculator')
  const TOOL = {
    values: hasValues
      ? {
          eyebrow: 'Value list',
          label: `See the full ${game.name} value list`,
          desc: `Live cash values for every ${game.name} item, updated daily.`,
          href: `/${gameSlug}/values`,
          icon: IconListDetails,
        }
      : null,
    calculator: hasCalculator
      ? {
          eyebrow: 'WFL calculator',
          label: `Check a trade — Win, Fair or Loss?`,
          desc: `Price both sides of a trade in real money before you accept.`,
          href: `/${gameSlug}/calculator`,
          icon: IconCalculator,
        }
      : null,
    sell: hubNav.sellHref
      ? {
          eyebrow: 'Sell',
          label: `List your ${game.name} items to sell`,
          desc: `Turn your items into cash — SafeDrop protects every payout.`,
          href: hubNav.sellHref,
          icon: IconTag,
        }
      : null,
  }
  const toolOrder: Array<keyof typeof TOOL> =
    post.postType === 'seller'
      ? ['sell', 'values']
      : post.postType === 'value'
        ? ['values', 'calculator']
        : ['values', 'calculator']
  const relatedTools = toolOrder.map((k) => TOOL[k]).filter(Boolean) as NonNullable<
    (typeof TOOL)[keyof typeof TOOL]
  >[]

  return (
    <main className="relative min-h-screen bg-[#0C0F0E]">
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
        })}
      />

      {/* Shared hub nav inside the backdrop so the scrim keeps it legible. */}
      <SabHeroBackdrop>
        <HubNav data={hubNav} />

        {/* HERO — category, title, lead, byline. No visible breadcrumb (the
            BreadcrumbList JSON-LD keeps the SERP trail) and no identity block
            (the game now lives in the HubNav switcher). pt clears the nav. */}
        <div className={`mx-auto w-full max-w-7xl px-4 pb-10 sm:px-6 lg:px-8 ${HUB_NAV_CLEAR}`}>
          {/* Centred like the hub pages, but a step down in size: the hub H1 is
              a 3-4 word product name, an article H1 is a full sentence. At
              hub scale ("Steal a Brainrot - Value" is 54px) a long title would
              run to four lines and swamp the fold, so this tops out at 38px. */}
          <div className="max-w-3xl">
            {/* Eyebrow + read-time — the category as a pill so it reads as a
                real label, then the read-time in a legible (non-mono) grey. */}
            <div className="mb-4 flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center rounded-full border border-[#2F6B46]/40 bg-[#2F6B46]/12 px-3 py-1 text-[12px] font-bold uppercase tracking-[0.12em] text-[#7ED39A]">
                {kindLabel}
              </span>
              <span className="text-[14px] text-[#8A968C]">
                {post.readMinutes} min read
              </span>
            </div>
            {/* Title — heavier weight + tight tracking for a strong, crawlable
                H1; the article H1 is the primary on-page SEO signal. */}
            <h1 className="text-balance text-[27px] font-bold leading-[1.1] tracking-[-0.03em] text-[#F1F3F1] sm:text-[34px] lg:text-[38px]">
              {post.title}
            </h1>
            <p className="mt-4 max-w-2xl text-pretty text-[15px] leading-7 text-[#B7C0B8] sm:text-[17px]">
              {post.excerpt}
            </p>

            {/* Byline — the DropMarket mark + author, in the normal type scale
                and a legible colour (the old mono #5E685E line was nearly
                invisible on the hero photo). */}
            <div className="mt-6 flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/logo-mark-white.png"
                alt=""
                width={26}
                height={26}
                className="h-[26px] w-[26px] object-contain"
              />
              <span className="text-[14px] font-semibold text-[#E4EAE2]">
                {post.author}
              </span>
              {updatedLabel && (
                <>
                  <span aria-hidden className="text-[#4A554B]">·</span>
                  <span className="text-[14px] text-[#98A398]">
                    {dateVerb} {updatedLabel}
                  </span>
                </>
              )}
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

          <div className="mx-auto w-full max-w-[760px]">
            {post.cover && (
              <div className="mb-10 overflow-hidden border border-[#1E2723]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={post.cover} alt="" className="w-full object-cover" />
              </div>
            )}

            <ArticleBody body={post.body} />

            {/* CTA — per-game banner behind it.
                Prefers the purpose-made blog_cta_image_url; falls back to the
                game's card art so every game gets a background today, and a
                flat panel if neither exists. A scrim keeps the copy readable
                whatever the art. */}
            <div
              className="relative mt-14 overflow-hidden border border-[#23331F] bg-[#0D140E] p-6 sm:p-8"
              style={
                ctaImage
                  ? {
                      backgroundImage: `linear-gradient(90deg, rgba(9,14,10,0.96) 0%, rgba(9,14,10,0.88) 45%, rgba(9,14,10,0.62) 100%), url(${ctaImage})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }
                  : undefined
              }
            >
              <h2 className="mb-3 text-[22px] font-semibold leading-tight tracking-tight text-[#F1F3F1]">
                Skip the grind — buy the {game.name} item you want
              </h2>
              <p className="mb-5 max-w-md text-sm leading-relaxed text-[#98A398]">
                Every order is covered by SafeDrop — the seller is paid only
                after you confirm delivery.
              </p>
              {/* Buy-only now — the value/calculator links moved to the
                  dedicated "Related tools" block below, each with its own
                  keyword-rich anchor (no duplicate value anchor on the page). */}
              <div className="flex flex-wrap gap-3">
                <Link
                  href={buyHref}
                  className="group inline-flex items-center gap-1.5 bg-[#1B6B3F] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1f7a48]"
                >
                  Buy {game.name} items
                  <IconArrowRight
                    className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                    stroke={2.4}
                  />
                </Link>
              </div>
            </div>

            {/* Related tools — sends the reader to the money page matching this
                post's intent, each with a distinct keyword-rich anchor. Uses the
                SpotlightCard cursor-glow (from the sell choice modal). */}
            {relatedTools.length > 0 && (
              <section className="mt-10">
                <h2 className="mb-4 text-[15px] font-semibold text-[#E4EAE2]">
                  Related tools
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {relatedTools.map((t) => (
                    <SpotlightCard
                      key={t.href}
                      glow="green"
                      className="group flex flex-col gap-3 border border-[#1E2723] bg-[#0B0F0C] p-5 transition-colors hover:border-[#2F6B46]"
                    >
                      <Link href={t.href} aria-label={t.label} className="absolute inset-0 z-10" />
                      <div className="relative z-[1] flex items-start justify-between gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#26332C] bg-[#0E1512] text-[#8FBF9C]">
                          <t.icon className="h-[19px] w-[19px]" stroke={1.9} />
                        </span>
                        <IconArrowUpRight
                          className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[#4FB477] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                          stroke={2.2}
                        />
                      </div>
                      <div className="relative z-[1] flex flex-col gap-1.5">
                        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8FBF9C]">
                          {t.eyebrow}
                        </span>
                        <span className="text-[14.5px] font-semibold leading-snug text-[#F1F5EF]">
                          {t.label}
                        </span>
                        <span className="text-[12.5px] leading-relaxed text-[#98A398]">
                          {t.desc}
                        </span>
                      </div>
                    </SpotlightCard>
                  ))}
                </div>
              </section>
            )}

            {/* Sell CTA — now UNCONDITIONAL (every article, not just
                post_type='seller'). The buy CTA above is always-on; the sell
                door should be too, so a reader of any guide can go either way.
                One generalized component (per-game founding rate). */}
            <SabSellerCta gameSlug={gameSlug} gameName={game.name} src={`${gameSlug}-blog-${slug}`} />

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
                      href={`/${gameSlug}/blog/${r.slug}`}
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
