import { describe, expect, it } from 'vitest'
import { sellerExtraTitle } from './seller-title'

const SAB = 'steal-a-brainrot'
const ctx = (itemName: string, traitLabel?: string) => ({ itemName, gameName: 'Steal a Brainrot', traitLabel })

describe('sellerExtraTitle', () => {
  it.each([
    ['Candy Dragon Cannelloni 1B/s - Quick Delivery', 'Dragon Cannelloni', 'Candy'],
    ['Rainbow Dragon Cannelloni - 2.5B/s (Steal A Brainrot)', 'Dragon Cannelloni', 'Rainbow'],
    ['La Secret Combinasion - 125M/s (Quick Delivery)', 'La Secret Combinasion', undefined],
    ['Garama and Madundung 50M/s | Quick Delivery', 'Garama and Madundung', undefined],
  ])('shows %s: it says the income', (title, item, trait) => {
    expect(sellerExtraTitle(SAB, title, ctx(item, trait))).toBe(title)
  })

  it.each([
    ['Dragon Gingerini', 'Dragon Gingerini', undefined],
    ['67 - Instant Delivery', '67', undefined],
    ['Skibidi Toilet - Quick Delivery', 'Skibidi Toilet', undefined],
    ['Divine Dragon Cannelloni', 'Dragon Cannelloni', 'Divine'],
    ['Dragon Cannelloni — Steal a Brainrot (Roblox) | Instant Delivery', 'Dragon Cannelloni', undefined],
  ])('leaves out %s: nothing new', (title, item, trait) => {
    expect(sellerExtraTitle(SAB, title, ctx(item, trait))).toBeNull()
  })

  it('Steal a Brainrot only, for now', () => {
    expect(sellerExtraTitle('adopt-me', 'Turtle Full Grown Special', { itemName: 'Turtle', gameName: 'Adopt Me' })).toBeNull()
    expect(sellerExtraTitle('murder-mystery-2', 'Sunrise Mint', { itemName: 'Sunrise', gameName: 'Murder Mystery 2' })).toBeNull()
  })

  it('nothing to show', () => {
    expect(sellerExtraTitle(SAB, null, ctx('67'))).toBeNull()
    expect(sellerExtraTitle(SAB, '   ', ctx('67'))).toBeNull()
  })
})
