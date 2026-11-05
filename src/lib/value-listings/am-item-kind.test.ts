import { describe, it, expect } from 'vitest'
import { amItemType, amTypesHeading } from './am-item-kind'

describe('amItemType', () => {
  it('gives the tab each kind belongs to; no kind is a pet', () => {
    expect(amItemType(null)).toBe('Pets')
    expect(amItemType(undefined)).toBe('Pets')
    expect(amItemType('egg')).toBe('Eggs')
    expect(amItemType('potion')).toBe('Potions')
  })
})

describe('amTypesHeading', () => {
  it('names the types in the heading', () => {
    expect(amTypesHeading(['Pets', 'Eggs', 'Potions'])).toBe('Pets, Eggs & Potions')
    expect(amTypesHeading(['Pets', 'Eggs'])).toBe('Pets & Eggs')
    expect(amTypesHeading(['Pets'])).toBe('Pets')
  })
})
