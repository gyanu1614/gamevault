/**
 * Category Browse Page — /{gameSlug}/{categorySlug}
 *
 * Layout: sticky GameSubNav → centered header → CategoryPageLayout (filter toggle)
 * Apple/Spotify-inspired minimal dark theme with game vibe.
 */

import React, { Suspense } from 'react'
import { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/server'
import Image from 'next/image'
import SafeDropBadge from '@/components/safedrop/SafeDropBadge'
import PresenceIndicator from '@/components/presence/PresenceIndicator'
import CategoryPills from '@/components/marketplace/CategoryPills'
import GameSubNav, { type GameCategory } from '@/components/marketplace/GameSubNav'
import CategoryPageLayout from '@/components/marketplace/CategoryPageLayout'
import { buildSynonymSearchQuery } from '@/lib/utils/gaming-synonyms'
import { ChevronLeft } from 'lucide-react'
import { getCurrencyShell, listingToOffer } from './_currencyData'
import CurrencyPageClient from './_CurrencyPageClient'
import BundleCurrencyPageClient, {
  type BundleCurrencyPageData,
  type BundleOffer,
} from './_BundleCurrencyPageClient'
import { fetchCategoryConfigBySlug } from '@/lib/actions/admin-category-configs'
import { normalizePlatformOptions } from '@/lib/types/category-configs'

// V19/P24/P4 — Inline delivery formatter for bundle offers. The
// `_currencyData.ts` formatter is wrapped around the flexible-Offer
// shape; copying the small humanizer here keeps the bundle path
// from depending on currency-data internals.
// V19/P24/P7.f — Humanize delivery labels: "20 Minutes" instead of
// "20 min", "1 Hour" / "2 Hours" instead of "1 h". Matches the format
// used in the seller wizard so buyer-side reads as written.
function formatBundleDelivery(raw: string | null | undefined): string {
  if (!raw) return '10 Minutes'
  if (raw === 'instant') return 'Instant'
  const m = raw.match(/^(\d+)\s*(min|hr)$/)
  if (!m) return raw
  const n = parseInt(m[1], 10)
  if (m[2] === 'hr') return `${n} ${n === 1 ? 'Hour' : 'Hours'}`
  return `${n} ${n === 1 ? 'Minute' : 'Minutes'}`
}
// V15 — Items page dispatch + SEO slug resolver.
import { getPausedSellerIds } from '@/lib/actions/seller-presence'
import { loadItemsTaxonomy, listingToOffer as listingToItemOffer } from './_itemsData'
import ItemsPageClient from './_ItemsPageClient'
import { resolveItemBySlug } from './_itemResolver'

interface PageProps {
  params: Promise<{
    gameSlug: string
    categorySlug: string
  }>
  searchParams: Promise<{
    sort?: string
    minPrice?: string
    maxPrice?: string
    search?: string
    tiers?: string
    delivery?: string
    online?: string
    page?: string
    type?: string
  }>
}

// ─── SEO ───────────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { gameSlug, categorySlug } = await params
  const supabase = await createClient()

  const { data: game } = await supabase
    .from('games')
    .select('name, id')
    .eq('slug', gameSlug)
    .single() as any

  if (!game) return { title: 'Not Found' }

  const { data: category } = await supabase
    .from('categories')
    .select('name')
    .eq('slug', categorySlug)
    .eq('game_id', game.id)
    .single() as any

  if (!category) {
    // V15 — When the slug isn't a category, it might be an SEO item slug
    // (e.g. /steal-a-brainrot/neon-garama-mandundung). Generate keyword-
    // rich metadata that mirrors common search phrases.
    const resolved = await resolveItemBySlug(game.id, categorySlug)
    if (resolved) {
      const prettyTitle = categorySlug
        .split('-')
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(' ')
      return {
        title: `Buy ${prettyTitle} (${game.name}) — Cheap & Instant`,
        description: `Buy ${prettyTitle} for ${game.name} from verified sellers. Covered by SafeDrop Buyer Protection. Instant delivery available.`,
        keywords: [
          `${game.name.toLowerCase()} ${prettyTitle.toLowerCase()}`,
          `buy ${prettyTitle.toLowerCase()}`,
          `cheap ${prettyTitle.toLowerCase()}`,
          `${prettyTitle.toLowerCase()} for sale`,
        ],
        openGraph: {
          title: `${prettyTitle} (${game.name}) — DropMarket`,
          description: `Secure peer-to-peer marketplace for ${game.name} items.`,
          type: 'website',
        },
      }
    }
    return { title: 'Not Found' }
  }

  return {
    title: `${game.name} ${category.name} for Sale`,
    description: `Browse verified ${game.name} ${category.name.toLowerCase()} listings. Every order covered by SafeDrop Buyer Protection. Instant delivery available.`,
    keywords: [
      `${game.name.toLowerCase()} ${category.name.toLowerCase()}`,
      `buy ${game.name.toLowerCase()} ${category.name.toLowerCase()}`,
      `cheap ${game.name.toLowerCase()} ${category.name.toLowerCase()}`,
      `${game.name.toLowerCase()} marketplace`,
    ],
    openGraph: {
      title: `${game.name} ${category.name} - DropMarket`,
      description: `Buy and sell ${game.name} ${category.name.toLowerCase()} safely`,
      type: 'website',
    },
  }
}

