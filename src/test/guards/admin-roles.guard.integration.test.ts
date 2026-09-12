/**
 * AUTH-030 — admin_roles is written by the backend only.
 * Exploit: "Users can access own admin role" had no FOR clause (ALL) with
 * USING/WITH CHECK (uid = user_id) → any signed-in user INSERTs their own
 * super_admin row; is_admin() / is_super_admin_safe() / has_permission() and
 * requireAdmin() all read that table.
 * Also asserts the other inputs to those functions (role_permissions,
 * profiles.role) are not user-writable, so no other row can satisfy them.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { hasEnv, p1GuardsApplied, makeFixture, type Fixture } from './throwaway'

let fx: Fixture | null = null
let ready = false

describe.skipIf(!hasEnv)('AUTH-030 — admin_roles write lock (integration)', () => {
  beforeAll(async () => { fx = await makeFixture(); ready = await p1GuardsApplied(fx.svc) }, 60_000)
  afterAll(async () => { await fx?.cleanup() })

  it('20260912100000_auth_p1.sql is applied to the target DB', () => {
    expect(ready).toBe(true)
  })

  it('a plain user cannot INSERT their own admin_roles row', async () => {
    const res = await fx!.buyer.client.from('admin_roles').insert({ user_id: fx!.buyer.id, role: 'super_admin', is_active: true })
    expect(res.error, 'insert must be rejected').not.toBeNull()
    expect(res.error!.code).toBe('42501')
    const { data } = await fx!.svc.from('admin_roles').select('id').eq('user_id', fx!.buyer.id)
    expect(data ?? []).toHaveLength(0)
    const { data: isAdmin } = await fx!.buyer.client.rpc('is_admin')
    expect(isAdmin).toBe(false)
  })

  it('an existing admin cannot escalate or re-activate their own row', async () => {
    const res = await fx!.admin.client.from('admin_roles').update({ role: 'super_admin' }).eq('user_id', fx!.admin.id).select('role')
    if (!res.error) expect(res.data ?? []).toHaveLength(0)
    const { data } = await fx!.svc.from('admin_roles').select('role').eq('user_id', fx!.admin.id).single()
    expect((data as any).role).toBe('admin')
    const { data: superSafe } = await fx!.admin.client.rpc('is_super_admin_safe')
    expect(superSafe).toBe(false)
  })

  it('an admin cannot grant a role to someone else through the session client', async () => {
    const res = await fx!.admin.client.from('admin_roles').insert({ user_id: fx!.buyer.id, role: 'admin', is_active: true })
    expect(res.error?.code).toBe('42501')
  })

  it('no other user-writable row can satisfy has_permission / is_admin', async () => {
    // role_permissions: read-only for users
    const rp = await fx!.buyer.client.from('role_permissions').insert({ role: 'admin', permission: `probe.${Date.now()}` })
    expect(rp.error?.code).toBe('42501')
    const { data: rows } = await fx!.svc.from('role_permissions').select('id').like('permission', 'probe.%')
    expect(rows ?? []).toHaveLength(0)
    // profiles.role: prevent_profile_privilege_escalation silently reverts the value
    await fx!.buyer.client.from('profiles').update({ role: 'super_admin' }).eq('id', fx!.buyer.id)
    const { data: prof } = await fx!.svc.from('profiles').select('role').eq('id', fx!.buyer.id).single()
    expect((prof as any).role).not.toBe('super_admin')
    const { data: hp } = await fx!.buyer.client.rpc('has_permission', { required_permission: 'applications.review' })
    expect(hp).toBe(false)
  })

  it('admins can still read their own role; the service role still writes', async () => {
    const { data, error } = await fx!.admin.client.from('admin_roles').select('role').eq('user_id', fx!.admin.id).single()
    expect(error).toBeNull(); expect((data as any).role).toBe('admin')
    const { error: te } = await fx!.svc.from('admin_roles').update({ last_active_at: new Date().toISOString() }).eq('user_id', fx!.admin.id)
    expect(te).toBeNull()
  })
})
