/**
 * Step 7a — the category OG image's data is built by a function that takes
 * its fetcher, so two things are pinned without rendering an image:
 *
 *  - it reads `game_categories` (the ONLY category table app code may read;
 *    it used to query the legacy `public.categories`, which Phase B drops),
 *  - the sub-line formats as "From $X · N Offers · Instant Delivery" and
 *    degrades to prettified slugs when a read fails.
 */
import { describe, it, expect } from 'vitest'
import { buildCategoryOgData, type OgFetcher } from './_ogData'

function fetcherFor(routes: Record<string, { rows: unknown[]; total?: number | null } | null>): {
  fetch: OgFetcher
  paths: string[]
} {
  const paths: string[] = []
  const fetch: OgFetcher = async (pathWithQuery) => {
    paths.push(pathWithQuery)
    const key = Object.keys(routes).find((prefix) => pathWithQuery.startsWith(prefix))
    const hit = key ? routes[key] : null
    return hit ? { rows: hit.rows as never[], total: hit.total ?? null } : null
  }
  return { fetch, paths }
}

describe('buildCategoryOgData', () => {
  it('resolves names through game_categories and formats the live sub-line', async () => {
    const f = fetcherFor({
      'games?': { rows: [{ id: 'g1', name: 'Roblox' }] },
      'game_categories?': { rows: [{ id: 'c1', name: 'Robux' }] },
      'listings?': { rows: [{ price: '1.99' }], total: 3 },
    })
    await expect(buildCategoryOgData('roblox', 'buy-robux', f.fetch)).resolves.toEqual({
      gameName: 'Roblox',
      categoryName: 'Robux',
      subtitle: 'From $1.99 · 3 Offers · Instant Delivery',
    })
    const categoryPath = f.paths.find((p) => p.startsWith('game_categories?'))
    expect(categoryPath).toMatch(/slug=eq\.buy-robux/)
    expect(categoryPath).toMatch(/game_id=eq\.g1/)
    expect(categoryPath).toMatch(/is_enabled=eq\.true/)
    expect(f.paths.some((p) => p.startsWith('categories?'))).toBe(false)
  })

  it('says "Offer" for one and keeps the generic sub-line with no listings', async () => {
    const one = fetcherFor({
      'games?': { rows: [{ id: 'g1', name: 'Roblox' }] },
      'game_categories?': { rows: [{ id: 'c1', name: 'Robux' }] },
      'listings?': { rows: [{ price: 4 }], total: 1 },
    })
    expect((await buildCategoryOgData('roblox', 'buy-robux', one.fetch)).subtitle).toBe(
      'From $4 · 1 Offer · Instant Delivery',
    )
    const none = fetcherFor({
      'games?': { rows: [{ id: 'g1', name: 'Roblox' }] },
      'game_categories?': { rows: [{ id: 'c1', name: 'Robux' }] },
      'listings?': { rows: [], total: 0 },
    })
    expect((await buildCategoryOgData('roblox', 'buy-robux', none.fetch)).subtitle).toBe(
      'Verified Sellers · Instant Delivery',
    )
  })

  it('degrades to prettified slugs when the reads fail', async () => {
    const f = fetcherFor({})
    await expect(buildCategoryOgData('grow-a-garden', 'buy-sheckles', f.fetch)).resolves.toEqual({
      gameName: 'Grow A Garden',
      categoryName: 'Buy Sheckles',
      subtitle: 'Verified Sellers · Instant Delivery',
    })
  })
})
