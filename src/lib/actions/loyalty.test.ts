import { describe, it, expect, vi, beforeEach } from 'vitest'

// getLoyaltyStats derives the spendable balance from the ledger (cashback
// lands in user_wallet) and the earned tiles from loyalty_credits; the old
// profiles.loyalty_balance counters are dead. awardCashback's tests live in
// src/lib/loyalty/award.test.ts — it is deliberately NOT a server action.

const h = vi.hoisted(() => ({
  createClient: vi.fn(),
  getWalletBalance: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: h.createClient }))
vi.mock('@/lib/wallet/wallet', () => ({ getWalletBalance: h.getWalletBalance }))

import * as loyaltyActions from '@/lib/actions/loyalty'

const USER_ID = 'buyer-1'

// Chainable PostgREST-builder stub: every method returns the builder; awaiting
// the chain (or .single()/.maybeSingle()) resolves to `result`.
function createBuilder(result: any) {
  const builder: any = {}
  const methods = ['select', 'eq', 'in', 'gte', 'order', 'limit', 'update', 'insert']
  for (const m of methods) builder[m] = vi.fn(() => builder)
  builder.single = vi.fn(() => Promise.resolve(result))
  builder.maybeSingle = vi.fn(() => Promise.resolve(result))
  builder.then = (res: any, rej: any) => Promise.resolve(result).then(res, rej)
  return builder
}

function createSupabaseMock(queues: Record<string, any[]>) {
  const from = vi.fn((table: string) =>
    queues[table]?.length ? queues[table].shift() : createBuilder({ data: null, error: null })
  )
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
    from,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  h.getWalletBalance.mockResolvedValue(0n)
})

describe('loyalty server-action surface', () => {
  it('does not expose awardCashback as a server action', () => {
    // Every export of this 'use server' module is a client-invocable
    // endpoint; a payload-trusting award here would mint spendable credit.
    expect((loyaltyActions as any).awardCashback).toBeUndefined()
  })
})

describe('getLoyaltyStats ledger-derived tiles', () => {
  it('derives balance from the ledger wallet and lifetime from loyalty_credits', async () => {
    const now = new Date().toISOString()
    const earnedBuilder = createBuilder({
      data: [
        { amount: 1.9, created_at: now },          // this month
        { amount: 0.6, created_at: '2020-01-05T00:00:00Z' }, // long ago
      ],
      error: null,
    })
    const recentBuilder = createBuilder({ data: [], error: null })
    const supabase = createSupabaseMock({
      loyalty_credits: [earnedBuilder, recentBuilder],
      orders: [createBuilder({ data: [{ subtotal: 50 }], error: null })],
    })
    h.createClient.mockResolvedValue(supabase)
    // Spendable store credit: $2.50 USD + $0.75 legacy USD-at-par
    h.getWalletBalance.mockImplementation(async (_uid: string, currency: string) =>
      currency === 'USD' ? 250n : 75n
    )

    const result = await loyaltyActions.getLoyaltyStats()

    expect(result.success).toBe(true)
    expect(result.data?.balance).toBe(3.25)
    expect(result.data?.lifetimeCashbackEarned).toBe(2.5)
    expect(result.data?.thisMonthEarned).toBe(1.9)
    expect(result.data?.pendingFromOrders).toBe(1) // 2% of $50
    expect(supabase.from).not.toHaveBeenCalledWith('profiles')
  })
})
