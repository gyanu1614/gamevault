/**
 * Category Browse Page — /{gameSlug}/{categorySlug}
 *
 * Layout: sticky GameSubNav → centered header → CategoryPageLayout (filter toggle)
 * Apple/Spotify-inspired minimal dark theme with game vibe.
 */

import { quantityUnit } from '@/lib/currency/quantity-unit'
import dynamic from 'next/dynamic'
import React, { Suspense, cache } from 'react'
import { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createAnonClient } from '@/lib/supabase/anon'
import Image from 'next/image'
import GameSubNav, { type GameCategory } from '@/components/marketplace/GameSubNav'
import GameDirectory from '@/components/marketplace/GameDirectory'
import { sellerDisplayName, sellerRatingPercent, sellerShopSlug } from '@/lib/seller/identity'
import { getCurrencyShell as getCurrencyShellUncached, listingToOffer } from './_currencyData'
import GenericListingsClient, { type GenericGridListing } from './_GenericListingsClient'
import {
  resolveCategoryRoute,
  getGameAndCategory,
  getActiveGame,
  getEnabledCategory,
} from './_routeGate'
import { getAllEnabledCategoryPairs } from '@/lib/seo/category-pairs'
import { bindCategoryListingsTag } from '@/lib/revalidation/listings'
import { getGameDirectory } from '@/lib/games/directory'
import { GAME_DIRECTORY_TAG } from '@/lib/revalidation/tags'
import { unstable_cache } from 'next/cache'
import RouteSkeleton from './_RouteSkeleton'
// PERF-004 — the three page variants below are mutually exclusive: a category
// resolves to exactly one of them at render time. Statically importing all
// three made every visitor download all three (60.4 + 50.5 + 30.5 kB of source
// plus their dependency closures) in order to use one. next/dynamic gives each
// its own chunk so only the variant actually rendered is fetched.
//
// This is a server component, so these are server-side dynamic imports: the
// chosen variant is still server-rendered in the same pass (no ssr:false, no
// loading flash) — only the client bundles are split.
const CurrencyPageClient = dynamic(() => import('./_CurrencyPageClient'))
const BundleCurrencyPageClient = dynamic(
  () => import('./_BundleCurrencyPageClient'),
)
import type {
  BundleCurrencyPageData,
  BundleOffer,
} from './_BundleCurrencyPageClient'
import { BlogRail } from '@/components/blog/BlogRail'
import { fetchCategoryConfigBySlug } from '@/lib/actions/admin-category-configs'
import { normalizePlatformOptions } from '@/lib/types/category-configs'
import { JsonLd, breadcrumbList, productAggregate, faqPage } from '@/lib/seo/jsonld'
import { getCategoryStats, formatStatPrice, type CategoryStats } from '@/lib/seo/page-stats'

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
  const m = raw.match(/^(\d+)\s*(min|hr|d)$/)
  if (!m) return raw
  const n = parseInt(m[1], 10)
  if (m[2] === 'hr') return `${n} ${n === 1 ? 'Hour' : 'Hours'}`
  // Day windows ("2d".."7d") from the wizard; without this the bundle
  // panel printed the raw code.
  if (m[2] === 'd') return `${n} ${n === 1 ? 'Day' : 'Days'}`
  return `${n} ${n === 1 ? 'Minute' : 'Minutes'}`
}
// V15 — Items page dispatch + SEO slug resolver.
import { getPausedSellerIds } from '@/lib/actions/seller-presence'
import { loadItemsTaxonomy, listingToOffer as listingToItemOffer } from './_itemsData'
const ItemsPageClient = dynamic(() => import('./_ItemsPageClient'))
import { resolveItemBySlug } from './_itemResolver'
import { SabNavExtras } from '../values/_SabNavExtras'

