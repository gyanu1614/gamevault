import { describe, it, expect } from 'vitest'
import { amTrait, withPotion, withTier } from './am-traits'

describe('amTrait', () => {
  it('reads every Adopt Me form as tier + potions', () => {
    expect(amTrait('normal')).toEqual({ tier: 'normal', fly: false, ride: false })
    expect(amTrait('fly')).toEqual({ tier: 'normal', fly: true, ride: false })
    expect(amTrait('neon-fly-ride')).toEqual({ tier: 'neon', fly: true, ride: true })
    expect(amTrait('mega-neon')).toEqual({ tier: 'mega', fly: false, ride: false })
  })

  it('null for anything else (mutations, no trait)', () => {
    expect(amTrait('gold')).toBeNull()
    expect(amTrait(null)).toBeNull()
  })
})

describe('withPotion', () => {
  it('a normal pet takes Fly and Ride one at a time', () => {
    expect(withPotion('normal', 'fly')).toBe('fly')
    expect(withPotion('fly', 'ride')).toBe('fly-ride')
    expect(withPotion('fly-ride', 'fly')).toBe('ride')
    expect(withPotion('ride', 'ride')).toBe('normal')
  })

  it('Neon and Mega only come plain or Fly Ride, so the potions switch together', () => {
    expect(withPotion('neon', 'fly')).toBe('neon-fly-ride')
    expect(withPotion('neon-fly-ride', 'ride')).toBe('neon')
    expect(withPotion('mega-neon', 'ride')).toBe('mega-fly-ride')
    expect(withPotion('mega-fly-ride', 'fly')).toBe('mega-neon')
  })

  it('no trait yet starts from Normal', () => {
    expect(withPotion(null, 'ride')).toBe('ride')
  })
})

describe('withTier', () => {
  it('keeps the potions where the tier allows them', () => {
    expect(withTier('fly-ride', 'neon')).toBe('neon-fly-ride')
    expect(withTier('neon-fly-ride', 'mega')).toBe('mega-fly-ride')
    expect(withTier('mega-fly-ride', 'normal')).toBe('fly-ride')
    expect(withTier('neon', 'normal')).toBe('normal')
  })

  it('one potion on a normal pet becomes Fly Ride on Neon / Mega', () => {
    expect(withTier('fly', 'neon')).toBe('neon-fly-ride')
    expect(withTier('ride', 'mega')).toBe('mega-fly-ride')
  })

  it('no trait yet starts from Normal', () => {
    expect(withTier(null, 'mega')).toBe('mega-neon')
  })
})
