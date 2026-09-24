import { describe, it, expect, vi, beforeEach } from 'vitest'

// confirmOrderReceipt completes an order through ONE service-role RPC
// (order_confirm_receipt → safedrop_transition BUYER_CONFIRMED with the
// maturity hold — fee PR 7). The row lock + idempotent ledger journal decide
// the race against the auto-complete runner. These tests pin that seam:
// exactly one RPC call on the win path, the loser (changed=false) returns
// success without comms or cashback, and the RPC's refusal reasons surface.

const h = vi.hoisted(() => ({
  createClient: vi.fn(),
  createServiceRoleClient: vi.fn(),
  rpc: vi.fn(),
  revalidateListingSurfaces: vi.fn(),
  refundToWallet: vi.fn(),
  sendOrderCompletionEmail: vi.fn(),
  sendOrderCompletedSellerEmail: vi.fn(),
  createNotification: vi.fn(),
  awardCashback: vi.fn(),
  recordReferralCommission: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: h.createClient }))
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: h.createServiceRoleClient }))
vi.mock('next/cache', () => ({ revalidatePath: h.revalidatePath }))
vi.mock('@/lib/audit', () => ({
  logOrderAction: vi.fn(),
  logUnauthorizedAccess: vi.fn(),
  logFailure: vi.fn(),
}))
vi.mock('@/lib/utils/rate-limit', () => ({ rateLimitCreateOrder: vi.fn() }))
vi.mock('@/lib/loyalty/award', () => ({ awardCashback: h.awardCashback }))
vi.mock('@/lib/referral/commission', () => ({ recordReferralCommission: h.recordReferralCommission }))
vi.mock('@/lib/actions/promo', () => ({ recordPromoUsage: vi.fn() }))
vi.mock('@/lib/revalidation/listings', () => ({ revalidateListingSurfaces: h.revalidateListingSurfaces }))
vi.mock('@/lib/wallet/wallet', () => ({ refundToWallet: h.refundToWallet }))
vi.mock('@/lib/email', () => ({
  sendOrderCompletionEmail: h.sendOrderCompletionEmail,
  sendOrderCompletedSellerEmail: h.sendOrderCompletedSellerEmail,
}))
vi.mock('@/lib/utils/notifications', () => ({ createNotification: h.createNotification }))

import { confirmOrderReceipt } from '@/lib/actions/orders'

const BUYER_ID = 'buyer-1'
const ORDER_ID = 'order-1'

// Chainable PostgREST-builder stub: every method returns the builder, awaiting
// the chain (or .single()) resolves to `result`. Call args are recorded on the
// vi.fn() methods for assertions.
function createBuilder(result: any) {
  const builder: any = {}
  for (const m of ['select', 'eq', 'in', 'update', 'insert', 'single']) {
    builder[m] = vi.fn(() => (m === 'single' ? Promise.resolve(result) : builder))
  }
  builder.then = (res: any, rej: any) => Promise.resolve(result).then(res, rej)
  return builder
}

// Supabase client whose from('orders') hands out queued builders in call
// order; other tables get inert empty builders.
function createSupabaseMock(ordersQueue: any[]) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: BUYER_ID } } }),
    },
    from: vi.fn((table: string) =>
      table === 'orders' && ordersQueue.length
        ? ordersQueue.shift()
        : createBuilder({ data: null, error: null })
    ),
  }
}

const baseOrder = {
  id: ORDER_ID,
  buyer_id: BUYER_ID,
  seller_id: 'seller-1',
  listing_id: 'listing-1',
  status: 'delivered',
  escrow_status: 'held',
  order_number: 'GV-1234',
  total_amount: 100,
  seller_payout: 90,
  subtotal: 95,
  is_guest_order: false,
}

beforeEach(() => {
  vi.clearAllMocks()
  h.rpc.mockResolvedValue({
    data: { order_id: ORDER_ID, status: 'completed', escrow_status: 'released', ledger_txn_id: 'txn-1', changed: true },
    error: null,
  })
  h.revalidateListingSurfaces.mockResolvedValue({ tags: [] })
  h.awardCashback.mockResolvedValue(undefined)
  h.recordReferralCommission.mockResolvedValue(undefined)
  h.createNotification.mockResolvedValue(undefined)
  // Comms lookups (profiles/listings) resolve empty — emails skip themselves.
  h.createServiceRoleClient.mockImplementation(() => ({
    from: vi.fn(() => createBuilder({ data: null, error: null })),
    rpc: h.rpc,
  }))
})

