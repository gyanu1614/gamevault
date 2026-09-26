/**
 * DB-010 — the admin seller-detail "Recent Wallet Activity" panel reads the
 * ledger, not the archived wallet_transactions table.
 *
 * 20260904000000 moved wallet_transactions to the archive schema; PostgREST
 * answers "relation does not exist", getSellerDetail() discarded the error
 * (`walletTxRes.data ?? []`) and the panel has been silently empty since
 * 2026-09-05. This credits a fixture user's wallet through the real ledger RPC
 * and expects the entry to come back through the action.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { hasEnv, makeFixture, type Fixture } from '@/test/guards/throwaway'
import { creditWallet } from '@/lib/wallet/wallet'

let sessionClient: SupabaseClient | null = null
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    if (!sessionClient) throw new Error('test: session client not set')
    return sessionClient
  },
}))
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }))

let fx: Fixture | null = null
const RUN = `test:ledger:dbp010:${Math.random().toString(36).slice(2, 8)}`

describe.skipIf(!hasEnv)('getSellerDetail wallet activity comes from the ledger (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    sessionClient = fx.admin.client
    await creditWallet({
      userId: fx.buyer.id, amountMinor: 500n, currency: 'USD', counterparty: 'refunds',
      idempotencyKey: `${RUN}:c1`, eventRef: 'guard:refund',
    })
  }, 60_000)
  afterAll(async () => {
    if (fx) {
      const { error } = await (fx.svc as any).rpc('ledger_test_cleanup', { p_prefix: `${RUN}%` })
      if (error) throw new Error(`ledger_test_cleanup: ${error.message}`)
      // ledger_accounts.owner_id has no FK, so the fixture's wallet account would outlive the user.
      const { error: ae } = await fx.svc.from('ledger_accounts').delete().in('owner_id', [fx.buyer.id, fx.seller.id, fx.admin.id])
      if (ae) throw new Error(`ledger_accounts cleanup: ${ae.message}`)
    }
    await fx?.cleanup()
  }, 60_000)

  it('lists the ledger credit as a wallet transaction', async () => {
    const { getSellerDetail } = await import('@/lib/actions/admin-seller-detail')
    const res = await getSellerDetail(fx!.buyer.id)
    expect(res.success, res.error).toBe(true)
    const tx = res.detail!.wallet.transactions
    expect(tx).toHaveLength(1)
    expect(tx[0]).toMatchObject({ type: 'credit', amount: 5 })
    expect(tx[0].description).toContain('guard:refund')
    expect(typeof tx[0].created_at).toBe('string')
  })
})
