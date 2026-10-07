/**
 * Game hub: /fortnite, /roblox, … (clean URL, no /marketplace prefix).
 *
 * Steal a Brainrot keeps its values landing (SabLanding); every other game
 * renders the hub template (_GameHub): header, currency Buy card, category
 * cards with live prices, best-offer rows, sell prompt, how it works, about,
 * FAQ. ISR: every read is cookie-free, and the page binds each category's
 * listings tag so a listing change anywhere in the game refreshes it (the
 * 24h window is only the safety net), like the category pages.
 */

import React from 'react'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isGameHubIndexable } from '@/lib/games/indexability'
import { createAnonClient } from '@/lib/supabase/anon'
import { createCategoryListingsReadClient } from '@/lib/listings/read-client'
import { withCurrencyNavLabel } from '@/lib/categories/currency-nav-label'
import { createValueListReadClient } from '@/lib/values/read-client'
import { JsonLd, breadcrumbList, faqPage } from '@/lib/seo/jsonld'
import { resolveGameSeo } from '@/lib/seo/templates'
import { stripBrand } from '@/lib/seo/title'
import { SITE_URL } from '@/config/site'
import GameSubNav from '@/components/marketplace/GameSubNav'
import { GameHeroBackdrop } from '@/components/marketplace/GameHeroBackdrop'
import { SabLanding } from './values/_SabLanding'
import { getGameIcon } from '@/features/home/lib/game-icons'
import { SabNavExtras } from './values/_SabNavExtras'
import { loadItemsTaxonomy, listingToOffer } from './[categorySlug]/_itemsData'
import type { ItemOffer } from './[categorySlug]/_itemsTypes'
import { cache } from 'react'
import { bindCategoryListingsTag } from '@/lib/revalidation/listings'
import { BlogRail } from '@/components/blog/BlogRail'
import { GameHub } from './_GameHub'
import { getHubCategoryStats, getHubCurrency, getHubOffers } from './_hubData'
import { buildHubCards, hubPitch, pickTopSelling, splitCards, type HubCategory } from './_hubModel'
import { getImageAccent } from '@/lib/ui/image-accent.server'
import { buildHubFaq, pickOfficialPack } from '@/lib/seo/hub-faq'
import { getCurrencyGuide } from '@/lib/currency-guides'
import { formatStatPrice } from '@/lib/seo/page-stats'
import { CHECKOUT_COINS } from '@/lib/payments/method-marks'
import { payssionSelectorMethods } from '@/lib/payments/providers/payssion/methods'

interface PageProps {
  params: Promise<{
    gameSlug: string
  }>
}

