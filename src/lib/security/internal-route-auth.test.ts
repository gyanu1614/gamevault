import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/security/rate-limit', () => ({
  checkRateLimitByIp: vi.fn(async () => ({ limited: false, retryAfter: 60, key: 'k' })),
  rateLimitResponse: vi.fn(() => Response.json({ success: false }, { status: 429 })),
}))

import { authorizeInternalRequest, constantTimeEqual } from './internal-route-auth'
import { checkRateLimitByIp } from '@/lib/security/rate-limit'

const req = (headers: Record<string, string> = {}) => new Request('https://x/api/internal/t', { headers })

describe('constantTimeEqual', () => {
  it('compares equal and unequal strings without throwing on length mismatch', () => {
    expect(constantTimeEqual('abc', 'abc')).toBe(true)
    expect(constantTimeEqual('abc', 'abd')).toBe(false)
    expect(constantTimeEqual('abc', 'abcd')).toBe(false)
    expect(constantTimeEqual('', '')).toBe(true)
  })
})

describe('authorizeInternalRequest', () => {
  it('rate-limits BEFORE comparing the secret', async () => {
    vi.mocked(checkRateLimitByIp).mockResolvedValueOnce({ limited: true, retryAfter: 60, key: 'k' })
    const res = await authorizeInternalRequest(req({ 'x-trend-radar-secret': 's3cret' }), { header: 'x-trend-radar-secret', secret: 's3cret' })
    expect(res.ok).toBe(false)
    expect(res.response?.status).toBe(429)
  })

  it('answers 500 when the secret is not configured — never open by default', async () => {
    const res = await authorizeInternalRequest(req({ 'x-trend-radar-secret': 'anything' }), { header: 'x-trend-radar-secret', secret: undefined })
    expect(res.ok).toBe(false)
    expect(res.response?.status).toBe(500)
  })

  it('rejects a missing or wrong secret with 401', async () => {
    const a = await authorizeInternalRequest(req(), { header: 'x-trend-radar-secret', secret: 's3cret' })
    expect(a.response?.status).toBe(401)
    const b = await authorizeInternalRequest(req({ 'x-trend-radar-secret': 'nope' }), { header: 'x-trend-radar-secret', secret: 's3cret' })
    expect(b.response?.status).toBe(401)
  })

  it('accepts the right secret', async () => {
    const res = await authorizeInternalRequest(req({ 'x-trend-radar-secret': 's3cret' }), { header: 'x-trend-radar-secret', secret: 's3cret' })
    expect(res.ok).toBe(true)
  })
})
