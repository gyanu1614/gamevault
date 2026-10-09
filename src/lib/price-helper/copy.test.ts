import { describe, expect, it } from 'vitest'
import { hintCopy } from './copy'

describe('hintCopy', () => {
  it('item: the price and how many sources back it', () => {
    expect(hintCopy({ kind: 'item', usd: 42, offers: 18 }, null)).toEqual({ price: '$42.00', per: null, sources: 'from 18 sources' })
  })

  it('currency: sub-cent price keeps its digits, per the unit the seller types', () => {
    expect(hintCopy({ kind: 'currency', usd: 0.0055, offers: 9 }, 'Robux')).toEqual({
      price: '$0.0055',
      per: 'per Robux',
      sources: 'from 9 sources',
    })
  })

  it('currency: per K', () => {
    expect(hintCopy({ kind: 'currency', usd: 3.8, offers: 4 }, 'K').per).toBe('per K')
  })
})
