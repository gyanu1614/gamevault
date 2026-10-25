/**
 * "Add Your Payout Details" step against the real schema (integration). A
 * PostgREST filter on a misspelled column errors, and the dashboard would read
 * that as "no details" — so the signal is proven on the local stack, with the
 * seller's real session client and the row written the way the Payouts tab
 * writes it (seller_payout_details_set).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { hasEnv, makeFixture, type Fixture } from '@/test/guards/throwaway'
import { encryptPayoutSecret, hashPayoutSecret } from '@/lib/crypto/payout-encryption'

const state = vi.hoisted(() => ({ client: null as any }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => state.client }))
vi.mock('next/cache', () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined, unstable_cache: (fn: any) => fn }))
vi.mock('server-only', () => ({}))

import { getSellerDashboard } from '@/lib/actions/seller-dashboard-v2'

let fx: Fixture | null = null

async function payoutConnected(): Promise<boolean> {
  state.client = fx!.seller.client
  const d = await getSellerDashboard(7)
  expect(d).not.toBeNull()
  return d!.onboarding.payoutConnected
}

describe.skipIf(!hasEnv)('seller checklist payout step follows seller_payout_details (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
  }, 60_000)

  afterAll(async () => {
    if (!fx) return
    await fx.svc.from('seller_payout_details').delete().eq('seller_id', fx.seller.id)
    await fx.cleanup()
  }, 60_000)

  it('the session client cannot read the table (why the read is service-role)', async () => {
    const { error } = await fx!.seller.client.from('seller_payout_details').select('seller_id').limit(1)
    expect(error?.code).toBe('42501')
  })

  it('no row → not done', async () => {
    expect(await payoutConnected()).toBe(false)
  })

  it('an empty row (a failed first save) → not done', async () => {
    const { error } = await fx!.svc.from('seller_payout_details').insert({ seller_id: fx!.seller.id })
    expect(error).toBeNull()
    expect(await payoutConnected()).toBe(false)
  })

  it('a saved Payoneer email → done', async () => {
    const email = fx!.ns.email('payout')
    const { data, error } = await (fx!.svc.rpc as any)('seller_payout_details_set', {
      p_seller_id: fx!.seller.id, p_kind: 'payoneer',
      p_email_enc: encryptPayoutSecret(email), p_email_hash: hashPayoutSecret(email),
    })
    expect(error).toBeNull()
    expect(data?.saved).toBe(true)
    expect(await payoutConnected()).toBe(true)
  })
})
