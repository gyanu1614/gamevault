import { describe, expect, it } from 'vitest'
import { DROP, LOOT_HANDOFF, LOOT_RISE, lootEmerge, lootLand, ramp, tileIn } from './timeline'

const LOOT = [0, 1, 2, 3]

describe('the Drop timeline', () => {
  it('ramps clamp outside their window', () => {
    expect(ramp(-1, [0.2, 0.4])).toBe(0)
    expect(ramp(0.3, [0.2, 0.4])).toBeCloseTo(0.5)
    expect(ramp(2, [0.2, 0.4])).toBe(1)
  })

  it('breaks the seal before the lid can open', () => {
    expect(DROP.sealCrack[0]).toBeLessThan(DROP.lidOpen[0])
    expect(DROP.sealFade[0]).toBeLessThanOrEqual(DROP.lidOpen[0])
  })

  it.each(LOOT)('loot %i leaves an open crate and lands on a tile that is already showing', (i) => {
    expect(lootEmerge(i)).toBeGreaterThan(DROP.lidOpen[0])
    expect(lootEmerge(i)).toBeLessThan(lootLand(i))
    expect(lootLand(i)).toBeGreaterThanOrEqual(tileIn(i)[1])
  })

  it('lands every object while the stage is still pinned, before the crate sinks out', () => {
    for (const i of LOOT) expect(lootLand(i)).toBeLessThan(1)
    // The last object leaves the crate before the crate starts to sink.
    expect(lootEmerge(LOOT.length - 1)).toBeLessThan(DROP.sink[0])
  })

  it('staggers the loot in tile order', () => {
    for (const i of LOOT.slice(1)) {
      expect(lootEmerge(i)).toBeGreaterThan(lootEmerge(i - 1))
      expect(lootLand(i)).toBeGreaterThan(lootLand(i - 1))
    }
  })

  it('hands the glyph over after the rise, before touchdown', () => {
    expect(LOOT_HANDOFF).toBeGreaterThan(LOOT_RISE)
    expect(LOOT_HANDOFF).toBeLessThan(1)
  })
})