/**
 * 24h safety net only: listing changes refresh the hub through the category
 * listings tags it binds (see the page body), same as the category pages.
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

// STATE-004 — generateMetadata and the page body both need this row; cache()
// makes the two runs of one request share a single query.
const getGameData = cache(async function getGameData(gameSlug: string) {
  const supabase = createAnonClient()

  const { data: game, error: gameError } = await supabase
    .from('games')
    // STATE-012 — explicit columns. The 7 read directly off `game` in this
    // file, plus the 4 seo_* overrides resolveGameSeo() reads via `overrides`.
    .select(
      'id, name, slug, description, ecosystem, content_tier, image_url, seo_indexable, seo_title, seo_description, seo_h1, seo_intro',
    )
    .eq('slug', gameSlug)
    .eq('is_active', true)
    .single() as any

  if (gameError || !game) {
    return null
  }

  const [{ data: categories, error: categoriesError }, { data: currencyCfg }] = await Promise.all([
    supabase
      .from('game_categories')
      .select('id, name, slug, description, icon_emoji, icon_url, type, sub_types')
      .eq('game_id', game.id)
      .eq('is_enabled', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true }) as any,
    supabase
      .from('category_configs')
      .select('config')
      .eq('game_id', game.id)
      .eq('category_type', 'currency')
      .maybeSingle() as any,
  ])

  if (categoriesError) {
    console.error('Error fetching categories:', categoriesError)
  }

  return {
    ...game,
    // Currency tab/card reads like its page title ("Gems", not "Currency").
    categories: withCurrencyNavLabel((categories || []) as any[], currencyCfg?.config?.unit_label),
  }
})

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
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
  const categoryLabels: string[] = gameCats.map(
    (c: any) => c.name || c.slug,
  )
  const hasAccounts = gameCats.some((c: any) => c.type === 'account')

  // Index bar (mirrors sitemap.ts): an empty hub — no active listings
  // and no curated currency config — stays out of the index until it
  // has something real to rank ({index:false, follow:true}).
  // The count spans every category of the game, so it is cached under all of
  // their listings tags (lib/listings/read-client): a mutation in any of them
  // refreshes it, not just the page shell.
  const listingsDb = createCategoryListingsReadClient(gameCats.map((c: any) => c.id))
  const [{ count: listingCount }, { data: curatedCfg }] = await Promise.all([
    listingsDb
      .from('listings')
      // SEO hygiene: only REAL (non-test) active listings count toward
      // indexability, so a game with only test listings stays noindex.
      .select('id, seller:public_profiles!listings_seller_id_fkey!inner(is_test)', { count: 'exact' })
      .eq('game_id', game.id)
      .eq('status', 'active')
      .eq('seller.is_test', false).limit(1),
    supabase
      .from('category_configs')
      .select('game_id')
      .eq('game_id', game.id)
      .eq('category_type', 'currency')
      .limit(1),
  ] as const) as any
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


export type SabTopValue = {
  slug: string
  name: string
  rarity: string
  imageUrl: string | null
  priceUsd: number | null
}

// Top brainrots by live default cash value, for the SAB landing carousel.
async function getSabTopValues(): Promise<SabTopValue[]> {
  // A price list: cached under the SAB list tags so a publish refreshes it.
  const supabase = createValueListReadClient('steal-a-brainrot')
  const { data: rows } = await (supabase as any)
    .from('sab_price_display')
    .select('brainrot_slug,brainrot_name,rarity,image_url,market_value_usd,mutation_slug')
    .eq('mutation_slug', 'default')
    .order('market_value_usd', { ascending: false })
    .limit(18)

  return ((rows ?? []) as any[]).map((r) => ({
    slug: r.brainrot_slug,
    name: r.brainrot_name,
    rarity: r.rarity,
    imageUrl: r.image_url,
    priceUsd: r.market_value_usd == null ? null : Number(r.market_value_usd),
  }))
}

/**
 * Top item + account listings for the SAB landing carousels, mapped to the
 * SAME `ItemOffer` shape the marketplace catalog uses so the carousels render
 * the real landscape `ItemCard`. Real inventory is thin pre-launch, so we
 * INCLUDE test/own sellers here (no is_test filter) — this is a marketing
 * surface, not an SEO-indexed listing count. Accounts are detected by the
 * joined category type === 'account'.
 */
