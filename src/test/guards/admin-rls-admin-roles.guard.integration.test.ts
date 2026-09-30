/**
 * Admin RLS reads admin_roles, never profiles.role (integration) —
 * migration 20260930162255_admin_rls_admin_roles.sql.
 *
 * Admin access is decided by admin_roles (the (admin) layout, requireAdmin,
 * is_admin()). The baseline's admin policies on withdrawal_requests,
 * withdrawal_methods and reviews still gated on profiles.role = 'admin'.
 * Reproduced on a local stack 2026-09-30: an active
 * admin_roles admin whose profiles.role is 'user' opened /admin/withdrawals
 * (getAllWithdrawalRequests, session client) and got an EMPTY queue with no
 * error — pending payouts looked cleared. And the reverse: a profiles.role
 * 'admin' with no admin_roles row read every seller's withdrawal.
 *   · no policy in any schema gates on profiles.role with an admin role name;
 *   · withdrawal_requests / withdrawal_methods: active admin + super_admin only
 *     (the Withdrawals and Fees & Payouts sidebar entries) — not moderator or
 *     support, not an inactive row, not profiles.role;
 *   · reviews: active admin / super_admin / moderator (unchanged set; the old
 *     admin_roles policy also let an INACTIVE row through);
 *   · anon still reads visible reviews and active withdrawal methods (the new
 *     policies are TO authenticated, so anon never evaluates them).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { hasEnv, makeFixture, URL, ANON, type Fixture } from './throwaway'

const DB_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

type AdminRole = 'super_admin' | 'admin' | 'moderator' | 'support'

/**
 * FROZEN — every policy that still reads profiles.role on 2026-09-30, after
 * this migration. The two listings entries are seller checks; the rest are
 * the same admin bug on tables outside this fix, left for a follow-up. The
 * list may only shrink: a new policy on profiles.role fails the guard.
 */
const PROFILES_ROLE_POLICIES_FROZEN = [
  'public.listings: Sellers can delete their own listings',
  'public.listings: Sellers can view their own listings',
  'public.admin_action_logs: Admins can view action logs',
  'public.admin_notifications: Admins can update notification read status',
  'public.admin_notifications: Admins can view notifications for their role',
  'public.attribute_conditional_rules: attribute_conditional_rules_admin_all',
  'public.attribute_options: attribute_options_admin_all',
  'public.attribute_templates: attribute_templates_admin_all',
  'public.attributes: attributes_admin_all',
  'public.game_categories: game_categories_admin_all',
  'public.global_categories: global_categories_admin_all',
  'public.loyalty_credits: loyalty_credits_admin_select',
  'public.promo_code_usages: promo_code_usages_admin_select',
  'public.seller_kyc_documents: Admins can view all KYC documents',
  'public.seller_verification_logs: Admins can view all verification logs',
  'public.trustpilot_invitations: Admins can view all invitations',
]

let fx: Fixture | null = null
let requestId = ''
let methodId = ''
let hiddenReviewId = ''
const anon = () => createClient(URL!, ANON!, { auth: { persistSession: false } })

function psql(q: string): string {
  return execFileSync('psql', [DB_URL, '-Atq', '-c', q], { stdio: 'pipe' }).toString().trim()
}

/** The exact select getAllWithdrawalRequests runs (src/lib/actions/withdrawals.ts). */
async function queueIds(client: SupabaseClient): Promise<string[]> {
  const { data, error } = await client
    .from('withdrawal_requests')
    .select(`
      *,
      user:profiles!withdrawal_requests_user_id_fkey(username, email, avatar_url),
      method:withdrawal_methods(display_name, icon_name)
    `)
    .order('created_at', { ascending: false })
  expect(error, error?.message).toBeNull()
  return ((data as { id: string }[] | null) ?? []).map((r) => r.id)
}
async function ids(client: SupabaseClient, table: string, id: string): Promise<string[]> {
  const { data, error } = await client.from(table).select('id').eq('id', id)
  expect(error, `${table}: ${error?.message}`).toBeNull()
  return ((data as { id: string }[] | null) ?? []).map((r) => r.id)
}

/** Set (or remove, with null) a fixture user's admin_roles row for the duration of `fn`, then restore it. */
async function withAdminRole(userId: string, role: AdminRole | null, isActive: boolean, fn: () => Promise<void>) {
  const svc = fx!.svc
  const { data: before } = await svc.from('admin_roles').select('role, is_active').eq('user_id', userId).maybeSingle()
  const set = async (r: { role: AdminRole; is_active: boolean } | null) => {
    const { error: de } = await svc.from('admin_roles').delete().eq('user_id', userId)
    if (de) throw new Error(`admin_roles delete: ${de.message}`)
    if (r) {
      const { error: ie } = await svc.from('admin_roles').insert({ user_id: userId, ...r })
      if (ie) throw new Error(`admin_roles insert: ${ie.message}`)
    }
  }
  await set(role ? { role, is_active: isActive } : null)
  try { await fn() } finally { await set(before as { role: AdminRole; is_active: boolean } | null) }
}

