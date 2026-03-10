/**
 * Dynamic Sitemap Generator
 *
 * Generates sitemap with all pages, games, categories, and listings
 */

import { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getAllLandingPageSlugs } from '@/lib/seo/landingPages'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://gamevault.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient()

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    // /marketplace redirects to / — no separate sitemap entry needed
    {
      url: `${BASE_URL}/vaultshield`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/seller/register`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
  ]

  // Fetch games
  const { data: games } = await supabase
    .from('games')
    .select('slug, updated_at')
    .eq('is_active', true) as { data: { slug: string; updated_at: string }[] | null }

  const gamePages: MetadataRoute.Sitemap =
    games?.map((game) => ({
      url: `${BASE_URL}/${game.slug}`,
      lastModified: new Date(game.updated_at ?? new Date()),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })) || []

  // Fetch game + category combinations
  const { data: listings } = await supabase
    .from('listings')
    .select(
      `
      slug,
      updated_at,
      game:games!listings_game_id_fkey(slug),
      category:categories!listings_category_id_fkey(slug)
    `
    )
    .eq('status', 'active')

  // Get unique game + category combinations
  const gameCategoryPairs = new Set<string>()
  listings?.forEach((listing: any) => {
    if (listing.game?.slug && listing.category?.slug) {
      gameCategoryPairs.add(`${listing.game.slug}/${listing.category.slug}`)
    }
  })

  const categoryPages: MetadataRoute.Sitemap = Array.from(gameCategoryPairs).map(
    (pair) => ({
      url: `${BASE_URL}/${pair}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.7,
    })
  )

  // Listing pages
  const listingPages: MetadataRoute.Sitemap =
    listings?.map((listing: any) => ({
      url: `${BASE_URL}/${listing.game.slug}/${listing.category.slug}/${listing.slug}`,
      lastModified: new Date(listing.updated_at),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })) || []

  // SEO landing pages
  const landingPages: MetadataRoute.Sitemap = getAllLandingPageSlugs().map((slug) => ({
    url: `${BASE_URL}/buy/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.75,
  }))

  return [...staticPages, ...landingPages, ...gamePages, ...categoryPages, ...listingPages]
}