/**
 * Step 7a — static-first. This route rendered per request (2,000 renders a
 * day, `private, no-store`) because it read the cookie client and
 * `searchParams` on the server. Every public read goes through the anon
 * client, the viewer is resolved in the client variants (useAuth), and the
 * generic grid's filters run in the browser.
 *
 * Step 7b — prerendered for EVERY enabled pair and event-driven. ~80% of hits
 * are long-tail pairs visited hours apart, and ~12 deploys/day empty the
 * on-demand cache, so a short TTL never deduped them. Now every pair is built
 * at deploy, the page re-renders only when a listing mutation revalidates its
 * `listings:category:<id>` tag (lib/revalidation/listings — every mutation
 * path is enumerated by a guard test), and 24 h is the safety net alongside
 * the nightly full revalidate. Unknown pairs still 404 and cache the 404.
 */
export const revalidate = 86400

/** Every enabled (active game, enabled category) pair — see lib/seo/category-pairs. */
export async function generateStaticParams() {
  return getAllEnabledCategoryPairs()
}

interface PageProps {
  params: Promise<{
    gameSlug: string
    categorySlug: string
  }>
}

// ─── SEO ───────────────────────────────────────────────────────────────────────

/**
 * SEO intro sentence rendered near the top of every money page. One
 * source for all four branches so copy never drifts. Zero listings →
 * the sell-side CTA (shared rule: full template + "be the first").
 */
function buildIntroLine(
  stats: CategoryStats,
  gameName: string,
  categoryLabel: string,
  /** Flexible currency: what the low price covers ("M", "Robux"). */
  priceSuffix?: string,
): string {
  if (stats.count > 0 && stats.lowPrice != null) {
    const avg = stats.avgDeliveryLabel ? ` — average delivery ${stats.avgDeliveryLabel}` : ''
    return `${stats.count} live ${gameName} ${categoryLabel} ${
      stats.count === 1 ? 'listing' : 'listings'
    } from $${formatStatPrice(stats.lowPrice)}${priceSuffix ? `/${priceSuffix}` : ''}${avg}. Every order covered by SafeDrop Buyer Protection.`
  }
  return `Be the first to sell ${gameName} ${categoryLabel} on DropMarket — list in minutes with the lowest fees for buyers and sellers.`
}

/**
 * Deterministic small hash of a string → stable index. Lets empty-inventory
 * pages pick a consistent-but-DIFFERENT copy variant per game, so their
 * titles/descriptions aren't near-duplicates (Bing/Google flag identical meta
 * across pages). Same game always maps to the same variant.
 */
function pickVariant(seed: string, count: number): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return h % count
}

/** Unique-per-game title for a zero-inventory category page. */
function emptyTitleFor(gameName: string, categoryName: string): string {
  // NOTE: the root layout appends " | DropMarket" via metadata title.template,
  // so variants must NOT include it (avoids "... | DropMarket | DropMarket").
  const variants = [
    `Buy ${gameName} ${categoryName} — Cheap & Safe`,
    `${gameName} ${categoryName} for Sale — Verified Sellers`,
    `Sell & Buy ${gameName} ${categoryName} Safely`,
    `${gameName} ${categoryName} Marketplace — SafeDrop Protected`,
  ]
  return variants[pickVariant(`${gameName}|${categoryName}|t`, variants.length)]
}

