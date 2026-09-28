/**
 * /api/cron/send-trustpilot-invitations runs as the service role.
 *
 * A Vercel cron request carries no cookies, so the session client it used to
 * build ran as anon: RLS hid every due invitation and the job reported
 * "No invitations ready" forever. This drives the handler against the local
 * stack with the session client mocked to exactly that anon client: a due
 * invitation must be sent (email mocked) and stamped sent_at.
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
const mail = vi.hoisted(() => ({ invite: vi.fn(async (_: unknown) => ({ success: true })) }))
vi.mock('@/lib/email', async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>()
  const stubs = Object.fromEntries(Object.keys(real).map((k) => [k, async () => undefined]))
  return { ...stubs, sendTrustpilotInvitationEmail: mail.invite }
})

let fx: Fixture | null = null
const SECRET = 'guard-cron-secret'
const cronRequest = (path: string) => new NextRequest(`http://localhost${path}`, { headers: { authorization: `Bearer ${SECRET}` } })
const saved = {
  bu: process.env.NEXT_PUBLIC_TRUSTPILOT_BUSINESS_UNIT_ID,
  bcc: process.env.TRUSTPILOT_BCC_EMAIL,
  key: process.env.TRUSTPILOT_API_KEY,
}

describe.skipIf(!hasEnv)('trustpilot invitations cron (integration)', () => {
  beforeAll(async () => {
    process.env.CRON_SECRET = SECRET
    process.env.NEXT_PUBLIC_TRUSTPILOT_BUSINESS_UNIT_ID = 'guard-business-unit'
    delete process.env.TRUSTPILOT_BCC_EMAIL
    delete process.env.TRUSTPILOT_API_KEY
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
    process.env.NEXT_PUBLIC_TRUSTPILOT_BUSINESS_UNIT_ID = saved.bu
    if (saved.bcc !== undefined) process.env.TRUSTPILOT_BCC_EMAIL = saved.bcc
    if (saved.key !== undefined) process.env.TRUSTPILOT_API_KEY = saved.key
    if (!fx) return
    await fx.svc.from('trustpilot_invitations').delete().eq('order_id', fx.pendingOrderId)
    await fx.cleanup()
  }, 60_000)

  it('the anon session client cannot see the invitation (why the cron found nothing)', async () => {
    const { data } = await sessionClient!.from('trustpilot_invitations').select('order_id').eq('order_id', fx!.pendingOrderId)
    expect(data ?? []).toHaveLength(0)
  })

  it('GET sends the due invitation and stamps sent_at', async () => {
    const { GET } = await import('@/app/api/cron/send-trustpilot-invitations/route')
    const res = await GET(cronRequest('/api/cron/send-trustpilot-invitations'))
    const body = await res.json()
    expect(res.status, JSON.stringify(body)).toBe(200)
    const mine = (body.results ?? []).find((r: any) => r.orderId === fx!.pendingOrderId)
    expect(mine, JSON.stringify(body)).toMatchObject({ success: true })
    expect(mail.invite).toHaveBeenCalledWith(expect.objectContaining({ orderId: fx!.pendingOrderId }))
    const { data } = await fx!.svc.from('trustpilot_invitations').select('sent_at').eq('order_id', fx!.pendingOrderId).single()
    expect((data as any).sent_at).not.toBeNull()
  })

  it('rejects a request without the cron secret', async () => {
    const { GET } = await import('@/app/api/cron/send-trustpilot-invitations/route')
    const res = await GET(new NextRequest('http://localhost/api/cron/send-trustpilot-invitations'))
    expect(res.status).toBe(401)
  })
})
