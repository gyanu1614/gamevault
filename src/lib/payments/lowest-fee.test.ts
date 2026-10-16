import { describe, it, expect } from 'vitest'
import { lowestFeeMethodId } from './lowest-fee'

const row = (id: string, serviceFeeMinor: number | null) => ({ id, quote: serviceFeeMinor == null ? null : { serviceFeeMinor } })

describe('lowestFeeMethodId — the "Lowest Fee" tag at checkout', () => {
  it('picks the row with the smallest service fee', () => {
    expect(lowestFeeMethodId([row('pix_br', 285), row('creditcard_br', 153), row('skrill', 173)])).toBe('creditcard_br')
  })

  it('a tie for cheapest goes to the first row in display order', () => {
    expect(lowestFeeMethodId([row('paynow_sg', 142), row('grabpay_sg', 142), row('skrill', 173)])).toBe('paynow_sg')
  })

  it('no tag when there is nothing to compare (0 or 1 quoted row)', () => {
    expect(lowestFeeMethodId([])).toBeNull()
    expect(lowestFeeMethodId([row('kakaopay_kr', 145)])).toBeNull()
    expect(lowestFeeMethodId([row('kakaopay_kr', 145), row('skrill', null)])).toBeNull()
  })

  it('no tag when every quoted row costs the same', () => {
    expect(lowestFeeMethodId([row('a', 142), row('b', 142), row('c', 142)])).toBeNull()
  })

  it('rows without a quote never win', () => {
    expect(lowestFeeMethodId([row('a', null), row('b', 300), row('c', 200)])).toBe('c')
  })
})
