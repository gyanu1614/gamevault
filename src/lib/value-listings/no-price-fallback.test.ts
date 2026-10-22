import { describe, expect, it } from 'vitest'
import { noPriceFallback } from './buy-panel'

describe('noPriceFallback (owner, 2026-10-21: one headline rule for every hub)', () => {
  it('a trade value when there is one (Adopt Me)', () => {
    expect(noPriceFallback({ tradeValue: '12.4 FR', isNew: false })).toEqual({ label: 'Value', value: '12.4 FR' })
    expect(noPriceFallback({ tradeValue: '≈ 0.3 Frosts', tradeLabel: 'Trade Value', isNew: true })).toEqual({ label: 'Trade Value', value: '≈ 0.3 Frosts' })
  })
  it('otherwise "No Trades Yet", labelled New for a new item', () => {
    expect(noPriceFallback({ isNew: true })).toEqual({ label: 'New', value: 'No Trades Yet' })
    expect(noPriceFallback({ tradeValue: null, isNew: false })).toEqual({ label: 'Value', value: 'No Trades Yet' })
  })
})
