/**
 * A seller who joined through /founding can get verified and withdraw (integration).
 * Migration *_identity_checks.
 *
 * On 2026-11-04 only approving an old-style application set is_verified, so 69 of 99
 * sellers had no way to cash out and the wallet promised "Verification opens in your
 * wallet soon". The provider is faked here; everything on our side is real.
 */
import { createHmac } from 'node:crypto'
import { NextRequest } from 'next/server'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { assertGuardTargetAllowed, hasEnv, makeFixture, type Fixture } from './throwaway'

const state = vi.hoisted(() => ({ client: null as any }))

vi.mock('next/cache', () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined, unstable_cache: (fn: any) => fn }))
vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined }) }))
vi.mock('@/lib/security/rate-limit', async (original) => ({ ...(await original<Record<string, unknown>>()), rateLimitAction: async () => null }))
vi.mock('@/lib/email', async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>()
  return Object.fromEntries(Object.keys(real).map((k) => [k, async () => undefined]))
})
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => state.client }))

import { startIdentityCheck } from '@/lib/actions/identity-check'
import { getIdentityCheckStatus } from '@/lib/identity/status'
import { GET as statusRoute } from '@/app/api/account/identity-check/route'
import { POST as webhook } from '@/app/api/webhooks/didit/route'

const SESSION = () => `aaaaaaaa-bbbb-4ccc-8ddd-${Date.now().toString(16).padStart(12, '0').slice(-12)}`
const realFetch = globalThis.fetch

/** Fakes only the provider's address; our own database calls go through. */
function fakeDidit(decision: { status: string; vendor_data: string } | null, sessionId = SESSION()) {
  const calls: string[] = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input)
    if (!url.includes('verification.didit.me')) return realFetch(input as any, init)
    calls.push(url)
    if (url.endsWith('/session/')) {
      return new Response(JSON.stringify({ session_id: sessionId, url: `https://verify.didit.me/s/${sessionId}` }), { status: 200 })
    }
    if (!decision) return new Response('gone', { status: 500 })
    return new Response(JSON.stringify(decision), { status: 200 })
  }) as typeof fetch
  return { calls, sessionId }
}

function signedRequest(body: object, secret = 'test-didit-secret') {
  const raw = JSON.stringify(body)
  return new NextRequest('http://localhost/api/webhooks/didit', {
    method: 'POST',
    body: raw,
    headers: { 'x-signature': createHmac('sha256', secret).update(raw, 'utf8').digest('hex'), 'x-timestamp': String(Math.floor(Date.now() / 1000)) },
  })
}

let fx: Fixture | null = null
const profile = async () => {
  const { data } = await fx!.svc.from('profiles').select('is_verified, kyc_status').eq('id', fx!.seller.id).single()
  return data as { is_verified: boolean | null; kyc_status: string | null }
}
const gate = async () => {
  const { data } = await fx!.svc.rpc('seller_withdrawal_gate', { p_seller_id: fx!.seller.id })
  return data as { eligible: boolean; reason: string | null; message?: string }
}
const reset = async () => {
  await fx!.svc.from('identity_checks').delete().eq('user_id', fx!.seller.id)
  await fx!.svc.from('profiles').update({ is_verified: false, kyc_status: null }).eq('id', fx!.seller.id)
}

