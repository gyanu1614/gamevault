/**
 * /fees (redesigned 2026-10-23) shows every public payment method with the
 * service fee on a $20 item, quoted by THE buyer quote (buyer_fee_quote_many)
 * through lib/fees/buyer-fee-overview. Against the local stack: every
 * switched-on public method gets a sample, the sandbox and fake providers
 * never show, store credit is left to its own line, and a sheet rate gives
 * the number the quote guard pins (creditcard_br: $0.40 + $1.13).
 * Reads only; nothing to clean up.
 */
import { describe, it, expect, vi } from 'vitest'

import { hasEnv } from './throwaway'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined, unstable_cache: (fn: any) => fn }))

describe.skipIf(!hasEnv)('/fees overview: fee per method from the buyer quote (integration)', () => {
  it('every public switched-on method has a $20 sample; no test rows; store credit apart', async () => {
    const { getBuyerFeeOverview } = await import('@/lib/fees/buyer-fee-overview')
    const { getPublicBuyerFees } = await import('@/lib/fees/buyer-public-rates')
    const { PUBLIC_PAYMENT_PROVIDER_KEYS } = await import('@/lib/legal/payment-processors')
    const o = await getBuyerFeeOverview()

    const expected = (await getPublicBuyerFees())
      .filter((r) => r.selectable && r.provider !== 'wallet' && PUBLIC_PAYMENT_PROVIDER_KEYS.has(r.provider))
      .map((r) => r.method)
      .sort()
    expect(o.methods.map((m) => m.method).sort()).toEqual(expected)
    expect(o.methods.map((m) => m.method)).not.toContain('payssion_test')
    expect(o.methods.map((m) => m.method)).not.toContain('wallet')
    for (const m of o.methods) expect(m.sample, `${m.method}: $20 sample`).not.toBeNull()

    expect(o.subtotalMinor).toBe(2000)
    expect(o.marketplacePct).toBe(2)
    const card = o.methods.find((m) => m.method === 'creditcard_br')!
    expect(card.name).toBe('Credit / Debit Card (Brazil)')
    expect(card.sample).toEqual({ marketplaceMinor: 40, processingMinor: 113, serviceFeeMinor: 153, totalMinor: 2153 })
    expect(card.terms).toMatch(/4\.25%/)
    // The "Refund to method" column reads this: paysafecard is "Store credit only".
    expect(o.methods.find((m) => m.method === 'paysafecard')?.refundable).toBe(false)
  })
})
