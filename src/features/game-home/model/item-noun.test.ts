import { describe, it, expect } from 'vitest'
import { itemNoun, itemNounSingular } from './item-noun'

describe('itemNoun', () => {
  it('names each values game its items', () => {
    expect(itemNoun('adopt-me')).toBe('Pets')
    expect(itemNoun('steal-a-brainrot')).toBe('Brainrots')
  })

  it('defaults to Items', () => {
    expect(itemNoun('fortnite')).toBe('Items')
  })
})

describe('itemNounSingular', () => {
  it('singularises the plural word', () => {
    expect(itemNounSingular('adopt-me')).toBe('Pet')
    expect(itemNounSingular('steal-a-brainrot')).toBe('Brainrot')
    expect(itemNounSingular('fortnite')).toBe('Item')
  })
})
