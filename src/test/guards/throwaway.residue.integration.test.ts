/**
 * The fixture teardown must FAIL when a guard-test user survives — it used to
 * swallow deleteUser errors and leaked a seller + an active GUARD-TEST listing
 * into a real database (2026-09-12). This plants residue, expects the
 * verifier to throw, removes it, and expects the verifier to pass.
 *
 * And it must fail only for its OWN residue: the check used to match every
 * guard-test row, so one suite's leak failed every later suite's teardown.
 * A leak planted under another file's namespace must not fail this file's
 * scoped check, and this file's purge must not delete it.
 */
import { describe, it, expect } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { hasEnv, verifyNoGuardTestResidue, purgeNamespace, assertGuardTargetAllowed, URL, SVC } from './throwaway'
import { fixtureNamespace, type FixtureNamespace } from './fixture-namespace'

async function plantUser(svc: SupabaseClient, ns: FixtureNamespace, label: string): Promise<string> {
  const email = ns.email(label)
  const { data, error } = await svc.auth.admin.createUser({ email, password: `Pw!${ns.tag}Leak1`, email_confirm: true, user_metadata: { username: ns.username(label) } })
  if (error || !data.user) throw new Error(`createUser: ${error?.message}`)
  const uid = data.user.id
  const { data: prof } = await svc.from('profiles').select('id').eq('id', uid).maybeSingle()
  if (!prof) await svc.from('profiles').insert({ id: uid, username: ns.username(label), email })
  return uid
}

describe.skipIf(!hasEnv)('guard fixture teardown — leaked fixtures fail the run', () => {
  it('verifyNoGuardTestResidue throws on a leaked fixture user and passes once it is gone', async () => {
    assertGuardTargetAllowed(URL, process.env)
    const svc = createClient(URL!, SVC!, { auth: { persistSession: false } })
    const ns = fixtureNamespace()
    const uid = await plantUser(svc, ns, 'leak')
    try {
      await expect(verifyNoGuardTestResidue(svc, [], ns)).rejects.toThrow(/guard-test .*remain/)
      await expect(verifyNoGuardTestResidue(svc)).rejects.toThrow(/guard-test .*remain/)
    } finally {
      const { error: de } = await svc.auth.admin.deleteUser(uid)
      if (de) throw new Error(`deleteUser: ${de.message}`)
    }
    await expect(verifyNoGuardTestResidue(svc, [], ns)).resolves.toBeUndefined()
  }, 60_000)

  it("another file's leak neither fails this file's check nor gets purged by it", async () => {
    assertGuardTargetAllowed(URL, process.env)
    const svc = createClient(URL!, SVC!, { auth: { persistSession: false } })
    const mine = fixtureNamespace()
    const other = fixtureNamespace('elsewhere/some-other-suite.guard.integration.test.ts')
    const otherUid = await plantUser(svc, other, 'leak')
    const myUid = await plantUser(svc, mine, 'stale')
    try {
      // my stale row (a crashed earlier run of THIS file) fails my check…
      await expect(verifyNoGuardTestResidue(svc, [], mine)).rejects.toThrow(/remain \(throwaway\.residue/)
      // …my purge removes it, and only it
      expect(await purgeNamespace(svc, mine)).toEqual([])
      await expect(verifyNoGuardTestResidue(svc, [], mine)).resolves.toBeUndefined()
      const { data: survivor } = await svc.from('profiles').select('id').eq('id', otherUid).maybeSingle()
      expect(survivor, "this file's purge deleted another file's row").not.toBeNull()
      // the other file's own scoped check still sees its leak
      await expect(verifyNoGuardTestResidue(svc, [], other)).rejects.toThrow(/remain/)
    } finally {
      expect(await purgeNamespace(svc, other)).toEqual([])
      await svc.auth.admin.deleteUser(myUid).catch(() => {})
    }
    await expect(verifyNoGuardTestResidue(svc, [], other)).resolves.toBeUndefined()
  }, 60_000)
})
