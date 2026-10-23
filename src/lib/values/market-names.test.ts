import { describe, it, expect } from 'vitest'
import { marketNameLabel, slugLabel } from './market-names'

describe('admin labels for the match log', () => {
  it('reads an MM2 market key as a name plus its form and type', () => {
    expect(marketNameLabel('gun|chroma|ember bow')).toBe('Ember Bow · Chroma Gun')
    expect(marketNameLabel('knife|default|emberscythe')).toBe('Emberscythe · Knife')
  })
  it('leaves an Adopt Me item name as Eldorado spells it, and turns slugs into names', () => {
    expect(marketNameLabel('Malayan Tapir')).toBe('Malayan Tapir')
    expect(slugLabel('malaysian-tapir')).toBe('Malaysian Tapir')
  })
})
