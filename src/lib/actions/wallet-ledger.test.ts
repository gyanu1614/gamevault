import { describe, it, expect, vi, beforeEach } from 'vitest'

// getMyWalletBalance is the wallet page's balance source. available_balance
// is ledger-derived; the total_cashback tile comes from loyalty_credits (the
// cashback history table the ledger awards write to), referral earnings from
// referral_earnings — never the archived wallet_balances float table or the
// dead profiles counters.

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
  h.createClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }) },
    from: vi.fn(() => createBuilder({ data: null, error: null })),
  })
})

describe('getMyWalletBalance tiles', () => {
  it('derives total_cashback from loyalty_credits and never reads wallet_balances', async () => {
    const serviceFrom = vi.fn((table: string) =>
      table === 'loyalty_credits'
        ? createBuilder({ data: [{ amount: 1.9 }, { amount: 0.6 }], error: null })
        : table === 'referral_earnings'
          ? createBuilder({
              data: [
                { amount: 5, status: 'paid' },
                { amount: 3, status: 'pending' },
              ],
              error: null,
            })
          : createBuilder({ data: null, error: null })
    )
    h.createServiceRoleClient.mockReturnValue({ from: serviceFrom })
    h.getWalletBalance.mockResolvedValue(250n)

    const result = await getMyWalletBalance()

    expect(result.success).toBe(true)
    expect(result.balance?.total_cashback).toBe(2.5)
    expect(result.balance?.available_balance).toBe(2.5) // 250n USD (single currency)
    expect(result.balance?.referral_earnings).toBe(5)   // paid only
    expect(serviceFrom).not.toHaveBeenCalledWith('wallet_balances')
    expect(serviceFrom).not.toHaveBeenCalledWith('profiles')
  })
})
