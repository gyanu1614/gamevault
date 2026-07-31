/**
 * /[game]/blog — the game's content collection (value + seller guides).
 * Lives in the Values-hub chrome. Reads published posts from the DB
 * (blog_posts, scoped by primary_game_slug).
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cn } from '@/lib/utils'
import { sabCard } from '@/lib/sab/theme'
import { createClient } from '@/lib/supabase/server'
import { getGamePosts } from '@/lib/blog/db'
import { JsonLd, breadcrumbList } from '@/lib/seo/jsonld'
import { SabHeroBackdrop } from '../values/_SabHeroBackdrop'
import { HubNav } from '@/components/content/HubNav'
import { HubFooter } from '@/components/content/HubFooter'
import { getHubNavData } from '@/lib/content/hubNav'
import { getGameContentTheme } from '@/lib/content/theme'
import { BlogHubHero } from './_BlogHubHero'
import { HubTrustBox, type HubTrustStat } from './_HubTrustBox'
import { FeaturedGuide } from './_FeaturedGuide'
import { ArticleGrid } from './_ArticleGrid'
import { ValuesTeaser, CalculatorTeaser, HubBuyCta } from './_HubTeasers'
import { getHubTopValues } from './_hubData'

export const revalidate = 3600

interface HubGame {
  name: string
  slug: string
  image_url: string | null
  seo_h1: string | null
  seo_intro: string | null
}

async function getGame(gameSlug: string): Promise<HubGame | null> {
  const supabase = await createClient()
  const { data } = await (supabase as any)
    .from('games')
    .select('name, slug, image_url, seo_h1, seo_intro, is_active')
    .eq('slug', gameSlug)
    .eq('is_active', true)
    .maybeSingle()
  return (data as HubGame | null) ?? null
}

/**
 * How many items we hold a public price for. Drives the "Items priced" stat,
 * which is omitted entirely rather than shown as 0 for games we haven't
 * started pricing.
 */
async function getPricedItemCount(gameSlug: string): Promise<number> {
  if (gameSlug !== 'steal-a-brainrot') return 0
  const supabase = await createClient()
  const { count, error } = await (supabase as any)
    .from('sab_public_price_catalog_corrected')
    .select('brainrot_id', { count: 'exact', head: true })
    .eq('mutation_slug', 'default')
  if (error) {
    console.error('Unable to count priced items for blog hub:', error)
    return 0
  }
  return count ?? 0
}

const DAY_MONTH = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
})

const POST_TYPE_LABEL: Record<string, string> = {
  value: 'Values',
  seller: 'Selling',
  guide: 'Guide',
}

const CARD_DATE = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

function formatCardDate(iso: string): string {
  const d = new Date(iso)
  return Number.isFinite(d.getTime()) ? CARD_DATE.format(d).toUpperCase() : ''
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
    alternates: { canonical: `/${gameSlug}/blog` },
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

  const [posts, pricedItems, topValues, hubNav] = await Promise.all([
    getGamePosts(gameSlug),
    getPricedItemCount(gameSlug),
    getHubTopValues(gameSlug, 4),
    getHubNavData(gameSlug),
  ])

  const theme = getGameContentTheme(gameSlug)

  // Newest post carries the featured slot; the carousel below shows the rest.
  const [featured, ...rest] = posts

  // Trust panel — only cells we can actually source. A game with nothing
  // priced yet drops those cells instead of showing zeroes.
  const newestPost = posts
    .map((p) => new Date(p.publishedAt).getTime())
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => b - a)[0]

  const trustStats: HubTrustStat[] = []
  if (pricedItems > 0) {
    trustStats.push({
      label: 'Items priced',
      value: pricedItems.toLocaleString(),
      hint: 'Tracked across every mutation',
    })
  }
  trustStats.push({
    label: 'Priced from',
    value: 'Real sales',
    hint: 'Completed orders and live listings',
  })
  if (newestPost) {
    trustStats.push({
      label: 'Last updated',
      value: DAY_MONTH.format(new Date(newestPost)),
      hint: 'Guides refreshed as prices move',
    })
  }
  trustStats.push({
    label: 'Every order',
    value: 'SafeDrop',
    hint: 'Seller paid only after you confirm',
  })

  const articleCards = rest.map((post) => ({
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    category: POST_TYPE_LABEL[post.postType] ?? 'Guide',
    date: formatCardDate(post.publishedAt),
    cover: post.cover,
    readMinutes: post.readMinutes,
  }))

  return (
    // Same shell as the Values page: opaque #0C0F0E base, shared backdrop with
    // the header + sub-nav inside it. The hero content floats on top exactly as
    // Values does, so the navbar reads over the faded (dark) part of the image.
    <main className="relative min-h-screen bg-[#0C0F0E]">
      {/* Single-row shared hub nav (game switcher + tools + storefront),
          inside the backdrop so the scrim keeps it legible at top of page. */}
      <SabHeroBackdrop>
        <HubNav data={hubNav} />

        <JsonLd
          data={breadcrumbList([
            { name: 'Home', path: '/' },
            { name: game.name, path: `/${gameSlug}` },
            { name: 'Guides', path: `/${gameSlug}/blog` },
          ])}
        />

        <BlogHubHero gameName={game.name} lead={theme.heroLead} />
      </SabHeroBackdrop>

      {/* No z-index here (matches Values): a z-10 wrapper created a stacking
          context that beat the fixed header — which sits in SabHeroBackdrop's
          own z-10 context earlier in the DOM — letting cards scroll over the
          navbar. Plain flow keeps the header on top. */}
      <div className="relative mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Trust panel — sits in the gap between the title and the featured
            guide, so the first thing below the headline is why to believe us. */}
        <HubTrustBox stats={trustStats} />

        {featured && (
          <FeaturedGuide
            href={`/${gameSlug}/blog/${featured.slug}`}
            category={POST_TYPE_LABEL[featured.postType] ?? 'Guide'}
            readMinutes={featured.readMinutes}
            title={featured.title}
            excerpt={featured.excerpt}
            publishedAt={featured.publishedAt}
            cover={featured.cover}
            initials={theme.initials}
          />
        )}

        {posts.length === 0 ? (
          <div className={cn(sabCard, 'mt-12 px-6 py-14 text-center sm:mt-16')}>
            <p className="text-[15px] font-semibold text-[#F1F3F1]">No guides yet</p>
            <p className="mt-2 text-[13px] text-[#9BA8A0]">
              Check back soon — {game.name} guides are on the way.
            </p>
          </div>
        ) : (
          <ArticleGrid
            gameName={game.name}
            gameSlug={gameSlug}
            posts={articleCards}
          />
        )}

        <ValuesTeaser
          gameSlug={gameSlug}
          items={topValues}
          footnote="Prices are medians of completed sales and active listings. Bundles, account sales and disputed orders are excluded. Change indicators appear only where we hold enough price history."
        />

        <CalculatorTeaser
          gameSlug={gameSlug}
          example={{
            title: 'Check a trade before you accept it',
            body: 'Put one item on each side, pick the mutation, and see whether the offer is a win, fair or a loss against observed sale prices.',
            offer: 'Antonio · Default — $149.99',
            give: 'Bunny and Eggy · Lava — $183.72',
            letter: 'L',
            verdict: 'You come out behind',
            qualifier: 'Based on completed sales',
          }}
        />

        <HubBuyCta
          gameName={game.name}
          buyHref={`/${gameSlug}/buy-items`}
          title={`Skip the grind — buy the ${game.name} item you want`}
        />
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
