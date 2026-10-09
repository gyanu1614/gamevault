import { describe, expect, it, vi } from 'vitest'
import { buildValueCatalog } from '@/lib/value-listings/catalogs'
import { resolveMarketPriceHint, type HintDeps, type HintInput } from './resolve'

const NOW = new Date('2026-10-08T12:00:00Z')
const FRESH = '2026-10-07T12:00:00Z'

const sab = buildValueCatalog('steal-a-brainrot', {
  items: [
    { slug: 'dragon-cannelloni', name: 'Dragon Cannelloni' },
    { slug: 'garama-and-madundung', name: 'Garama and Madundung' },
  ],
  mutations: [
    { slug: 'default', name: 'Default' },
    { slug: 'gold', name: 'Gold' },
  ],
})!
const am = buildValueCatalog('adopt-me', {
  items: [{ slug: 'bat-dragon', name: 'Bat Dragon' }],
})!

function deps(over: Partial<HintDeps> = {}): HintDeps {
  return {
    loadCatalog: vi.fn(async (game: string) => (game === 'steal-a-brainrot' ? sab : game === 'adopt-me' ? am : null)),
    loadItemPrice: vi.fn(async () => ({ usd: 18.99, offers: 12, updatedAt: FRESH, isEstimate: false })),
    loadCurrencyOffers: vi.fn(async () => [
      { price: 3.5, stock: 100, minQty: 1, unlimited: false },
      { price: 3.8, stock: 100, minQty: 1, unlimited: false },
      { price: 4.2, stock: 100, minQty: 1, unlimited: false },
    ]),
    now: () => NOW,
    ...over,
  }
}

const itemInput = (over: Partial<HintInput> = {}): HintInput => ({
  gameSlug: 'steal-a-brainrot',
  categorySlug: 'items',
  gameCategoryId: 'pair-1',
  templateData: { 'select-brainrot': 'dragon-cannelloni', mutation: 'gold' },
  optionLabels: { mutation: { gold: 'Gold' } },
  ...over,
})

describe('resolveMarketPriceHint: items (picked fields only)', () => {
  it('prices the picked item and mutation', async () => {
    const d = deps()
    const hint = await resolveMarketPriceHint(itemInput(), d)
    expect(d.loadItemPrice).toHaveBeenCalledWith('steal-a-brainrot', 'dragon-cannelloni', 'gold')
    expect(hint).toEqual({ kind: 'item', usd: 18.99, offers: 12 })
  })

  it('SAB: a brainrot with no mutation picked uses the default price', async () => {
    const d = deps()
    await resolveMarketPriceHint(itemInput({ templateData: { 'select-brainrot': 'dragon-cannelloni' }, optionLabels: {} }), d)
    expect(d.loadItemPrice).toHaveBeenCalledWith('steal-a-brainrot', 'dragon-cannelloni', 'default')
  })

  it('SAB: reads the brainrot from any of the per-rarity "Select Brainrot" fields', async () => {
    const d = deps()
    await resolveMarketPriceHint(itemInput({ templateData: { 'select-brainrot-6': 'garama-and-madundung' }, optionLabels: {} }), d)
    expect(d.loadItemPrice).toHaveBeenCalledWith('steal-a-brainrot', 'garama-and-madundung', 'default')
  })

  it('Adopt Me: a pet alone shows nothing; the trait makes it priceable', async () => {
    const d = deps()
    const petOnly = await resolveMarketPriceHint(
      itemInput({ gameSlug: 'adopt-me', templateData: { 'pet-name': 'bat-dragon' }, optionLabels: {} }),
      d,
    )
    expect(petOnly).toBeNull()
    expect(d.loadItemPrice).not.toHaveBeenCalled()

    await resolveMarketPriceHint(
      itemInput({
        gameSlug: 'adopt-me',
        templateData: { 'pet-name': 'bat-dragon', trait: 'fr' },
        optionLabels: { trait: { fr: 'Fly Ride (FR)' } },
      }),
      d,
    )
    expect(d.loadItemPrice).toHaveBeenCalledWith('adopt-me', 'bat-dragon', 'fly-ride')
  })

  it('returns null when no item field is picked', async () => {
    const d = deps()
    expect(await resolveMarketPriceHint(itemInput({ templateData: {}, optionLabels: {} }), d)).toBeNull()
    expect(d.loadCatalog).not.toHaveBeenCalled()
  })

  it('returns null when the picked value is not a catalogue item', async () => {
    const d = deps()
    expect(await resolveMarketPriceHint(itemInput({ templateData: { 'select-brainrot': 'not-a-brainrot' } }), d)).toBeNull()
    expect(d.loadItemPrice).not.toHaveBeenCalled()
  })

  it('returns null when the price is too thin to show', async () => {
    const d = deps({ loadItemPrice: vi.fn(async () => ({ usd: 20, offers: 2, updatedAt: FRESH, isEstimate: false })) })
    expect(await resolveMarketPriceHint(itemInput(), d)).toBeNull()
  })

  it('returns null for a game with no values pricing', async () => {
    const d = deps()
    expect(await resolveMarketPriceHint(itemInput({ gameSlug: 'blox-fruits' }), d)).toBeNull()
    expect(d.loadCatalog).not.toHaveBeenCalled()
  })
})

describe('resolveMarketPriceHint: currency', () => {
  it('returns the median of live offers for the pair', async () => {
    const d = deps()
    const hint = await resolveMarketPriceHint(
      { gameSlug: 'roblox', categorySlug: 'currency', gameCategoryId: 'pair-9', templateData: {} },
      d,
    )
    expect(d.loadCurrencyOffers).toHaveBeenCalledWith('pair-9', null)
    expect(hint).toEqual({ kind: 'currency', usd: 3.8, offers: 3 })
  })

  it('reads the chosen bundle only, in bundle mode', async () => {
    const d = deps()
    await resolveMarketPriceHint(
      { gameSlug: 'fortnite', categorySlug: 'currency', gameCategoryId: 'pair-2', templateData: {}, bundleId: 'b-1000' },
      d,
    )
    expect(d.loadCurrencyOffers).toHaveBeenCalledWith('pair-2', 'b-1000')
  })
})

describe('resolveMarketPriceHint: other categories', () => {
  it('returns null for accounts, top-up and boosting', async () => {
    for (const categorySlug of ['accounts', 'top-up', 'boosting']) {
      const d = deps()
      expect(await resolveMarketPriceHint(itemInput({ categorySlug }), d)).toBeNull()
      expect(d.loadCurrencyOffers).not.toHaveBeenCalled()
      expect(d.loadItemPrice).not.toHaveBeenCalled()
    }
  })

  it('returns null when a loader throws (advice is never worth an error)', async () => {
    const d = deps({ loadItemPrice: vi.fn(async () => { throw new Error('db down') }) })
    expect(await resolveMarketPriceHint(itemInput(), d)).toBeNull()
  })
})
