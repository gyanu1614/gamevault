/**
 * /auth/callback — OAuth return. Every account lands on `next` (the Set Your
 * Password modal opens there on its own; the middleware covers protected
 * routes); a new OAuth account never keeps its email local-part as its
 * public username or the provider photo as its avatar.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

type FakeUser = Record<string, unknown>

const state: { user: FakeUser | null; exchangeError: { message: string } | null } = {
  user: null,
  exchangeError: null,
}

const verifyOtp = vi.fn(async () => ({ error: null }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      exchangeCodeForSession: async () =>
        state.exchangeError ? { data: { user: null }, error: state.exchangeError } : { data: { user: state.user }, error: null },
      getUser: async () => ({ data: { user: state.user } }),
      verifyOtp,
    },
  }),
}))

vi.mock('@/lib/actions/auth', () => ({
  syncProfileEmail: vi.fn(async () => ({ error: null })),
  generateUniqueGamerTag: vi.fn(async () => ({ username: 'SilentRaptor42' })),
}))

vi.mock('@/lib/utils/avatar', () => ({ generateDiceBearAvatar: (u: string) => `https://api.dicebear.com/7.x/bottts/svg?seed=${u}` }))

/** profiles rows the fake service-role client serves and records writes to. */
const profiles: Record<string, { id: string; username: string; avatar_url?: string | null } | undefined> = {}
const profileUpdate = vi.fn()
const profileInsert = vi.fn()
vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: () => ({
    from: () => ({
      select: () => ({ eq: (_c: string, id: string) => ({ maybeSingle: async () => ({ data: profiles[id] ?? null, error: null }) }) }),
      update: (patch: unknown) => ({ eq: (_c: string, id: string) => { profileUpdate(id, patch); return Promise.resolve({ error: null }) } }),
      insert: (row: unknown) => { profileInsert(row); return Promise.resolve({ error: null }) },
    }),
  }),
}))

const googleOnly: FakeUser = {
  id: 'u-google',
  email: 'jane.doe1987@gmail.com',
  app_metadata: { provider: 'google', providers: ['google'] },
  identities: [{ provider: 'google', identity_data: { email: 'jane.doe1987@gmail.com' } }],
}
const emailUser: FakeUser = { id: 'u-email', email: 'buyer@x.y', app_metadata: { provider: 'email', providers: ['email'] }, identities: [] }

async function hit(query: string, cookie?: string) {
  const { GET } = await import('./route')
  const res = await GET(new Request(`http://localhost:3025/auth/callback${query}`, cookie ? { headers: { cookie } } : undefined))
  return { status: res.status, location: res.headers.get('location'), setCookie: res.headers.get('set-cookie') }
}

beforeEach(() => {
  state.user = null
  state.exchangeError = null
  for (const k of Object.keys(profiles)) delete profiles[k]
  profiles['u-email'] = { id: 'u-email', username: 'buyer_chosen', avatar_url: 'https://xyz.supabase.co/storage/v1/object/public/avatars/u-email/avatar.webp' }
  profileUpdate.mockClear()
  profileInsert.mockClear()
  verifyOtp.mockClear()
})

describe('/auth/callback — OAuth code exchange', () => {
  it('lands a password-less Google account on next (the modal opens there)', async () => {
    state.user = googleOnly
    const r = await hit('?code=abc&next=%2Fadopt-me')
    expect(r.status).toBe(307)
    expect(r.location).toBe('http://localhost:3025/adopt-me')
  })

  it('reads next from the OAuth cookie (the return URL stays bare) and clears it', async () => {
    state.user = googleOnly
    const r = await hit('?code=abc', `dm_oauth_next=${encodeURIComponent('/founding#src=banner')}; other=1`)
    expect(r.location).toBe('http://localhost:3025/founding#src=banner')
    expect(r.setCookie).toMatch(/dm_oauth_next=;.*Max-Age=0/i)
  })

  it('a query next wins over the cookie, and the cookie is sanitized too', async () => {
    state.user = emailUser
    expect((await hit('?code=abc&next=%2Fadopt-me', 'dm_oauth_next=%2Ffounding')).location).toBe('http://localhost:3025/adopt-me')
    expect((await hit('?code=abc', 'dm_oauth_next=https%3A%2F%2Fevil.com')).location).toBe('http://localhost:3025/')
  })

  it('lands an account that already has a password on next, unchanged', async () => {
    state.user = emailUser
    const r = await hit('?code=abc&next=%2Faccount%2Forders')
    expect(r.location).toBe('http://localhost:3025/account/orders')
  })

  it('never follows an off-site next', async () => {
    state.user = googleOnly
    const r = await hit('?code=abc&next=https%3A%2F%2Fevil.com')
    expect(r.location).toBe('http://localhost:3025/')
  })

  it('gives a new OAuth account a gamer tag and the site avatar instead of the email handle and provider photo', async () => {
    state.user = googleOnly
    // what the profile trigger produced from Google's metadata
    profiles['u-google'] = { id: 'u-google', username: 'jane.doe1987', avatar_url: 'https://lh3.googleusercontent.com/a/ACg8oc_photo' }
    await hit('?code=abc')
    expect(profileUpdate).toHaveBeenCalledWith('u-google', {
      username: 'SilentRaptor42',
      avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=SilentRaptor42',
    })
    expect(profileInsert).not.toHaveBeenCalled()
  })

  it('creates the profile when the trigger could not (username CHECK), with a gamer tag and site avatar', async () => {
    state.user = googleOnly
    await hit('?code=abc')
    expect(profileInsert).toHaveBeenCalledWith({
      id: 'u-google',
      username: 'SilentRaptor42',
      email: 'jane.doe1987@gmail.com',
      avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=SilentRaptor42',
    })
    expect(profileUpdate).not.toHaveBeenCalled()
  })

  it('swaps only the provider photo when the username is already fine', async () => {
    state.user = googleOnly
    profiles['u-google'] = { id: 'u-google', username: 'KeptName', avatar_url: 'https://cdn.discordapp.com/avatars/1/abc.png' }
    await hit('?code=abc')
    expect(profileUpdate).toHaveBeenCalledWith('u-google', {
      avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=KeptName',
    })
  })

  it('leaves a chosen username and uploaded avatar alone', async () => {
    state.user = emailUser
    await hit('?code=abc')
    expect(profileUpdate).not.toHaveBeenCalled()
    expect(profileInsert).not.toHaveBeenCalled()
  })

  it('maps a provider error for an unverified Discord email to a readable signal', async () => {
    const r = await hit(
      '?error=access_denied&error_code=unexpected_failure&error_description=Unverified%20email%20with%20discord.%20A%20confirmation%20email%20has%20been%20sent%20to%20your%20discord%20email&next=%2Fadopt-me',
    )
    expect(r.location).toBe('http://localhost:3025/adopt-me?auth_error=oauth_unverified_email')
  })

  it('maps a provider that shared no email', async () => {
    const r = await hit('?error=server_error&error_description=Error%20getting%20user%20email%20from%20external%20provider')
    expect(r.location).toBe('http://localhost:3025/?auth_error=oauth_no_email')
  })

  it('keeps the signup confirmation path (token_hash) exactly as before', async () => {
    state.user = emailUser
    const r = await hit('?token_hash=t&type=signup&next=%2Ffounding')
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: 't', type: 'signup' })
    expect(r.location).toBe('http://localhost:3025/founding?confirmed=1')
  })
})
