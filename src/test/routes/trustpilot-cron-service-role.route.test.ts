/**
 * /api/cron/send-trustpilot-invitations runs as the service role.
 *
 * A Vercel cron request carries no cookies, so the session client it used to
 * build ran as anon: RLS hid every due invitation and the job reported
 * "No invitations ready" forever. This drives the handler against the local
 * stack with the session client mocked to exactly that anon client: a due
 * invitation must be processed and its outcome recorded. The fixture order is
 * not completed, so the honest outcome is `skipped / not_completed` and no
 * email at all (since 2026-10-11 the cron never mails a non-qualifying order).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import { hasEnv, makeFixture, URL, ANON, type Fixture } from '../guards/throwaway'

let sessionClient: SupabaseClient | null = null
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    if (!sessionClient) throw new Error('test: session client not set')
    return sessionClient
  },
}))
const mail = vi.hoisted(() => ({ receipt: vi.fn(async (_: unknown) => ({ success: true })) }))
vi.mock('@/lib/email', async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>()
  const stubs = Object.fromEntries(Object.keys(real).map((k) => [k, async () => undefined]))
  return { ...stubs, sendOrderCompletionEmail: mail.receipt }
})

let fx: Fixture | null = null
const SECRET = 'guard-cron-secret'
const cronRequest = (path: string) => new NextRequest(`http://localhost${path}`, { headers: { authorization: `Bearer ${SECRET}` } })
const saved = { bcc: process.env.TRUSTPILOT_BCC_EMAIL }

describe.skipIf(!hasEnv)('trustpilot invitations cron (integration)', () => {
  beforeAll(async () => {
    process.env.CRON_SECRET = SECRET
    process.env.TRUSTPILOT_BCC_EMAIL = 'guard@invite.example.com'
    fx = await makeFixture()
    sessionClient = createClient(URL!, ANON!, { auth: { persistSession: false } })
    const { data: buyer } = await fx.svc.from('profiles').select('email').eq('id', fx.buyer.id).single()
    const { error } = await fx.svc.from('trustpilot_invitations').insert({
      order_id: fx.pendingOrderId, buyer_id: fx.buyer.id, email: (buyer as any).email,
      scheduled_for: new Date(Date.now() - 60_000).toISOString(),
    })
    if (error) throw new Error(`invitation insert: ${error.message}`)
  }, 60_000)

  afterAll(async () => {
    if (saved.bcc !== undefined) process.env.TRUSTPILOT_BCC_EMAIL = saved.bcc
    else delete process.env.TRUSTPILOT_BCC_EMAIL
    if (!fx) return
    await fx.svc.from('trustpilot_invitations').delete().eq('order_id', fx.pendingOrderId)
    await fx.cleanup()
  }, 60_000)

  it('the anon session client cannot see the invitation (why the cron found nothing)', async () => {
    const { data } = await sessionClient!.from('trustpilot_invitations').select('order_id').eq('order_id', fx!.pendingOrderId)
    expect(data ?? []).toHaveLength(0)
  })

  it('GET processes the due invitation as the service role and records the honest outcome', async () => {
    const { GET } = await import('@/app/api/cron/send-trustpilot-invitations/route')
    const res = await GET(cronRequest('/api/cron/send-trustpilot-invitations'))
    const body = await res.json()
    expect(res.status, JSON.stringify(body)).toBe(200)
    expect(body.processed, JSON.stringify(body)).toBeGreaterThanOrEqual(1)
    const { data } = await fx!.svc
      .from('trustpilot_invitations')
      .select('status, skip_reason, sent_at')
      .eq('order_id', fx!.pendingOrderId)
      .single()
    expect(data).toMatchObject({ status: 'skipped', skip_reason: 'not_completed', sent_at: null })
    expect(mail.receipt).not.toHaveBeenCalledWith(expect.objectContaining({ orderId: fx!.pendingOrderId }))
  })

  it('rejects a request without the cron secret', async () => {
    const { GET } = await import('@/app/api/cron/send-trustpilot-invitations/route')
    const res = await GET(new NextRequest('http://localhost/api/cron/send-trustpilot-invitations'))
    expect(res.status).toBe(401)
  })
})
