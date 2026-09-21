import { unstable_cache } from 'next/cache'
import { createAnonClient } from '@/lib/supabase/anon'
import { GAME_DIRECTORY_TAG } from '@/lib/revalidation/tags'

export interface DirectoryGame {
  slug: string
  name: string
  imageUrl: string | null
  categories: { slug: string; label: string }[]
}

/**
 * Every active game with its enabled categories — the footer directory mesh
 * rendered under every marketplace page (Step 7b: one tagged cache entry per
 * build/hour instead of two queries on each of ~600 prerendered pages).
 * Admin game/category changes are covered by the hourly revalidate and the
 * nightly full revalidate; revalidateTag(GAME_DIRECTORY_TAG) forces it.
 */
export const getGameDirectory = unstable_cache(
  async (): Promise<DirectoryGame[]> => {
    const supabase = createAnonClient()

    const { data: games } = (await supabase
      .from('games')
      .select('id, slug, name, image_url, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })) as {
      data: { id: string; slug: string; name: string; image_url: string | null }[] | null
    }
    const list = games ?? []
    if (list.length === 0) return []

    const { data: cats } = (await supabase
      .from('game_categories')
      .select('game_id, slug, name, sort_order')
      .in('game_id', list.map((g) => g.id))
      .eq('is_enabled', true)
      .order('sort_order', { ascending: true })) as unknown as {
      data: { game_id: string; slug: string; name: string | null; sort_order: number | null }[] | null
    }

    const catsByGame = new Map<string, { slug: string; label: string }[]>()
    for (const c of cats ?? []) {
      const label =
        c.name ||
        c.slug.replace(/^buy-/, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase())
      const arr = catsByGame.get(c.game_id)
      if (arr) arr.push({ slug: c.slug, label })
      else catsByGame.set(c.game_id, [{ slug: c.slug, label }])
    }

    return list
      .map((g) => ({
        slug: g.slug,
        name: g.name,
        imageUrl: g.image_url,
        categories: catsByGame.get(g.id) ?? [],
      }))
      .filter((g) => g.categories.length > 0)
  },
  ['game-directory'],
  { tags: [GAME_DIRECTORY_TAG], revalidate: 3600 },
)
