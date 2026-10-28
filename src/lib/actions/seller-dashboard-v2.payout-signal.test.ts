/**
 * "Add Your Payout Details" checklist step (onboarding.payoutConnected).
 *
 * The Payouts tab saves to seller_payout_details (savePayoutDetails →
 * seller_payout_details_set); nothing ever sets profiles.payout_enabled, so a
 * signal read from the profile alone never turned the step done for a real
 * seller. The table is service-role only (encrypted secrets, no authenticated
 * grant), so the read goes through the service role, scoped to the session
 * user, and asks for existence only.
 *
 * Uses the recording fake: no DB. The real-schema check (column names in the
 * filter, empty-row case) is seller-dashboard-v2.payout-signal.integration.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSupabaseRecorder, type SupabaseRecorder } from '@/test/fakes/supabase-recorder'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined, unstable_cache: (fn: any) => fn }))

const SELLER_ID = 'seller-1'
let session: SupabaseRecorder
let service: SupabaseRecorder

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => session.client }))
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: () => service.client }))

import { getSellerDashboard } from '@/lib/actions/seller-dashboard-v2'

const PROFILE = { shop_name: null, shop_slug: null, paypal_email: null, payout_enabled: false }

function setup(profile: Record<string, unknown>, payoutRows: Array<Record<string, unknown>>) {
  session = createSupabaseRecorder({ profiles: [profile] })
  session.client.auth.getUser = async () => ({ data: { user: { id: SELLER_ID } }, error: null })
  service = createSupabaseRecorder({ seller_payout_details: payoutRows })
}

describe('seller checklist: payout step', () => {
  beforeEach(() => setup(PROFILE, []))

  it('is done once the seller has saved payout details (payout_enabled never set)', async () => {
    setup(PROFILE, [{ seller_id: SELLER_ID }])
    const d = await getSellerDashboard(7)
    expect(d!.onboarding.payoutConnected).toBe(true)
  })

  it('is not done with no saved details and no legacy signal', async () => {
    const d = await getSellerDashboard(7)
    expect(d!.onboarding.payoutConnected).toBe(false)
  })

  it('still counts a legacy PayPal email', async () => {
    setup({ ...PROFILE, paypal_email: 'seller@example.com' }, [])
    const d = await getSellerDashboard(7)
    expect(d!.onboarding.payoutConnected).toBe(true)
  })

  it('reads existence only, for the session user, through the service role', async () => {
    await getSellerDashboard(7)
    // The session client has no grant on the table: it must never ask.
    expect(session.tables()).not.toContain('seller_payout_details')

    const reads = service.queries.filter((q) => q.table === 'seller_payout_details')
    expect(reads).toHaveLength(1)
    const [q] = reads
    const arg = (name: string) => q.args[q.calls.indexOf(name)]

    // Only the key column; no secret, hash or count option (head: true is banned).
    expect(arg('select')).toEqual(['seller_id'])
    expect(arg('eq')).toEqual(['seller_id', SELLER_ID])
    expect(q.calls).toContain('limit')
    // A saved method, not a bare row: an `email_in_use` save leaves an empty row.
    expect(arg('or')).toEqual(['crypto_coin.not.is.null,payoneer_email_hash.not.is.null'])
    // Every table the service role touches here is this one.
    expect(service.tables()).toEqual(['seller_payout_details'])
  })
})
