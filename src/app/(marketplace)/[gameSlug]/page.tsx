/**
 * Game home: /adopt-me, /steal-a-brainrot, /fortnite, … (clean URL, no
 * /marketplace prefix). One template for every game (features/game-home):
 * the loader reads, buildGameHome decides which sections show, GameHome
 * renders them. A game's values data, tool pages and guides add their
 * sections on their own (owner, 2026-10-23; spec:
 * docs/superpowers/specs/2026-10-23-game-home-design.md).
 *
 * ISR: every read is cookie-free, and the page binds each category's listings
 * tag so a listing change anywhere in the game refreshes it (the 24 h window
 * is only the safety net), like the category pages.
 */

import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isGameHubIndexable } from '@/lib/games/indexability'
import { createAnonClient } from '@/lib/supabase/anon'
import { createCategoryListingsReadClient } from '@/lib/listings/read-client'
import { JsonLd, breadcrumbList, faqPage, productAggregate } from '@/lib/seo/jsonld'
import { resolveGameSeo } from '@/lib/seo/templates'
import { stripBrand } from '@/lib/seo/title'
import { SITE_URL } from '@/config/site'
import GameSubNav from '@/components/marketplace/GameSubNav'
import { GameHeroBackdrop } from '@/components/marketplace/GameHeroBackdrop'
import { hubNavExtras } from './values/_HubNavExtras'
import { seoMeta } from '@/lib/seo/fit'
import { getGameData } from '@/features/game-home/load/game'
import { loadGameHome } from '@/features/game-home/load/load-game-home'
import { buildGameHome } from '@/features/game-home/model/build'
import { GameHome } from '@/features/game-home/GameHome'

interface PageProps {
  params: Promise<{
    gameSlug: string
  }>
}

/**
 * 24h safety net only: listing changes refresh the page through the category
 * listings tags it binds (loadGameHome), same as the category pages.
 */
export const revalidate = 86400

/**
 * Prerender every active game's storefront. Cookie-free read; games added
 * later still render on demand and are picked up by the window above.
 */
export async function generateStaticParams() {
  const supabase = createAnonClient()
  const { data } = await supabase.from('games').select('slug').eq('is_active', true)
  return ((data ?? []) as { slug: string }[]).map((g) => ({ gameSlug: g.slug }))
}

async function generateMetadataRaw({ params }: PageProps): Promise<Metadata> {
  const { gameSlug } = await params
  const supabase = createAnonClient()

  // STATE-004 — shares one cached read with the page body, instead of querying
  // games + categories a second time here with a different column set.
  const game = await getGameData(gameSlug)

  // 404 from metadata so the status is decided before anything streams —
  // consistent with the category/listing routes, where a Suspense boundary
  // otherwise locks the response to 200 (soft 404). See those files.
  if (!game) notFound()

  // Category labels the game has enabled (for template copy + accounts flag).
  const gameCats = (game.categories ?? []) as any[]
  const categoryLabels: string[] = gameCats.map((c: any) => c.name || c.slug)
  const hasAccounts = gameCats.some((c: any) => c.type === 'account')

  // Index bar (mirrors sitemap.ts): an empty hub — no active listings
  // and no curated currency config — stays out of the index until it
  // has something real to rank ({index:false, follow:true}).
  // The count spans every category of the game, so it is cached under all of
  // their listings tags (lib/listings/read-client): a mutation in any of them
  // refreshes it, not just the page shell.
  const listingsDb = createCategoryListingsReadClient(gameCats.map((c: any) => c.id))
  const [{ count: listingCount }, { data: curatedCfg }] = (await Promise.all([
    listingsDb
      .from('listings')
      // SEO hygiene: only REAL (non-test) active listings count toward
      // indexability, so a game with only test listings stays noindex.
      .select('id, seller:public_profiles!listings_seller_id_fkey!inner(is_test)', { count: 'exact' })
      .eq('game_id', game.id)
      .eq('status', 'active')
      .eq('seller.is_test', false)
      .limit(1),
    supabase.from('category_configs').select('game_id').eq('game_id', game.id).eq('category_type', 'currency').limit(1),
  ] as const)) as any
  // Indexability — ONE definition, shared with sitemap.ts so the robots meta
  // and the sitemap can never disagree. See lib/games/indexability.ts.
  const indexable = isGameHubIndexable({
    contentTier: game.content_tier,
    activeListingCount: listingCount ?? 0,
    hasCuratedCurrencyConfig: (curatedCfg?.length ?? 0) > 0,
    seoIndexable: game.seo_indexable,
  })

  // Auto-SEO engine: admin overrides merged with smart templates.
  const seo = resolveGameSeo({
    name: game.name,
    categoryLabels,
    hasAccounts,
    ecosystem: game.ecosystem,
    description: game.description,
    overrides: game,
  })

  return {
    // `seo.title` may be an admin override (games.seo_title) that carries the
    // brand, and it is reused for the social title below; the templated
    // <title> takes it bare.
    title: stripBrand(seo.title),
    description: seo.description,
    robots: indexable ? undefined : { index: false, follow: true },
    keywords: seo.keywords,
    alternates: { canonical: `${SITE_URL}/${gameSlug}` },
    openGraph: {
      title: seo.title,
      description: seo.description,
      type: 'website',
      url: `${SITE_URL}/${gameSlug}`,
    },
  }
}

export default async function GameHomePage({ params }: PageProps) {
  const { gameSlug } = await params
  const game = await getGameData(gameSlug)
  if (!game) notFound()

  const model = buildGameHome(await loadGameHome(game), Date.now())

  return (
    <GameHeroBackdrop gameSlug={gameSlug} size="market">
      <div className="min-h-screen">
        <JsonLd
          data={breadcrumbList([
            { name: 'Home', path: '/' },
            { name: game.name, path: `/${gameSlug}` },
          ])}
        />
        {model.faq.length > 0 && <JsonLd data={faqPage(model.faq)} />}
        {model.productSchema && (
          <JsonLd
            data={productAggregate({
              ...model.productSchema,
              // productAggregate takes an absolute image URL; a /public path gets the site origin.
              image: model.productSchema.image?.startsWith('/') ? `${SITE_URL}${model.productSchema.image}` : model.productSchema.image,
              url: `/${gameSlug}`,
            })}
          />
        )}

        <GameSubNav
          gameSlug={gameSlug}
          gameName={game.name}
          gameImageUrl={game.image_url}
          currentCategorySlug=""
          categories={game.categories as any}
          extraTabs={hubNavExtras(gameSlug, game.name)}
        />

        <GameHome model={model} />
      </div>
    </GameHeroBackdrop>
  )
}

/** Search-length rules (title ≤ 60, description ≤ 155) — see src/lib/seo/fit.ts. */
export async function generateMetadata(...args: Parameters<typeof generateMetadataRaw>): Promise<Metadata> {
  return seoMeta(await generateMetadataRaw(...args))
}
