import { describe, expect, it } from 'vitest'
import { offerLine, sellerExtraTitle } from './seller-title'

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

describe('offerLine', () => {
  it('keeps what this offer is, drops the name, the game and the sales talk', () => {
    expect(offerLine(SAB, 'Rainbow Garama and Madundung 500M/s – Steal a Brainrot | Instant Delivery', ctx('Garama and Madundung', 'Rainbow'))).toBe('Rainbow 500M/s')
    expect(offerLine(SAB, 'Candy Dragon Cannelloni 1B/s - Quick Delivery', ctx('Dragon Cannelloni', 'Candy'))).toBe('Candy 1B/s')
    expect(offerLine(SAB, 'Garama and Madundung - 50M/s', ctx('Garama and Madundung'))).toBe('50M/s')
  })
  it('a title that never names the item stays as written, minus the talk', () => {
    expect(offerLine(SAB, 'Best Traits Bundle | Instant Delivery', ctx('Garama and Madundung'))).toBe('Best Traits Bundle')
  })
  it('says nothing when the title adds nothing', () => {
    expect(offerLine(SAB, 'Dragon Gingerini', ctx('Dragon Gingerini'))).toBeNull()
    expect(offerLine(SAB, 'Dragon Gingerini - Instant Delivery', ctx('Dragon Gingerini'))).toBeNull()
  })
  it('only on games whose titles carry news', () => {
    expect(offerLine('adopt-me', 'Candy Dragon 1B/s', ctx('Dragon'))).toBeNull()
  })
})