// ─── Data fetching ─────────────────────────────────────────────────────────────

async function getGameAndCategory(gameSlug: string, categorySlug: string) {
  const supabase = await createClient()

  const gameResult = await supabase
    .from('games')
    .select('*')
    .eq('slug', gameSlug)
    .eq('is_active', true)
    .single() as any

  if (gameResult.error || !gameResult.data) return null

  const categoryResult = await supabase
    .from('categories')
    .select('*')
    .eq('slug', categorySlug)
    .eq('game_id', gameResult.data.id)
    .eq('is_active', true)
    .single() as any

  if (categoryResult.error || !categoryResult.data) return null

  return { game: gameResult.data, category: categoryResult.data }
}

async function getAllGameCategories(gameId: string): Promise<GameCategory[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('categories')
    .select('id, name, slug')
    .eq('game_id', gameId)
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .order('name', { ascending: true }) as any
  return (data || []) as GameCategory[]
}

// V21/P7.ae — Apply an "exclude offline sellers" filter to a listings
// query. Sellers in Offline Mode have all their offers hidden from
// buyers. Takes a PRE-FETCHED paused-id list (fetched once per page) so
// it stays synchronous — awaiting a thenable PostgREST builder would
// EXECUTE it and break the chain (.order is not a function). No-op when
// nobody is paused, so the empty `.not(... in ())` edge case never fires.
function excludePausedSellers(query: any, pausedIds: string[]) {
  if (pausedIds.length === 0) return query
  return query.not('seller_id', 'in', `(${pausedIds.join(',')})`)
}