describe.skipIf(!hasEnv)('identity check (integration)', () => {
  beforeAll(async () => {
    assertGuardTargetAllowed(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env)
    process.env.DIDIT_API_KEY = 'test-key'
    process.env.DIDIT_WORKFLOW_ID = 'test-workflow'
    process.env.DIDIT_WEBHOOK_SECRET = 'test-didit-secret'
    fx = await makeFixture()
    await fx.svc.from('profiles').update({ role: 'seller' }).eq('id', fx.seller.id)
    state.client = fx.seller.client
  }, 60_000)

  beforeEach(async () => {
    state.client = fx!.seller.client
    await reset()
  })

  afterEach(() => {
    globalThis.fetch = realFetch
  })

  afterAll(async () => {
    await fx?.svc.from('identity_checks').delete().eq('user_id', fx!.seller.id)
    if (fx) await fx.cleanup()
    delete process.env.DIDIT_API_KEY
    delete process.env.DIDIT_WORKFLOW_ID
    delete process.env.DIDIT_WEBHOOK_SECRET
  }, 60_000)

  it('an unverified seller is refused at withdrawal with a message that is true', async () => {
    const refused = await gate()
    expect(refused).toMatchObject({ eligible: false, reason: 'kyc_required' })
    expect(refused.message).toMatch(/verify your identity/i)
    expect(refused.message).not.toMatch(/soon/i)
  })

  it('starting a check needs no application', async () => {
    const didit = fakeDidit(null)
    const result = await startIdentityCheck()
    expect(result).toEqual({ ok: true, url: `https://verify.didit.me/s/${didit.sessionId}` })
    const { data } = await fx!.svc.from('identity_checks').select('session_id, status').eq('user_id', fx!.seller.id)
    expect(data).toEqual([{ session_id: didit.sessionId, status: 'started' }])
  })

  it('a second click within the hour reuses the open check', async () => {
    const didit = fakeDidit(null)
    await startIdentityCheck()
    await startIdentityCheck()
    expect(didit.calls.filter((c) => c.endsWith('/session/'))).toHaveLength(1)
  })

  it('the status route answers with the state and never the session link', async () => {
    const didit = fakeDidit(null)
    await startIdentityCheck()
    fakeDidit({ status: 'In Progress', vendor_data: fx!.seller.id }, didit.sessionId)
    const res = await statusRoute()
    const text = await res.text()
    expect(JSON.parse(text)).toEqual({ state: 'not_started', available: true })
    expect(text).not.toContain(didit.sessionId)
    expect(res.headers.get('cache-control')).toContain('no-store')
  })

  it('a buyer cannot start one', async () => {
    state.client = fx!.buyer.client
    fakeDidit(null)
    const result = await startIdentityCheck()
    expect(result.ok).toBe(false)
  })

  it('an approved decision verifies the seller and opens the withdrawal gate past the ID step', async () => {
    const didit = fakeDidit({ status: 'Approved', vendor_data: fx!.seller.id })
    await startIdentityCheck()
    expect((await getIdentityCheckStatus()).state).toBe('verified')

    expect(await profile()).toEqual({ is_verified: true, kyc_status: 'approved' })
    expect((await gate()).reason).not.toBe('kyc_required')
    const { data } = await fx!.svc.from('identity_checks').select('status, decided_at').eq('session_id', didit.sessionId).single()
    expect(data?.status).toBe('approved')
    expect(data?.decided_at).not.toBeNull()
  })

  it('in review and declined do not verify', async () => {
    fakeDidit({ status: 'In Review', vendor_data: fx!.seller.id })
    await startIdentityCheck()
    expect((await getIdentityCheckStatus()).state).toBe('in_review')
    expect((await profile()).is_verified).toBe(false)

    await reset()
    fakeDidit({ status: 'Declined', vendor_data: fx!.seller.id })
    await startIdentityCheck()
    expect((await getIdentityCheckStatus()).state).toBe('needs_attention')
    expect((await profile()).is_verified).toBe(false)
  })

  it('a decision for someone else’s user id is ignored', async () => {
    fakeDidit({ status: 'Approved', vendor_data: fx!.buyer.id })
    await startIdentityCheck()
    await getIdentityCheckStatus()
    expect((await profile()).is_verified).toBe(false)
  })

  describe('webhook', () => {
    it('a signed Approved call verifies only after the provider confirms it', async () => {
      const didit = fakeDidit({ status: 'Approved', vendor_data: fx!.seller.id })
      await startIdentityCheck()
      const res = await webhook(signedRequest({ session_id: didit.sessionId, status: 'Approved', vendor_data: fx!.seller.id }))
      expect(res.status).toBe(200)
      expect((await profile()).is_verified).toBe(true)
      expect(didit.calls.some((c) => c.includes(`/session/${didit.sessionId}/decision/`))).toBe(true)
    })

    it('a signed call the provider does not back up does not verify', async () => {
      const didit = fakeDidit({ status: 'In Review', vendor_data: fx!.seller.id })
      await startIdentityCheck()
      await webhook(signedRequest({ session_id: didit.sessionId, status: 'Approved', vendor_data: fx!.seller.id }))
      expect((await profile()).is_verified).toBe(false)
    })

    it('a forged signature changes nothing', async () => {
      const didit = fakeDidit({ status: 'Approved', vendor_data: fx!.seller.id })
      await startIdentityCheck()
      const res = await webhook(signedRequest({ session_id: didit.sessionId, status: 'Approved', vendor_data: fx!.seller.id }, 'wrong-secret'))
      expect(res.status).toBe(401)
      expect((await profile()).is_verified).toBe(false)
    })

    it('when the provider cannot be reached it answers 500 so the call is retried', async () => {
      const didit = fakeDidit(null)
      await startIdentityCheck()
      const res = await webhook(signedRequest({ session_id: didit.sessionId, status: 'Approved', vendor_data: fx!.seller.id }))
      expect(res.status).toBe(500)
      expect((await profile()).is_verified).toBe(false)
    })
  })

  describe('the database', () => {
    it('a signed-in user cannot record their own result or read the table', async () => {
      const { error } = await fx!.seller.client.rpc('identity_check_record', { p_session: 'x', p_status: 'approved' })
      expect(error?.code).toBe('42501')
      const read = await fx!.seller.client.from('identity_checks').select('id')
      expect(read.error?.code ?? (read.data ?? []).length).toBeTruthy()
    })

    it('a seller still cannot write is_verified directly', async () => {
      await fx!.seller.client.from('profiles').update({ is_verified: true }).eq('id', fx!.seller.id)
      expect((await profile()).is_verified).toBe(false)
    })

    it('an approval reversed by the provider takes verification back', async () => {
      const didit = fakeDidit({ status: 'Approved', vendor_data: fx!.seller.id })
      await startIdentityCheck()
      await getIdentityCheckStatus()
      expect((await profile()).is_verified).toBe(true)
      await fx!.svc.rpc('identity_check_record', { p_session: didit.sessionId, p_status: 'declined' })
      expect(await profile()).toEqual({ is_verified: false, kyc_status: 'rejected' })
    })

    it('a reversal still takes verification back after the check went through review', async () => {
      const didit = fakeDidit({ status: 'Approved', vendor_data: fx!.seller.id })
      await startIdentityCheck()
      await getIdentityCheckStatus()
      await fx!.svc.rpc('identity_check_record', { p_session: didit.sessionId, p_status: 'in_review' })
      expect((await profile()).is_verified).toBe(true)
      await fx!.svc.rpc('identity_check_record', { p_session: didit.sessionId, p_status: 'declined' })
      expect((await profile()).is_verified).toBe(false)
    })

    it('a declined check never touches a seller verified some other way', async () => {
      const didit = fakeDidit(null)
      await startIdentityCheck()
      await fx!.svc.from('profiles').update({ is_verified: true, kyc_status: 'approved' }).eq('id', fx!.seller.id)
      await fx!.svc.rpc('identity_check_record', { p_session: didit.sessionId, p_status: 'declined' })
      expect(await profile()).toEqual({ is_verified: true, kyc_status: 'approved' })
    })

    it('an unknown session records nothing', async () => {
      const { data } = await fx!.svc.rpc('identity_check_record', { p_session: 'no-such-session-id', p_status: 'approved' })
      expect(data).toMatchObject({ recorded: false })
    })
  })
})
