import 'server-only'
import { unstable_cache } from 'next/cache'
import { createAnonClient } from '@/lib/supabase/anon'
import { GAME_CTA_BANNERS_TAG } from '@/lib/revalidation/tags'
import { gameCtaImage } from './game-cta-art'

/**
 * Every active game's admin CTA banner (games.blog_cta_image_url), keyed by
 * slug. ONE cookie-free cached read shared by every CTA band on every public
 * page, so it never makes a route dynamic. Its own tag (not the site-wide
 * game directory): a banner upload refreshes only the pages with a CTA band,
 * instead of every page on the site (2026-10-06 cache audit).
 */
const getCtaBannerMap = unstable_cache(
  async (): Promise<Record<string, string | null>> => {
    try {
      const supabase = createAnonClient()
      const { data, error } = await (supabase as any)
        .from('games')
        .select('slug, blog_cta_image_url')
        .eq('is_active', true)
      // Column missing on a stack that's behind → static art, never a 500.
      if (error) return {}
      const map: Record<string, string | null> = {}
      for (const row of (data ?? []) as Array<{ slug: string; blog_cta_image_url: string | null }>) {
        map[row.slug] = row.blog_cta_image_url
      }
      return map
    } catch {
      return {}
    }
  },
  ['game-cta-banners'],
  { tags: [GAME_CTA_BANNERS_TAG], revalidate: 86400 },
)

/** The ONE CTA background for a game (admin upload → static art). */
export async function getGameCtaImage(gameSlug: string): Promise<string> {
  const map = await getCtaBannerMap()
  return gameCtaImage({ slug: gameSlug, ctaImageUrl: map[gameSlug] ?? null })
}