async function getSabLandingOffers(gameId: string, categoryIds: string[]): Promise<{
  itemOffers: ItemOffer[]
  accountOffers: ItemOffer[]
  minPriceUsd: number | null
}> {
  // Every category of the game, so a listing change in any of them refreshes
  // this landing (the tags also bind the render; lib/listings/read-client).
  const supabase = createCategoryListingsReadClient(categoryIds)

  // Same select shape as the buy-items page's RawListing so listingToOffer()
  // gets everything it needs (seller rating/reviews/sales, category, template).
  const [{ data: rows }, itemsTaxonomy, accountsTaxonomy] = await Promise.all([
    supabase
      .from('listings')
      .select(
        `
        id, slug, title, price, original_price, delivery_time,
        quantity, is_unlimited, images, template_data, status,
        seller:public_profiles!listings_seller_id_fkey(
          id, username, shop_name, shop_slug, avatar_url, seller_tier,
          seller_rating, total_reviews, total_sales, is_verified
        ),
        category:game_categories!listings_game_category_id_fkey(slug, name, type)
      `,
      )
      .eq('game_id', gameId)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(24),
    loadItemsTaxonomy(gameId, 'items'),
    loadItemsTaxonomy(gameId, 'accounts'),
  ] as const) as any

  const itemOffers: ItemOffer[] = []
  const accountOffers: ItemOffer[] = []
  const prices: number[] = []

  for (const row of (rows ?? []) as any[]) {
    const isAccount = row.category?.type === 'account'
    const offer = listingToOffer(row, isAccount ? accountsTaxonomy : itemsTaxonomy)
    if (Number.isFinite(offer.pricePerUnit) && offer.pricePerUnit > 0) {
      prices.push(offer.pricePerUnit)
    }
    if (isAccount) {
      if (accountOffers.length < 12) accountOffers.push(offer)
    } else if (itemOffers.length < 12) {
      itemOffers.push(offer)
    }
  }

  return {
    itemOffers,
    accountOffers,
    minPriceUsd: prices.length > 0 ? Math.min(...prices) : null,
  }
}

