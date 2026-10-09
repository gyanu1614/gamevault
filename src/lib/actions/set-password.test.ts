/**
 * setInitialPassword — the ONLY write path for the post-OAuth password. It
 * must refuse an account that already has a password (an email identity or
 * the stored flag): it is never a change-password-without-the-old-one route.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const state: { user: Record<string, unknown> | null; limited: boolean; updateError: { message: string } | null } = {
  user: null,
  limited: false,
  updateError: null,
}

const updateUser = vi.fn(async () => ({ error: state.updateError }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: state.user }, error: null }),
      updateUser,
    },
  }),
}))

const adminUpdate = vi.fn(async () => ({ error: null }))
vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: () => ({ auth: { admin: { updateUserById: adminUpdate } } }),
}))

vi.mock('@/lib/security/rate-limit', () => ({
  rateLimitAction: async () => (state.limited ? { error: 'Too many attempts.', rateLimited: true, retryAfter: 60 } : null),
}))

const googleOnly = { id: 'u1', app_metadata: { providers: ['google'] }, identities: [{ provider: 'google' }] }
const emailUser = { id: 'u2', app_metadata: { providers: ['email'] }, identities: [{ provider: 'email' }] }
const flagged = { id: 'u3', app_metadata: { providers: ['google'], password_set: true }, identities: [{ provider: 'google' }] }

beforeEach(() => {
  state.user = null
  state.limited = false
  state.updateError = null
  updateUser.mockClear()
  adminUpdate.mockClear()
})

describe('setInitialPassword', () => {
  it('sets the password for a password-less OAuth account and stamps the flag', async () => {
    state.user = googleOnly
    const { setInitialPassword } = await import('./set-password')
    const r = await setInitialPassword('correct-horse-9')
    expect(r).toEqual({ ok: true })
    expect(updateUser).toHaveBeenCalledWith({ password: 'correct-horse-9' })
    expect(adminUpdate).toHaveBeenCalledWith('u1', { app_metadata: { password_set: true } })
  })

  it('refuses an account that already has a password (email identity)', async () => {
    state.user = emailUser
    const { setInitialPassword } = await import('./set-password')
    const r = await setInitialPassword('correct-horse-9')
    expect(r.ok).toBe(false)
    expect(updateUser).not.toHaveBeenCalled()
    expect(adminUpdate).not.toHaveBeenCalled()
  })

  it('refuses an account whose stored flag says a password exists', async () => {
    state.user = flagged
    const { setInitialPassword } = await import('./set-password')
    const r = await setInitialPassword('correct-horse-9')
    expect(r.ok).toBe(false)
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('rejects a short password before touching auth', async () => {
    state.user = googleOnly
    const { setInitialPassword } = await import('./set-password')
    const r = await setInitialPassword('short7!')
    expect(r.ok).toBe(false)
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('requires a session', async () => {
    const { setInitialPassword } = await import('./set-password')
    const r = await setInitialPassword('correct-horse-9')
    expect(r.ok).toBe(false)
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('is rate limited', async () => {
    state.user = googleOnly
    state.limited = true
    const { setInitialPassword } = await import('./set-password')
    const r = await setInitialPassword('correct-horse-9')
    expect(r.ok).toBe(false)
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('does not stamp the flag when the auth update fails', async () => {
    state.user = googleOnly
    state.updateError = { message: 'weak' }
    const { setInitialPassword } = await import('./set-password')
    const r = await setInitialPassword('correct-horse-9')
    expect(r.ok).toBe(false)
    expect(adminUpdate).not.toHaveBeenCalled()
  })
})
