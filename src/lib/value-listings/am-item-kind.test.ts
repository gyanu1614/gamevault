import { describe, it, expect } from 'vitest'
import { amItemType } from './am-item-kind'

describe('amItemType', () => {
  it('gives the tab each kind belongs to; no kind is a pet', () => {
    expect(amItemType(null)).toBe('Pets')
    expect(amItemType(undefined)).toBe('Pets')
    expect(amItemType('egg')).toBe('Eggs')
    expect(amItemType('potion')).toBe('Potions')
  })
})
