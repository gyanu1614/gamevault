import { describe, expect, it } from 'vitest'
import { CONTENT_HUB_GAME_SLUGS, blogHubCopy, contentHubSlugsFor, getGameContentTheme } from './theme'

describe('blog hub copy and gating', () => {
  it('every content-hub game has a blog (one shared blog home)', () => {
    expect(contentHubSlugsFor('blog').sort()).toEqual([...CONTENT_HUB_GAME_SLUGS].sort())
  })
  it('the blog H1 is blog copy, never the value list heading', () => {
    expect(blogHubCopy('murder-mystery-2', 'Murder Mystery 2').title).toBe('MM2 Guides')
    expect(blogHubCopy('adopt-me', 'Adopt Me').title).toBe('Adopt Me Guides')
    for (const slug of CONTENT_HUB_GAME_SLUGS) {
      const copy = blogHubCopy(slug, slug)
      expect(copy.title).not.toBe(getGameContentTheme(slug).heroTitle)
      expect(copy.lead).not.toBe(getGameContentTheme(slug).heroLead)
      expect(copy.lead.length).toBeGreaterThan(20)
    }
  })
  it('a game without a theme falls back to "<Game> Guides"', () => {
    expect(blogHubCopy('valorant', 'Valorant').title).toBe('Valorant Guides')
  })
})
