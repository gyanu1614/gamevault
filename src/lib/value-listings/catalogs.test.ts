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

  it('MM2: the picked knife / gun / pet field is the identity (chroma is its own row)', () => {
    const c = buildValueCatalog('murder-mystery-2', {
      items: [
        { slug: 'lightbringer', name: 'Lightbringer' },
        { slug: 'chroma-lightbringer', name: 'Chroma Lightbringer' },
      ],
    })!
    expect(matchListingToValueItem({ title: '', templateData: { 'select-gun': 'chroma-lightbringer' } }, c.catalog)).toEqual({
      itemSlug: 'chroma-lightbringer',
      variant: null,
    })
    expect(matchListingToValueItem({ title: '', templateData: { 'select-knife': 'lightbringer' } }, c.catalog)?.itemSlug).toBe(
      'lightbringer',
    )
  })

  it('Steal an Egg: the most specific pick wins (egg / pet over area)', () => {
    const c = buildValueCatalog('steal-an-egg', {
      items: [
        { slug: 'forest', name: 'Forest' },
        { slug: 'luminous-egg', name: 'Luminous Egg' },
      ],
    })!
    expect(
      matchListingToValueItem({ title: '', templateData: { 'egg-area': 'forest', 'select-egg': 'luminous-egg' } }, c.catalog)?.itemSlug,
    ).toBe('luminous-egg')
    expect(matchListingToValueItem({ title: '', templateData: { 'egg-area': 'forest' } }, c.catalog)?.itemSlug).toBe('forest')
  })
})
