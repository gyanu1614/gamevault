import { describe, it, expect, vi, beforeEach } from 'vitest'

// awardCashback mints spendable ledger credit, so it must NOT trust its
// caller: it lives outside the server-action surface and derives the
// recipient, amount and currency from the order row it verifies itself
// (service-role). These tests pin that contract — the security review found
// the payload-trusting version was a mintable-money endpoint.

const h = vi.hoisted(() => ({
  createServiceRoleClient: vi.fn(),
  creditWallet: vi.fn(),
  getWalletBalance: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: h.createServiceRoleClient }))
vi.mock('@/lib/wallet/wallet', () => ({
  creditWallet: h.creditWallet,
  getWalletBalance: h.getWalletBalance,
}))

import { awardCashback } from '@/lib/loyalty/award'

const BUYER_ID = 'buyer-1'
const ORDER_ID = 'order-1'

function createBuilder(result: any) {
  const builder: any = {}
  for (const m of ['select', 'eq', 'insert']) builder[m] = vi.fn(() => builder)
  builder.single = vi.fn(() => Promise.resolve(result))
  builder.maybeSingle = vi.fn(() => Promise.resolve(result))
  builder.then = (res: any, rej: any) => Promise.resolve(result).then(res, rej)
  return builder
}

function createServiceMock(queues: Record<string, any[]>) {
  const from = vi.fn((table: string) =>
    queues[table]?.length ? queues[table].shift() : createBuilder({ data: null, error: null })
  )
  return { from }
}

const completedOrder = {
  id: ORDER_ID,
  buyer_id: BUYER_ID,
  subtotal: 95,
  currency: 'usd',
  status: 'completed',
  is_guest_order: false,
}

function mockService(order: any, historyRow: any = null) {
  const checkBuilder = createBuilder({ data: historyRow, error: null })
  const insertBuilder = createBuilder({ data: null, error: null })
  const service = createServiceMock({
    orders: [createBuilder({ data: order, error: null })],
    loyalty_credits: [checkBuilder, insertBuilder],
  })
  h.createServiceRoleClient.mockReturnValue(service)
  return { service, insertBuilder }
}

beforeEach(() => {
  vi.clearAllMocks()
  h.creditWallet.mockResolvedValue('txn-1')
  h.getWalletBalance.mockResolvedValue(0n)
})

describe('awardCashback (order-verified ledger credit)', () => {
  it('credits the verified buyer from the order row, keyed cashback:<orderId>', async () => {
    mockService(completedOrder)

    await awardCashback({ orderId: ORDER_ID })

    expect(h.creditWallet).toHaveBeenCalledTimes(1)
    expect(h.creditWallet).toHaveBeenCalledWith({
      userId: BUYER_ID,
      orderId: ORDER_ID,
      amountMinor: 190n, // 2% of $95.00
      currency: 'USD',
      counterparty: 'platform_commission',
      idempotencyKey: `cashback:${ORDER_ID}`,
      eventRef: 'CASHBACK',
    })
  })

  it('refuses an order that is not completed', async () => {
    mockService({ ...completedOrder, status: 'delivered' })

    await awardCashback({ orderId: ORDER_ID })

    expect(h.creditWallet).not.toHaveBeenCalled()
  })

  it('refuses guest orders and unknown orders', async () => {
    mockService({ ...completedOrder, is_guest_order: true })
    await awardCashback({ orderId: ORDER_ID })

    mockService(null)
    await awardCashback({ orderId: ORDER_ID })

    expect(h.creditWallet).not.toHaveBeenCalled()
  })

  it('records a loyalty_credits history row with the ledger balance after', async () => {
    const { insertBuilder } = mockService(completedOrder)
    h.getWalletBalance.mockResolvedValue(190n)

    await awardCashback({ orderId: ORDER_ID })

    expect(insertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: BUYER_ID,
        order_id: ORDER_ID,
        type: 'earned',
        amount: 1.9,
        balance_after: 1.9,
      })
    )
  })

  it('never touches the profiles counters', async () => {
    const { service } = mockService(completedOrder)

    await awardCashback({ orderId: ORDER_ID })

    expect(service.from).not.toHaveBeenCalledWith('profiles')
  })

  it('replay with an existing history row for the order posts nothing', async () => {
    const { insertBuilder } = mockService(completedOrder, { id: 'credit-1' })

    await awardCashback({ orderId: ORDER_ID })

    expect(h.creditWallet).not.toHaveBeenCalled()
    expect(insertBuilder.insert).not.toHaveBeenCalled()
  })

  it('zero and sub-cent cashback amounts are no-ops', async () => {
    mockService({ ...completedOrder, subtotal: 0 })
    await awardCashback({ orderId: ORDER_ID })

    // 2% of $0.24 = $0.0048 → rounds to $0.00
    mockService({ ...completedOrder, subtotal: 0.24 })
    await awardCashback({ orderId: ORDER_ID })

    expect(h.creditWallet).not.toHaveBeenCalled()
  })

  it('does not write a history row when the ledger credit fails', async () => {
    const { insertBuilder } = mockService(completedOrder)
    h.creditWallet.mockRejectedValue(new Error('wallet_credit failed: boom'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Fire-and-forget contract: swallows the error, never throws.
    await expect(awardCashback({ orderId: ORDER_ID })).resolves.toBeUndefined()

    expect(insertBuilder.insert).not.toHaveBeenCalled()
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })
})
