import { describe, expect, it } from 'vitest'
import { rarityMeta, rarityRank, raritiesFor } from './rarity'

describe('values rarity map', () => {
  it('resolves known keys per game', () => {
    expect(rarityMeta('adopt-me', 'ultra_rare')).toMatchObject({ label: 'Ultra-Rare', color: '#B07BC9' })
    expect(rarityMeta('steal-a-brainrot', 'Brainrot God').color).toBe('#FF8A3D')
  })
  it('falls back to the raw key with a neutral colour', () => {
    expect(rarityMeta('adopt-me', 'mythic')).toEqual({ key: 'mythic', label: 'mythic', color: '#9BA8A0' })
    expect(rarityMeta('unknown-game', null).label).toBe('')
  })
  it('orders rarest first and unknown last', () => {
    expect(rarityRank('steal-a-brainrot', 'Secret')).toBe(0)
    expect(rarityRank('steal-a-brainrot', 'nope')).toBe(Number.MAX_SAFE_INTEGER)
    expect(raritiesFor('steal-an-egg')).toEqual([])
  })
})
