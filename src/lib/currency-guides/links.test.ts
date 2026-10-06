import { describe, it, expect } from 'vitest'
import { buildGuideLinks, currencyLinkLabel } from './links'
import { getCurrencyGuide, guideFamily } from './index'

const directory = {
  games: [
    { id: 'g-rb', slug: 'roblox', name: 'Roblox', image_url: null, sort_order: 1 },
    { id: 'g-fn', slug: 'fortnite', name: 'Fortnite', image_url: '/f.png', sort_order: 2 },
    { id: 'g-bb', slug: 'blade-ball', name: 'Blade Ball', image_url: null, sort_order: 5 },
    { id: 'g-sot', slug: 'sea-of-thieves', name: 'Sea of Thieves', image_url: null, sort_order: 3 },
    { id: 'g-cod', slug: 'call-of-duty', name: 'Call of Duty', image_url: null, sort_order: 4 },
    { id: 'g-nocur', slug: 'adopt-me', name: 'Adopt Me', image_url: null, sort_order: 0 },
  ],
  categories: [
    { game_id: 'g-rb', slug: 'buy-robux', name: 'Robux', type: 'currency' },
    { game_id: 'g-rb', slug: 'items', name: 'Items', type: 'items' },
    { game_id: 'g-rb', slug: 'accounts', name: 'Accounts', type: 'account' },
    { game_id: 'g-fn', slug: 'buy-vbucks', name: 'V-Bucks', type: 'currency' },
    { game_id: 'g-bb', slug: 'buy-tokens', name: 'Tokens', type: 'currency' },
    { game_id: 'g-sot', slug: 'buy-ancient-coins', name: 'Ancient Coins', type: 'currency' },
    { game_id: 'g-cod', slug: 'buy-cod-points', name: 'Points', type: 'currency' },
    { game_id: 'g-nocur', slug: 'pets', name: 'Pets', type: 'items' },
  ],
}

function links(slug: string, name: string, extra: { hasValues?: boolean } = {}) {
  const guide = getCurrencyGuide(slug)!
  return buildGuideLinks({
    gameSlug: slug,
    gameName: name,
    family: guideFamily(guide),
    directory,
    hasValues: extra.hasValues ?? false,
    hasCalculator: false,
    guideFor: getCurrencyGuide,
    familyOf: guideFamily,
  })
}

describe('buildGuideLinks', () => {
  it("lists the game's hub and its other categories, never its own currency page", () => {
    const { game } = links('roblox', 'Roblox', { hasValues: true })
    expect(game.map((l) => l.href)).toEqual(['/roblox', '/roblox/items', '/roblox/accounts', '/roblox/values'])
    expect(game.map((l) => l.label)).toContain('Roblox Items')
  })

  it('related: other games with a currency page, guide + same family first, max 4', () => {
    const { related } = links('roblox', 'Roblox')
    expect(related[0].href).toBe('/blade-ball/buy-tokens') // Roblox experience with a guide
    expect(related.map((l) => l.href)).not.toContain('/roblox/buy-robux')
    expect(related.map((l) => l.href)).not.toContain('/adopt-me/pets') // no currency page
    expect(related.length).toBeLessThanOrEqual(4)
  })

  it('labels read naturally', () => {
    expect(currencyLinkLabel('Fortnite', 'V-Bucks')).toBe('Fortnite V-Bucks')
    expect(currencyLinkLabel('Blade Ball', 'Blade Ball Tokens')).toBe('Blade Ball Tokens')
    expect(currencyLinkLabel('Call of Duty', 'COD Points')).toBe('COD Points')
    expect(currencyLinkLabel('GTA V', 'GTA$')).toBe('GTA$')
  })
})
