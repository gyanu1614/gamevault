'use server'

import { createClient } from '@/lib/supabase/server'

/**
 * Debug action to check what's actually in the listings table
 */
export async function debugListings() {
  const supabase = await createClient()

  // Check all listings
  const { data: allListings, error: listingsError } = await supabase
    .from('listings')
    .select('id, slug, title, game_id, category_id, status, seller_id')
    .limit(20)

  // Check all games
  const { data: games, error: gamesError } = await supabase
    .from('games')
    .select('id, slug, name')
    .limit(20)

  // Check all categories
  const { data: categories, error: categoriesError } = await supabase
    .from('categories')
    .select('id, slug, name')
    .limit(20)

  // Check for test listings specifically
  const { data: testListings, error: testError } = await supabase
    .from('listings')
    .select('*')
    .in('slug', [
      'valorant-radiant-account-5000-vp-all-agents',
      'roblox-premium-account-level-250-100k-robux',
      'fortnite-og-account-rare-skins-stacked',
    ])

  return {
    success: true,
    data: {
      allListings: { data: allListings, error: listingsError },
      games: { data: games, error: gamesError },
      categories: { data: categories, error: categoriesError },
      testListings: { data: testListings, error: testError }
    }
  }
}
