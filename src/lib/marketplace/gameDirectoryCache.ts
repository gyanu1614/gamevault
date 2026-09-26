import { unstable_cache } from 'next/cache'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Shared cache tag + cached reader for the public game/category directory.
 *
 * FooterGameLinks renders on EVERY route via the root layout. It used to read
 * through the cookie-bound server client, and because cookies() is a dynamic
 * API that single read opted all 158 page routes out of static rendering —
 * including the 17 (legal) pages, which fetch nothing at all.
 *
 * The read uses a plain anon client (NO cookies) so it is safe to memoize
 * inside unstable_cache — a cookie-bound server client cannot be cached.
 * Admin game/category mutations call revalidateTag(GAME_DIRECTORY_TAG) so the
 * directory picks up edits immediately instead of waiting out the hour.
 */
export const GAME_DIRECTORY_TAG = 'game-directory'

function anonClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export interface DirectoryGameRow {
  id: string
  slug: string
  name: string
  sort_order: number | null
}

export interface DirectoryCategoryRow {
  game_id: string
  slug: string
  name: string | null
  type: string | null
}

/**
 * Active games + their active categories — the two reads the footer directory
 * needs. Cached + tagged so every route can render it statically.
 */
export const getCachedGameDirectory = unstable_cache(
  async (): Promise<{ games: DirectoryGameRow[]; categories: DirectoryCategoryRow[] }> => {
    const supabase = anonClient()
    const [gamesResult, categoriesResult] = await Promise.all([
      supabase
        .from('games')
        .select('id, slug, name, is_active, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .limit(24),
      supabase
        .from('game_categories')
        .select('game_id, slug, name, type, sort_order, is_enabled')
        .eq('is_enabled', true)
        .order('sort_order', { ascending: true }),
    ])
    return {
      games: (gamesResult.data as unknown as DirectoryGameRow[] | null) ?? [],
      categories: (categoriesResult.data as unknown as DirectoryCategoryRow[] | null) ?? [],
    }
  },
  ['game-directory'],
  { tags: [GAME_DIRECTORY_TAG], revalidate: 3600 },
)
