import { describe, it, expect } from 'vitest'
import { hubToolLinks } from '@/lib/content/hub-links'
import { CONTENT_HUB_GAME_SLUGS, hasHubPage } from '@/lib/content/theme'

const hrefs = (slug: string) => hubToolLinks(slug).map((l) => l.href)

describe('hubToolLinks', () => {
  it('links every hub game with a value list to it, then its calculator', () => {
    expect(hrefs('adopt-me')).toEqual(['/adopt-me/values', '/adopt-me/calculator'])
    expect(hrefs('steal-a-brainrot')).toEqual(['/steal-a-brainrot/values', '/steal-a-brainrot/calculator'])
  })

  it('falls back to the inventory worth tool when a game has no WFL calculator', () => {
    expect(hrefs('murder-mystery-2')).toEqual(['/murder-mystery-2/values', '/murder-mystery-2/inventory'])
  })

  it('links the value list alone when a game publishes no calculator of either kind', () => {
    expect(hrefs('steal-an-egg')).toEqual(['/steal-an-egg/values'])
  })

  it('links nothing for a game without a content hub', () => {
    expect(hubToolLinks('fortnite')).toEqual([])
  })

  it('only ever links pages the game publishes (an unpublished hub page 404s)', () => {
    for (const slug of CONTENT_HUB_GAME_SLUGS) {
      for (const link of hubToolLinks(slug)) {
        expect(hasHubPage(slug, link.tool), link.href).toBe(true)
      }
    }
  })

  it('writes keyword anchors for the footer and short labels for the sub-nav', () => {
    const [values, calc] = hubToolLinks('adopt-me')
    expect(values).toMatchObject({ footerLabel: 'Value List', tabLabel: 'Values' })
    expect(calc).toMatchObject({ footerLabel: 'Value Calculator', tabLabel: 'Calculator' })
  })
})
