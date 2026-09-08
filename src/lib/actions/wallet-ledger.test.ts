import { describe, it, expect, vi, beforeEach } from 'vitest'

// getMyWalletBalance is the wallet page's balance source. available_balance is
// ledger-derived; the total_cashback tile must come from loyalty_credits (the
// cashback history table), not the dead legacy wallet_balances float column.

const h = vi.hoisted(() => ({
  createClient: vi.fn(),
  createServiceRoleClient: vi.fn(),
  getWalletBalance: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: h.createClient }))
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: h.createServiceRoleClient }))
vi.mock('@/lib/wallet/wallet', () => ({ getWalletBalance: h.getWalletBalance }))

import { getMyWalletBalance } from '@/lib/actions/wallet-ledger'

const USER_ID = 'buyer-1'

function createBuilder(result: any) {
  const builder: any = {}
  for (const m of ['select', 'eq', 'in', 'order', 'limit']) {
    builder[m] = vi.fn(() => builder)
  }
  builder.single = vi.fn(() => Promise.resolve(result))
  builder.maybeSingle = vi.fn(() => Promise.resolve(result))
  builder.then = (res: any, rej: any) => Promise.resolve(result).then(res, rej)
  return builder
}

beforeEach(() => {
  vi.clearAllMocks()
  h.getWalletBalance.mockResolvedValue(0n)
  h.createServiceRoleClient.mockReturnValue({
    from: vi.fn(() => createBuilder({ data: null, error: null })),
    rpc: vi.fn().mockResolvedValue({ data: 0, error: null }),
  })
})

describe('getMyWalletBalance cashback tile', () => {
  it('derives total_cashback from loyalty_credits, not legacy wallet_balances', async () => {
    const legacyBuilder = createBuilder({
      data: { pending_balance: 0, lifetime_earned: 0, lifetime_spent: 0, total_cashback: 99, referral_earnings: 0 },
      error: null,
    })
    const creditsBuilder = createBuilder({
      data: [{ amount: 1.9 }, { amount: 0.6 }],
      error: null,
    })
    h.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
      from: vi.fn((table: string) =>
        table === 'wallet_balances' ? legacyBuilder
        : table === 'loyalty_credits' ? creditsBuilder
        : createBuilder({ data: null, error: null })
      ),
    })
    h.getWalletBalance.mockResolvedValue(250n)

    const result = await getMyWalletBalance()

    expect(result.success).toBe(true)
    expect(result.balance?.total_cashback).toBe(2.5)
    expect(result.balance?.available_balance).toBe(5) // 250n USD + 250n EUR at par
  })
})
