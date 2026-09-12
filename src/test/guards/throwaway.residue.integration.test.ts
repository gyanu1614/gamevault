/**
 * The fixture teardown must FAIL when a guard-test user survives — it used to
 * swallow deleteUser errors and leaked a seller + an active GUARD-TEST listing
 * into a real database (2026-09-12). This plants residue, expects the
 * verifier to throw, removes it, and expects the verifier to pass.
 */
import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { hasEnv, verifyNoGuardTestResidue, URL, SVC } from './throwaway'

describe.skipIf(!hasEnv)('guard fixture teardown — leaked fixtures fail the run', () => {
  it('verifyNoGuardTestResidue throws on a leaked fixture user and passes once it is gone', async () => {
    const svc = createClient(URL!, SVC!, { auth: { persistSession: false } })
    const tag = Math.random().toString(36).slice(2, 8)
    const email = `guardtest-leak-${tag}@example.com`
    const { data, error } = await svc.auth.admin.createUser({ email, password: `Pw!${tag}Leak1`, email_confirm: true, user_metadata: { username: `gt_leak_${tag}` } })
    if (error || !data.user) throw new Error(`createUser: ${error?.message}`)
    const uid = data.user.id
    try {
      const { data: prof } = await svc.from('profiles').select('id').eq('id', uid).maybeSingle()
      if (!prof) await svc.from('profiles').insert({ id: uid, username: `gt_leak_${tag}`, email })
      await expect(verifyNoGuardTestResidue(svc)).rejects.toThrow(/guard-test .*remain/)
    } finally {
      const { error: de } = await svc.auth.admin.deleteUser(uid)
      if (de) throw new Error(`deleteUser: ${de.message}`)
    }
    await expect(verifyNoGuardTestResidue(svc)).resolves.toBeUndefined()
  }, 60_000)
})
