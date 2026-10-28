/**
 * The Stripe card row is a checkout candidate only when Stripe is configured
 * (both keys set). Its fee row then decides, like every other method:
 * selectable=false keeps it off the page.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const rpc = vi.fn()
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: () => ({ rpc }) }))

import { eligibleMethods } from './eligibility'

const input = { buyerId: null, currency: 'USD', country: 'GB', subtotalMinor: 1000n }

beforeEach(() => {
  // Quote every candidate as ok so the test sees exactly the candidate list.
  rpc.mockReset().mockImplementation(async (_fn: string, args: { p_methods: string[] }) => ({
    data: args.p_methods.map((method) => ({
      ok: true, reason: null, method, fee_minor: 10, marketplace_minor: 30, service_fee_minor: 40,
      total_minor: 1040, charge_minor: 1040, wallet_applied_minor: 0, pct_effective: 1, refundable: true, instant_clearing: true,
    })),
    error: null,
  }))
})
afterEach(() => vi.unstubAllEnvs())

describe('eligibleMethods: Stripe card row', () => {
  it('is offered when both Stripe keys are set, as a worldwide card row', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_x')
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_x')
    const { methods } = await eligibleMethods(input)
    const card = methods.find((m) => m.method === 'stripe')
    expect(card).toMatchObject({ provider: 'stripe', pmId: null, kind: 'card', label: 'Credit / Debit Card', countries: [], countryMatch: true })
  })

  it('is not a candidate without the keys (nothing claims cards before the owner sets them)', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', '')
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_x')
    const { methods, refused } = await eligibleMethods(input)
    expect(methods.some((m) => m.method === 'stripe')).toBe(false)
    expect(refused.some((m) => m.method === 'stripe')).toBe(false)
    expect((rpc.mock.calls[0][1] as { p_methods: string[] }).p_methods).not.toContain('stripe')
  })
})
