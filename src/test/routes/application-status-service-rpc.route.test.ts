/**
 * DB-006 follow-through — getApplicationStatus() must call can_seller_reapply()
 * through the service-role client.
 *
 * The action called the RPC with the session client, which only worked
 * because can_seller_reapply(uuid) was anon/authenticated-executable (it
 * reveals any uuid's application state). With EXECUTE now service-only the
 * session call fails 42501, the error is only logged, and canReapply silently
 * falls back to `true` — a user with a pending application would be told they
 * can reapply.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { hasEnv, makeFixture, type Fixture } from '../guards/throwaway'

let sessionClient: SupabaseClient | null = null
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    if (!sessionClient) throw new Error('test: session client not set')
    return sessionClient
  },
}))
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }))

let fx: Fixture | null = null

describe.skipIf(!hasEnv)('getApplicationStatus reads the reapply verdict as the service role (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    sessionClient = fx.buyer.client
    const { error } = await fx.svc.from('seller_applications').insert({
      user_id: fx.buyer.id, status: 'pending', is_18_or_older: true, seller_type: 'individual',
      display_name: 'Status Applicant', submitted_at: new Date().toISOString(),
    })
    if (error) throw new Error(`application insert: ${error.message}`)
  }, 60_000)
  afterAll(async () => { await fx?.cleanup() }, 60_000)

  it('a pending applicant is told they cannot reapply (verdict comes from can_seller_reapply, not the fallback)', async () => {
    const { getApplicationStatus } = await import('@/lib/actions/seller-application-status')
    const res = await getApplicationStatus()
    expect(res.success).toBe(true)
    expect(res.data?.status).toBe('pending')
    expect(res.data?.canReapply).toBe(false)
  })
})