/** Give a fixture user profiles.role = 'admin' (no admin_roles row) for the duration of `fn`. */
async function withProfileRoleAdmin(userId: string, fn: () => Promise<void>) {
  const svc = fx!.svc
  const { data: before } = await svc.from('profiles').select('role').eq('id', userId).single()
  const { error } = await svc.from('profiles').update({ role: 'admin' }).eq('id', userId)
  if (error) throw new Error(`profiles.role = admin: ${error.message}`)
  try { await fn() } finally {
    const { error: re } = await svc.from('profiles').update({ role: (before as any).role }).eq('id', userId)
    if (re) throw new Error(`profiles.role restore: ${re.message}`)
  }
}

describe.skipIf(!hasEnv)('admin RLS reads admin_roles, never profiles.role (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    const svc = fx.svc
    // An INACTIVE method: invisible to everyone but admins ("Anyone can view active withdrawal methods").
    const { data: m, error: me } = await svc.from('withdrawal_methods').insert({
      method_name: `guard_${fx.ns.tag}`, display_name: `Guard ${fx.ns.tag}`, method_type: 'fiat',
      is_active: false, fee_percentage: 0, fee_fixed: 0, min_withdrawal: 1, max_withdrawal: 100,
    }).select('id').single()
    if (me) throw new Error(`withdrawal_methods insert: ${me.message}`)
    methodId = (m as any).id
    const { data: r, error: re } = await svc.from('withdrawal_requests').insert({
      user_id: fx.seller.id, amount: 25, method_id: methodId, method_name: `guard_${fx.ns.tag}`,
      status: 'pending', fee_amount: 0, net_amount: 25, payment_details: {},
    }).select('id').single()
    if (re) throw new Error(`withdrawal_requests insert: ${re.message}`)
    requestId = (r as any).id
    const { data: rv, error: rve } = await svc.from('reviews').insert({
      order_id: fx.completedOrderId, reviewer_id: fx.buyer.id, seller_id: fx.seller.id,
      listing_id: fx.listingId, rating: 1, comment: 'guard test — hidden by moderation', is_visible: false,
    }).select('id').single()
    if (rve) throw new Error(`reviews insert: ${rve.message}`)
    hiddenReviewId = (rv as any).id
  }, 120_000)

  afterAll(async () => {
    if (!fx) return
    const failures: string[] = []
    const users = [fx.buyer.id, fx.seller.id, fx.admin.id]
    const { error: we } = await fx.svc.from('withdrawal_requests').delete().in('user_id', users)
    if (we) failures.push(`withdrawal_requests cleanup: ${we.message}`)
    if (methodId) {
      const { error: me } = await fx.svc.from('withdrawal_methods').delete().eq('id', methodId)
      if (me) failures.push(`withdrawal_methods cleanup: ${me.message}`)
    }
    // reviews + admin_roles go with the fixture users (DEPENDENT_TABLES).
    try { await fx.cleanup() } catch (e: any) { failures.push(String(e?.message ?? e)) }
    if (failures.length) throw new Error(`admin-rls cleanup left residue:\n  - ${failures.join('\n  - ')}`)
  }, 120_000)

  it('no policy reads profiles.role outside the frozen list (which may only shrink)', () => {
    const rows = psql(`
      select n.nspname || '.' || c.relname || ': ' || p.polname
      from pg_policy p
      join pg_class c on c.oid = p.polrelid
      join pg_namespace n on n.oid = c.relnamespace
      where (coalesce(pg_get_expr(p.polqual, p.polrelid), '') || ' ' || coalesce(pg_get_expr(p.polwithcheck, p.polrelid), ''))
            ilike '%profiles.role%'
      order by 1`).split('\n').filter(Boolean)
    const unexpected = rows.filter((r) => !PROFILES_ROLE_POLICIES_FROZEN.includes(r))
    expect(unexpected, `policies gating on profiles.role (admin access is admin_roles — use get_admin_role()/is_admin()):\n${unexpected.join('\n')}`).toEqual([])
    const gone = PROFILES_ROLE_POLICIES_FROZEN.filter((r) => !rows.includes(r))
    expect(gone, 'fixed — remove these from PROFILES_ROLE_POLICIES_FROZEN').toEqual([])
  })

  it('the fixture admin is an admin_roles admin whose profiles.role is NOT admin (the reported case)', async () => {
    const { data: ar } = await fx!.svc.from('admin_roles').select('role, is_active').eq('user_id', fx!.admin.id).single()
    expect(ar).toEqual({ role: 'admin', is_active: true })
    const { data: p } = await fx!.svc.from('profiles').select('role').eq('id', fx!.admin.id).single()
    expect((p as any).role).not.toBe('admin')
  })

  it('an admin_roles admin reads the payout queue (withdrawals + inactive methods)', async () => {
    expect(await queueIds(fx!.admin.client)).toContain(requestId)
    expect(await ids(fx!.admin.client, 'withdrawal_methods', methodId)).toEqual([methodId])
  })

  it('a super_admin reads the payout queue', async () => {
    await withAdminRole(fx!.admin.id, 'super_admin', true, async () => {
      expect(await queueIds(fx!.admin.client)).toContain(requestId)
      expect(await ids(fx!.admin.client, 'withdrawal_methods', methodId)).toEqual([methodId])
    })
  })

  it('an admin session can update a withdrawal request; a non-admin matches no row', async () => {
    const note = `guard ${fx!.ns.tag}`
    const { data: none, error: ne } = await fx!.buyer.client.from('withdrawal_requests')
      .update({ admin_notes: 'forged' }).eq('id', requestId).select('id')
    expect(ne, ne?.message).toBeNull()
    expect(none).toEqual([])
    const { data, error } = await fx!.admin.client.from('withdrawal_requests')
      .update({ admin_notes: note }).eq('id', requestId).select('id')
    expect(error, error?.message).toBeNull()
    expect(data).toEqual([{ id: requestId }])
    const { data: row } = await fx!.svc.from('withdrawal_requests').select('admin_notes').eq('id', requestId).single()
    expect((row as any).admin_notes).toBe(note)
  })

  it('a signed-in non-admin sees neither another seller\'s withdrawal nor an inactive method', async () => {
    expect(await queueIds(fx!.buyer.client)).not.toContain(requestId)
    expect(await ids(fx!.buyer.client, 'withdrawal_methods', methodId)).toEqual([])
  })

  it('profiles.role = admin with no admin_roles row grants nothing', async () => {
    await withProfileRoleAdmin(fx!.buyer.id, async () => {
      expect(await queueIds(fx!.buyer.client)).not.toContain(requestId)
      expect(await ids(fx!.buyer.client, 'withdrawal_methods', methodId)).toEqual([])
      expect(await ids(fx!.buyer.client, 'reviews', hiddenReviewId)).toEqual([])
      const { data, error } = await fx!.buyer.client.from('withdrawal_requests')
        .update({ admin_notes: 'forged' }).eq('id', requestId).select('id')
      expect(error, error?.message).toBeNull()
      expect(data).toEqual([])
    })
  })

  it('moderator and support admin_roles rows do not see the payout queue', async () => {
    for (const role of ['moderator', 'support'] as const) {
      await withAdminRole(fx!.admin.id, role, true, async () => {
        expect(await queueIds(fx!.admin.client), role).not.toContain(requestId)
        expect(await ids(fx!.admin.client, 'withdrawal_methods', methodId), role).toEqual([])
      })
    }
  })

  it('an INACTIVE admin_roles row grants nothing (payouts or hidden reviews)', async () => {
    await withAdminRole(fx!.admin.id, 'admin', false, async () => {
      expect(await queueIds(fx!.admin.client)).not.toContain(requestId)
      expect(await ids(fx!.admin.client, 'withdrawal_methods', methodId)).toEqual([])
      expect(await ids(fx!.admin.client, 'reviews', hiddenReviewId)).toEqual([])
    })
  })

  it('admin and moderator read a hidden review; support and the review parties do not', async () => {
    expect(await ids(fx!.admin.client, 'reviews', hiddenReviewId)).toEqual([hiddenReviewId])
    await withAdminRole(fx!.admin.id, 'moderator', true, async () => {
      expect(await ids(fx!.admin.client, 'reviews', hiddenReviewId)).toEqual([hiddenReviewId])
    })
    await withAdminRole(fx!.admin.id, 'support', true, async () => {
      expect(await ids(fx!.admin.client, 'reviews', hiddenReviewId)).toEqual([])
    })
    expect(await ids(fx!.buyer.client, 'reviews', hiddenReviewId)).toEqual([])
    expect(await ids(fx!.seller.client, 'reviews', hiddenReviewId)).toEqual([])
  })

  it('anon still reads visible reviews and active withdrawal methods, and no withdrawal', async () => {
    const a = anon()
    const { error: re } = await a.from('reviews').select('id').limit(1)
    expect(re, re?.message).toBeNull()
    const { data: m, error: me } = await a.from('withdrawal_methods').select('id').eq('is_active', true).limit(1)
    expect(me, me?.message).toBeNull()
    expect(Array.isArray(m)).toBe(true)
    const { data: w } = await a.from('withdrawal_requests').select('id').eq('id', requestId)
    expect(w ?? []).toEqual([])
  })
})
