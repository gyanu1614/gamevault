import { describe, it, expect } from 'vitest'
import { gameTools } from './tools'
import { CONTENT_HUB_GAME_SLUGS, hasHubPage } from '@/lib/content/theme'

describe('gameTools', () => {
  it('lists the tool pages Adopt Me publishes, the trade calculator first and featured', () => {
    const t = gameTools('adopt-me', 'Adopt Me', 'Pets')
    expect(t[0]).toMatchObject({ key: 'calculator', featured: true, href: '/adopt-me/calculator' })
    expect(t.filter((x) => x.featured)).toHaveLength(1)
    const keys = t.map((x) => x.key)
    expect(keys).toContain('values')
    expect(keys).toContain('neon')
  })

  it('words questions with the game and its items', () => {
    const values = gameTools('adopt-me', 'Adopt Me', 'Pets').find((x) => x.key === 'values')
    expect(values?.question).toBe('What Are My Pets Worth?')
  })

  it('gives no tools to a game without a content hub', () => {
    expect(gameTools('fortnite', 'Fortnite', 'Items')).toEqual([])
  })

  it('only ever links a page the game publishes', () => {
    for (const slug of CONTENT_HUB_GAME_SLUGS) {
      for (const tool of gameTools(slug, slug, 'Items')) {
        if (tool.key === 'neon') continue
        const page = tool.key as Parameters<typeof hasHubPage>[1]
        expect(hasHubPage(slug, page), tool.href).toBe(true)
      }
    }
  })

  it('features the first tool when a game has no trade calculator', () => {
    const t = gameTools('murder-mystery-2', 'Murder Mystery 2', 'Items')
    expect(t.length).toBeGreaterThan(0)
    expect(t[0].featured).toBe(true)
    expect(t.filter((x) => x.featured)).toHaveLength(1)
  })
})