async function getListings(
  gameId: string,
  categoryId: string,
  searchParams: Awaited<PageProps['searchParams']>,
  pausedSellerIds: string[]
) {
  const supabase = await createClient()
  const LISTINGS_PER_PAGE = 12
  const currentPage = parseInt(searchParams.page || '1', 10)

  let query: any = supabase
    .from('listings')
    .select(`
      *,
      seller:profiles!listings_seller_id_fkey(
        id, username, seller_tier, avatar_url,
        presence:seller_presence(is_online, last_seen_at)
      ),
      game:games!listings_game_id_fkey(name, slug),
      category:categories!listings_category_id_fkey(name, slug)
    `)
    .eq('game_id', gameId)
    .eq('category_id', categoryId)
    .eq('status', 'active')

  query = excludePausedSellers(query, pausedSellerIds)

  if (searchParams.minPrice) query = query.gte('price', parseFloat(searchParams.minPrice))
  if (searchParams.maxPrice) query = query.lte('price', parseFloat(searchParams.maxPrice))
  if (searchParams.search) {
    const synonymQuery = buildSynonymSearchQuery(searchParams.search)
    query = query.or(synonymQuery)
  }
  if (searchParams.type) {
    const typeLabel = searchParams.type.replace(/-/g, ' ')
    query = query.ilike('title', `%${typeLabel}%`)
  }
  if (searchParams.delivery) {
    query = query.in('delivery_time', searchParams.delivery.split(','))
  }

  switch (searchParams.sort) {
    case 'price_low':  query = query.order('price', { ascending: true }); break
    case 'price_high': query = query.order('price', { ascending: false }); break
    case 'popular':    query = query.order('view_count', { ascending: false }); break
    default:           query = query.order('created_at', { ascending: false })
  }

  const { data: listings, error } = await query
  if (error) return { listings: [], hasMore: false, currentPage: 1, totalListings: 0 }

  let filtered = listings || []
  if (searchParams.tiers) {
    const tiers = searchParams.tiers.split(',')
    filtered = filtered.filter((l: any) => tiers.includes(l.seller?.seller_tier))
  }
  if (searchParams.online === 'true') {
    filtered = filtered.filter((l: any) => l.seller?.presence?.is_online === true)
  }

  const totalListings = filtered.length
  const endIndex = currentPage * LISTINGS_PER_PAGE
  const paginatedListings = filtered.slice(0, endIndex)
  const hasMore = endIndex < totalListings

  return { listings: paginatedListings, hasMore, currentPage, totalListings }
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function CategoryBrowsePage({ params, searchParams }: PageProps) {
  const { gameSlug, categorySlug } = await params
  const resolvedSearchParams = await searchParams

  // V21/P7.ae — Fetch the offline-seller set ONCE per page render and
  // reuse it across every listing query branch (currency / bundle /
  // items / generic). One indexed read, no per-query refetch.
  const pausedSellerIds = await getPausedSellerIds()

  // V17g — Canonical-redirect block removed. The DB now stores the
  // canonical slug directly (buy-robux, buy-vbucks, etc.), so every
  // URL the app serves is already canonical. No aliases → no 301s →
  // no client flicker.

  // V12/V13 — Currency dispatch. When (game, slug) is currency, merge the
  // game's currency shell (copy/FAQ) with real listings from the DB.
  const currencyShell = await getCurrencyShell(gameSlug, categorySlug)
  // V19/P24/P4 — Read the currency config to detect bundle mode. When
  // bundles exist, we render the BundleCurrencyPageClient (region +
  // bundle grid + sticky offer panel) instead of the flexible
  // CurrencyPageClient (hero + seller rows + stepper).
  const currencyConfig = currencyShell
    ? await fetchCategoryConfigBySlug(gameSlug, 'currency')
    : null
  const bundles = (currencyConfig?.bundles ?? []).filter(
    (b) => b && b.id && b.name,
  )
  if (currencyShell && bundles.length > 0) {
    const supabase = await createClient()
    const gameRes = await supabase
      .from('games')
      .select('id, name, image_url')
      .eq('slug', gameSlug)
      .eq('is_active', true)
      .single() as any
    const game = gameRes.data
    const categories = game ? await getAllGameCategories(game.id) : []

    // Listings for any bundle under the currency category. The
    // BundleCurrencyPageClient does its own (bundle, region) filtering
    // on the client; we just send all active bundle-tagged rows.
    let bundleOffers: BundleOffer[] = []
    let realCategorySlug: string | null = null
    if (game?.id) {
      const catRow = await supabase
        .from('categories')
        .select('id, slug')
        .eq('game_id', game.id)
        .or('slug.eq.currency,metadata->>type.eq.currency')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle() as any
      const categoryId = catRow.data?.id
      realCategorySlug = catRow.data?.slug ?? null
      if (categoryId) {
        let bundleQuery: any = supabase
          .from('listings')
          .select(`
            id, description, price, quantity, delivery_time, is_unlimited,
            bundle_id, region, platform,
            seller:profiles!listings_seller_id_fkey(
              id, username, shop_name, avatar_url, seller_tier,
              seller_rating, total_reviews, is_verified
            )
          `)
          .eq('game_id', game.id)
          .eq('category_id', categoryId)
          .eq('status', 'active')
          .not('bundle_id', 'is', null)
          .order('price', { ascending: true })
          .limit(200)
        bundleQuery = excludePausedSellers(bundleQuery, pausedSellerIds)
        const { data: listings } = await bundleQuery as any
        bundleOffers = (listings ?? []).map((l: any) => ({
          listingId: l.id,
          sellerId: l.seller?.id ?? null,
          sellerUsername: l.seller?.username ?? null,
          sellerName: l.seller?.shop_name ?? l.seller?.username ?? 'Seller',
          sellerAvatarUrl: l.seller?.avatar_url ?? null,
          verified:
            !!l.seller?.is_verified ||
            (!!l.seller?.seller_tier && l.seller.seller_tier !== 'unverified'),
          rating: Math.min(99.9, Math.max(0, Number(l.seller?.seller_rating ?? 95))),
          reviews: l.seller?.total_reviews ?? 0,
          pricePerBundle: Number(l.price ?? 0),
          stock: l.is_unlimited ? 1_000_000_000 : (l.quantity ?? 0),
          deliveryLabel: formatBundleDelivery(l.delivery_time),
          deliveryMin: 0,
          deliveryMax: 0,
          blurb: (l.description ?? '').trim(),
          bundleId: l.bundle_id,
          region: l.region ?? null,
          platform: l.platform ?? null,
        }))
      }
    }

    const { data: { user: viewer } } = await supabase.auth.getUser()

    const data: BundleCurrencyPageData = {
      unitLabel: currencyConfig?.unit_label ?? 'Currency',
      tagline: currencyConfig?.tagline ?? '',
      gameName: game?.name ?? gameSlug,
      gameSlug,
      currencyIconUrl: currencyConfig?.currency_icon_url ?? null,
      bundles: [...bundles].sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
      ),
      // V51 — Regions keep their PlatformOption shape (flag icons);
      // legacy string[] rows normalize to { value, icon_url: null }
      // and the client resolves a preset flag by name.
      regions: currencyConfig?.platform_fields?.region?.enabled
        ? normalizePlatformOptions(
            currencyConfig.platform_fields.region.options,
          )
        : [],
      // V19/P24/P7 — Platforms keep their PlatformOption shape so the
      // buyer page can render logos. normalizePlatformOptions also
      // handles legacy string[] data transparently.
      platforms: currencyConfig?.platform_fields?.platform?.enabled
        ? normalizePlatformOptions(
            currencyConfig.platform_fields.platform.options,
          )
        : [],
      offers: bundleOffers,
      // V19/P24/P7.d — Surface How it works + FAQ on the bundle page,
      // same shape and source as the flexible currency page uses.
      steps: currencyConfig?.steps ?? [],
      faq: currencyConfig?.faq ?? [],
    }

    return (
      <>
        <GameSubNav
          gameSlug={gameSlug}
          gameName={game?.name ?? gameSlug}
          gameImageUrl={game?.image_url}
          currentCategorySlug={realCategorySlug ?? 'currency'}
          categories={categories}
        />
        <BundleCurrencyPageClient
          data={data}
          viewerId={viewer?.id ?? null}
        />
      </>
    )
  }

  if (currencyShell) {
    const supabase = await createClient()
    const gameRes = await supabase
      .from('games')
      .select('id, name, image_url')
      .eq('slug', gameSlug)
      .eq('is_active', true)
      .single() as any
    const game = gameRes.data

    // Categories for the sub-nav.
    const categories = game ? await getAllGameCategories(game.id) : []

    // Find the legacy `categories` row for this (game, "currency") pair so we
    // can filter the listings table by category_id. We ALWAYS look up the
    // "currency" category row regardless of whether the URL is /currency or
    // /robux — listings are stored against the generic currency category.
    let realOffers: ReturnType<typeof listingToOffer>[] = []
    // V14c — Capture the real category slug so we can highlight the right
    // tab in GameSubNav. For Roblox, this is typically 'robux' not 'currency'.
    let realCategorySlug: string | null = null
    if (game?.id) {
      const catRow = await supabase
        .from('categories')
        .select('id, slug')
        .eq('game_id', game.id)
        .or('slug.eq.currency,metadata->>type.eq.currency')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle() as any
      const categoryId = catRow.data?.id
      realCategorySlug = catRow.data?.slug ?? null
      if (categoryId) {
        let currencyQuery: any = supabase
          .from('listings')
          .select(`
            id, title, description, price, original_price, quantity,
            min_quantity, delivery_method, delivery_time, is_unlimited,
            seller:profiles!listings_seller_id_fkey(
              id, username, shop_name, avatar_url, seller_tier,
              seller_rating, total_reviews, is_verified
            )
          `)
          .eq('game_id', game.id)
          .eq('category_id', categoryId)
          .eq('status', 'active')
          // V19/P8 — Removed the legacy `.lte('price', 1)` filter. It was
          // built for the old "$ per single unit" Robux pricing model and
          // hid any new currency listing priced > $1 in the per-K/M
          // granularity model (e.g. a Blade Ball seller listing $3.50/K
          // Tokens stores `price=3.50` and was wrongly filtered out).
          // Quantity floors are still enforced by the JS filter below.
          .order('price', { ascending: true })
          .limit(50)
        currencyQuery = excludePausedSellers(currencyQuery, pausedSellerIds)
        const { data: listings } = await currencyQuery as any
        realOffers = (listings ?? [])
          .map(listingToOffer)
          // V19/P8 — Quantity floor only. Dropped the price < 1 belt-
          // and-braces filter (same reason as above). Sanity check
          // pricePerUnit > 0 to skip zero-priced rows that shouldn't
          // have made it past the wizard but defensive in case they do.
          .filter((o: { minQty: number; pricePerUnit: number }) => o.minQty >= 100 && o.pricePerUnit > 0)
      }
    }

    // Merge: when real offers exist, use them. Pick the cheapest as the hero.
    // Otherwise fall back to the mock shell.
    let mergedData = currencyShell
    if (realOffers.length > 0) {
      const sorted = [...realOffers].sort((a, b) => (b.recommended ?? 0) - (a.recommended ?? 0))
      const [hero, ...rest] = sorted
      mergedData = {
        ...currencyShell,
        hero,
        sellers: rest,
      }
    }
    // V21/P7.i — Surface the admin-uploaded category icon on the currency
    // object so HeroCard can render it as the product logo.
    mergedData = {
      ...mergedData,
      currency: {
        ...mergedData.currency,
        iconUrl: currencyConfig?.currency_icon_url ?? null,
      },
    }

    // V14m — Resolve the viewer so the client can block self-purchase
    // (a seller can't buy their own listing — confusing & buyer
    // protection doesn't make sense). Anonymous viewers get null.
    const { data: { user: viewer } } = await supabase.auth.getUser()

    return (
      <>
        <GameSubNav
          gameSlug={gameSlug}
          gameName={game?.name ?? currencyShell.currency.game}
          gameImageUrl={game?.image_url}
          // V14c — Highlight whichever category row actually exists for
          // currency. For Roblox that's 'robux'; for V-Bucks it's 'v-bucks'.
          // Falls back to 'currency' if no per-game row was found.
          currentCategorySlug={realCategorySlug ?? 'currency'}
          categories={categories}
        />
        <CurrencyPageClient
          data={mergedData}
          gameImageUrl={game?.image_url ?? `/games/${gameSlug}.png`}
          viewerId={viewer?.id ?? null}
          gameSlug={gameSlug}
        />
      </>
    )
  }

  const data = await getGameAndCategory(gameSlug, categorySlug)

  // V15 — Items SEO routing. If the URL segment isn't a known category
  // slug for this game, see whether it resolves to an active item
  // listing under {gameSlug}/items. If so, redirect to the listing
  // detail page (canonical detail UI lives elsewhere); otherwise 404.
  if (!data) {
    const sb = await createClient()
    const gameRes = await sb
      .from('games')
      .select('id')
      .eq('slug', gameSlug)
      .eq('is_active', true)
      .single() as any
    if (gameRes.data?.id) {
      const resolved = await resolveItemBySlug(gameRes.data.id, categorySlug)
      if (resolved) {
        // V15h — Redirect to the proper detail page (with price history
        // chart, full template fields, etc) rather than the legacy
        // /listings/{id} resolver page.
        // V15z — Redirect direct to the canonical detail URL, no /marketplace/
        // prefix. The prefix is only kept as a back-compat alias.
        redirect(`/${gameSlug}/${resolved.categorySlug}/${resolved.listingSlug}`)
      }
    }
    notFound()
  }

  const { game, category } = data

  // V15 — Items dispatch. When the page is the per-game items catalogue,
  // render the new Showcase-grid client with admin-driven taxonomy and
  // SEO-friendly URLs. V19/P24/P7.kk — Accounts / Boosting / Top-up
  // now also use this client. They get the same landscape card grid
  // + filter band; taxonomy() returns empty when no template exists,
  // so cards render cleanly with just title + photo + price.
  const categoryType = (category as any).metadata?.type as string | undefined
  const isItemsLikeCategory =
    category.slug === 'items' ||
    categoryType === 'items' ||
    categoryType === 'account' ||
    categoryType === 'service' ||
    categoryType === 'top_up'
  if (isItemsLikeCategory) {
    // V19/P24/P7.nn — Taxonomy lookups go through `global_categories`
    // which uses canonical slugs (`items`, `accounts`, `boosting`,
    // `top-up`). The URL slug (`buy-items`, etc.) and the category
    // type (`account`, `service`, `top_up`) both differ from those.
    // Map here so the attribute_templates load correctly.
    const taxonomySlug = (() => {
      if (categoryType === 'items') return 'items'
      if (categoryType === 'account') return 'accounts'
      if (categoryType === 'service') return 'boosting'
      if (categoryType === 'top_up') return 'top-up'
      return 'items'
    })()
    const [allCategories, taxonomy, viewerRes, listingsRaw] = await Promise.all([
      getAllGameCategories(game.id),
      loadItemsTaxonomy(game.id, taxonomySlug),
      (await createClient()).auth.getUser(),
      (async () => {
        const sb = await createClient()
        let itemsQuery: any = sb
          .from('listings')
          .select(`
            id, slug, title, price, original_price, delivery_time,
            quantity, is_unlimited, images, template_data, status,
            seller:profiles!listings_seller_id_fkey(
              id, username, shop_name, avatar_url, seller_tier,
              seller_rating, total_reviews, total_sales, is_verified
            ),
            category:categories!listings_category_id_fkey(slug, name)
          `)
          .eq('game_id', game.id)
          .eq('category_id', category.id)
          .eq('status', 'active')
          .order('updated_at', { ascending: false })
          .limit(200)
        itemsQuery = excludePausedSellers(itemsQuery, pausedSellerIds)
        const { data } = await itemsQuery as any
        return (data ?? []) as any[]
      })(),
    ])

    const offers = listingsRaw.map((l) => listingToItemOffer(l, taxonomy))
    const viewer = viewerRes.data?.user

    return (
      <>
        <GameSubNav
          gameSlug={gameSlug}
          gameName={game.name}
          gameImageUrl={(game as any).image_url}
          currentCategorySlug={category.slug}
          categories={allCategories}
        />
        {/* Suspense boundary required for the client's useSearchParams
            (reads ?attr_<slug>= deep-link filters from a navbar search). */}
        <Suspense fallback={null}>
          <ItemsPageClient
            gameSlug={gameSlug}
            gameName={game.name}
            gameImageUrl={(game as any).image_url ?? null}
            categoryLabel={category.name}
            tagline={
              (category as any).description ||
              `Browse verified ${game.name} listings — every order covered by SafeDrop Buyer Protection.`
            }
            offers={offers}
            taxonomy={taxonomy}
            viewerId={viewer?.id ?? null}
          />
        </Suspense>
      </>
    )
  }

  const [allCategories, listingsData] = await Promise.all([
    getAllGameCategories(game.id),
    getListings(game.id, category.id, resolvedSearchParams, pausedSellerIds),
  ])

  const { listings, hasMore, currentPage, totalListings } = listingsData

  const maxPrice = listings.length > 0
    ? Math.max(...listings.map((l: any) => l.price))
    : 1000

  const subTypes = ((category as any).metadata?.sub_types as string[]) || []
  const activeType = resolvedSearchParams.type || null

  return (
    <div className="min-h-screen bg-bg-base">
      {/* ── Game Sub-Nav ─────────────────────────────────────────────── */}
      <GameSubNav
        gameSlug={gameSlug}
        gameName={game.name}
        gameImageUrl={(game as any).image_url}
        currentCategorySlug={categorySlug}
        categories={allCategories}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ── Hero header ──────────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl border border-border-default bg-bg-raised mt-4 mb-8 px-6 py-8 sm:px-10 sm:py-10">
          {/* Lime radial glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 60% 50% at 10% 0%, rgba(198,255,61,0.14), transparent 60%)',
            }}
          />
          <div className="relative flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:gap-5 sm:text-left">
            {(game as any).image_url && (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border-default bg-bg-overlay shadow-elevated sm:h-20 sm:w-20">
                <Image
                  src={(game as any).image_url}
                  alt={game.name}
                  width={80}
                  height={80}
                  className="h-full w-full object-cover"
                />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center justify-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary sm:justify-start">
                <Link href={`/${gameSlug}`} className="transition-colors hover:text-lime-text">
                  {game.name}
                </Link>
                <span>·</span>
                <span className="text-lime-text">{category.name}</span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
                {game.name} {category.name}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-text-secondary sm:text-base">
                {(category as any).description ||
                  `Browse verified ${category.name.toLowerCase()} listings for ${game.name}.`}
              </p>
            </div>
          </div>
          {/* Bottom lime hairline */}
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-lime to-transparent opacity-50" />
        </div>

        {/* ── Sub-type pills (CS2 Skins / Knives etc.) ─────────────────── */}
        {subTypes.length > 0 && (
          <div className="mb-6">
            <Suspense fallback={null}>
              <CategoryPills subTypes={subTypes} activeType={activeType} />
            </Suspense>
          </div>
        )}

        {/* ── Main content with collapsible filter ─────────────────────── */}
        <div className="pb-20">
          <CategoryPageLayout
            maxPrice={maxPrice}
            totalListings={totalListings}
            hasMore={hasMore}
            currentPage={currentPage}
          >
            {listings.length === 0 ? (
              <EmptyState gameSlug={gameSlug} gameName={game.name} />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {listings.map((listing: any) => (
                  <ListingCard
                    key={listing.id}
                    gameSlug={gameSlug}
                    categorySlug={categorySlug}
                    listing={listing}
                  />
                ))}
              </div>
            )}
          </CategoryPageLayout>
        </div>
      </div>
    </div>
  )
}

