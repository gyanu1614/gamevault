/**
 * One account per email (integration, local stack).
 *
 * Google first, then an email signup with the same address: the signup form
 * is told the email is taken (checkEmailAvailability), and Supabase itself
 * never mints a second auth user for that email. The Google-shaped account
 * also keeps tripping the required-password rule until a password is set.
 *
 * The reverse direction (email first, then Google with the same email) is
 * GoTrue's automatic linking, which only links provider-VERIFIED emails and
 * cannot be driven without a real Google round trip — covered by the owner's
 * localhost check and the rollout note (prod "Confirm email" must stay ON).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { createClient } from '@supabase/supabase-js'

// checkEmailAvailability runs on the service role; the cookie client module
// it sits next to needs a request scope (React cache), so stub it out.
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => null }))
vi.mock('server-only', () => ({}))
// Four auth-server round trips per test on a loaded laptop: give them room.
vi.setConfig({ testTimeout: 20_000, hookTimeout: 30_000 })
import { ANON, SVC, URL, assertGuardTargetAllowed, hasEnv, purgeFixtureUsers } from './throwaway'
import { fixtureNamespace } from './fixture-namespace'
import { needsPassword } from '@/lib/auth/oauth'
import { checkEmailAvailability } from '@/lib/actions/auth'

const ns = fixtureNamespace()
const created: string[] = []
const svc = hasEnv ? createClient(URL!, SVC!, { auth: { persistSession: false, autoRefreshToken: false } }) : null

beforeAll(() => {
  if (!hasEnv) return
  assertGuardTargetAllowed(URL, process.env)
})

afterAll(async () => {
  if (!svc) return
  const failures: string[] = []
  await purgeFixtureUsers(svc, created, failures)
  if (failures.length) throw new Error(`cleanup: ${failures.join('; ')}`)
})

describe.skipIf(!hasEnv)('one account per email — Google first, email signup second', () => {
  const email = ns.email('googlefirst')

  it('a Google-shaped account exists and still needs a password', async () => {
    const { data, error } = await svc!.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { username: ns.username('gfirst'), full_name: 'Guard Google' },
      app_metadata: { provider: 'google', providers: ['google'] },
    })
    if (error || !data.user) throw new Error(`createUser: ${error?.message}`)
    created.push(data.user.id)
    const { data: fetched } = await svc!.auth.admin.getUserById(data.user.id)
    expect(needsPassword(fetched.user)).toBe(true)
  })

  it('the signup form is told the email is taken', async () => {
    const res = await checkEmailAvailability(email)
    expect(res.available).toBe(false)
  })

  it('an email signup with that address never creates a second auth user', async () => {
    const anon = createClient(URL!, ANON!, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data, error } = await anon.auth.signUp({ email, password: `Guard!${ns.tag}xyz9` })
    // Supabase either refuses outright (autoconfirm stacks) or returns an
    // obfuscated user with no identities (confirm-email stacks). Never a
    // fresh account with the same email.
    if (!error) expect(data.user?.identities ?? []).toHaveLength(0)
    const { data: list } = await svc!.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const matches = (list?.users ?? []).filter((u) => u.email?.toLowerCase() === email.toLowerCase())
    expect(matches).toHaveLength(1)
    expect(matches[0].id).toBe(created[0])
  })

  it('setting a password clears the rule (flag + email identity), so the gate opens', async () => {
    const { error } = await svc!.auth.admin.updateUserById(created[0], {
      password: `Guard!${ns.tag}set9`,
      app_metadata: { provider: 'google', providers: ['google'], password_set: true },
    })
    expect(error).toBeNull()
    const { data: fetched } = await svc!.auth.admin.getUserById(created[0])
    expect(needsPassword(fetched.user)).toBe(false)
    // And the password really works for an email login afterwards.
    const anon = createClient(URL!, ANON!, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: session, error: se } = await anon.auth.signInWithPassword({ email, password: `Guard!${ns.tag}set9` })
    expect(se).toBeNull()
    expect(session.user?.id).toBe(created[0])
  })
})
