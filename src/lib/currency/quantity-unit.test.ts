import { describe, it, expect } from 'vitest'
import { quantityUnit, formatQuantity, priceUnit } from '@/lib/currency/quantity-unit'

describe('quantityUnit', () => {
  it('uses K / M for bulk granularities, regardless of the currency name', () => {
    expect(quantityUnit('thousand', 'Tokens')).toBe('K')
    expect(quantityUnit('million', 'Tokens')).toBe('M')
  })
  it("uses the currency's own name for unit granularity", () => {
    expect(quantityUnit('unit', 'Robux')).toBe('Robux')
    expect(quantityUnit(undefined, 'Robux')).toBe('Robux')
  })
  it('falls back to "unit" when a unit-granularity currency has no name', () => {
    expect(quantityUnit('unit', '')).toBe('unit')
    expect(quantityUnit('unit', null)).toBe('unit')
  })
})

describe('formatQuantity', () => {
  it('formats with separators and the unit, as buyers read it', () => {
    expect(formatQuantity(100, 'million', 'Tokens')).toBe('100 M')
    expect(formatQuantity(1000, 'million', 'Tokens')).toBe('1,000 M')
    expect(formatQuantity(1, 'thousand', 'Tokens')).toBe('1 K')
    expect(formatQuantity(5000, 'unit', 'Robux')).toBe('5,000 Robux')
  })
})

describe('priceUnit', () => {
  it('names what one price covers', () => {
    expect(priceUnit('thousand')).toBe('K')
    expect(priceUnit('million')).toBe('M')
    expect(priceUnit('unit')).toBe('Unit')
    expect(priceUnit(undefined)).toBe('Unit')
  })
})
