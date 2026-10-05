import { describe, it, expect } from 'vitest'
import { tierByKey } from '@/lib/seller/tiers'
import { avatarHalo, rgbFromGlowClass } from './store-header'

describe('store header — avatar halo', () => {
  it('gives every rank its own quiet colour', () => {
    expect(avatarHalo('bronze').rgb).toBe('196,140,98')
    expect(avatarHalo('silver').rgb).toBe('220,228,240')
    expect(avatarHalo('gold').rgb).toBe('236,196,96')
    expect(avatarHalo('diamond').rgb).toBe('125,220,240')
    const all = ['bronze', 'silver', 'gold', 'diamond', 'legendary'].map((t) => avatarHalo(t).rgb)
    expect(new Set(all).size).toBe(5)
  })

  it('takes Legendary from the rank definition, so it cannot drift from the badge', () => {
    expect(avatarHalo('legendary').rgb).toBe(rgbFromGlowClass(tierByKey('legendary').colors.glow))
    expect(avatarHalo('legendary').rgb).toBe('198,255,61')
  })

  it('stays faint (minimal): ring and glow alphas well under half', () => {
    for (const t of ['bronze', 'silver', 'gold', 'diamond', 'legendary']) {
      const h = avatarHalo(t)
      expect(h.ringAlpha).toBeGreaterThan(0)
      expect(h.ringAlpha).toBeLessThanOrEqual(0.35)
      expect(h.glowAlpha).toBeGreaterThan(0)
      expect(h.glowAlpha).toBeLessThanOrEqual(0.3)
    }
  })

  it('falls back to the entry rank for an unknown tier', () => {
    expect(avatarHalo(null)).toEqual(avatarHalo('bronze'))
    expect(avatarHalo('platinum')).toEqual(avatarHalo('bronze'))
  })

  it('reads the rgb out of a tiers.ts glow class', () => {
    expect(rgbFromGlowClass('shadow-[0_0_26px_-8px_rgba(198,255,61,0.6)]')).toBe('198,255,61')
    expect(rgbFromGlowClass('shadow-none')).toBeNull()
  })
})
