import { describe, it, expect } from 'vitest'
import { countryName, flagEmoji } from './countries'

describe('country display helpers', () => {
  it('names a country from its ISO code, any case', () => {
    expect(countryName('BE')).toBe('Belgium')
    expect(countryName('pl')).toBe('Poland')
  })

  it('a malformed code comes back unchanged (never throws)', () => {
    expect(countryName('Belgium')).toBe('Belgium')
    expect(countryName('')).toBe('')
  })

  it('flags: the regional-indicator pair, or the globe for anything else', () => {
    expect(flagEmoji('BE')).toBe('🇧🇪')
    expect(flagEmoji('sg')).toBe('🇸🇬')
    expect(flagEmoji('other')).toBe('🌍')
  })
})
