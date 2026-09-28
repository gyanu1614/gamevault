import { describe, expect, it } from 'vitest'
import { orderDisplayTitle } from './display-title'

describe('orderDisplayTitle', () => {
  it('prefixes the amount for flexible per-unit currency', () => {
    expect(
      orderDisplayTitle({ title: 'Roblox Robux', quantity: 2000, isCurrency: true, granularity: 'unit' }),
    ).toBe('2,000 - Roblox Robux')
  })

  it('shows the K / M magnitude for bulk currency games', () => {
    expect(
      orderDisplayTitle({ title: 'Blade Ball Tokens', quantity: 100, isCurrency: true, granularity: 'million' }),
    ).toBe('100 M - Blade Ball Tokens')
    expect(
      orderDisplayTitle({ title: 'Gems', quantity: 5, isCurrency: true, granularity: 'thousand' }),
    ).toBe('5 K - Gems')
  })

  it('treats a missing currency config as per-unit', () => {
    expect(orderDisplayTitle({ title: 'Robux', quantity: 400, isCurrency: true })).toBe('400 - Robux')
  })

  it('counts bundles and items with ×, only when more than one', () => {
    expect(orderDisplayTitle({ title: 'Robux Pack', quantity: 2, isCurrency: true, hasBundles: true })).toBe(
      '2 × Robux Pack',
    )
    expect(orderDisplayTitle({ title: 'Dragon Pet', quantity: 3, isCurrency: false })).toBe('3 × Dragon Pet')
    expect(orderDisplayTitle({ title: 'Dragon Pet', quantity: 1, isCurrency: false })).toBe('Dragon Pet')
  })

  it('never runs two numbers together', () => {
    expect(orderDisplayTitle({ title: '10,000 Robux', quantity: 1, isCurrency: true })).toBe('10,000 Robux')
    expect(orderDisplayTitle({ title: '10,000 Robux', quantity: 2, isCurrency: true })).toBe('2 × 10,000 Robux')
  })

  it('falls back to the plain title on a bad quantity', () => {
    expect(orderDisplayTitle({ title: 'Robux', quantity: null, isCurrency: false })).toBe('Robux')
    expect(orderDisplayTitle({ title: 'Robux', quantity: 0, isCurrency: true })).toBe('Robux')
  })
})
