/**
 * ACC-07 — /sell/* is for sellers (and applicants building drafts) only.
 * The middleware asks ONE question, the sell_access_kind RPC, and routes:
 *   seller / admin / applicant → through
 *   seller_blocked             → /account/restrictions
 *   none                       → /account/become-seller
 * /account/listings* keeps its role gate; /seller* and /sell/fees are untouched.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => ({ user: { id: 'u-1' } as { id: string } | null, kind: 'none' as string, rpcCalls: [] as string[] }))
vi.mock('@/lib/supabase/middleware', () => ({
  createMiddlewareClient: () => ({
    supabase: {
      auth: { getUser: async () => ({ data: { user: h.user }, error: null }) },
      rpc: async (name: string) => { h.rpcCalls.push(name); return { data: h.kind, error: null } },
      from: () => { throw new Error('the middleware must not read tables directly') },
    },
    response: { cookies: { getAll: () => [] } },
  }),
}))

import { middleware } from './middleware'

async function go(path: string) {
  const res = await middleware(new NextRequest(`http://localhost${path}`))
  return { status: res.status, location: res.headers.get('location') }
}

beforeEach(() => { h.user = { id: 'u-1' }; h.kind = 'none'; h.rpcCalls = [] })

describe('ACC-07 — /sell surface gate', () => {
  for (const path of ['/sell', '/sell/new', '/sell/bulk', '/sell/edit/abc']) {
    it(`${path}: a plain user is sent to /account/become-seller`, async () => {
      h.kind = 'none'
      const r = await go(path)
      expect(r.status).toBe(307)
      expect(r.location).toBe('http://localhost/account/become-seller')
      expect(h.rpcCalls).toEqual(['sell_access_kind'])
    })
  }

  for (const kind of ['seller', 'admin', 'applicant']) {
    it(`/sell/new: ${kind} passes`, async () => {
      h.kind = kind
      const r = await go('/sell/new')
      expect(r.status).toBe(200)
      expect(r.location).toBeNull()
    })
  }

  it('/sell/new: a restricted / banned seller lands on /account/restrictions', async () => {
    h.kind = 'seller_blocked'
    const r = await go('/sell/new')
    expect(r.location).toBe('http://localhost/account/restrictions')
  })

  it('/sell/fees stays public: no auth, no RPC', async () => {
    h.user = null
    const r = await go('/sell/fees')
    expect(r.status).toBe(200)
    expect(h.rpcCalls).toEqual([])
  })

  it('/seller-agreement and /seller/account are not the sell surface', async () => {
    h.kind = 'none'
    expect((await go('/seller-agreement')).status).toBe(200)
    // /seller/* is protected (login) but not seller-gated by this rule
    expect((await go('/seller/account')).location).toBeNull()
  })

  it('/account/listings keeps its role gate: applicants and admins without the seller role are bounced home', async () => {
    h.kind = 'applicant'
    expect((await go('/account/listings')).location).toBe('http://localhost/?access=seller-only')
    h.kind = 'seller_blocked'
    expect((await go('/account/listings')).status).toBe(200)
  })

  it('signed out: /sell/new goes to login with the return path, no RPC', async () => {
    h.user = null
    const r = await go('/sell/new')
    expect(r.location).toBe('http://localhost/login?redirect=%2Fsell%2Fnew')
    expect(h.rpcCalls).toEqual([])
  })
})
