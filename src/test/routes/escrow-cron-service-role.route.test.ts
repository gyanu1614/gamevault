/**
 * DB-004 follow-through — the routes that call the service-only getters must
 * use the service-role client.
 *
 * /api/cron/auto-release-escrow and /api/cron/mark-inactive-sellers built the
 * SESSION client (anon key + request cookies). A Vercel cron request carries no
 * cookies, so both RPCs ran as `anon` and only worked because the functions
 * were anon-executable (DB-004 / DB-007). /api/admin/trigger-escrow-release
 * called the same getter as the signed-in admin. Once EXECUTE is revoked from
 * anon + authenticated, all three answer 500 unless they switch to the
 * service-role client. This drives the handlers end-to-end against the local
 * stack with the fixture's held order kept in the future, so nothing releases.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import { hasEnv, makeFixture, URL, ANON, type Fixture } from '../guards/throwaway'

// The session client is what the routes used to build. The mock hands the
// cron routes a cookie-less anon client (exactly what Vercel's cron gets) and
// the admin route the fixture admin's signed-in client.
let sessionClient: SupabaseClient | null = null
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    if (!sessionClient) throw new Error('test: session client not set')
    return sessionClient
  },
}))

let fx: Fixture | null = null
let heldOrderId = ''
const SECRET = 'guard-cron-secret'
const cronRequest = (path: string) => new NextRequest(`http://localhost${path}`, { headers: { authorization: `Bearer ${SECRET}` } })

describe.skipIf(!hasEnv)('escrow/presence cron + admin release routes run their RPCs as the service role (integration)', () => {
  beforeAll(async () => {
    process.env.CRON_SECRET = SECRET
    fx = await makeFixture()
    sessionClient = createClient(URL!, ANON!, { auth: { persistSession: false } })
    const { data, error } = await fx.svc.from('orders').insert({
      buyer_id: fx.buyer.id, seller_id: fx.seller.id, listing_id: fx.listingId, quantity: 1,
      unit_price: 1, subtotal: 1, platform_fee_rate: 0, payment_processing_fee_rate: 0,
      platform_fee: 0, payment_processing_fee: 0, total_amount: 1, seller_payout: 1, currency: 'USD',
      status: 'delivered', escrow_status: 'held',
      auto_release_at: new Date(Date.now() + 86_400_000).toISOString(), // tomorrow: nothing is due
    }).select('id').single()
    if (error) throw new Error(`held order insert: ${error.message}`)
    heldOrderId = (data as any).id
  }, 60_000)
  afterAll(async () => { await fx?.cleanup() }, 60_000)

  it('GET /api/cron/auto-release-escrow answers 200 with nothing due (getter executed as service role)', async () => {
    const { GET } = await import('@/app/api/cron/auto-release-escrow/route')
    const res = await GET(cronRequest('/api/cron/auto-release-escrow'))
    const body = await res.json()
    expect(res.status, JSON.stringify(body)).toBe(200)
    expect(body.processed).toBe(0)
    const { data } = await fx!.svc.from('orders').select('escrow_status').eq('id', heldOrderId).single()
    expect((data as any).escrow_status).toBe('held')
  })

  it('GET /api/cron/mark-inactive-sellers answers 200 (RPC executed as service role)', async () => {
    const { GET } = await import('@/app/api/cron/mark-inactive-sellers/route')
    const res = await GET(cronRequest('/api/cron/mark-inactive-sellers'))
    const body = await res.json()
    expect(res.status, JSON.stringify(body)).toBe(200)
  })

  it('POST /api/admin/trigger-escrow-release answers 200 for an admin session', async () => {
    const { error: pe } = await fx!.svc.from('profiles').update({ role: 'admin' }).eq('id', fx!.admin.id)
    if (pe) throw new Error(`promote admin profile: ${pe.message}`)
    sessionClient = fx!.admin.client
    const { POST } = await import('@/app/api/admin/trigger-escrow-release/route')
    const res = await POST(new NextRequest('http://localhost/api/admin/trigger-escrow-release', { method: 'POST' }))
    const body = await res.json()
    expect(res.status, JSON.stringify(body)).toBe(200)
    expect(body.processed).toBe(0)
  })
})
