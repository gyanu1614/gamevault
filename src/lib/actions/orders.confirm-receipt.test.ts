import { describe, it, expect, vi, beforeEach } from 'vitest'

// confirmOrderReceipt completes an order through the atomic SafeDrop
// transition RPC (safedrop_transition BUYER_CONFIRMED): the row lock +
// idempotent ledger journal decide the race against the auto-release cron.
// These tests pin that seam: exactly one transition call on the win path,
// and the loser (changed=false) returns success without comms or cashback.

const h = vi.hoisted(() => ({
  createClient: vi.fn(),
  createServiceRoleClient: vi.fn(),
  transition: vi.fn(),
  refundToWallet: vi.fn(),
  sendOrderCompletionEmail: vi.fn(),
  sendOrderCompletedSellerEmail: vi.fn(),
  createNotification: vi.fn(),
  awardCashback: vi.fn(),
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
vi.mock('@/lib/actions/loyalty', () => ({ awardCashback: h.awardCashback }))
vi.mock('@/lib/actions/promo', () => ({ recordPromoUsage: vi.fn() }))
vi.mock('@/lib/escrow/transition', () => ({ transition: h.transition }))
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
  h.transition.mockResolvedValue({
    orderId: ORDER_ID,
    status: 'completed',
    escrowStatus: 'released',
    ledgerTxnId: 'txn-1',
    changed: true,
  })
  h.awardCashback.mockResolvedValue(undefined)
  h.createNotification.mockResolvedValue(undefined)
  // Comms lookups (profiles/listings) resolve empty — emails skip themselves.
  h.createServiceRoleClient.mockImplementation(() => ({
    from: vi.fn(() => createBuilder({ data: null, error: null })),
  }))
})

describe('confirmOrderReceipt ledger transition', () => {
  it('winner path: applies exactly one BUYER_CONFIRMED transition', async () => {
    const readBuilder = createBuilder({ data: { ...baseOrder }, error: null })
    h.createClient.mockResolvedValue(createSupabaseMock([readBuilder]))

    const result = await confirmOrderReceipt(ORDER_ID)

    expect(result).toEqual({ success: true })
    expect(h.transition).toHaveBeenCalledTimes(1)
    expect(h.transition).toHaveBeenCalledWith(
      ORDER_ID,
      'BUYER_CONFIRMED',
      undefined,
      'buyer_confirmed'
    )
  })

  it('lost race: changed=false returns success with no comms or cashback', async () => {
    const readBuilder = createBuilder({ data: { ...baseOrder }, error: null })
    h.createClient.mockResolvedValue(createSupabaseMock([readBuilder]))
    // The cron won the release between our read and the transition — the RPC
    // reports the order already at 'completed'.
    h.transition.mockResolvedValue({
      orderId: ORDER_ID,
      status: 'completed',
      changed: false,
    })

    const result = await confirmOrderReceipt(ORDER_ID)

    expect(result).toEqual({ success: true })
    expect(h.transition).toHaveBeenCalledTimes(1)
    expect(h.sendOrderCompletionEmail).not.toHaveBeenCalled()
    expect(h.sendOrderCompletedSellerEmail).not.toHaveBeenCalled()
    expect(h.createNotification).not.toHaveBeenCalled()
    expect(h.awardCashback).not.toHaveBeenCalled()
    expect(h.revalidatePath).not.toHaveBeenCalled()
  })

  it('transition failure surfaces as an error (order not silently completed)', async () => {
    const readBuilder = createBuilder({ data: { ...baseOrder }, error: null })
    h.createClient.mockResolvedValue(createSupabaseMock([readBuilder]))
    h.transition.mockRejectedValue(new Error('safedrop_transition(BUYER_CONFIRMED) failed: boom'))

    const result = await confirmOrderReceipt(ORDER_ID)

    expect(result.success).toBe(false)
    expect(h.sendOrderCompletionEmail).not.toHaveBeenCalled()
    expect(h.awardCashback).not.toHaveBeenCalled()
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
    expect(h.transition).not.toHaveBeenCalled()
  })

  it('disputed order: refuses to release frozen funds', async () => {
    const readBuilder = createBuilder({
      data: { ...baseOrder, status: 'disputed', escrow_status: 'frozen' },
      error: null,
    })
    h.createClient.mockResolvedValue(createSupabaseMock([readBuilder]))

    const result = await confirmOrderReceipt(ORDER_ID)

    expect(result.success).toBe(false)
    expect(h.transition).not.toHaveBeenCalled()
  })

  it('mark-delivered pre-step is guarded on held escrow', async () => {
    const readBuilder = createBuilder({ data: { ...baseOrder, status: 'delivering' }, error: null })
    const deliveredBuilder = createBuilder({ data: null, error: null })
    h.createClient.mockResolvedValue(createSupabaseMock([readBuilder, deliveredBuilder]))

    const result = await confirmOrderReceipt(ORDER_ID)

    expect(result).toEqual({ success: true })
    expect(deliveredBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'delivered' })
    )
    // A replay must not drag a completed/disputed order back to 'delivered'.
    expect(deliveredBuilder.eq).toHaveBeenCalledWith('escrow_status', 'held')
    expect(h.transition).toHaveBeenCalledTimes(1)
  })
})
