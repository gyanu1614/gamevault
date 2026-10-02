import { describe, it, expect, vi, beforeEach } from 'vitest'

const insert = vi.fn(async () => ({ error: null }))
const limited = { limited: false, retryAfter: 1, key: 'k' }
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: () => ({ from: () => ({ insert }) }) }))
vi.mock('@/lib/security/rate-limit', () => ({ checkRateLimitByIp: vi.fn(async () => limited) }))

import { POST } from './route'

const req = (body: string) => new Request('http://localhost/api/events/value', { method: 'POST', body }) as never

describe('POST /api/events/value', () => {
  beforeEach(() => {
    insert.mockClear()
    limited.limited = false
  })

  it('stores a valid event', async () => {
    const res = await POST(req(JSON.stringify({ event: 'cta_click', surface: 'value_item', game: 'adopt-me', item: 'bat-dragon', state: 'in_stock' })))
    expect(res.status).toBe(204)
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ event: 'cta_click', game_slug: 'adopt-me', state: 'in_stock' }))
  })

  it('drops an invalid or oversized body without storing it', async () => {
    expect((await POST(req('not json'))).status).toBe(204)
    expect((await POST(req(JSON.stringify({ event: 'value_view', surface: 'value_item', game: 'x'.repeat(2000) })))).status).toBe(204)
    expect(insert).not.toHaveBeenCalled()
  })

  it('429s when the IP is over budget', async () => {
    limited.limited = true
    expect((await POST(req('{}'))).status).toBe(429)
    expect(insert).not.toHaveBeenCalled()
  })
})