/** Unique-per-game description for a zero-inventory category page. */
function emptyDescriptionFor(gameName: string, categoryName: string): string {
  const variants = [
    `Be the first to sell ${gameName} ${categoryName} on DropMarket — list in minutes with the lowest fees for buyers and sellers. Every order is covered by SafeDrop Buyer Protection.`,
    `Looking to buy or sell ${gameName} ${categoryName}? DropMarket connects verified traders with SafeDrop buyer protection — item guaranteed or your money back.`,
    `${gameName} ${categoryName} on DropMarket: the lowest fees for buyers and sellers, fast delivery, and SafeDrop Buyer Protection on every trade. Be an early seller and set the price.`,
    `Trade ${gameName} ${categoryName} the safe way. With SafeDrop, your item is guaranteed — get exactly what you ordered, or your money back.`,
  ]
  return variants[pickVariant(`${gameName}|${categoryName}|d`, variants.length)]
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { gameSlug, categorySlug } = await params

  // Shared with the route gate and the body (cache()d, anon client).
  const game = await getActiveGame(gameSlug)

  // SEO/soft-404 — bail out of METADATA, not just the body. `loading.tsx`
  // puts this page inside a Suspense boundary, so a `notFound()` thrown from
  // the page component fires after the shell has already streamed with a 200.
  // Legacy URLs (/game/roblox, /topup/steam-wallet, …) therefore answered
  // `200 + "Not Found" + index,follow` — a textbook soft 404 that invites
  // Google to index a dead page. Metadata resolves before the shell flushes,
  // so throwing here is what actually produces a real 404 + noindex.
  if (!game) notFound()

  const category = await getEnabledCategory(game.id, categorySlug)

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
    // Not a category and not an item slug — real 404 (see note above).
    notFound()
  }

  // CATEGORY branch — live stats drive the title/description so the
  // numbers in search results always match the page (shared source
  // with the JSON-LD and the on-page intro line).
  const stats = await getCategoryStats(game.id, category.id)

  const isCurrency = category.type === 'currency'
  const currencyCfg = isCurrency
    ? await fetchCategoryConfigBySlug(gameSlug, 'currency')
    : null
  // Currency shells with admin-curated FAQ/steps count as unique
  // content — they stay indexable even before the first listing.
  const hasCuratedContent =
    !!currencyCfg &&
    ((currencyCfg.faq?.length ?? 0) > 0 || (currencyCfg.steps?.length ?? 0) > 0)

  // Flexible (non-bundle) currency prices are per-unit, so the low
  // price reads best with its unit ("$0.0045/Robux", or "$0.003/M" on a
  // per-million game, where the price covers 1M, not one token). Bundle-mode
  // currency prices are per bundle — no unit suffix there.
  const usesUnitSuffix =
    isCurrency && !!currencyCfg?.unit_label && (currencyCfg.bundles?.length ?? 0) === 0
  const priceLabel =
    stats.lowPrice != null
      ? `$${formatStatPrice(stats.lowPrice)}${usesUnitSuffix ? `/${quantityUnit(currencyCfg!.quantity_granularity, currencyCfg!.unit_label)}` : ''}`
      : null

  const hasListings = stats.count > 0 && priceLabel != null

  // Admin overrides (categories.seo_*) win; otherwise the stats-aware
  // templates below. `.trim() || fallback` keeps blank overrides on template.
  const seoOverride = (v: string | null | undefined, fallback: string) =>
    (v ?? '').trim() || fallback

  return {
    title: seoOverride(
      category.seo_title,
      hasListings
        ? `Buy ${game.name} ${category.name} from ${priceLabel}`
        : emptyTitleFor(game.name, category.name),
    ),
    description: seoOverride(
      category.seo_description,
      hasListings
        ? `Buy ${game.name} ${category.name} from verified sellers. ${stats.count} live listings from ${priceLabel}. SafeDrop protection: get what you ordered or your money back.`
        : emptyDescriptionFor(game.name, category.name),
    ),
    keywords: [
      `${game.name.toLowerCase()} ${category.name.toLowerCase()}`,
      `buy ${game.name.toLowerCase()} ${category.name.toLowerCase()}`,
      `cheap ${game.name.toLowerCase()} ${category.name.toLowerCase()}`,
      `${game.name.toLowerCase()} marketplace`,
    ],
    // Zero-listing money pages stay crawlable but unindexed until the
    // first offer lands — UNLESS the page carries curated unique
    // content (admin currency config with FAQ/steps).
    ...(stats.count === 0 && !hasCuratedContent
      ? { robots: { index: false, follow: true } }
      : {}),
    openGraph: {
      title: `${game.name} ${category.name} - DropMarket`,
      description: `Buy and sell ${game.name} ${category.name.toLowerCase()} safely`,
      type: 'website',
    },
  }
}

// ─── Data fetching ─────────────────────────────────────────────────────────────

