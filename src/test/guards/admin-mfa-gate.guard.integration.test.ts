/**
 * Every staff power requires a two-factor session (integration) — migration
 * 20261103125855_admin_mfa_required.
 *
 * Until now the second factor was checked by the (admin) page layout only, and
 * a layout does not protect what sits behind it: with just a staff password
 * (an aal1 session) the database's staff checks all answered yes, so admin-only
 * tables could be read straight through the API and moderator RPCs could be
 * called. These tests take exactly what an attacker with a stolen password
 * holds: the same admin, signed in without the authenticator code.
 *
 * Also pinned here, found on the way:
 *   · the audit log is readable by the owner role only, not by every staff member;
 *   · a signed-in user can no longer list who the staff are (admin_roles was
 *     readable by everyone "for chat"); chat asks chat_staff_senders instead.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { hasEnv, makeFixture, type Fixture } from './throwaway'

let fx: Fixture | null = null
let passwordOnly: SupabaseClient
let convo = ''

describe.skipIf(!hasEnv)('staff powers require aal2 (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    passwordOnly = await fx.adminPasswordOnly()
    const { data, error } = await fx.svc
      .from('conversations')
      .insert({ buyer_id: fx.buyer.id, seller_id: fx.seller.id })
      .select('id')
      .single()
    if (error) throw new Error(`conversation: ${error.message}`)
    convo = (data as { id: string }).id
    const sent = await fx.admin.client.from('messages').insert({ conversation_id: convo, sender_id: fx.admin.id, content: 'DropMarket support here' })
    if (sent.error) throw new Error(`admin message: ${sent.error.message}`)
  }, 60_000)

  afterAll(async () => {
    if (!fx) return
    if (convo) {
      await fx.svc.from('messages').delete().eq('conversation_id', convo)
      await fx.svc.from('conversations').delete().eq('id', convo)
    }
    await fx.cleanup()
  }, 60_000)

  describe('the session levels are what the tests think they are', () => {
    const levelOf = async (client: SupabaseClient) => (await client.auth.mfa.getAuthenticatorAssuranceLevel()).data?.currentLevel

    it('the fixture admin is aal2; the password-only sign-in is aal1', async () => {
      expect(await levelOf(fx!.admin.client)).toBe('aal2')
      expect(await levelOf(passwordOnly)).toBe('aal1')
    })
  })

  describe('the database staff checks', () => {
    it('is_admin / get_admin_role / has_permission / get_my_permissions answer no at aal1, yes at aal2', async () => {
      expect((await passwordOnly.rpc('is_admin')).data).toBe(false)
      expect((await passwordOnly.rpc('get_admin_role')).data).toBeNull()
      expect((await passwordOnly.rpc('has_permission', { required_permission: 'applications.review' })).data).toBe(false)
      expect((await passwordOnly.rpc('get_my_permissions')).data).toEqual([])

      expect((await fx!.admin.client.rpc('is_admin')).data).toBe(true)
      expect((await fx!.admin.client.rpc('get_admin_role')).data).toBe('admin')
    })

    it('moderator tools refuse an aal1 session', async () => {
      const { error } = await passwordOnly.rpc('takedown_listing', { listing_id: fx!.listingId, reason: 'stolen password' })
      expect(error).not.toBeNull()
      expect(error!.message).toMatch(/forbidden|permission denied/i)
    })
  })

  describe('admin-only rows, through the API', () => {
    // Real rows, so "nothing back" means blocked and not an empty table.
    it('the activity log and seller restrictions show to aal2 and not to aal1', async () => {
      const { data: activity, error: ae } = await fx!.svc
        .from('admin_activity_log')
        .insert({ admin_id: fx!.admin.id, action: 'guard.test', action_category: 'guard', resource_type: 'guard' })
        .select('id')
        .single()
      expect(ae).toBeNull()
      const { data: restriction, error: re } = await fx!.svc
        .from('seller_restrictions')
        .insert({ seller_id: fx!.seller.id, restricted_by: fx!.admin.id, restriction_type: 'restricted', reason: 'guard' })
        .select('id')
        .single()
      expect(re).toBeNull()
      const activityId = (activity as { id: string }).id
      const restrictionId = (restriction as { id: string }).id

      try {
        expect((await fx!.admin.client.from('admin_activity_log').select('id').eq('id', activityId)).data).toHaveLength(1)
        expect((await fx!.admin.client.from('seller_restrictions').select('id').eq('id', restrictionId)).data).toHaveLength(1)
        expect((await passwordOnly.from('admin_activity_log').select('id').eq('id', activityId)).data ?? []).toEqual([])
        expect((await passwordOnly.from('seller_restrictions').select('id').eq('id', restrictionId)).data ?? []).toEqual([])
      } finally {
        await fx!.svc.from('admin_activity_log').delete().eq('id', activityId)
        await fx!.svc.from('seller_restrictions').delete().eq('id', restrictionId)
      }
    })

    it('an aal1 session cannot restrict a seller or write the activity log', async () => {
      const restrict = await passwordOnly
        .from('seller_restrictions')
        .insert({ seller_id: fx!.seller.id, restricted_by: fx!.admin.id, restriction_type: 'restricted', reason: 'stolen password' })
      expect(restrict.error).not.toBeNull()
      const log = await passwordOnly
        .from('admin_activity_log')
        .insert({ admin_id: fx!.admin.id, action: 'guard.test', action_category: 'guard', resource_type: 'guard' })
      expect(log.error).not.toBeNull()
    })

    it('other users’ orders stay hidden at aal1 and show at aal2', async () => {
      const weak = await passwordOnly.from('orders').select('id').eq('id', fx!.completedOrderId)
      expect(weak.data ?? []).toEqual([])
      const strong = await fx!.admin.client.from('orders').select('id').eq('id', fx!.completedOrderId)
      expect(strong.data ?? []).toHaveLength(1)
    })

    it('an aal1 admin still has their own ordinary access (the MFA page reads their role)', async () => {
      const own = await passwordOnly.from('admin_roles').select('role').eq('user_id', fx!.admin.id).maybeSingle()
      expect(own.data).toEqual({ role: 'admin' })
    })
  })

  describe('admin_context', () => {
    it('reports the verified session level, role, permissions and profile', async () => {
      const strong = await fx!.admin.client.rpc('admin_context')
      expect(strong.error).toBeNull()
      expect(strong.data.aal).toBe('aal2')
      expect(strong.data.role).toBe('admin')
      expect(Array.isArray(strong.data.permissions)).toBe(true)
      expect(strong.data.username).toBeTruthy()

      const weak = await passwordOnly.rpc('admin_context')
      expect(weak.data.aal).toBe('aal1')
    })

    it('returns null for anyone who is not active staff', async () => {
      const { data } = await fx!.buyer.client.rpc('admin_context')
      expect(data).toBeNull()
    })
  })

  describe('audit log and staff list', () => {
    it('an ordinary admin cannot read the audit log; only the owner role can', async () => {
      const { data: row, error } = await fx!.svc
        .from('audit_logs')
        .insert({ action: 'guard_test', table_name: 'guard_test', user_id: fx!.admin.id, success: true })
        .select('id')
        .single()
      expect(error).toBeNull()
      const id = (row as { id: string }).id

      const asAdmin = await fx!.admin.client.from('audit_logs').select('id').eq('id', id)
      expect(asAdmin.data ?? []).toEqual([])

      await fx!.svc.from('admin_roles').update({ role: 'super_admin' }).eq('user_id', fx!.admin.id)
      const asOwner = await fx!.admin.client.from('audit_logs').select('id').eq('id', id)
      await fx!.svc.from('admin_roles').update({ role: 'admin' }).eq('user_id', fx!.admin.id)
      expect(asOwner.data ?? []).toHaveLength(1)
    })

    it('a buyer cannot list staff', async () => {
      const { data } = await fx!.buyer.client.from('admin_roles').select('user_id').eq('user_id', fx!.admin.id)
      expect(data ?? []).toEqual([])
    })

    it('chat_staff_senders names staff who wrote in my conversation, and only there', async () => {
      const mine = await fx!.buyer.client.rpc('chat_staff_senders', { p_conversation_id: convo })
      expect(mine.error).toBeNull()
      expect(mine.data).toEqual([fx!.admin.id])
      // The admin wrote nowhere the outsider belongs: they learn nothing.
      const { data: other } = await fx!.svc
        .from('conversations')
        .insert({ buyer_id: fx!.seller.id, seller_id: fx!.admin.id })
        .select('id')
        .single()
      const outsider = await fx!.buyer.client.rpc('chat_staff_senders', { p_conversation_id: (other as { id: string }).id })
      await fx!.svc.from('conversations').delete().eq('id', (other as { id: string }).id)
      expect(outsider.data ?? []).toEqual([])
    })
  })
})
