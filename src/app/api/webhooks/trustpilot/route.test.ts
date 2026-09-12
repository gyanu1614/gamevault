/**
 * AUTH-015 — the Trustpilot webhook must fail CLOSED: with no secret configured
 * it refuses every request (503) instead of skipping verification.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ from: () => ({ update: () => ({ eq: async () => ({ error: null }) }) }) }),
}))

async function post(body: string, headers: Record<string, string> = {}) {
  vi.resetModules()
  const { POST } = await import('./route')
  const { NextRequest } = await import('next/server')
  return POST(new NextRequest('http://localhost/api/webhooks/trustpilot', { method: 'POST', body, headers }))
}

async function hmacHex(secret: string, body: string) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body))
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

const BODY = JSON.stringify({ eventName: 'service-review-created', reviewId: 'r1', referenceId: 'order-1', businessUnitId: 'bu' })

describe('Trustpilot webhook — AUTH-015 fail-closed', () => {
  beforeEach(() => { delete process.env.TRUSTPILOT_WEBHOOK_SECRET })

  it('secret unset → 503, even with a signature header (the old fail-open path)', async () => {
    const res = await post(BODY, { 'x-trustpilot-signature': 'sha256=deadbeef' })
    expect(res.status).toBe(503)
  })

  it('secret set, no signature → 401', async () => {
    process.env.TRUSTPILOT_WEBHOOK_SECRET = 'test-secret'
    expect((await post(BODY)).status).toBe(401)
  })

  it('secret set, forged signature → 401', async () => {
    process.env.TRUSTPILOT_WEBHOOK_SECRET = 'test-secret'
    const forged = await hmacHex('wrong-secret', BODY)
    expect((await post(BODY, { 'x-trustpilot-signature': `sha256=${forged}` })).status).toBe(401)
  })

  it('secret set, genuine signature → passes verification', async () => {
    process.env.TRUSTPILOT_WEBHOOK_SECRET = 'test-secret'
    const good = await hmacHex('test-secret', BODY)
    const res = await post(BODY, { 'x-trustpilot-signature': `sha256=${good}` })
    expect([401, 503]).not.toContain(res.status)
  })
})
