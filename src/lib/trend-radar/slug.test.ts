import { describe, it, expect } from 'vitest'
import { slugFromTitle, resolveSlug } from './slug'

describe('slugFromTitle', () => {
  it('builds a URL slug from the normalised Roblox title', () => {
    expect(slugFromTitle('Steal An Egg')).toBe('steal-an-egg')
    expect(slugFromTitle('[🧲] Blox Fruits')).toBe('blox-fruits')
    expect(slugFromTitle("Sol's RNG [ Summer Event 🏖️]")).toBe('sols-rng')
  })
  it('returns null when nothing sluggable is left', () => {
    expect(slugFromTitle('🔥🔥🔥')).toBeNull()
  })
})

describe('resolveSlug', () => {
  it('keeps the natural slug when free', () => {
    expect(resolveSlug('Steal An Egg', new Set())).toEqual({ slug: 'steal-an-egg', collided: false })
  })
  it('suffixes -roblox on a collision and flags it', () => {
    expect(resolveSlug('Steal An Egg', new Set(['steal-an-egg']))).toEqual({
      slug: 'steal-an-egg-roblox',
      collided: true,
      collidedWith: 'steal-an-egg',
    })
  })
  it('keeps counting when the suffixed slug is taken too', () => {
    expect(resolveSlug('Steal An Egg', new Set(['steal-an-egg', 'steal-an-egg-roblox']))?.slug).toBe('steal-an-egg-roblox-2')
  })
  it('treats a reserved route as a collision', () => {
    const r = resolveSlug('Shop', new Set())
    expect(r?.slug).toBe('shop-roblox')
    expect(r?.collided).toBe(true)
  })
  it('returns null for an unsluggable title', () => {
    expect(resolveSlug('🔥', new Set())).toBeNull()
  })
})

describe('cleanTitle', () => {
  it('strips Roblox decoration but keeps the creator casing', async () => {
    const { cleanTitle } = await import('./slug')
    expect(cleanTitle('[🥚] Steal An Egg')).toBe('Steal An Egg')
    expect(cleanTitle('🔥 Steal a Brainrot [UPDATE!] 🔥')).toBe('Steal a Brainrot')
    expect(cleanTitle("Sol's RNG [ Summer Event 🏖️]")).toBe("Sol's RNG")
    expect(cleanTitle('99 Nights in the Forest 🔦')).toBe('99 Nights in the Forest')
  })
  it('drops a pipe-separated tagline (seen live: "[X2] +1 Speed Keyboard Escape | Candy & Chocolate")', async () => {
    const { cleanTitle } = await import('./slug')
    expect(cleanTitle('[X2] +1 Speed Keyboard Escape | Candy & Chocolate')).toBe('+1 Speed Keyboard Escape')
    expect(cleanTitle('Animal Hospital (Anomaly) 🧪')).toBe('Animal Hospital')
  })
  it('falls back to the raw title when stripping empties it', async () => {
    const { cleanTitle } = await import('./slug')
    expect(cleanTitle('🔥🔥')).toBe('🔥🔥')
  })
})
