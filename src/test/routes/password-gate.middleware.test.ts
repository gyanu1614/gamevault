/**
 * Server-side password gate: a signed-in account with no password may not
 * use a protected route until it sets one. Enforced in src/middleware.ts on
 * the getUser() it already makes for protected paths.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const state: { user: Record<string, unknown> | null } = { user: null }

vi.mock('@/lib/supabase/middleware', async () => {
  const { NextResponse } = await import('next/server')
  return {
    createMiddlewareClient: (request: NextRequest) => ({
      supabase: {
        auth: { getUser: async () => ({ data: { user: state.user }, error: state.user ? null : { message: 'no' } }) },
        rpc: async () => ({ data: 'none' }),
      },
      response: NextResponse.next({ request: { headers: request.headers } }),
    }),
  }
})

const googleOnly = { id: 'u1', app_metadata: { providers: ['google'] }, identities: [{ provider: 'google' }] }
const emailUser = { id: 'u2', app_metadata: { providers: ['email'] }, identities: [{ provider: 'email' }] }

async function run(path: string) {
  const { middleware } = await import('@/middleware')
  const res = await middleware(new NextRequest(`http://localhost:3025${path}`))
  return { status: res.status, location: res.headers.get('location') }
}

beforeEach(() => {
  state.user = null
})

describe('middleware password gate', () => {
  it('bounces a password-less account off a protected route to Set Your Password', async () => {
    state.user = googleOnly
    const r = await run('/account/orders')
    expect(r.status).toBe(307)
    expect(r.location).toBe('http://localhost:3025/auth/set-password?next=%2Faccount%2Forders')
  })

  it('lets an account with a password through', async () => {
    state.user = emailUser
    const r = await run('/account/orders')
    expect(r.status).toBe(200)
    expect(r.location).toBeNull()
  })

  it('does not gate the set-password screen itself (it is not a protected route)', async () => {
    state.user = googleOnly
    const r = await run('/auth/set-password')
    expect(r.status).toBe(200)
  })

  it('still sends a signed-out visitor to login', async () => {
    const r = await run('/account/orders')
    expect(r.location).toBe('http://localhost:3025/login?redirect=%2Faccount%2Forders')
  })
})
