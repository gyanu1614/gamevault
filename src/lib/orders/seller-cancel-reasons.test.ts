import { describe, expect, it } from 'vitest'
import { sellerCancelReasonLabel, validateSellerCancel, SELLER_CANCEL_REASONS } from './seller-cancel-reasons'

describe('seller cancel reasons', () => {
  it('labels every reason, and nothing else', () => {
    for (const r of SELLER_CANCEL_REASONS) expect(sellerCancelReasonLabel(r.id)).toBe(r.label)
    expect(sellerCancelReasonLabel('made_up')).toBeNull()
  })
  it('requires a known reason; Other needs a note', () => {
    expect(validateSellerCancel(null, '')).toMatch(/Pick a reason/)
    expect(validateSellerCancel('made_up', '')).toMatch(/Pick a reason/)
    expect(validateSellerCancel('out_of_stock', '')).toBeNull()
    expect(validateSellerCancel('other', 'no')).toMatch(/short note/)
    expect(validateSellerCancel('other', 'Game servers down')).toBeNull()
    expect(validateSellerCancel('price_error', 'x'.repeat(501))).toMatch(/500/)
  })
})