export default async function GameBrowsePage({ params }: PageProps) {
  const { gameSlug } = await params
  const game = await getGameData(gameSlug)

  if (!game) {
    notFound()
  }

  const categories = (game.categories || []) as (HubCategory & { icon_emoji?: string | null })[]

  // Top brainrot values for the SAB landing carousel (marketplace inventory is
  // thin pre-launch, so we lead with our rich value data).
  const isSab = gameSlug === 'steal-a-brainrot'
  const [sabTopValues, sabListings] = await Promise.all([
    isSab ? getSabTopValues() : Promise.resolve([]),
    isSab
      ? getSabLandingOffers(game.id, categories.map((c) => c.id))
      : Promise.resolve({ itemOffers: [], accountOffers: [], minPriceUsd: null }),
  ])

  // Auto-SEO: resolved H1 / intro / FAQ (admin overrides + templates).
  const seo = resolveGameSeo({
    name: game.name,
    categoryLabels: categories.map((c: any) => c.name || c.slug),
    hasAccounts: categories.some((c: any) => c.type === 'account'),
    ecosystem: game.ecosystem,
    description: game.description,
    overrides: game,
  })

  // Steal a Brainrot gets its own forest-themed "DropMarket Values" landing
  // (header + sub-nav + backdrop + value carousels), separate from the generic
  // game layout other games use.
  if (gameSlug === 'steal-a-brainrot') {
    // A standard MARKETPLACE page — same chrome as every other game/category
    // page: global navbar + GameSubNav pill + the homepage-style hero header.
    // The body carries Top Selling Items/Accounts carousels + links into the
    // Values/Calculator hub (which have their own forest theme).
    return (
      <GameHeroBackdrop gameSlug={gameSlug} size="market">
      <div className="min-h-screen">
        <JsonLd
          data={breadcrumbList([
            { name: 'Home', path: '/' },
            { name: game.name, path: `/${gameSlug}` },
          ])}
        />
        <JsonLd data={faqPage(seo.faq.map((f) => ({ q: f.q, a: f.a })))} />

        <GameSubNav
          gameSlug={gameSlug}
          gameName={game.name}
          gameImageUrl={game.image_url}
          currentCategorySlug=""
          categories={categories}
          extraTabs={<SabNavExtras />}
        />

        <SabLanding
          gameSlug={gameSlug}
          gameName={game.name}
          // Same logo fallback as GameSubNav + HubNav (admin upload → static).
          gameImageUrl={game.image_url || getGameIcon(gameSlug)}
          listingCount={sabListings.itemOffers.length + sabListings.accountOffers.length}
          minPriceUsd={sabListings.minPriceUsd}
          topValues={sabTopValues}
          itemOffers={sabListings.itemOffers}
          accountOffers={sabListings.accountOffers}
        />
      </div>
      </GameHeroBackdrop>
    )
  }

  // ── Hub (every other game) ────────────────────────────────────────────────
  const hasCurrency = categories.some((c) => c.type === 'currency')
  const [stats, currency, offers] = await Promise.all([
    getHubCategoryStats(game.id, categories),
    hasCurrency ? getHubCurrency(gameSlug) : Promise.resolve({ iconUrl: null, unitSuffix: null, unitsPerPrice: null }),
    getHubOffers(game.id, categories),
    // Anchor this render to every category's listings tag (no-op reads), so
    // revalidateListingSurfaces refreshes the hub with its category pages.
    Promise.all(categories.map((c) => bindCategoryListingsTag(c.id))),
  ])

  const cards = buildHubCards(gameSlug, categories, stats, currency.unitSuffix)
  const { spotlight, grid } = splitCards(cards)
  const itemsCard = cards.find((c) => c.type === 'items') ?? null
  const accountsCard = cards.find((c) => c.type === 'account') ?? null
  const currencyIcon = currency.iconUrl || (spotlight && !spotlight.icon.startsWith('/icons/categories/') ? spotlight.icon : null)
  const currencyAccent = currencyIcon ? await getImageAccent(currencyIcon) : null

  // Why Buy's "from" price: the cheapest non-currency offer (a per-Robux
  // price would read as "listings from $0.0052").
  const goodsLow = grid
    .map((c) => stats[c.id]?.lowPrice)
    .filter((p): p is number => typeof p === 'number' && p > 0)
  const fromPrice = goodsLow.length > 0 ? `$${formatStatPrice(Math.min(...goodsLow))}` : null

  // The FAQ players actually search ("how much is 1000 robux in usd", "is it
  // safe to buy robux"…). One list for the accordion and the FAQPage JSON-LD.
  const guide = spotlight ? getCurrencyGuide(gameSlug) : null
  const faq = buildHubFaq({
    gameName: game.name,
    currency: spotlight
      ? {
          name: spotlight.name,
          fromLabel: spotlight.fromLabel,
          avgDelivery: spotlight.avgDelivery,
          official: pickOfficialPack(guide?.official_prices?.packages),
          lowPrice: stats[spotlight.id]?.lowPrice ?? null,
          unitsPerPrice: currency.unitsPerPrice,
        }
      : null,
    items: itemsCard ? { fromLabel: itemsCard.fromLabel, count: itemsCard.count } : null,
    accounts: accountsCard ? { fromLabel: accountsCard.fromLabel, count: accountsCard.count } : null,
    paymentMethods: [...CHECKOUT_COINS.map((c) => c.label), ...payssionSelectorMethods().map((m) => m.label)],
    extra: guide?.page?.hub_faq ?? [],
  })

  return (
    <GameHeroBackdrop gameSlug={gameSlug} size="market">
    <div className="min-h-screen">
      <JsonLd
        data={breadcrumbList([
          { name: 'Home', path: '/' },
          { name: game.name, path: `/${gameSlug}` },
        ])}
      />
      <JsonLd data={faqPage(faq)} />

      <GameSubNav
        gameSlug={gameSlug}
        gameName={game.name}
        gameImageUrl={game.image_url}
        currentCategorySlug=""
        categories={categories as any}
      />

      <GameHub
        gameSlug={gameSlug}
        gameName={game.name}
        gameImageUrl={game.image_url}
        pitch={hubPitch(game.name, cards)}
        spotlight={spotlight}
        currencyIconUrl={currency.iconUrl}
        currencyAccent={currencyAccent}
        grid={grid}
        itemOffers={pickTopSelling(offers.items, 12)}
        accountOffers={pickTopSelling(offers.accounts, 12)}
        itemsHref={itemsCard?.href ?? null}
        accountsHref={accountsCard?.href ?? null}
        totalOffers={cards.reduce((n, c) => n + c.count, 0)}
        fromPrice={fromPrice}
        faq={faq}
        blogRail={<BlogRail gameSlug={gameSlug} gameName={game.name} />}
      />
    </div>
    </GameHeroBackdrop>
  )
}
