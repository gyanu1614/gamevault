import { describe, it, expect } from 'vitest'
import { buildValueCatalog, AM_VARIANT_KEY, amVariantKey } from './catalogs'
import { matchListingToValueItem } from './match'

describe('buildValueCatalog', () => {
  it('SAB: brainrots + active mutations, select-brainrot identity, default variant', () => {
    const c = buildValueCatalog('steal-a-brainrot', {
      items: [{ slug: 'dragon-cannelloni', name: 'Dragon Cannelloni', rarity: 'Secret', valueUsd: 12 }],
      mutations: [
        { slug: 'default', name: 'Default' },
        { slug: 'diamond', name: 'Diamond' },
      ],
    })!
    expect(c.catalog.identityKeys).toContain('select-brainrot')
    expect(c.catalog.defaultVariant).toBe('default')
    expect(c.catalog.variants.map((v) => v.key)).toEqual(['diamond'])
    expect(matchListingToValueItem({ title: 'Diamond Dragon Cannelloni', templateData: {} }, c.catalog)).toEqual({
      itemSlug: 'dragon-cannelloni',
      variant: 'diamond',
    })
  })

  it('Adopt Me: pets, the eight potion variants, pet-name identity, no default', () => {
    const c = buildValueCatalog('adopt-me', { items: [{ slug: 'bat-dragon', name: 'Bat Dragon' }] })!
    expect(c.catalog.variants.map((v) => v.key)).toEqual(Object.values(AM_VARIANT_KEY))
    expect(c.catalog.defaultVariant).toBeUndefined()
    expect(c.catalog.identityKeys).toContain('pet-name')
  })

  it('generic games: items by title, no variants', () => {
    const c = buildValueCatalog('steal-an-egg', { items: [{ slug: 'golden-egg', name: 'Golden Egg' }] })!
    expect(c.catalog.variants).toEqual([])
    expect(matchListingToValueItem({ title: 'Golden Egg x1', templateData: {} }, c.catalog)?.itemSlug).toBe('golden-egg')
  })

  it('returns null for a game with no value catalogue', () => {
    expect(buildValueCatalog('fortnite', { items: [] })).toBeNull()
  })
})

describe('amVariantKey', () => {
  it('maps the value page codes to URL keys', () => {
    expect(amVariantKey('NFR')).toBe('neon-fly-ride')
    expect(amVariantKey('MEGA')).toBe('mega-neon')
    expect(amVariantKey('N')).toBe('normal')
  })
})
