/**
 * Step 7a — the blog hub is a closed set (dynamicParams = false), so its
 * prerender list must cover every hub that is reachable today: the content-hub
 * games AND any game that already has a published post (`/valorant/blog` is
 * in the sitemap with one post and no theme). Missing one turns a live URL
 * into a static 404 on deploy.
 */
import { describe, it, expect, vi } from 'vitest'

// React.cache() only exists in the react-server build; vitest loads the
// client build, so the modules this pulls in (lib/blog/db) fail at import.
// Identity is exactly its semantics within one request/test.
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  cache: (fn: unknown) => fn,
}))

import { getBlogHubGameSlugs, isBlogHubGame } from './hub-params'

const post = (primaryGameSlug: string | null) => ({ primaryGameSlug })

describe('getBlogHubGameSlugs', () => {
  it('unions the content-hub games with games that have a published post', async () => {
    const slugs = await getBlogHubGameSlugs(
      ['steal-a-brainrot', 'adopt-me'],
      async () => [post('valorant'), post('adopt-me'), post(null), post('valorant')],
    )
    expect(slugs).toEqual(['adopt-me', 'steal-a-brainrot', 'valorant'])
  })

  it('is the hub games alone when no post names a game', async () => {
    const slugs = await getBlogHubGameSlugs(['steal-a-brainrot'], async () => [post(null)])
    expect(slugs).toEqual(['steal-a-brainrot'])
  })

  it('does not drop a hub game when the post loader fails', async () => {
    // A transient DB error at build time must not shrink the prerender set:
    // with dynamicParams=false that would 404 a live hub until the next deploy.
    const slugs = await getBlogHubGameSlugs(['adopt-me'], async () => {
      throw new Error('db down')
    })
    expect(slugs).toEqual(['adopt-me'])
  })
})

/**
 * Runtime twin of the static set. `dynamicParams = false` is NOT enforced on
 * Vercel: Next only throws its fallback-false 404 outside minimal mode
 * (base-server.js), and the preview served /rust/blog and /cs2/blog as 200
 * empty hubs. The page must 404 in its own body, by the same rule.
 */
describe('isBlogHubGame', () => {
  it('is true for a content-hub game even with no posts yet', () => {
    expect(isBlogHubGame('steal-an-egg', [], ['steal-an-egg'])).toBe(true)
  })
  it('is true for a non-hub game that has a published post', () => {
    expect(isBlogHubGame('valorant', [post('valorant')], ['adopt-me'])).toBe(true)
  })
  it('is false for a game with neither (the 233 empty hubs)', () => {
    expect(isBlogHubGame('rust', [], ['adopt-me', 'steal-a-brainrot'])).toBe(false)
  })
})
