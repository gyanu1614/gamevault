/**
 * Dynamic Sitemap Generator
 *
 * DB-driven: games, game+category pairs, and listing details come from
 * Supabase; legal docs and blog posts come from their typed modules.
 *
 * lastmod policy: only emit lastModified when we have a REAL change
 * date (listing updated_at, blog publishedAt). Static pages emit no
 * lastmod — an always-changing `new Date()` trains Google to ignore
 * the field entirely.
 */

import { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'
import { LANDING_PAGES } from '@/lib/seo/landingPages'
import {
  isGameHubIndexable,
  isGameSellPageIndexable,
} from '@/lib/games/indexability'
import { isLandingPageIndexable } from '@/lib/seo/landingPageInventory'
import { LEGAL_DOCS } from '@/lib/legal/documents'
import { getAllPosts, getFlatPosts } from '@/lib/blog/posts'

import { SITE_URL } from '@/config/site'
import {
  CONTENT_HUB_GAME_SLUGS,
  getGameContentTheme,
} from '@/lib/content/theme'

const BASE_URL = SITE_URL

/**
 * Legal doc slug → (legal) route-folder name. Folder names match doc
 * slugs 1:1 except `safedrop`, whose route is /safedrop-policy (the
 * bare /safedrop URL is the marketing page).
 */
function legalDocPath(slug: string): string {
  return slug === 'safedrop' ? '/safedrop-policy' : `/${slug}`
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient()

  const { data: sabBrainrots, error: sabBrainrotsError } = await (supabase as any)
    .from('sab_brainrot_catalog')
    .select('slug')
    .order('slug', { ascending: true })

  if (sabBrainrotsError) {
    console.error('Unable to load SAB Brainrots for sitemap:', sabBrainrotsError)
  }

  // Only PUBLISHABLE Adopt Me pets (has_page) — a pet without a description
  // 404s, and submitting a 404 to Google is a soft-404 signal. updated_at gives
  // a real lastmod so freshness is honest.
  const { data: adoptMePets, error: adoptMePetsError } = await (supabase as any)
    .from('adopt_me_pets')
    .select('slug, updated_at')
    .eq('has_page', true)
    .order('slug', { ascending: true })

  if (adoptMePetsError) {
    console.error('Unable to load Adopt Me pets for sitemap:', adoptMePetsError)
  }

  /**
   * Games on the generic values_* pipeline. Only PRICED items are listed:
   * a value with no price (every Steal An Egg pet) renders `noindex`, so
   * advertising it here would contradict the page's own robots meta — the
   * exact soft-404 shape Step 1c fixed for the hubs.
   *
   * `lastmod` is the value's real last CHANGE, not the crawl time.
   */
  const { data: pipelineItems, error: pipelineItemsError } = await (supabase as any)
    .from('values_items')
    .select('slug, games!inner(slug), values_prices!inner(price_changed_at, sample_size)')
    .eq('is_enabled', true)
    .eq('is_priced', true)
    .order('slug', { ascending: true })

  if (pipelineItemsError) {
    console.error('Unable to load values-pipeline items for sitemap:', pipelineItemsError)
  }

  const pipelineByGame = new Map<string, Array<{ slug: string; updated_at: string | null }>>()
  for (const row of (pipelineItems ?? []) as Array<{
    slug: string
    games?: { slug: string } | null
    values_prices?: { price_changed_at: string | null; sample_size: number } | null
  }>) {
    const gameSlug = row.games?.slug
    // Mirror the page's own noindex rule: fewer than 3 listings behind a value
    // means it is not a ranking page, so it does not belong in the sitemap.
    if (!gameSlug || (row.values_prices?.sample_size ?? 0) < 3) continue
    const list = pipelineByGame.get(gameSlug) ?? []
    list.push({ slug: row.slug, updated_at: row.values_prices?.price_changed_at ?? null })
    pipelineByGame.set(gameSlug, list)
  }

  // Static marketing/trust pages — no lastmod (see policy above).
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      changeFrequency: 'daily',
      priority: 1,
    },
    // /marketplace redirects to / — no separate sitemap entry needed
    {
      url: `${BASE_URL}/browse`,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/safedrop`,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/sell/fees`,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/account/become-seller`,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
  ]

  // Legal & policy pack — one route per doc under src/app/(legal)/*.
  const legalPages: MetadataRoute.Sitemap = LEGAL_DOCS.map((doc) => ({
    url: `${BASE_URL}${legalDocPath(doc.slug)}`,
    changeFrequency: 'monthly' as const,
    priority: 0.3,
  }))

  // Blog — the FLAT index + only the general (untagged) articles. A game-tagged
  // post's flat /blog/{slug} URL 301-redirects to its nested /{game}/blog/{slug}
  // home (see next.config.js), so listing it here would put a redirecting URL in
  // the sitemap (a GSC "Page with redirect" error) AND double-list it alongside
  // the nested entry emitted elsewhere. So keep only posts with no game tag,
  // which genuinely live at the flat URL.
  const posts = getAllPosts()
  // ROUTE-008 — shared with generateStaticParams in /blog/[slug] so the
  // "still lives at the flat URL" rule has exactly one definition.
  const flatPosts = getFlatPosts()
  const newestPostDate = posts.reduce<string | null>(
    (acc, p) => (!acc || p.publishedAt > acc ? p.publishedAt : acc),
    null,
  )
  const blogPages: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/blog`,
      ...(newestPostDate ? { lastModified: new Date(newestPostDate) } : {}),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    },
    ...flatPosts.map((post) => ({
      url: `${BASE_URL}/blog/${post.slug}`,
      lastModified: new Date(post.publishedAt),
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
  ]

  // DB-driven per-game blog posts (/[game]/blog/[slug]) + their index pages.
  // Only PUBLISHED, game-scoped posts. Index pages are added per game that has
  // at least one published post.
  const { data: gamePostRows } = (await supabase
    .from('blog_posts')
    .select('slug, primary_game_slug, updated_at')
    .eq('status', 'published')
    .not('primary_game_slug', 'is', null)) as unknown as {
    data: { slug: string; primary_game_slug: string; updated_at: string }[] | null
  }
  const gameBlogIndexSlugs = new Set<string>()
  const gameBlogPages: MetadataRoute.Sitemap = (gamePostRows ?? []).map((p) => {
    gameBlogIndexSlugs.add(p.primary_game_slug)
    return {
      url: `${BASE_URL}/${p.primary_game_slug}/blog/${p.slug}`,
      ...(p.updated_at ? { lastModified: new Date(p.updated_at) } : {}),
      changeFrequency: 'weekly' as const,
      priority: 0.55,
    }
  })
  const gameBlogIndexPages: MetadataRoute.Sitemap = Array.from(gameBlogIndexSlugs).map((g) => ({
    url: `${BASE_URL}/${g}/blog`,
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }))

  // Fetch games, active listings (with game/category slugs), and the
  // curated currency configs in parallel.
  const [{ data: games }, { data: listings }, { data: currencyConfigs }] =
    await Promise.all([
      supabase
        .from('games')
        .select('id, slug, content_tier, updated_at, seo_indexable')
        .eq('is_active', true) as unknown as Promise<{
        data: {
          id: string
          slug: string
          content_tier: string | null
          updated_at: string | null
          seo_indexable: boolean | null
        }[] | null
      }>,
      supabase
        .from('listings')
        .select(
          `
          slug,
          updated_at,
          seller:public_profiles!listings_seller_id_fkey!inner(is_test),
          game:games!listings_game_id_fkey(slug),
          category:game_categories!listings_game_category_id_fkey(slug)
        `
        )
        .eq('status', 'active')
        // SEO hygiene: never list test/demo sellers' listings in the sitemap.
        .eq('seller.is_test', false),
      // Mirrors the nav index bar: a category_configs row with curated
      // currency content (unit label / FAQ / steps) makes a game hub a
      // real destination even before its first listing.
      supabase
        .from('category_configs')
        .select('game_id')
        .eq('category_type', 'currency') as unknown as Promise<{
        data: { game_id: string }[] | null
      }>,
    ])

  // Curated currency CATEGORY pages: a game with an admin currency
  // config is indexable at /{game}/{currency-category} even before its
  // first listing (the page's robots logic treats curated content as
  // unique value) — so those URLs belong in the sitemap too.
  const supabase2 = await createClient()
  const { data: currencyCategories } = (await supabase2
    .from('game_categories')
    .select('slug, game_id, game:games!game_categories_game_id_fkey(slug)')
    .eq('is_enabled', true)
    .eq('type', 'currency')) as unknown as {
    data: { slug: string; game_id: string; game: { slug: string } | null }[] | null
  }

  // Which games have at least one enabled category — the sell page's
  // indexability input.
  const { data: gameCategoryCounts } = (await supabase2
    .from('game_categories')
    .select('game_id')
    .eq('is_enabled', true)) as unknown as {
    data: { game_id: string }[] | null
  }

  // Unique game+category pairs + max listing updated_at per pair/game
  // (cheap — derived from the listings we already fetched). ISO strings
  // compare lexicographically, so string max is date max.
  const gameCategoryPairs = new Set<string>()
  const activeGameSlugs = new Set<string>()
  const pairLastmod = new Map<string, string>()
  const gameLastmod = new Map<string, string>()
  listings?.forEach((listing: any) => {
    const gameSlug = listing.game?.slug
    const categorySlug = listing.category?.slug
    if (!gameSlug || !categorySlug) return
    const pair = `${gameSlug}/${categorySlug}`
    gameCategoryPairs.add(pair)
    activeGameSlugs.add(gameSlug)
    const updatedAt: string | null = listing.updated_at
    if (updatedAt) {
      if (!pairLastmod.has(pair) || updatedAt > pairLastmod.get(pair)!) {
        pairLastmod.set(pair, updatedAt)
      }
      if (!gameLastmod.has(gameSlug) || updatedAt > gameLastmod.get(gameSlug)!) {
        gameLastmod.set(gameSlug, updatedAt)
      }
    }
  })

  const curatedGameIds = new Set(
    currencyConfigs?.map((c) => c.game_id) ?? [],
  )

  // Game hubs — the SAME rule the page's robots meta uses, imported from
  // lib/games/indexability.ts so the two can never drift. A seeded
  // zero-inventory `listed` hub renders 200 but stays out of the index and
  // out of this sitemap until it has real inventory.
  const gamePages: MetadataRoute.Sitemap = (games ?? [])
    .filter((game) =>
      isGameHubIndexable({
        contentTier: game.content_tier,
        activeListingCount: activeGameSlugs.has(game.slug) ? 1 : 0,
        hasCuratedCurrencyConfig: curatedGameIds.has(game.id),
        // The admin override is passed through so the sitemap reaches the
        // SAME verdict as the page's robots meta. Previously omitted, which
        // meant `seo_indexable=false` produced a noindex hub that this
        // sitemap still advertised — the exact contradictory signal the
        // shared module exists to prevent (Step 1 verification, D13.4).
        seoIndexable: game.seo_indexable,
      }),
    )
    .map((game) => {
      const lastmod = gameLastmod.get(game.slug)
      return {
        url: `${BASE_URL}/${game.slug}`,
        ...(lastmod ? { lastModified: new Date(lastmod) } : {}),
        changeFrequency: 'daily' as const,
        priority: 0.8,
      }
    })

  // Seller-acquisition pages — indexable for every active game with at least
  // one enabled category, inventory or not: the page targets sellers, so it
  // is complete with zero listings. This is what carries the seeded
  // catalogue's SEO while the hubs wait for inventory.
  const gamesWithCategories = new Set(
    (gameCategoryCounts ?? []).map((c: { game_id: string }) => c.game_id),
  )
  const sellPages: MetadataRoute.Sitemap = (games ?? [])
    .filter((game) =>
      isGameSellPageIndexable({
        enabledCategoryCount: gamesWithCategories.has(game.id) ? 1 : 0,
        // Same contract as the hub above: an explicit admin noindex on the
        // game drops its sell page from the sitemap too, matching the
        // robots meta that sell/page.tsx already derives from this field.
        seoIndexable: game.seo_indexable,
      }),
    )
    .map((game) => ({
      url: `${BASE_URL}/${game.slug}/sell`,
      ...(game.updated_at ? { lastModified: new Date(game.updated_at) } : {}),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))

  // Add curated currency pairs that have no listings yet.
  const curatedConfigGameIds = new Set(currencyConfigs?.map((c) => c.game_id) ?? [])
  currencyCategories?.forEach((cat) => {
    const gameSlug = cat.game?.slug
    if (!gameSlug || !curatedConfigGameIds.has(cat.game_id)) return
    gameCategoryPairs.add(`${gameSlug}/${cat.slug}`)
  })

  // Game + category pages, lastmod = max listing updated_at in the pair.
  const categoryPages: MetadataRoute.Sitemap = Array.from(gameCategoryPairs).map(
    (pair) => {
      const lastmod = pairLastmod.get(pair)
      return {
        url: `${BASE_URL}/${pair}`,
        ...(lastmod ? { lastModified: new Date(lastmod) } : {}),
        changeFrequency: 'daily' as const,
        priority: 0.7,
      }
    }
  )

  // Listing detail pages.
  const listingPages: MetadataRoute.Sitemap =
    listings
      ?.filter((listing: any) => listing.slug && listing.game?.slug && listing.category?.slug)
      .map((listing: any) => ({
        url: `${BASE_URL}/${listing.game.slug}/${listing.category.slug}/${listing.slug}`,
        ...(listing.updated_at ? { lastModified: new Date(listing.updated_at) } : {}),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      })) || []

  // SEO landing pages (curated copy; no meaningful change date → no lastmod).
  // Only the ones with real inventory: an empty landing page is noindexed by
  // the route itself, and submitting a noindexed URL in the sitemap is a
  // contradiction Google reports as an error. Previously every configured slug
  // was listed unconditionally, including four that rendered "coming soon".
  const landingPageCandidates = LANDING_PAGES
  const landingPageHasInventory = await Promise.all(
    landingPageCandidates.map((page) => isLandingPageIndexable(page)),
  )
  const landingPages: MetadataRoute.Sitemap = landingPageCandidates
    .filter((_, i) => landingPageHasInventory[i])
    .map((page) => ({
      url: `${BASE_URL}/buy/${page.slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.75,
    }))

  /**
   * Hub pages for every game with a content hub — driven by the per-game
   * content config (`pages`) rather than one hand-written block per game, so a
   * new game's hub URLs appear here by adding its config entry.
   *
   * Emits exactly the URLs the previous hardcoded SAB + Adopt Me blocks did:
   * the same paths, changeFrequency and priority. Per-game item URLs and the
   * extras a single game has (Adopt Me's neon-calculator) are supplied by the
   * caller through `itemsByGame` / `extraPathsByGame`.
   *
   * NOTE: /[game]/sell is deliberately NOT emitted here. It was a hardcoded
   * entry that bypassed isGameSellPageIndexable(), so an admin setting
   * seo_indexable=false produced a noindex sell page this sitemap still
   * advertised — and it double-listed the URL that `sellPages` already emits
   * for every game. The rule-driven entry covers it.
   */
  const itemsByGame: Record<
    string,
    Array<{ slug: string; updated_at?: string | null }>
  > = {
    'steal-a-brainrot': ((sabBrainrots ?? []) as { slug: string }[]),
    'adopt-me': ((adoptMePets ?? []) as {
      slug: string
      updated_at: string | null
    }[]),
    // Generic-pipeline games contribute their priced items by config.
    ...Object.fromEntries(pipelineByGame),
  }

  // Game-specific hub routes that are not part of the shared page set.
  const extraPathsByGame: Record<
    string,
    Array<{ path: string; changeFrequency: 'weekly'; priority: number }>
  > = {
    'adopt-me': [
      { path: 'neon-calculator', changeFrequency: 'weekly', priority: 0.6 },
    ],
  }

  const hubPages: MetadataRoute.Sitemap = CONTENT_HUB_GAME_SLUGS.flatMap(
    (slug) => {
      const theme = getGameContentTheme(slug)
      const entries: MetadataRoute.Sitemap = []

      if (theme.pages.values) {
        entries.push({
          url: `${BASE_URL}/${slug}/values`,
          changeFrequency: 'daily',
          priority: 0.85,
        })
      }
      if (theme.pages.calculator) {
        // Canonical calculator route. The old /value-calculator +
        // /trade-calculator URLs 301 here (next.config.js), so we emit only the
        // live one to avoid pointing Google at a redirect and splitting equity.
        entries.push({
          url: `${BASE_URL}/${slug}/calculator`,
          changeFrequency: 'weekly',
          priority: 0.8,
        })
      }
      for (const extra of extraPathsByGame[slug] ?? []) {
        entries.push({
          url: `${BASE_URL}/${slug}/${extra.path}`,
          changeFrequency: extra.changeFrequency,
          priority: extra.priority,
        })
      }
      if (theme.pages.methodology) {
        // E-E-A-T / AI-citability: how we source & calculate values.
        entries.push({
          url: `${BASE_URL}/${slug}/values/methodology`,
          changeFrequency: 'monthly',
          priority: 0.5,
        })
      }
      if (theme.pages.priceIndex) {
        // Price Index — the citable data-story / link-magnet page.
        entries.push({
          url: `${BASE_URL}/${slug}/price-index`,
          changeFrequency: 'daily',
          priority: 0.7,
        })
      }
      for (const item of itemsByGame[slug] ?? []) {
        if (!item.slug) continue
        entries.push({
          url: `${BASE_URL}/${slug}/values/${item.slug}`,
          // Prices refresh daily via the snapshot cron — advertise real freshness.
          ...(item.updated_at
            ? { lastModified: new Date(item.updated_at) }
            : {}),
          changeFrequency: 'daily' as const,
          priority: 0.7,
        })
      }
      return entries
    },
  )

  return [
    ...staticPages,
    ...legalPages,
    ...blogPages,
    ...gameBlogIndexPages,
    ...gameBlogPages,
    ...landingPages,
    ...hubPages,
    ...gamePages,
    ...sellPages,
    ...categoryPages,
    ...listingPages,
  ]
}
