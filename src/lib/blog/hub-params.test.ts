/**
 * Blog v2 (2026-10-13): a game has a blog hub when an admin has switched its
 * content hub on (games.content_hub_enabled, Admin → Games → "Guides &
 * content"). Posts no longer open a hub on their own: the picker and the hubs
 * show only games with content, and the owner decides which those are.
 *
 * The prerender list is still a closed set (dynamicParams = false), so a DB
 * hiccup at build time must not shrink it below the compile-time hub games.
 */
import { describe, it, expect, vi } from 'vitest'

// React.cache() only exists in the react-server build; vitest loads the
// client build, so the modules this pulls in fail at import. Identity is
// exactly its semantics within one request/test.
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  cache: (fn: unknown) => fn,
}))

import { getBlogHubGameSlugs, isBlogHubGame } from './hub-params'

describe('getBlogHubGameSlugs', () => {
  it('is the games switched on in admin, sorted', async () => {
    expect(await getBlogHubGameSlugs(async () => ['steal-an-egg', 'adopt-me'], ['steal-a-brainrot'])).toEqual(['adopt-me', 'steal-an-egg'])
  })
  it('falls back to the compile-time hub games when the switch list cannot be read', async () => {
    expect(await getBlogHubGameSlugs(async () => { throw new Error('db down') }, ['adopt-me'])).toEqual(['adopt-me'])
    // getAllGames returns [] on a read error rather than throwing.
    expect(await getBlogHubGameSlugs(async () => [], ['adopt-me'])).toEqual(['adopt-me'])
  })
})

describe('isBlogHubGame', () => {
  it('is true only for a game that is switched on', () => {
    expect(isBlogHubGame('steal-an-egg', ['steal-an-egg', 'adopt-me'])).toBe(true)
    expect(isBlogHubGame('rust', ['steal-an-egg', 'adopt-me'])).toBe(false)
  })
})
