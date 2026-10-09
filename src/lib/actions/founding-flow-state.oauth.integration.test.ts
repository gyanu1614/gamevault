/**
 * /founding step 1 after Google/Discord sign-in (integration, local stack):
 * getFoundingFlowState carries the Discord username to prefill in step 2 —
 * read from the auth identity, never a profile column — and nothing about
 * the password: the site-wide modal (PasswordGate) handles that over /founding.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { hasEnv, makeFixture, type Fixture } from '@/test/guards/throwaway'

let fx: Fixture | null = null

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    if (!fx) throw new Error('fixture not ready')
    return fx.buyer.client
  },
}))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('next/cache', () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }))
vi.mock('@/lib/security/rate-limit', () => ({ rateLimitAction: async () => null }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/email', async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>()
  return Object.fromEntries(Object.keys(real).map((k) => [k, async () => undefined]))
})
vi.setConfig({ testTimeout: 30_000, hookTimeout: 60_000 })

describe.skipIf(!hasEnv)('founding flow state — OAuth fields (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
  })
  afterAll(async () => {
    await fx?.cleanup()
  })

  it('an email+password account has no Discord handle to prefill', async () => {
    const a = await import('@/lib/actions/founding-onboarding')
    const state = await a.getFoundingFlowState()
    expect(state.signedIn).toBe(true)
    expect(state.discordHandle).toBeNull()
  })
})
