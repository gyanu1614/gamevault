/**
 * AUTH-014 — an applicant cannot review their own seller application.
 * Exploit: "Users can update own pending applications" had a USING clause
 * only, so the applicant sets status='approved' (public storefront goes live,
 * status UI reads approved), reviewed_by/reviewed_at, admin_notes and the
 * verification flags through PostgREST.
 * Positive: the applicant can still resubmit (status → 'pending', clearing the
 * admin's notes/review stamps) and withdraw; an admin holding
 * applications.review still reviews through the session client.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { hasEnv, p1GuardsApplied, makeFixture, expectGuardRejection, type Fixture } from './throwaway'

let fx: Fixture | null = null
let ready = false
let appId = ''
let createdPermission = false

async function setApp(patch: Record<string, unknown>) {
  const { error } = await fx!.svc.from('seller_applications').update(patch).eq('id', appId)
  if (error) throw new Error(`svc setApp: ${error.message}`)
}
async function readApp() {
  const { data } = await fx!.svc.from('seller_applications').select('*').eq('id', appId).single()
  return data as any
}

describe.skipIf(!hasEnv)('AUTH-014 — seller_applications self-review guard (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    ready = await p1GuardsApplied(fx.svc)
    const { data, error } = await fx.svc.from('seller_applications').insert({
      user_id: fx.buyer.id, status: 'pending', is_18_or_older: true, seller_type: 'individual',
      display_name: 'Guard Applicant', submitted_at: new Date().toISOString(),
    }).select('id').single()
    if (error) throw new Error(`application insert: ${error.message}`)
    appId = (data as any).id
    // A fresh local DB has no role_permissions seed — grant the fixture admin's role the
    // review permission so the has_permission door can be exercised; cleaned up below.
    const { data: perm } = await fx.svc.from('role_permissions').select('id')
      .eq('role', 'admin').eq('permission', 'applications.review').maybeSingle()
    if (!perm) {
      const { error: pe } = await fx.svc.from('role_permissions').insert({ role: 'admin', permission: 'applications.review' })
      if (pe) throw new Error(`role_permissions insert: ${pe.message}`)
      createdPermission = true
    }
  }, 60_000)
  afterAll(async () => {
    if (createdPermission) await fx?.svc.from('role_permissions').delete().eq('role', 'admin').eq('permission', 'applications.review')
    await fx?.cleanup()
  })

  it('20260912100000_auth_p1.sql is applied to the target DB', () => {
    expect(ready).toBe(true)
  })

  it('the applicant cannot approve their own application', async () => {
    const res = await fx!.buyer.client.from('seller_applications')
      .update({ status: 'approved' }).eq('id', appId).select('id')
    expectGuardRejection(res as any, 'seller_applications')
    expect((await readApp()).status).toBe('pending')
  })

  it('the applicant cannot stamp reviewed_by / reviewed_at / admin_notes', async () => {
    const res = await fx!.buyer.client.from('seller_applications')
      .update({ reviewed_by: fx!.buyer.id, reviewed_at: new Date().toISOString(), admin_notes: 'looks great' })
      .eq('id', appId).select('id')
    expectGuardRejection(res as any, 'seller_applications')
    const a = await readApp()
    expect(a.reviewed_by).toBeNull(); expect(a.reviewed_at).toBeNull(); expect(a.admin_notes).toBeNull()
  })

  it('the applicant cannot set the verification flags or rejection fields', async () => {
    const res = await fx!.buyer.client.from('seller_applications')
      .update({ identity_verified: true, address_verified: true, business_verified: true, tax_verified: true, rejection_reason: 'x' })
      .eq('id', appId).select('id')
    expectGuardRejection(res as any, 'seller_applications')
    const a = await readApp()
    expect([a.identity_verified, a.address_verified, a.business_verified, a.tax_verified]).not.toContain(true)
  })

  it('the applicant CAN resubmit from info_requested: status→pending clears notes + review stamps', async () => {
    await setApp({ status: 'info_requested', admin_notes: 'please add ID', reviewed_at: new Date().toISOString(), reviewed_by: fx!.admin.id })
    const res = await fx!.buyer.client.from('seller_applications')
      .update({ status: 'pending', display_name: 'Guard Applicant v2', admin_notes: null, reviewed_at: null, reviewed_by: null })
      .eq('id', appId).select('id')
    expect(res.error).toBeNull()
    const a = await readApp()
    expect(a.status).toBe('pending'); expect(a.admin_notes).toBeNull(); expect(a.reviewed_by).toBeNull()
  })

  it("the NULL allowance is only for a resubmit — clearing notes while staying info_requested is refused", async () => {
    await setApp({ status: 'info_requested', admin_notes: 'please add ID', reviewed_by: fx!.admin.id })
    const res = await fx!.buyer.client.from('seller_applications')
      .update({ admin_notes: null, reviewed_by: null }).eq('id', appId).select('id')
    expectGuardRejection(res as any, 'seller_applications')
    expect((await readApp()).admin_notes).toBe('please add ID')
    await setApp({ status: 'pending', admin_notes: null, reviewed_by: null })
  })

  it('the applicant CAN withdraw a pending application', async () => {
    const res = await fx!.buyer.client.from('seller_applications')
      .update({ status: 'withdrawn' }).eq('id', appId).select('id')
    expect(res.error).toBeNull()
    expect((await readApp()).status).toBe('withdrawn')
    await setApp({ status: 'pending' })
  })

  it('an approved application is read-only to the applicant', async () => {
    await setApp({ status: 'approved' })
    const res = await fx!.buyer.client.from('seller_applications')
      .update({ display_name: 'Sneaky Rename' }).eq('id', appId).select('id')
    if (!res.error) expect(res.data ?? []).toHaveLength(0)
    expect((await readApp()).display_name).not.toBe('Sneaky Rename')
    await setApp({ status: 'pending' })
  })

  it('an admin with applications.review still reviews through the session client', async () => {
    const res = await fx!.admin.client.from('seller_applications')
      .update({ status: 'under_review', reviewed_by: fx!.admin.id, reviewed_at: new Date().toISOString(), admin_notes: 'reviewing' })
      .eq('id', appId).select('id')
    expect(res.error).toBeNull()
    expect((await readApp()).status).toBe('under_review')
  })
})
