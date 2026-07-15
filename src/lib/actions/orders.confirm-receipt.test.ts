import { describe, it, expect, vi, beforeEach } from 'vitest'

// confirmOrderReceipt races the auto-release cron for the held → released
// escrow flip. These tests pin the compare-and-swap semantics: exactly one
// winner credits the seller (transferEscrowToSeller has no per-order
// idempotency), and the loser returns success without paying or sending comms.

const h = vi.hoisted(() => ({
  createClient: vi.fn(),
  createServiceRoleClient: vi.fn(),
  transferEscrowToSeller: vi.fn(),
  sendOrderCompletionEmail: vi.fn(),
  sendOrderCompletedSellerEmail: vi.fn(),
  createNotification: vi.fn(),
  awardCashback: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: h.createClient }))
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: h.createServiceRoleClient }))
vi.mock('next/cache', () => ({ revalidatePath: h.revalidatePath }))
vi.mock('stripe', () => ({ default: class Stripe {} }))
vi.mock('@/lib/audit', () => ({
  logOrderAction: vi.fn(),
  logUnauthorizedAccess: vi.fn(),
  logFailure: vi.fn(),
}))
vi.mock('@/lib/utils/rate-limit', () => ({ rateLimitCreateOrder: vi.fn() }))
vi.mock('@/lib/actions/loyalty', () => ({ awardCashback: h.awardCashback }))
vi.mock('@/lib/actions/promo', () => ({ recordPromoUsage: vi.fn() }))
vi.mock('@/lib/stripe/connect', () => ({ transferEscrowToSeller: h.transferEscrowToSeller }))
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
  h.transferEscrowToSeller.mockResolvedValue({ success: true, transferId: 'tr_1', error: null })
  h.awardCashback.mockResolvedValue(undefined)
  h.createNotification.mockResolvedValue(undefined)
  // Comms lookups (profiles/listings) resolve empty — emails skip themselves.
  h.createServiceRoleClient.mockImplementation(() => ({
    from: vi.fn(() => createBuilder({ data: null, error: null })),
  }))
})

describe('confirmOrderReceipt escrow CAS', () => {
  it('winner path: claims held escrow, credits seller exactly once', async () => {
    const readBuilder = createBuilder({ data: { ...baseOrder }, error: null })
    const casBuilder = createBuilder({ data: [{ id: ORDER_ID }], error: null })
    h.createClient.mockResolvedValue(createSupabaseMock([readBuilder, casBuilder]))

    const result = await confirmOrderReceipt(ORDER_ID)

    expect(result).toEqual({ success: true })
    expect(casBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'completed',
        escrow_status: 'released',
        release_method: 'buyer_confirmed',
      })
    )
    expect(casBuilder.eq).toHaveBeenCalledWith('escrow_status', 'held')
    expect(casBuilder.select).toHaveBeenCalledWith('id')
    expect(h.transferEscrowToSeller).toHaveBeenCalledTimes(1)
    expect(h.transferEscrowToSeller).toHaveBeenCalledWith(ORDER_ID)
  })

  it('lost race: zero rows claimed returns success with no payout and no comms', async () => {
    const readBuilder = createBuilder({ data: { ...baseOrder }, error: null })
    // The cron won the held → released flip between our read and the update.
    const casBuilder = createBuilder({ data: [], error: null })
    h.createClient.mockResolvedValue(createSupabaseMock([readBuilder, casBuilder]))

    const result = await confirmOrderReceipt(ORDER_ID)

    expect(result).toEqual({ success: true })
    expect(h.transferEscrowToSeller).not.toHaveBeenCalled()
    expect(h.sendOrderCompletionEmail).not.toHaveBeenCalled()
    expect(h.sendOrderCompletedSellerEmail).not.toHaveBeenCalled()
    expect(h.createNotification).not.toHaveBeenCalled()
    expect(h.awardCashback).not.toHaveBeenCalled()
    expect(h.revalidatePath).not.toHaveBeenCalled()
  })

  it('already completed at read time: returns success without touching the order', async () => {
    const readBuilder = createBuilder({
      data: { ...baseOrder, status: 'completed', escrow_status: 'released' },
      error: null,
    })
    h.createClient.mockResolvedValue(createSupabaseMock([readBuilder]))

    const result = await confirmOrderReceipt(ORDER_ID)

    expect(result).toEqual({ success: true })
    expect(readBuilder.update).not.toHaveBeenCalled()
    expect(h.transferEscrowToSeller).not.toHaveBeenCalled()
  })

  it('mark-delivered pre-step is guarded on held escrow', async () => {
    const readBuilder = createBuilder({ data: { ...baseOrder, status: 'shipped' }, error: null })
    const deliveredBuilder = createBuilder({ data: null, error: null })
    const casBuilder = createBuilder({ data: [{ id: ORDER_ID }], error: null })
    h.createClient.mockResolvedValue(
      createSupabaseMock([readBuilder, deliveredBuilder, casBuilder])
    )

    const result = await confirmOrderReceipt(ORDER_ID)

    expect(result).toEqual({ success: true })
    expect(deliveredBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'delivered' })
    )
    // A replay must not drag a completed/disputed order back to 'delivered'.
    expect(deliveredBuilder.eq).toHaveBeenCalledWith('escrow_status', 'held')
    expect(h.transferEscrowToSeller).toHaveBeenCalledTimes(1)
  })
})
