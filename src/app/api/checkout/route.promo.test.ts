/**
 * AUTH-003 at the HTTP boundary — a request carrying `promoDiscount: 9999`
 * must reach createCheckout with NO discount amount, only the code.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const createCheckout = vi.fn(async () => ({ success: false, error: 'stub' }))
vi.mock('@/lib/actions/checkout', () => ({ createCheckout }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'buyer-1' } } }) } }),
}))
vi.mock('@/lib/utils/idempotency', () => ({
  getIdempotentResult: async () => null,
  storeIdempotentResult: async () => {},
  validateIdempotencyKey: () => false,
}))

describe('POST /api/checkout — AUTH-003', () => {
  beforeEach(() => createCheckout.mockClear())

  it('drops a client-supplied promoDiscount and forwards only the code', async () => {
    const { POST } = await import('./route')
    const { NextRequest } = await import('next/server')
    const req = new NextRequest('http://localhost/api/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ listingId: 'l1', quantity: 1, promoDiscount: 9999, promoCode: 'SAVE10', walletAmount: 0 }),
    })
    await POST(req)
    expect(createCheckout).toHaveBeenCalledTimes(1)
    const arg = (createCheckout.mock.calls[0] as unknown[])[0] as Record<string, unknown>
    expect(arg).not.toHaveProperty('promoDiscount')
    expect(arg.promoCode).toBe('SAVE10')
  })

  it('non-string promoCode is discarded', async () => {
    const { POST } = await import('./route')
    const { NextRequest } = await import('next/server')
    const req = new NextRequest('http://localhost/api/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ listingId: 'l1', promoCode: { discountAmount: 50 } }),
    })
    await POST(req)
    const arg = (createCheckout.mock.calls[0] as unknown[])[0] as Record<string, unknown>
    expect(arg.promoCode).toBeUndefined()
  })
})
