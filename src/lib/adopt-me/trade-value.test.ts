import { describe, expect, it } from 'vitest'

import { formatTradeValue, frostsLabel } from './trade-value'

describe('formatTradeValue', () => {
  it('rounds for reading; exact values stay in the database', () => {
    expect(formatTradeValue(20552)).toBe('20.6K')
    expect(formatTradeValue(6940)).toBe('6,940')
    expect(formatTradeValue(1003)).toBe('1,003')
    expect(formatTradeValue(243.5)).toBe('244')
    expect(formatTradeValue(15.25)).toBe('15')
    expect(formatTradeValue(2.48)).toBe('2.5')
    expect(formatTradeValue(0.03)).toBe('0.03')
    expect(formatTradeValue(0)).toBe('0')
  })
})

describe('frostsLabel', () => {
  it('reads points as Frost Dragons (Frost FR = 100)', () => {
    expect(frostsLabel(320)).toBe('≈ 3.2 Frosts')
    expect(frostsLabel(100)).toBe('≈ 1 Frost')
    expect(frostsLabel(1450)).toBe('≈ 15 Frosts')
    expect(frostsLabel(4)).toBe('< 0.1 Frosts')
  })
})
