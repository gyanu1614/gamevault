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
import { isLandingPageIndexable } from '@/lib/seo/landingPageInventory'
import { LEGAL_DOCS } from '@/lib/legal/documents'
import { getAllPosts } from '@/lib/blog/posts'

import { SITE_URL } from '@/config/site'

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

  // Blog — index + articles. publishedAt is a real date, so it's an
  // honest lastmod; the index takes the newest post's date.
  const posts = getAllPosts()
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
    ...posts.map((post) => ({
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
        .select('id, slug')
        .eq('is_active', true) as unknown as Promise<{
        data: { id: string; slug: string }[] | null
      }>,
      supabase
        .from('listings')
        .select(
          `
          slug,
          updated_at,
          seller:profiles!listings_seller_id_fkey!inner(is_test),
          game:games!listings_game_id_fkey(slug),
          category:categories!listings_category_id_fkey(slug)
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
    .from('categories')
    .select('slug, game_id, game:games!categories_game_id_fkey(slug)')
    .eq('is_active', true)
    .filter('metadata->>type', 'eq', 'currency')) as unknown as {
    data: { slug: string; game_id: string; game: { slug: string } | null }[] | null
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

  // Game hubs — only games with ≥1 active listing OR a curated currency
  // config. Empty hubs with neither stay out of the sitemap (they
  // self-mark noindex on the page).
  const gamePages: MetadataRoute.Sitemap = (games ?? [])
    .filter((game) => activeGameSlugs.has(game.slug) || curatedGameIds.has(game.id))
    .map((game) => {
      const lastmod = gameLastmod.get(game.slug)
      return {
        url: `${BASE_URL}/${game.slug}`,
        ...(lastmod ? { lastModified: new Date(lastmod) } : {}),
        changeFrequency: 'daily' as const,
        priority: 0.8,
      }
    })

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

  const sabPages: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/steal-a-brainrot/values`,
      changeFrequency: 'daily',
      priority: 0.85,
    },
    {
      // Canonical calculator route. The old /value-calculator + /trade-calculator
      // URLs 301 here (next.config.js), so we emit only the live one to avoid
      // pointing Google at a redirect and splitting equity between two URLs.
      url: `${BASE_URL}/steal-a-brainrot/calculator`,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      // E-E-A-T / AI-citability: how we source & calculate values.
      url: `${BASE_URL}/steal-a-brainrot/values/methodology`,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      // Price Index — the citable data-story / link-magnet page.
      url: `${BASE_URL}/steal-a-brainrot/price-index`,
      changeFrequency: 'daily',
      priority: 0.7,
    },
    ...((sabBrainrots ?? []) as { slug: string }[])
      .filter((brainrot) => Boolean(brainrot.slug))
      .map((brainrot) => ({
        url: `${BASE_URL}/steal-a-brainrot/values/${brainrot.slug}`,
        // Prices refresh daily via the snapshot cron — advertise real freshness.
        changeFrequency: 'daily' as const,
        priority: 0.7,
      })),
  ]

  return [
    ...staticPages,
    ...legalPages,
    ...blogPages,
    ...gameBlogIndexPages,
    ...gameBlogPages,
    ...landingPages,
    ...sabPages,
    ...gamePages,
    ...categoryPages,
    ...listingPages,
  ]
}
