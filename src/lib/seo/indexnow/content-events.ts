import { isGameHubIndexable, isGameSellPageIndexable } from '@/lib/games/indexability'

import { submitIndexNow, type SubmitFn } from './submit'

/** Blog posts and game hubs: the content sections other than listings and values. */

export type PostEvent = 'published' | 'edited' | 'removed'

/** A post and the blog index that lists it. */
export function postEventUrls(post: { gameSlug: string | null; slug: string }): string[] {
  return post.gameSlug
    ? [`/${post.gameSlug}/blog/${post.slug}`, `/${post.gameSlug}/blog`]
    : [`/blog/${post.slug}`, '/blog']
}

export async function submitPostEvent(
  event: PostEvent,
  post: { gameSlug: string | null; slug: string },
  deps: { submit?: SubmitFn } = {},
): Promise<void> {
  try {
    await (deps.submit ?? ((u, o) => submitIndexNow(u, o)))(postEventUrls(post), { reason: `post-${event}` })
  } catch (e) {
    console.error('[indexnow] post submission failed (non-fatal):', e)
  }
}

export interface GameLiveInfo {
  slug: string
  contentTier: string | null
  seoIndexable: boolean | null
  enabledCategoryCount: number
  activeListingCount: number
}

/**
 * Pages of a game that just went live, using the SAME verdicts as the pages'
 * robots meta and the sitemap: a hub that will say noindex is not advertised.
 */
export function gameLiveUrls(game: GameLiveInfo): string[] {
  const urls: string[] = []
  if (
    isGameHubIndexable({
      contentTier: game.contentTier,
      activeListingCount: game.activeListingCount,
      hasCuratedCurrencyConfig: false,
      seoIndexable: game.seoIndexable,
    })
  ) {
    urls.push(`/${game.slug}`)
  }
  if (isGameSellPageIndexable({ enabledCategoryCount: game.enabledCategoryCount, seoIndexable: game.seoIndexable })) {
    urls.push(`/${game.slug}/sell`)
  }
  return urls
}

/** A game switched off: its pages now 404, so engines should look again. */
export function gameRemovedUrls(slug: string): string[] {
  return [`/${slug}`, `/${slug}/sell`]
}

export async function submitGameLive(game: GameLiveInfo, deps: { submit?: SubmitFn } = {}): Promise<void> {
  try {
    const urls = gameLiveUrls(game)
    if (urls.length > 0) await (deps.submit ?? ((u, o) => submitIndexNow(u, o)))(urls, { reason: 'game-live' })
  } catch (e) {
    console.error('[indexnow] game submission failed (non-fatal):', e)
  }
}

export async function submitGameRemoved(slug: string, deps: { submit?: SubmitFn } = {}): Promise<void> {
  try {
    await (deps.submit ?? ((u, o) => submitIndexNow(u, o)))(gameRemovedUrls(slug), { reason: 'game-removed' })
  } catch (e) {
    console.error('[indexnow] game submission failed (non-fatal):', e)
  }
}

type Db = any

/**
 * Read a game and submit its pages if it is live: for the admin paths that
 * create, activate or add a category to a game. Never throws.
 */
export async function submitGameIfLive(db: Db, gameId: string, deps: { submit?: SubmitFn } = {}): Promise<void> {
  try {
    const { data: game } = await db
      .from('games')
      .select('slug, is_active, content_tier, seo_indexable')
      .eq('id', gameId)
      .maybeSingle()
    if (!game?.is_active) return
    const [{ count: categories }, { count: listings }] = await Promise.all([
      db.from('game_categories').select('id', { count: 'exact', head: false }).eq('game_id', gameId).eq('is_enabled', true).limit(1),
      db.from('listings').select('id', { count: 'exact', head: false }).eq('game_id', gameId).eq('status', 'active').limit(1),
    ])
    await submitGameLive(
      {
        slug: game.slug,
        contentTier: game.content_tier ?? null,
        seoIndexable: game.seo_indexable ?? null,
        enabledCategoryCount: categories ?? 0,
        activeListingCount: listings ?? 0,
      },
      deps,
    )
  } catch (e) {
    console.error('[indexnow] game submission failed (non-fatal):', e)
  }
}