// ─── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ gameSlug, gameName }: { gameSlug: string; gameName: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-6 w-16 h-16 rounded-full bg-bg-overlay flex items-center justify-center">
        <svg className="w-7 h-7 text-text-disabled" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-text-primary mb-1">No listings found</h3>
      <p className="text-sm text-text-tertiary mb-6">Try adjusting your filters or check back later</p>
      <Link
        href={`/${gameSlug}`}
        className="inline-flex items-center gap-1.5 text-sm text-lime-text hover:text-lime-text transition-colors font-medium"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to {gameName}
      </Link>
    </div>
  )
}

// ─── Listing Card ──────────────────────────────────────────────────────────────

const TIER_COLORS: Record<string, string> = {
  bronze:   'text-orange-400',
  silver:   'text-text-tertiary',
  gold:     'text-warning',
  platinum: 'text-cyan-400',
}

function ListingCard({
  gameSlug,
  categorySlug,
  listing,
}: {
  gameSlug: string
  categorySlug: string
  listing: any
}) {
  const imageUrl = listing.images?.[0] || null
  const tierColor = TIER_COLORS[listing.seller?.seller_tier] || 'text-text-tertiary'
  const hasPriceDrop = listing.original_price && listing.original_price > listing.price
  const discountPct = hasPriceDrop
    ? Math.round(((listing.original_price - listing.price) / listing.original_price) * 100)
    : 0

  return (
    <Link href={`/${gameSlug}/${categorySlug}/${listing.slug || listing.id}`}>
      <div className="group relative overflow-hidden rounded-2xl border border-border-subtle bg-bg-raised transition-colors hover:border-lime-tint-border hover:bg-bg-raised-hover">
        {/* Image */}
        <div className="relative aspect-[4/3] overflow-hidden bg-bg-overlay">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={listing.title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-lime/10 via-lime/5 to-bg-base text-5xl">
              🎮
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-bg-base/80 via-transparent to-transparent" />

          {/* SafeDrop badge — top-left */}
          <div className="absolute left-2.5 top-2.5">
            <SafeDropBadge
              level={listing.price >= 500 ? 'premium' : listing.price >= 100 ? 'enhanced' : 'standard'}
              size="sm"
              showLabel={false}
            />
          </div>

          {/* Discount — top-right */}
          {hasPriceDrop && (
            <div className="absolute right-2.5 top-2.5 inline-flex items-center rounded-full border border-success/40 bg-success-bg/80 px-2 py-0.5 text-[10px] font-bold text-success backdrop-blur-sm">
              -{discountPct}%
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex flex-col gap-2 p-4">
          <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug text-text-primary transition-colors group-hover:text-lime-text">
            {listing.title}
          </h3>

          <div className="flex items-baseline gap-2">
            <span className="font-mono text-lg font-bold tabular-nums text-text-primary">
              ${listing.price.toFixed(2)}
            </span>
            {hasPriceDrop && (
              <span className="font-mono text-xs text-text-tertiary line-through tabular-nums">
                ${listing.original_price.toFixed(2)}
              </span>
            )}
          </div>

          <div className="mt-1 flex items-center justify-between gap-2 border-t border-border-subtle pt-2">
            <span className={cn('truncate text-xs font-medium', tierColor)}>
              @{listing.seller?.username}
            </span>
            {listing.seller?.presence && (
              <PresenceIndicator
                isOnline={listing.seller.presence.is_online}
                lastSeenAt={listing.seller.presence.last_seen_at}
                showLabel={false}
                size="sm"
              />
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
