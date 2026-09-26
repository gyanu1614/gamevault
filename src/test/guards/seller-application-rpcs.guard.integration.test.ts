/**
 * AUTH-032 — the seller-application RPCs take the actor from auth.uid(), not
 * from a parameter, and are not callable with the anon key.
 * Exploits: `withdraw_seller_application(app, user_id_param)` and
 * `reject_seller_application(app, admin_id_param, …)` were SECURITY DEFINER,
 * EXECUTE-granted to anon + authenticated, and trusted the id parameter —
 * the ANON key withdrew another user's application (reproduced 2026-09-12).
 * Positive: the owner still withdraws their own; an admin holding
 * applications.review still rejects; the service role is unrestricted.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { hasEnv, p1GuardsApplied, makeFixture, URL, ANON, type Fixture } from './throwaway'

let fx: Fixture | null = null
let ready = false
let appId = ''
let createdPermission = false
const anon = () => createClient(URL!, ANON!, { auth: { persistSession: false } })

async function status() {
  const { data } = await fx!.svc.from('seller_applications').select('status, rejected_by, withdrawal_count').eq('id', appId).single()
  return data as any
}
async function reset() { await fx!.svc.from('seller_applications').update({ status: 'pending', rejected_by: null, rejected_at: null }).eq('id', appId) }

describe.skipIf(!hasEnv)('AUTH-032 — seller application RPCs are self-scoped (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    ready = await p1GuardsApplied(fx.svc)
    const { data, error } = await fx.svc.from('seller_applications').insert({
      user_id: fx.buyer.id, status: 'pending', is_18_or_older: true, seller_type: 'individual',
      display_name: 'RPC Applicant', submitted_at: new Date().toISOString(),
    }).select('id').single()
    if (error) throw new Error(`application insert: ${error.message}`)
    appId = (data as any).id
    const { data: perm } = await fx.svc.from('role_permissions').select('id').eq('role', 'admin').eq('permission', 'applications.review').maybeSingle()
    if (!perm) {
      const { error: pe } = await fx.svc.from('role_permissions').insert({ role: 'admin', permission: 'applications.review' })
      if (pe) throw new Error(`role_permissions insert: ${pe.message}`)
      createdPermission = true
    }
  }, 60_000)
  afterAll(async () => {
    if (createdPermission) await fx?.svc.from('role_permissions').delete().eq('role', 'admin').eq('permission', 'applications.review')
    await fx?.cleanup()
  }, 60_000)

  it('20260912100000_auth_p1.sql is applied to the target DB', () => {
    expect(ready).toBe(true)
  })

  it("the anon key cannot withdraw anyone's application", async () => {
    const { error } = await anon().rpc('withdraw_seller_application', { application_id_param: appId, user_id_param: fx!.buyer.id })
    expect(error, 'anon must be refused').not.toBeNull()
    expect(error!.code).toBe('42501')
    expect((await status()).status).toBe('pending')
  })

  it("another signed-in user cannot withdraw someone else's application by passing their id", async () => {
    const { data, error } = await fx!.seller.client.rpc('withdraw_seller_application', { application_id_param: appId, user_id_param: fx!.buyer.id })
    if (!error) expect((data as any).success).toBe(false)
    expect((await status()).status).toBe('pending')
  })

  it('the anon key cannot reject an application', async () => {
    const { error } = await anon().rpc('reject_seller_application', {
      application_id_param: appId, admin_id_param: fx!.admin.id, rejection_reason_param: 'x', rejection_category_param: 'other',
    })
    expect(error?.code).toBe('42501')
    expect((await status()).status).toBe('pending')
  })

  it('a non-admin user cannot reject an application even by passing an admin id', async () => {
    const { error } = await fx!.seller.client.rpc('reject_seller_application', {
      application_id_param: appId, admin_id_param: fx!.admin.id, rejection_reason_param: 'x', rejection_category_param: 'other',
    })
    expect(error, 'must be refused').not.toBeNull()
    expect(error!.code).toBe('42501')
    expect((await status()).status).toBe('pending')
  })

  it('an admin with applications.review rejects; rejected_by is the CALLER, not the parameter', async () => {
    const { data, error } = await fx!.admin.client.rpc('reject_seller_application', {
      application_id_param: appId, admin_id_param: fx!.buyer.id /* forged */, rejection_reason_param: 'probe', rejection_category_param: 'other',
    })
    expect(error).toBeNull()
    expect((data as any).success).toBe(true)
    const s = await status()
    expect(s.status).toBe('rejected')
    expect(s.rejected_by).toBe(fx!.admin.id)
    await reset()
  })

  it('the owner withdraws their own application (id parameter ignored in favour of auth.uid())', async () => {
    const { data, error } = await fx!.buyer.client.rpc('withdraw_seller_application', { application_id_param: appId, user_id_param: fx!.seller.id /* forged */ })
    expect(error).toBeNull()
    expect((data as any).success).toBe(true)
    expect((await status()).status).toBe('withdrawn')
    await reset()
  })
})
