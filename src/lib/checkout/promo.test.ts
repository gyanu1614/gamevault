/**
 * AUTH-003 — a buyer must not be able to set their own discount.
 *
 *  1. resolveCheckoutPromo derives the discount from the VALIDATED promo row;
 *     it has no input through which a client amount could arrive.
 *  2. Source guards: neither checkout path reads a client `promoDiscount`, the
 *     input types no longer carry one, and the API route does not forward it.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolveCheckoutPromo } from './promo'

const CHECKOUT = readFileSync('src/lib/actions/checkout.ts', 'utf8')
const ORDERS = readFileSync('src/lib/actions/orders.ts', 'utf8')
const ROUTE = readFileSync('src/app/api/checkout/route.ts', 'utf8')
const FORM = readFileSync('src/app/checkout/[id]/CheckoutForm.tsx', 'utf8')

describe('AUTH-003 — resolveCheckoutPromo', () => {
  it('no code → no discount, validator never consulted', async () => {
    const validate = vi.fn()
    expect(await resolveCheckoutPromo(undefined, 50, validate)).toEqual({ ok: true, discount: 0, promoCodeId: null })
    expect(await resolveCheckoutPromo('   ', 50, validate)).toEqual({ ok: true, discount: 0, promoCodeId: null })
    expect(validate).not.toHaveBeenCalled()
  })

  it('invalid / expired code → checkout is refused, not silently discounted', async () => {
    const validate = vi.fn(async () => ({ valid: false, error: 'This promo code has expired' }))
    expect(await resolveCheckoutPromo('OLD', 50, validate)).toEqual({ ok: false, error: 'This promo code has expired' })
  })

  it('discount comes from the promo row, capped at the subtotal', async () => {
    const validate = vi.fn(async () => ({ valid: true, promoCodeId: 'p1', code: 'TEN', discountAmount: 10 }))
    expect(await resolveCheckoutPromo('ten', 50, validate)).toEqual({ ok: true, discount: 10, promoCodeId: 'p1' })
    expect(validate).toHaveBeenCalledWith('ten', 50)

    const over = vi.fn(async () => ({ valid: true, promoCodeId: 'p2', code: 'BIG', discountAmount: 999 }))
    expect(await resolveCheckoutPromo('BIG', 50, over)).toEqual({ ok: true, discount: 50, promoCodeId: 'p2' })
  })

  it('malformed validator amounts collapse to 0, never negative or NaN', async () => {
    const neg = vi.fn(async () => ({ valid: true, promoCodeId: 'p3', discountAmount: -20 }))
    expect(await resolveCheckoutPromo('NEG', 50, neg)).toEqual({ ok: true, discount: 0, promoCodeId: 'p3' })
    const nan = vi.fn(async () => ({ valid: true, promoCodeId: 'p4', discountAmount: Number.NaN }))
    expect(await resolveCheckoutPromo('NAN', 50, nan)).toEqual({ ok: true, discount: 0, promoCodeId: 'p4' })
  })
})

describe('AUTH-003 — no client amount can reach the order total', () => {
  it('checkout.ts and orders.ts never read a client-supplied promoDiscount', () => {
    expect(CHECKOUT).not.toMatch(/input\.promoDiscount/)
    expect(ORDERS).not.toMatch(/data\.promoDiscount/)
    expect(CHECKOUT).toMatch(/resolveCheckoutPromo\(input\.promoCode, subtotal, validatePromoCode\)/)
    expect(ORDERS).toMatch(/resolveCheckoutPromo\(data\.promoCode, subtotal, validatePromoCode\)/)
  })

  it('input contracts carry a promo CODE, not an amount', () => {
    const checkoutInput = CHECKOUT.slice(CHECKOUT.indexOf('export interface CreateCheckoutInput'), CHECKOUT.indexOf('}', CHECKOUT.indexOf('export interface CreateCheckoutInput')))
    expect(checkoutInput).toMatch(/promoCode\?: string/)
    expect(checkoutInput).not.toMatch(/promoDiscount/)
    const orderInput = ORDERS.slice(ORDERS.indexOf('interface CreateOrderData'), ORDERS.indexOf('}', ORDERS.indexOf('interface CreateOrderData')))
    expect(orderInput).toMatch(/promoCode\?: string/)
    expect(orderInput).not.toMatch(/promoDiscount|promoCodeId/)
  })

  it('API route forwards only a string promoCode; the client sends the code', () => {
    expect(ROUTE).not.toMatch(/body\.promoDiscount/)
    expect(ROUTE).toMatch(/promoCode: typeof body\.promoCode === 'string' \? body\.promoCode : undefined/)
    expect(FORM).toMatch(/promoCode: promoResult\?\.valid \? promoResult\.code : undefined/)
    expect(FORM).not.toMatch(/^\s*promoDiscount,\s*$/m)
  })

  it('promo usage is recorded on checkout so limits bind', () => {
    expect(CHECKOUT).toMatch(/recordPromoUsage\(\{ promoCodeId, orderId, discountAmount: promoDiscount, userId: user\.id \}\)/)
  })
})
