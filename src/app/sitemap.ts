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
import { getAllLandingPageSlugs } from '@/lib/seo/landingPages'
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
          game:games!listings_game_id_fkey(slug),
          category:categories!listings_category_id_fkey(slug)
        `
        )
        .eq('status', 'active'),
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
  const landingPages: MetadataRoute.Sitemap = getAllLandingPageSlugs().map((slug) => ({
    url: `${BASE_URL}/buy/${slug}`,
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
      url: `${BASE_URL}/steal-a-brainrot/value-calculator`,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    ...((sabBrainrots ?? []) as { slug: string }[])
      .filter((brainrot) => Boolean(brainrot.slug))
      .map((brainrot) => ({
        url: `${BASE_URL}/steal-a-brainrot/values/${brainrot.slug}`,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      })),
  ]

  return [
    ...staticPages,
    ...legalPages,
    ...blogPages,
    ...landingPages,
    ...sabPages,
    ...gamePages,
    ...categoryPages,
    ...listingPages,
  ]
}
