/**
 * The (game → enabled categories) catalogue behind the navbar's category
 * menus and search, and the homepage hero search.
 *
 * One query definition so both share React Query's cache under one key:
 * whichever mounts first fetches, the other reads the cached rows. Browser
 * client (it runs after hydration), so it never touches the static page's
 * server render.
 */

export interface NavCategoryRow {
  slug: string
  name: string | null
  type: string | null
  game_id: string
  game: {
    name: string
    slug: string
    emoji: string | null
    image_url: string | null
    sort_order: number | null
  } | null
}

export const navCategoriesQuery = {
  queryKey: ['nav-categories'] as const,
  queryFn: async (): Promise<NavCategoryRow[]> => {
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    const { data } = await supabase
      .from('game_categories')
      .select('slug, name, type, game_id, game:games!game_categories_game_id_fkey(name, slug, emoji, image_url, sort_order)')
      .eq('is_enabled', true)
      .order('sort_order')
    return (data as unknown as NavCategoryRow[]) || []
  },
  staleTime: 1000 * 60 * 5,
}