describe('confirmOrderReceipt ledger transition', () => {
  it('winner path: exactly one order_confirm_receipt RPC, listing surfaces revalidated', async () => {
    const readBuilder = createBuilder({ data: { ...baseOrder }, error: null })
    h.createClient.mockResolvedValue(createSupabaseMock([readBuilder]))

    const result = await confirmOrderReceipt(ORDER_ID)

    expect(result).toEqual({ success: true })
    expect(h.rpc).toHaveBeenCalledTimes(1)
    expect(h.rpc).toHaveBeenCalledWith('order_confirm_receipt', { p_order_id: ORDER_ID, p_buyer_id: BUYER_ID })
    // No direct status write from TS — the RPC owns the state machine.
    expect(readBuilder.update).not.toHaveBeenCalled()
    expect(h.revalidateListingSurfaces).toHaveBeenCalledWith(expect.anything(), { listingIds: ['listing-1'] })
  })

  it('hands cashback only the orderId — award verifies the order itself', async () => {
    const readBuilder = createBuilder({ data: { ...baseOrder }, error: null })
    h.createClient.mockResolvedValue(createSupabaseMock([readBuilder]))

    await confirmOrderReceipt(ORDER_ID)

    // No caller-supplied user/amount/currency: awardCashback derives them
    // from the order row it re-fetches (mintable-money hardening).
    expect(h.awardCashback).toHaveBeenCalledWith({ orderId: ORDER_ID })
    // DB-017: the referrer's commission is recorded next to cashback, id only.
    expect(h.recordReferralCommission).toHaveBeenCalledWith(ORDER_ID)
  })

  it('lost race: changed=false returns success with no comms or cashback', async () => {
    const readBuilder = createBuilder({ data: { ...baseOrder }, error: null })
    h.createClient.mockResolvedValue(createSupabaseMock([readBuilder]))
    // The runner won the release between our read and the RPC — it reports
    // the order already at 'completed'.
    h.rpc.mockResolvedValue({ data: { order_id: ORDER_ID, changed: false, reason: 'already_completed' }, error: null })

    const result = await confirmOrderReceipt(ORDER_ID)

    expect(result).toEqual({ success: true })
    expect(h.rpc).toHaveBeenCalledTimes(1)
    expect(h.sendOrderCompletionEmail).not.toHaveBeenCalled()
    expect(h.sendOrderCompletedSellerEmail).not.toHaveBeenCalled()
    expect(h.createNotification).not.toHaveBeenCalled()
    expect(h.awardCashback).not.toHaveBeenCalled()
    expect(h.recordReferralCommission).not.toHaveBeenCalled()
    expect(h.revalidatePath).not.toHaveBeenCalled()
  })

  it('RPC failure surfaces as an error (order not silently completed)', async () => {
    const readBuilder = createBuilder({ data: { ...baseOrder }, error: null })
    h.createClient.mockResolvedValue(createSupabaseMock([readBuilder]))
    h.rpc.mockResolvedValue({ data: null, error: { message: 'order_confirm_receipt failed: boom' } })

    const result = await confirmOrderReceipt(ORDER_ID)

    expect(result.success).toBe(false)
    expect(h.sendOrderCompletionEmail).not.toHaveBeenCalled()
    expect(h.awardCashback).not.toHaveBeenCalled()
    expect(h.recordReferralCommission).not.toHaveBeenCalled()
  })

  it('already completed at read time: returns success without transitioning', async () => {
    const readBuilder = createBuilder({
      data: { ...baseOrder, status: 'completed', escrow_status: 'released' },
      error: null,
    })
    h.createClient.mockResolvedValue(createSupabaseMock([readBuilder]))

    const result = await confirmOrderReceipt(ORDER_ID)

    expect(result).toEqual({ success: true })
    expect(readBuilder.update).not.toHaveBeenCalled()
    expect(h.rpc).not.toHaveBeenCalled()
  })

  it('disputed order: the RPC refuses and the action says so (nothing released)', async () => {
    const readBuilder = createBuilder({
      data: { ...baseOrder, status: 'disputed', escrow_status: 'frozen' },
      error: null,
    })
    h.createClient.mockResolvedValue(createSupabaseMock([readBuilder]))
    h.rpc.mockResolvedValue({ data: { order_id: ORDER_ID, changed: false, reason: 'disputed' }, error: null })

    const result = await confirmOrderReceipt(ORDER_ID)

    expect(result).toEqual({ success: false, error: 'This order is under dispute review' })
    expect(h.awardCashback).not.toHaveBeenCalled()
  })

  it('unpaid order: the RPC refuses with not_paid', async () => {
    const readBuilder = createBuilder({ data: { ...baseOrder, status: 'pending', escrow_status: 'pending' }, error: null })
    h.createClient.mockResolvedValue(createSupabaseMock([readBuilder]))
    h.rpc.mockResolvedValue({ data: { order_id: ORDER_ID, changed: false, reason: 'not_paid' }, error: null })

    const result = await confirmOrderReceipt(ORDER_ID)

    expect(result).toEqual({ success: false, error: 'This order has not been paid yet' })
  })

  it('never writes status from TS on the delivering → completed path (the RPC stamps delivery)', async () => {
    const readBuilder = createBuilder({ data: { ...baseOrder, status: 'delivering' }, error: null })
    h.createClient.mockResolvedValue(createSupabaseMock([readBuilder]))

    const result = await confirmOrderReceipt(ORDER_ID)

    expect(result).toEqual({ success: true })
    expect(readBuilder.update).not.toHaveBeenCalled()
    expect(h.rpc).toHaveBeenCalledTimes(1)
  })
})
