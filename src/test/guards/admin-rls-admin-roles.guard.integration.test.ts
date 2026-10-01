/**
 * Admin RLS reads admin_roles, never profiles.role (integration) —
 * migrations 20260930162255_admin_rls_admin_roles.sql and
 * 20260930172822_admin_rls_admin_roles_rest.sql.
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
 * The follow-up moves every remaining admin policy (catalogue, loyalty,
 * promo usages, Trustpilot, KYC documents + verification logs,
 * admin_notifications, admin_action_logs) the same way:
 *   · catalogue / loyalty / promo usages / Trustpilot: active admin +
 *     super_admin (Games, Promo Codes, Analytics, Fraud — admin-only entries);
 *   · KYC documents, verification logs, admin_notifications: any active
 *     admin_roles row (the is_admin() / admin_roles policies they already had);
 *   · admin_action_logs stays service-role only (no table grant to sessions);
 *   · owners keep their own rows; anon keeps the public catalogue reads.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { hasEnv, makeFixture, URL, ANON, type Fixture } from './throwaway'

const DB_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

type AdminRole = 'super_admin' | 'admin' | 'moderator' | 'support'

/**
 * FROZEN — every policy that still reads profiles.role after the follow-up
 * migration (2026-10-01): only the two listings seller checks, which are not
 * admin gates. The list may only shrink: a new policy on profiles.role fails
 * the guard.
 */
const PROFILES_ROLE_POLICIES_FROZEN = [
  'public.listings: Sellers can delete their own listings',
  'public.listings: Sellers can view their own listings',
]

let fx: Fixture | null = null
let requestId = ''
let methodId = ''
let hiddenReviewId = ''
/** Admin-only rows seeded on the follow-up's tables, keyed by table. */
const seeded: Record<string, string> = {}
let gameId = ''
let pairId = ''
let promoCodeId = ''
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

/** Admin access per table: admin + super_admin only, or any active admin_roles row. */
const ADMIN_ONLY = [
  'attribute_templates', 'attributes', 'attribute_options', 'attribute_conditional_rules',
  'global_categories', 'loyalty_credits', 'promo_code_usages', 'trustpilot_invitations',
] as const
const ANY_ADMIN = ['seller_kyc_documents', 'seller_verification_logs', 'admin_notifications'] as const