// Both resolvers run twice per request — once in the route gate (which must
// settle 200-vs-404 before anything streams) and once in the page body.
// React `cache()` collapses that to a single execution per request, so the
// gate costs no extra queries.
const getCurrencyShell = cache(getCurrencyShellUncached)

// Step 7b — per game, not per page: a game's sub-nav tabs are identical on
// every one of its category pages, so this is one tagged cache entry per game
// per build/hour (GAME_DIRECTORY_TAG, like the footer directory).
const getAllGameCategories = unstable_cache(
  async (gameId: string): Promise<GameCategory[]> => {
    const supabase = createAnonClient()
    const { data } = await supabase
      .from('game_categories')
      .select('id, name, slug')
      .eq('game_id', gameId)
      .eq('is_enabled', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true }) as any
    return (data || []) as GameCategory[]
  },
  ['game-categories-nav'],
  { tags: [GAME_DIRECTORY_TAG], revalidate: 3600 },
)

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

/**
 * Every active listing in the pair, newest first. The generic grid's URL
 * rules (price bounds, search, type, delivery, sort, tiers, online, page) run
 * in the browser now — see _genericListingFilters.ts — so this is the same
 * base query the old server-side getListings started from, minus the
 * per-request filters, with the columns the card and the filters read.
 */
async function getGenericListings(
  gameId: string,
  categoryId: string,
  pausedSellerIds: string[],
): Promise<GenericGridListing[]> {
  const supabase = createAnonClient()
  let query: any = supabase
    .from('listings')
    .select(`
      id, slug, title, description, price, original_price, images,
      delivery_time, view_count, created_at,
      seller:public_profiles!listings_seller_id_fkey!inner(
        id, username, seller_tier, avatar_url, is_test,
        presence:seller_presence(is_online, last_seen_at)
      )
    `)
    .eq('game_id', gameId)
    .eq('game_category_id', categoryId)
    .eq('status', 'active')
    // SEO hygiene: hide test/demo accounts from public category pages.
    .eq('seller.is_test', false)
    .order('created_at', { ascending: false })
  query = excludePausedSellers(query, pausedSellerIds)
  const { data, error } = await query
  return error ? [] : ((data ?? []) as GenericGridListing[])
}

// ─── Page ──────────────────────────────────────────────────────────────────────

/**
 * Route gate — decides 200 / 301 / 404 BEFORE any HTML streams.
 *
 * The status code is fixed the moment the shell flushes, so this resolution
 * cannot sit behind a Suspense boundary. That was the soft-404 bug: with a
 * route-level `loading.tsx` above the page, legacy URLs (/game/roblox,
 * /topup/steam-wallet, …) and any unknown category answered
 * `200 + "Not Found" + index,follow` — Google was being invited to index a
 * dead page. Running the same checks here, with no boundary above, lets
 * `notFound()` and `redirect()` reach the response again.
 *
 * The mirrored checks are free: both resolvers are `cache()`d, so the body
 * below reuses these results rather than re-querying.
 */
export default async function CategoryBrowseRoute(props: PageProps) {
  const { gameSlug, categorySlug } = await props.params

  // Step 7a — _routeGate.ts: game → category → SEO item slug → 404, in that
  // order, so junk two-segment URLs cost one `games` read and no listing or
  // seller query (category-route-gate.test.ts). An SEO item slug 301s to the
  // canonical listing URL from outside the boundary (a real HTTP redirect).
  const resolution = await resolveCategoryRoute(gameSlug, categorySlug)
  if (resolution.kind === 'item-redirect') redirect(resolution.href)
  if (resolution.kind === 'not-found') notFound()

  // Skeleton preserved — it just lives in an in-page boundary now instead of
  // a route-level loading.tsx.
  return (
    <Suspense fallback={<RouteSkeleton />}>
      <CategoryBrowsePage {...props} />
    </Suspense>
  )
}

