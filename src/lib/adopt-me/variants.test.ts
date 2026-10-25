import { describe, expect, it } from 'vitest'
import { VARIANTS, VARIANT_KEY, variantFromChoiceLabel, variantFromKey } from './variants'

describe('VARIANT_KEY', () => {
  it('gives every code one URL key, and reads back', () => {
    expect(VARIANT_KEY.FR).toBe('fly-ride')
    expect(VARIANT_KEY.NFR).toBe('neon-fly-ride')
    expect(VARIANT_KEY.MFR).toBe('mega-fly-ride')
    expect(VARIANT_KEY.R).toBe('ride')
    for (const code of VARIANTS) expect(variantFromKey(VARIANT_KEY[code])).toBe(code)
    expect(new Set(Object.values(VARIANT_KEY)).size).toBe(VARIANTS.length)
  })

  it('unknown key → null', () => {
    expect(variantFromKey('rainbow')).toBeNull()
  })
})

describe('variantFromChoiceLabel', () => {
  it.each([
    // today's Trait choices (labels are the codes)
    ['FR', 'FR'],
    ['R', 'R'],
    ['F', 'F'],
    ['NFR', 'NFR'],
    ['MFR', 'MFR'],
    ['N', 'NEON'],
    ['M', 'MEGA'],
    ['None', 'N'],
    // older long labels
    ['Fly Ride (FR)', 'FR'],
    ['Neon Fly Ride (NFR)', 'NFR'],
    ['Mega Neon', 'MEGA'],
    ['Mega Neon Fly Ride', 'MFR'],
    ['Neon', 'NEON'],
    ['No Potion', 'N'],
    ['Normal', 'N'],
    [' fr ', 'FR'],
  ])('%s → %s', (label, expected) => {
    expect(variantFromChoiceLabel(label)).toBe(expected)
  })

  it.each([['NR'], ['MF'], ['Mega Ride'], [''], ['Rainbow']])('%s → null', (label) => {
    expect(variantFromChoiceLabel(label)).toBeNull()
  })
})