/** Which seeded admin-only rows `client` can read. */
async function visible(client: SupabaseClient): Promise<Record<string, boolean>> {
  const out: Record<string, boolean> = {}
  for (const table of [...ADMIN_ONLY, ...ANY_ADMIN]) out[table] = (await ids(client, table, seeded[table])).length === 1
  return out
}
function expectedFor(role: AdminRole | null): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  for (const t of ADMIN_ONLY) out[t] = role === 'admin' || role === 'super_admin'
  for (const t of ANY_ADMIN) out[t] = role !== null
  return out
}
/** A no-op admin write: the row comes back only when a policy lets the session UPDATE it. */
async function touch(client: SupabaseClient, table: string, id: string, patch: Record<string, unknown>): Promise<string[]> {
  const { data, error } = await client.from(table).update(patch).eq('id', id).select('id')
  expect(error, `${table}: ${error?.message}`).toBeNull()
  return ((data as { id: string }[] | null) ?? []).map((r) => r.id)
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

    // ── follow-up tables: one admin-only row each, owned by the SELLER so the
    // buyer is a plain non-owner (and the profiles.role-admin stand-in) ──────
    const must = <T,>(label: string, r: { data: T | null; error: { message: string } | null }): T => {
      if (r.error || !r.data) throw new Error(`${label}: ${r.error?.message ?? 'no row'}`)
      return r.data
    }
    const tag = fx.ns.tag
    // Catalogue: a throwaway (inactive) game + pair + INACTIVE template, so the
    // public-read policies hide the template, its attributes, options and rules.
    gameId = must<any>('games insert', await svc.from('games')
      .insert({ name: `Guard RLS ${tag}`, slug: `guard-test-${tag}-rls`, is_active: false }).select('id').single()).id
    const items = must<any>('global items', await svc.from('global_categories').select('id').eq('slug', 'items').single())
    pairId = must<any>('game_categories insert', await svc.from('game_categories').insert({
      game_id: gameId, global_category_id: items.id, is_enabled: false,
      slug: `guard-rls-items-${tag}`, name: 'Guard RLS Items', type: 'items',
    }).select('id').single()).id
    seeded.attribute_templates = must<any>('attribute_templates insert', await svc.from('attribute_templates')
      .insert({ game_category_id: pairId, name: `Guard ${tag}`, is_active: false }).select('id').single()).id
    const attrs = must<any[]>('attributes insert', await svc.from('attributes').insert([
      { template_id: seeded.attribute_templates, slug: 'guard-a', name: 'Guard A', type: 'select' },
      { template_id: seeded.attribute_templates, slug: 'guard-b', name: 'Guard B', type: 'select' },
    ]).select('id, slug'))
    const [a, b] = ['guard-a', 'guard-b'].map((sl) => attrs.find((r) => r.slug === sl)!.id as string)
    seeded.attributes = a
    seeded.attribute_options = must<any>('attribute_options insert', await svc.from('attribute_options')
      .insert({ attribute_id: a, slug: 'x', value: 'x', label: 'X' }).select('id').single()).id
    seeded.attribute_conditional_rules = must<any>('attribute_conditional_rules insert', await svc.from('attribute_conditional_rules')
      .insert({ attribute_id: b, trigger_attribute_id: a, operator: 'equals', trigger_values: ['x'] }).select('id').single()).id
    // An inactive global category ships with the migrations (boosting / skins / top-up).
    seeded.global_categories = must<any>('inactive global category', await svc.from('global_categories')
      .select('id').eq('is_active', false).limit(1).single()).id
    seeded.loyalty_credits = must<any>('loyalty_credits insert', await svc.from('loyalty_credits').insert({
      user_id: fx.seller.id, type: 'bonus', amount: 1, balance_after: 1, description: `guard ${tag}`,
    }).select('id').single()).id
    promoCodeId = must<any>('promo_codes insert', await svc.from('promo_codes').insert({
      code: `GUARD${tag}`.toUpperCase(), type: 'flat', value: 1, is_active: false,
    }).select('id').single()).id
    seeded.promo_code_usages = must<any>('promo_code_usages insert', await svc.from('promo_code_usages').insert({
      promo_code_id: promoCodeId, user_id: fx.seller.id, order_id: fx.completedOrderId, discount_amount: 1,
    }).select('id').single()).id
    seeded.trustpilot_invitations = must<any>('trustpilot_invitations insert', await svc.from('trustpilot_invitations').insert({
      buyer_id: fx.seller.id, order_id: fx.pendingOrderId, email: fx.ns.email('tp'), // the completed order already has one (trigger)
    }).select('id').single()).id
    // KYC: a draft application (no submitted_at, so notify_new_application stays quiet).
    const applicationId = must<any>('seller_applications insert', await svc.from('seller_applications').insert({
      user_id: fx.seller.id, status: 'pending', is_18_or_older: true, seller_type: 'individual', display_name: `Guard ${tag}`,
    }).select('id').single()).id
    seeded.seller_kyc_documents = must<any>('seller_kyc_documents insert', await svc.from('seller_kyc_documents').insert({
      application_id: applicationId, user_id: fx.seller.id, document_type: 'other',
      file_path: `guard/${tag}.png`, file_name: `${tag}.png`,
    }).select('id').single()).id
    seeded.seller_verification_logs = must<any>('seller_verification_logs insert', await svc.from('seller_verification_logs')
      .insert({ application_id: applicationId, action: 'admin_note_added' }).select('id').single()).id
    // Addressed to the fixture admin directly, so the old specific_admin_id
    // branch would show it to that user even with the admin_roles row inactive.
    seeded.admin_notifications = must<any>('admin_notifications insert', await svc.from('admin_notifications').insert({
      notification_type: 'system_alert', title: `Guard ${tag}`, message: 'guard test',
      target_roles: ['admin', 'super_admin'], specific_admin_id: fx.admin.id,
    }).select('id').single()).id
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
    const del = async (table: string, col: string, val: string | undefined) => {
      if (!val) return
      const { error } = await fx!.svc.from(table).delete().eq(col, val)
      if (error) failures.push(`${table} cleanup: ${error.message}`)
    }
    await del('admin_notifications', 'id', seeded.admin_notifications)
    await del('trustpilot_invitations', 'id', seeded.trustpilot_invitations)
    await del('promo_codes', 'id', promoCodeId) // promo_code_usages cascade
    await del('loyalty_credits', 'id', seeded.loyalty_credits)
    await del('seller_applications', 'user_id', fx.seller.id) // KYC documents + verification logs cascade
    await del('games', 'id', gameId) // pair → template → attributes → options/rules cascade
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
  }, 30_000)

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
  }, 30_000)

  it('moderator and support admin_roles rows do not see the payout queue', async () => {
    for (const role of ['moderator', 'support'] as const) {
      await withAdminRole(fx!.admin.id, role, true, async () => {
        expect(await queueIds(fx!.admin.client), role).not.toContain(requestId)
        expect(await ids(fx!.admin.client, 'withdrawal_methods', methodId), role).toEqual([])
      })
    }
  }, 30_000)

  it('an INACTIVE admin_roles row grants nothing (payouts or hidden reviews)', async () => {
    await withAdminRole(fx!.admin.id, 'admin', false, async () => {
      expect(await queueIds(fx!.admin.client)).not.toContain(requestId)
      expect(await ids(fx!.admin.client, 'withdrawal_methods', methodId)).toEqual([])
      expect(await ids(fx!.admin.client, 'reviews', hiddenReviewId)).toEqual([])
    })
  }, 30_000)

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
  }, 30_000)

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

  // ── follow-up: catalogue, loyalty, promo usages, Trustpilot, KYC,
  // admin_notifications, admin_action_logs ──────────────────────────────────

  it('an admin_roles admin (profiles.role not admin) reads every admin-only row', async () => {
    expect(await visible(fx!.admin.client)).toEqual(expectedFor('admin'))
  }, 30_000)

  it('super_admin reads all; moderator and support read only KYC, verification logs and notifications', async () => {
    for (const role of ['super_admin', 'moderator', 'support'] as const) {
      await withAdminRole(fx!.admin.id, role, true, async () => {
        expect(await visible(fx!.admin.client), role).toEqual(expectedFor(role))
      })
    }
  }, 60_000)

  it('an INACTIVE admin_roles row reads none of them (not even a notification addressed to it)', async () => {
    await withAdminRole(fx!.admin.id, 'admin', false, async () => {
      expect(await visible(fx!.admin.client)).toEqual(expectedFor(null))
    })
  }, 30_000)

  it('a signed-in non-admin reads none of them', async () => {
    expect(await visible(fx!.buyer.client)).toEqual(expectedFor(null))
  }, 30_000)

  it('profiles.role = admin with no admin_roles row reads and writes none of them', async () => {
    await withProfileRoleAdmin(fx!.buyer.id, async () => {
      expect(await visible(fx!.buyer.client)).toEqual(expectedFor(null))
      expect(await touch(fx!.buyer.client, 'game_categories', pairId, { name: 'Guard RLS Items' })).toEqual([])
      expect(await touch(fx!.buyer.client, 'attribute_templates', seeded.attribute_templates, { name: `Guard ${fx!.ns.tag}` })).toEqual([])
      expect(await touch(fx!.buyer.client, 'admin_notifications', seeded.admin_notifications, { read: false })).toEqual([])
    })
  }, 30_000)

  it('an admin session can write the catalogue and mark a notification read; a non-admin matches no row', async () => {
    const b = fx!.buyer.client
    expect(await touch(b, 'game_categories', pairId, { name: 'Guard RLS Items' })).toEqual([])
    expect(await touch(b, 'attribute_templates', seeded.attribute_templates, { name: `Guard ${fx!.ns.tag}` })).toEqual([])
    expect(await touch(b, 'admin_notifications', seeded.admin_notifications, { read: false })).toEqual([])
    const a = fx!.admin.client
    expect(await touch(a, 'game_categories', pairId, { name: 'Guard RLS Items' })).toEqual([pairId])
    expect(await touch(a, 'attribute_templates', seeded.attribute_templates, { name: `Guard ${fx!.ns.tag}` })).toEqual([seeded.attribute_templates])
    expect(await touch(a, 'admin_notifications', seeded.admin_notifications, { read: false })).toEqual([seeded.admin_notifications])
    await withAdminRole(fx!.admin.id, 'moderator', true, async () => {
      expect(await touch(a, 'game_categories', pairId, { name: 'Guard RLS Items' }), 'moderator').toEqual([])
    })
  }, 30_000)

  it('owners keep their own loyalty credit, promo usage, invitation, KYC document and log', async () => {
    const s = fx!.seller.client
    for (const t of ['loyalty_credits', 'promo_code_usages', 'trustpilot_invitations', 'seller_kyc_documents', 'seller_verification_logs']) {
      expect(await ids(s, t, seeded[t]), t).toEqual([seeded[t]])
    }
  })

  it('admin_action_logs stays service-role only: an admin session has no table privilege', async () => {
    const { error } = await fx!.admin.client.from('admin_action_logs').select('id').limit(1)
    expect(error?.code, error?.message).toBe('42501')
  })

  it('anon still reads the public catalogue and none of the admin-only rows', async () => {
    const a = anon()
    for (const t of ['global_categories', 'game_categories', 'attribute_templates', 'attributes', 'attribute_options', 'attribute_conditional_rules']) {
      const { error } = await a.from(t).select('id').limit(1)
      expect(error, `${t}: ${error?.message}`).toBeNull()
    }
    for (const t of [...ADMIN_ONLY, ...ANY_ADMIN]) {
      const { data } = await a.from(t).select('id').eq('id', seeded[t])
      expect(data ?? [], t).toEqual([])
    }
  }, 30_000)
})
