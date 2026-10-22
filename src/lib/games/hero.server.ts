import 'server-only'
import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { createAnonClient } from '@/lib/supabase/anon'
import { gameHeroTag } from '@/lib/revalidation/tags'
import { mediaUrl } from '@/lib/images/media-url'
import { GAME_HERO_COLUMNS, heroSrcSetAttr, resolveGameHero, type GameHero, type GameHeroRow } from './hero'

/**
 * The hero background for one game — the read behind GameHeroBackdrop.
 *
 * Cookie-free (anon client) and `unstable_cache`d per game under
 * `gameHeroTag(slug)`, so it never makes a route dynamic and a build reads
 * each game once, however many of its pages are prerendered. The tag also
 * lands on every page that renders the backdrop, so the admin upload's
 * `revalidateTag(gameHeroTag(slug))` refreshes exactly that game's pages.
 *
 * A read error (e.g. the columns not pushed yet) or an unknown game resolves
 * to the static art / neutral fallback — never a 500.
 */
async function readHeroRow(slug: string): Promise<GameHeroRow | null> {
  try {
    const { data, error } = await (createAnonClient() as any)
      .from('games')
      .select(GAME_HERO_COLUMNS)
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle()
    if (error || !data) return null
    return data as GameHeroRow
  } catch {
    return null
  }
}

export const getGameHero = cache(async function getGameHero(slug: string): Promise<GameHero> {
  const row = await unstable_cache(() => readHeroRow(slug), ['game-hero-v1', slug], {
    tags: [gameHeroTag(slug)],
    revalidate: 86400,
  })()
  return heroViaMedia(resolveGameHero(slug, row, process.env.NEXT_PUBLIC_SUPABASE_URL))
})

/**
 * The page renders the hero through /media (Vercel CDN), not straight from
 * Storage (2026-10-20 usage audit). Done here, not in ./hero: that module is
 * loaded by Node's type-stripper for the import script and stays self-contained.
 */
export function heroViaMedia(hero: GameHero): GameHero {
  if (hero.kind !== 'upload') return hero
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const via = (url: string) => mediaUrl(url, supabaseUrl)
  return {
    ...hero,
    src: via(hero.src),
    srcSet: heroSrcSetAttr(hero.sources.map((s) => ({ ...s, url: via(s.url) }))),
  }
}