async function CategoryBrowsePage({ params }: PageProps) {
  const { gameSlug, categorySlug } = await params

  // V21/P7.ae — Fetch the offline-seller set ONCE per page render and
  // reuse it across every listing query branch (currency / bundle /
  // items / generic). One indexed read, no per-query refetch.
  const pausedSellerIds = await getPausedSellerIds()

  // Step 7b — tag this render so listing mutations in this category can
  // revalidate exactly this page (cache()d lookup, shared with the gate).
  const resolvedPair = await getGameAndCategory(gameSlug, categorySlug)
  if (resolvedPair) await bindCategoryListingsTag(resolvedPair.category.id)

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
    const supabase = createAnonClient()
    const game = await getActiveGame(gameSlug)
    const categories = game ? await getAllGameCategories(game.id) : []

    // Listings for any bundle under the currency category. The
    // BundleCurrencyPageClient does its own (bundle, region) filtering
    // on the client; we just send all active bundle-tagged rows.
    let bundleOffers: BundleOffer[] = []
    let realCategorySlug: string | null = null
    // Live stats for the SEO intro line + JSON-LD (same helper the
    // metadata uses, so all three surfaces agree).
    let stats: CategoryStats = { count: 0, lowPrice: null, highPrice: null, avgDeliveryLabel: null }
    if (game?.id) {
      const catRow = await supabase
        .from('game_categories')
        .select('id, slug')
        .eq('game_id', game.id)
        .eq('type', 'currency')
        .eq('is_enabled', true)
        .order('sort_order', { ascending: true })
        .limit(1)
        .maybeSingle() as any
      const categoryId = catRow.data?.id
      realCategorySlug = catRow.data?.slug ?? null
      if (categoryId) {
        stats = await getCategoryStats(game.id, categoryId)
        let bundleQuery: any = supabase
          .from('listings')
          .select(`
            id, description, price, quantity, delivery_time, is_unlimited,
            bundle_id, region, platform,
            seller:public_profiles!listings_seller_id_fkey(
              id, username, shop_name, shop_slug, avatar_url, seller_tier,
              seller_rating, total_reviews, is_verified
            )
          `)
          .eq('game_id', game.id)
          .eq('game_category_id', categoryId)
          .eq('status', 'active')
          .not('bundle_id', 'is', null)
          .order('price', { ascending: true })
          .limit(200)
        bundleQuery = excludePausedSellers(bundleQuery, pausedSellerIds)
        const { data: listings } = await bundleQuery as any
        bundleOffers = (listings ?? []).map((l: any) => ({
          listingId: l.id,
          sellerId: l.seller?.id ?? null,
          sellerSlug: sellerShopSlug(l.seller),
          sellerName: sellerDisplayName(l.seller),
          sellerAvatarUrl: l.seller?.avatar_url ?? null,
          verified: !!l.seller?.is_verified,
          sellerTier: l.seller?.seller_tier ?? null,
          // Positive-feedback % (0–100) from the 0–5 star average, or null for
          // a seller with no reviews (rendered as "New"). Never the old raw-star
          // -as-percent (5★ → "5%") or the fabricated 95 default.
          rating: sellerRatingPercent(l.seller),
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

    const gameName = game?.name ?? gameSlug
    const categoryLabel = data.unitLabel
    const introLine = buildIntroLine(stats, gameName, categoryLabel)

    return (
      <>
        <JsonLd
          data={breadcrumbList([
            { name: 'Home', path: '/' },
            { name: gameName, path: `/${gameSlug}` },
            { name: categoryLabel, path: `/${gameSlug}/${categorySlug}` },
          ])}
        />
        {stats.count > 0 && stats.lowPrice != null && stats.highPrice != null && (
          <JsonLd
            data={productAggregate({
              name: `${gameName} ${categoryLabel}`,
              description: `Buy ${gameName} ${categoryLabel} from verified sellers — get what you ordered, or your money back with SafeDrop Buyer Protection.`,
              brand: gameName,
              lowPrice: stats.lowPrice,
              highPrice: stats.highPrice,
              offerCount: stats.count,
              url: `/${gameSlug}/${categorySlug}`,
            })}
          />
        )}
        {data.faq.length > 0 && <JsonLd data={faqPage(data.faq)} />}
        <GameSubNav
          gameSlug={gameSlug}
          gameName={gameName}
          gameImageUrl={game?.image_url}
          currentCategorySlug={realCategorySlug ?? 'currency'}
          categories={categories}
          extraTabs={gameSlug === 'steal-a-brainrot' ? <SabNavExtras /> : undefined}
        />
        <BundleCurrencyPageClient
          data={data}
          introLine={introLine}
          blogRail={<BlogRail gameSlug={gameSlug} gameName={gameName} />}
        />
        {game?.id && (
          <RelatedGames
            currentGameId={game.id}
            categorySlug={categorySlug}
            categoryName={categoryLabel}
          />
        )}
      </>
    )
  }

  if (currencyShell) {
    const supabase = createAnonClient()
    const game = await getActiveGame(gameSlug)

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
    // Live stats for the SEO intro line + JSON-LD (same helper the
    // metadata uses, so all three surfaces agree).
    let stats: CategoryStats = { count: 0, lowPrice: null, highPrice: null, avgDeliveryLabel: null }
    if (game?.id) {
      const catRow = await supabase
        .from('game_categories')
        .select('id, slug')
        .eq('game_id', game.id)
        .eq('type', 'currency')
        .eq('is_enabled', true)
        .order('sort_order', { ascending: true })
        .limit(1)
        .maybeSingle() as any
      const categoryId = catRow.data?.id
      realCategorySlug = catRow.data?.slug ?? null
      if (categoryId) {
        stats = await getCategoryStats(game.id, categoryId)
        let currencyQuery: any = supabase
          .from('listings')
          .select(`
            id, title, description, price, original_price, quantity,
            min_quantity, delivery_method, delivery_time, is_unlimited,
            seller:public_profiles!listings_seller_id_fkey(
              id, username, shop_name, shop_slug, avatar_url, seller_tier,
              seller_rating, total_reviews, is_verified
            )
          `)
          .eq('game_id', game.id)
          .eq('game_category_id', categoryId)
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
          // Only a price sanity check. The old `o.minQty >= 100` clause
          // was a leftover from the per-unit Robux model: it silently
          // dropped every listing in a game whose admin minimum is
          // below 100, which is exactly what a `thousand`-granularity
          // game wants (min 1 = 1K). The real floor is the per-game
          // admin `min_quantity`, enforced in the wizard on save.
          .filter((o: { minQty: number; pricePerUnit: number }) => o.pricePerUnit > 0)
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

    // V14m/Step 7a — the self-purchase block (a seller can't buy their own
    // listing) is computed in the client from useAuth(); resolving the viewer
    // here would make the whole ISR route dynamic.

    const gameName = game?.name ?? currencyShell.currency.game
    const categoryLabel = mergedData.currency.name
    const introLine = buildIntroLine(
      stats,
      gameName,
      categoryLabel,
      quantityUnit(mergedData.currency.granularity, mergedData.currency.unitLabel),
    )

    return (
      <>
        <JsonLd
          data={breadcrumbList([
            { name: 'Home', path: '/' },
            { name: gameName, path: `/${gameSlug}` },
            { name: categoryLabel, path: `/${gameSlug}/${categorySlug}` },
          ])}
        />
        {stats.count > 0 && stats.lowPrice != null && stats.highPrice != null && (
          <JsonLd
            data={productAggregate({
              name: `${gameName} ${categoryLabel}`,
              description: `Buy ${gameName} ${categoryLabel} from verified sellers — get what you ordered, or your money back with SafeDrop Buyer Protection.`,
              brand: gameName,
              lowPrice: stats.lowPrice,
              highPrice: stats.highPrice,
              offerCount: stats.count,
              url: `/${gameSlug}/${categorySlug}`,
            })}
          />
        )}
        {mergedData.faq.length > 0 && <JsonLd data={faqPage(mergedData.faq)} />}
        <GameSubNav
          gameSlug={gameSlug}
          gameName={gameName}
          gameImageUrl={game?.image_url}
          // V14c — Highlight whichever category row actually exists for
          // currency. For Roblox that's 'robux'; for V-Bucks it's 'v-bucks'.
          // Falls back to 'currency' if no per-game row was found.
          currentCategorySlug={realCategorySlug ?? 'currency'}
          categories={categories}
          extraTabs={gameSlug === 'steal-a-brainrot' ? <SabNavExtras /> : undefined}
        />
        <CurrencyPageClient
          data={mergedData}
          gameImageUrl={game?.image_url ?? `/games/${gameSlug}.png`}
          gameSlug={gameSlug}
          introLine={introLine}
          blogRail={<BlogRail gameSlug={gameSlug} gameName={gameName} />}
        />
        {game?.id && (
          <RelatedGames
            currentGameId={game.id}
            categorySlug={categorySlug}
            categoryName={categoryLabel}
          />
        )}
      </>
    )
  }

  const data = await getGameAndCategory(gameSlug, categorySlug)

  // V15 — Items SEO routing. If the URL segment isn't a known category
  // slug for this game, see whether it resolves to an active item
  // listing under {gameSlug}/items. If so, redirect to the listing
  // detail page (canonical detail UI lives elsewhere); otherwise 404.
  // The route gate already 301'd SEO item slugs and 404'd unknown pairs;
  // this only guards the (cache()d) lookup against a mid-render change.
  if (!data) notFound()

  const { game, category } = data

  // V15 — Items dispatch. When the page is the per-game items catalogue,
  // render the new Showcase-grid client with admin-driven taxonomy and
  // SEO-friendly URLs. V19/P24/P7.kk — Accounts / Boosting / Top-up
  // now also use this client. They get the same landscape card grid
  // + filter band; taxonomy() returns empty when no template exists,
  // so cards render cleanly with just title + photo + price.
  const categoryType = (category as any).type as string | undefined
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
    const [allCategories, taxonomy, listingsRaw, stats] = await Promise.all([
      getAllGameCategories(game.id),
      loadItemsTaxonomy(game.id, taxonomySlug),
      (async () => {
        const sb = createAnonClient()
        let itemsQuery: any = sb
          .from('listings')
          .select(`
            id, slug, title, price, original_price, delivery_time,
            quantity, is_unlimited, images, template_data, status,
            seller:public_profiles!listings_seller_id_fkey(
              id, username, shop_name, shop_slug, avatar_url, seller_tier,
              seller_rating, total_reviews, total_sales, is_verified
            ),
            category:game_categories!listings_game_category_id_fkey(slug, name)
          `)
          .eq('game_id', game.id)
          .eq('game_category_id', category.id)
          .eq('status', 'active')
          .order('updated_at', { ascending: false })
          .limit(200)
        itemsQuery = excludePausedSellers(itemsQuery, pausedSellerIds)
        const { data } = await itemsQuery as any
        return (data ?? []) as any[]
      })(),
      getCategoryStats(game.id, category.id),
    ])

    const offers = listingsRaw.map((l) => listingToItemOffer(l, taxonomy))
    const introLine = buildIntroLine(stats, game.name, category.name)

    return (
      <>
        <JsonLd
          data={breadcrumbList([
            { name: 'Home', path: '/' },
            { name: game.name, path: `/${gameSlug}` },
            { name: category.name, path: `/${gameSlug}/${categorySlug}` },
          ])}
        />
        {stats.count > 0 && stats.lowPrice != null && stats.highPrice != null && (
          <JsonLd
            data={productAggregate({
              name: `${game.name} ${category.name}`,
              description: `Buy ${game.name} ${category.name} from verified sellers — get what you ordered, or your money back with SafeDrop Buyer Protection.`,
              brand: game.name,
              lowPrice: stats.lowPrice,
              highPrice: stats.highPrice,
              offerCount: stats.count,
              url: `/${gameSlug}/${categorySlug}`,
            })}
          />
        )}
        <GameSubNav
          gameSlug={gameSlug}
          gameName={game.name}
          gameImageUrl={(game as any).image_url}
          currentCategorySlug={category.slug}
          categories={allCategories}
          extraTabs={gameSlug === 'steal-a-brainrot' ? <SabNavExtras /> : undefined}
        />
        {/* The client reads ?attr_<slug>= / ?search= deep links through
            SearchParamsBridge, so it stays in the static HTML. */}
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
            introLine={introLine}
            stats={stats}
          />
        </Suspense>
        <RelatedGames
          currentGameId={game.id}
          categorySlug={categorySlug}
          categoryName={category.name}
        />
      </>
    )
  }

  const [allCategories, allListings, stats] = await Promise.all([
    getAllGameCategories(game.id),
    getGenericListings(game.id, category.id, pausedSellerIds),
    getCategoryStats(game.id, category.id),
  ])

  const introLine = buildIntroLine(stats, game.name, category.name)
  const subTypes = ((category as any).sub_types as string[]) || []

  return (
    <div className="min-h-screen bg-bg-base">
      <JsonLd
        data={breadcrumbList([
          { name: 'Home', path: '/' },
          { name: game.name, path: `/${gameSlug}` },
          { name: category.name, path: `/${gameSlug}/${categorySlug}` },
        ])}
      />
      {stats.count > 0 && stats.lowPrice != null && stats.highPrice != null && (
        <JsonLd
          data={productAggregate({
            name: `${game.name} ${category.name}`,
            description: `Buy ${game.name} ${category.name} from verified sellers — get what you ordered, or your money back with SafeDrop Buyer Protection.`,
            brand: game.name,
            lowPrice: stats.lowPrice,
            highPrice: stats.highPrice,
            offerCount: stats.count,
            url: `/${gameSlug}/${categorySlug}`,
          })}
        />
      )}
      {/* ── Game Sub-Nav ─────────────────────────────────────────────── */}
      <GameSubNav
        gameSlug={gameSlug}
        gameName={game.name}
        gameImageUrl={(game as any).image_url}
        currentCategorySlug={categorySlug}
        categories={allCategories}
        extraTabs={gameSlug === 'steal-a-brainrot' ? <SabNavExtras /> : undefined}
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
              {/* SEO intro — live stats, same source as metadata + JSON-LD. */}
              <p className="mt-1.5 max-w-2xl text-[13px] text-text-tertiary">
                {introLine}
              </p>
            </div>
          </div>
          {/* Bottom lime hairline */}
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-lime to-transparent opacity-50" />
        </div>

        {/* Sub-type pills, filters, grid and load-more: the URL rules run
            in the browser (Step 7a). */}
        <GenericListingsClient
          gameSlug={gameSlug}
          gameName={game.name}
          categorySlug={categorySlug}
          categoryName={category.name}
          listings={allListings}
          subTypes={subTypes}
        />
      </div>

      {/* ── Related games — same category on other games ─────────────── */}
      <RelatedGames
        currentGameId={game.id}
        categorySlug={categorySlug}
        categoryName={category.name}
      />
    </div>
  )
}

// ─── Related games ─────────────────────────────────────────────────────────────

/**
 * Cross-links the same category slug on up to 6 OTHER games that
 * actually have it active. Real <a> links (next/link) so crawlers can
 * follow the lateral money-page mesh. Server component — renders
 * nothing when no sibling game carries the category.
 */
/**
 * RelatedGames — kept name + call signature for back-compat, but now
 * renders the full game directory (every active game + its subcategories)
 * above the footer. Big SEO win: internal-links every game×category page
 * from every marketplace page. Collapsed with "Show All" (GameDirectory).
 */
async function RelatedGames({
  categoryName,
}: {
  currentGameId: string
  categorySlug: string
  categoryName: string
}) {
  // Step 7b — the directory (every active game + its enabled categories) is
  // the same on all ~600 prerendered pages: one tagged cache read
  // (lib/games/directory), not two queries per page at build.
  const directoryGames = await getGameDirectory()
  if (directoryGames.length === 0) return null

  return <GameDirectory games={directoryGames} heading={`Buy ${categoryName} for Every Game`} />
}
