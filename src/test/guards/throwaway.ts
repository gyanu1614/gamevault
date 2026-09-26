/**
 * Throwaway fixtures for the AUTH-002/005/006 column-guard integration tests.
 *
 * Creates real auth users (service role), signs each in with the PUBLIC anon
 * key — exactly what an attacker holds — and seeds a listing + orders they
 * own. Every write in the tests goes through PostgREST as that user, so a
 * passing "exploit fails" case proves the DB guard, not app code.
 *
 * Self-skips when env is absent or the guard migration is not applied
 * (probed via `auth_p0_guards_version()`).
 *
 * Cleanup (call from afterAll) deletes every dependent row for the fixture's
 * users explicitly, then the auth users (profiles cascade), and FINALLY
 * verifies that no `guardtest-%@example.com` profile or auth user remains —
 * a leaked fixture fails the run instead of quietly surviving. (One did on
 * 2026-09-12: a swallowed deleteUser error left a fixture seller + an active
 * "GUARD-TEST-…" listing behind.)
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { supabaseReachable } from '../supabase-reachable'
import { fixtureNamespace, purgeAuditLogs, type FixtureNamespace } from './fixture-namespace'

export const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
export const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY
export const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
export const hasEnv = Boolean(URL && SVC && ANON)

/**
 * Guard fixtures create real auth users and rows. Refuse anything but a local
 * Supabase stack unless ALLOW_REMOTE_GUARD_TESTS=1 is set explicitly — a run
 * with .env.local unshadowed leaked a fixture into production on 2026-09-12.
 */
export function assertGuardTargetAllowed(url: string | undefined, env: Record<string, string | undefined>): void {
  if (env.ALLOW_REMOTE_GUARD_TESTS === '1') return
  let host = ''
  try { host = new globalThis.URL(url ?? '').hostname } catch { host = '' }
  const local = host === '127.0.0.1' || host === 'localhost' || host === '[::1]' || host === '::1'
  if (!local) {
    throw new Error(
      `guard tests refuse to run against non-local Supabase URL ${JSON.stringify(url ?? '')}: ` +
      'they create real users and rows. Point NEXT_PUBLIC_SUPABASE_URL at the local stack, ' +
      'or set ALLOW_REMOTE_GUARD_TESTS=1 deliberately.',
    )
  }
}

export type Actor = { id: string; client: SupabaseClient }
export type Fixture = {
  svc: SupabaseClient
  seller: Actor
  buyer: Actor
  admin: Actor
  listingId: string
  pendingOrderId: string
  completedOrderId: string
  /** this test file's fixture namespace — mint any extra ids through it */
  ns: FixtureNamespace
  cleanup: () => Promise<void>
}

export async function guardsApplied(svc: SupabaseClient): Promise<boolean> {
  const { error } = await svc.rpc('auth_p0_guards_version')
  return !error
}

/** 20260912100000_auth_p1.sql applied? (AUTH-008/009/011/013/014) */
export async function p1GuardsApplied(svc: SupabaseClient): Promise<boolean> {
  const { error } = await svc.rpc('auth_p1_guards_version')
  return !error
}

/**
 * A tier ABOVE the entry tier, read from the live seller_tier_config: the
 * lowest sort_order with pre_moderation_listings = 0 (gemstone → amethyst,
 * metal → silver). Never hard-code a tier name in a fixture — the local stack
 * and prod carry different tier sets, and an invalid tier makes the whole
 * profiles UPDATE fail, leaving the fixture seller as role='user'.
 */
export async function establishedTier(svc: SupabaseClient): Promise<{ tier: string; entry: string }> {
  const { data, error } = await svc.from('seller_tier_config').select('tier, sort_order, pre_moderation_listings').order('sort_order', { ascending: true })
  if (error || !data?.length) throw new Error(`seller_tier_config unreadable: ${error?.message ?? 'no rows'}`)
  const rows = data as Array<{ tier: string; pre_moderation_listings: number | null }>
  const entry = rows[0].tier
  const established = rows.find((r) => Number(r.pre_moderation_listings ?? 0) === 0 && r.tier !== entry) ?? rows[rows.length - 1]
  return { tier: established.tier, entry }
}

/** Promote a fixture user to an active seller on the established tier; throws if the write fails. */
/**
 * Activate the fixture's pending listing the way the app does: through the
 * approve_listing RPC (flag path). Since ACC-03 (20260925204757) a plain
 * service-role `update({ status: 'active' })` on a pending_approval row is
 * rejected — review is the only way out of moderation, for the app too.
 */
export async function activateFixtureListing(svc: SupabaseClient, listingId: string, adminId: string, extra: Record<string, unknown> = {}): Promise<void> {
  const { error } = await svc.rpc('approve_listing', { listing_id: listingId, admin_id: adminId })
  if (error) throw new Error(`approve_listing(${listingId}): ${error.message}`)
  if (Object.keys(extra).length) {
    const { error: ue } = await svc.from('listings').update(extra).eq('id', listingId)
    if (ue) throw new Error(`listing patch(${listingId}): ${ue.message}`)
  }
}

export async function promoteToEstablishedSeller(svc: SupabaseClient, userId: string): Promise<{ tier: string; entry: string }> {
  const t = await establishedTier(svc)
  const { error } = await svc.from('profiles').update({ role: 'seller', seller_tier: t.tier, seller_status: 'active' }).eq('id', userId)
  if (error) throw new Error(`promote seller (${t.tier}): ${error.message}`)
  return t
}

/** Every table that references a fixture user, with the referencing columns. */
export const DEPENDENT_TABLES: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['reviews', ['reviewer_id', 'seller_id']],
  ['orders', ['buyer_id', 'seller_id']],
  ['listings', ['seller_id']],
  ['seller_applications', ['user_id']],
  ['referral_earnings', ['referrer_id', 'referred_user_id']],
  ['notifications', ['user_id']],
  ['admin_roles', ['user_id']],
]

export const GUARD_EMAIL_LIKE = 'guardtest-%@example.com'
export const GUARD_EMAIL_RE = /^guardtest-[a-z]+-[a-z0-9]+@example\.com$/

/**
 * Throws when guard-test fixture residue exists in the target database —
 * profiles or auth users matching the fixture email pattern, or listings
 * titled GUARD-TEST-… . Called from cleanup()'s finally block, so a leaked
 * fixture (this run's or an earlier one's) fails the run loudly.
 *
 * With `ns` the check covers ONLY that test file's namespace: another file's
 * leak is that file's failure, not this one's (it used to fail every suite
 * that tore down after it). Without `ns` it scans every guard-test row.
 */
export async function verifyNoGuardTestResidue(svc: SupabaseClient, priorFailures: string[] = [], ns?: FixtureNamespace): Promise<void> {
  const problems = [...priorFailures]
  const scope = ns ? ` (${ns.file}, key ${ns.key})` : ''
  const { data: profs, error: pe } = await svc.from('profiles').select('id').like('email', ns?.emailLike ?? GUARD_EMAIL_LIKE)
  if (pe) problems.push(`residue check (profiles): ${pe.message}`)
  else if ((profs ?? []).length) problems.push(`${(profs ?? []).length} guard-test profile(s) remain${scope}: ${(profs ?? []).map((p: any) => p.id).join(', ')}`)
  const { data: lst, error: le } = await svc.from('listings').select('id').like('title', ns?.listingLike ?? 'GUARD-TEST-%')
  if (le) problems.push(`residue check (listings): ${le.message}`)
  else if ((lst ?? []).length) problems.push(`${(lst ?? []).length} GUARD-TEST listing(s) remain${scope}: ${(lst ?? []).map((l: any) => l.id).join(', ')}`)
  const { data: au, error: ae } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (ae) problems.push(`residue check (auth.users): ${ae.message}`)
  else {
    const re = ns?.emailRe ?? GUARD_EMAIL_RE
    const leaked = (au?.users ?? []).filter((u) => re.test(u.email ?? ''))
    if (leaked.length) problems.push(`${leaked.length} guard-test auth user(s) remain${scope}: ${leaked.map((u) => u.id).join(', ')}`)
  }
  if (problems.length) {
    throw new Error(`guard-test fixture teardown left residue in ${URL}:\n  - ${problems.join('\n  - ')}`)
  }
}

/**
 * Delete fixture users and everything that references them: dependents
 * first (explicitly — never rely on cascades that differ between
 * environments), then audit_logs (local psql path), then the auth users
 * (profiles cascade). Errors are collected into `failures`, never swallowed.
 */
export async function purgeFixtureUsers(svc: SupabaseClient, userIds: string[], failures: string[]): Promise<void> {
  if (!userIds.length) return
  for (const [table, cols] of DEPENDENT_TABLES) {
    for (const col of cols) {
      const { error } = await svc.from(table).delete().in(col, userIds)
      if (error) failures.push(`${table}.${col}: ${error.message}`)
    }
  }
  purgeAuditLogs(userIds, failures)
  for (const id of userIds) {
    const { error } = await svc.auth.admin.deleteUser(id)
    if (error) {
      failures.push(`auth.admin.deleteUser(${id}): ${error.message}`)
      const { error: pe } = await svc.from('profiles').delete().eq('id', id)
      if (pe) failures.push(`profiles.delete(${id}): ${pe.message}`)
    }
  }
}

/**
 * Remove every row ANY earlier run of this test file left behind (a crashed
 * run, a killed worker) — and nothing outside the file's namespace. Returns
 * what it could not delete.
 */
export async function purgeNamespace(svc: SupabaseClient, ns: FixtureNamespace): Promise<string[]> {
  const failures: string[] = []
  const ids = new Set<string>()
  const { data: profs } = await svc.from('profiles').select('id').like('email', ns.emailLike)
  for (const p of (profs ?? []) as { id: string }[]) ids.add(p.id)
  const { data: au } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 })
  for (const u of au?.users ?? []) if (ns.emailRe.test(u.email ?? '')) ids.add(u.id)
  await purgeFixtureUsers(svc, [...ids], failures)
  const { error: le } = await svc.from('listings').delete().like('title', ns.listingLike)
  if (le) failures.push(`listings(${ns.listingLike}): ${le.message}`)
  const { error: ge } = await svc.from('games').delete().like('slug', ns.gameSlugLike)
  if (ge) failures.push(`games(${ns.gameSlugLike}): ${ge.message}`)
  return failures
}

export async function makeFixture(): Promise<Fixture> {
  assertGuardTargetAllowed(URL, process.env)
  // Credentials can be present and valid while nothing is listening — the
  // default .env.test points at a local stack that may not be started. Fail
  // with a clear instruction instead of an undici "fetch failed" stack.
  if (!(await supabaseReachable(URL))) {
    throw new Error(
      `guard tests: no Supabase reachable at ${JSON.stringify(URL ?? '')}. ` +
        'Start this worktree\'s stack with `pnpm db:up` (then `pnpm test:reset`), or run with ' +
        'ALLOW_REMOTE_GUARD_TESTS=1 to target .env.local deliberately.',
    )
  }
  const svc = createClient(URL!, SVC!, { auth: { persistSession: false } })
  // Every id this fixture mints carries the test file's key (see
  // fixture-namespace.ts); stale rows from an earlier crashed run of THIS
  // file are purged first, other files' rows are never touched.
  const ns = fixtureNamespace()
  const stale = await purgeNamespace(svc, ns)
  if (stale.length) throw new Error(`guard fixture (${ns.file}): could not purge an earlier run's rows:\n  - ${stale.join('\n  - ')}`)
  const tag = ns.tag
  const created: string[] = []
  let createdGameId: string | null = null
  /** A pair created under a PRE-EXISTING game (no cascade to rely on). Its mirrored legacy row goes with it. */
  let createdGameCategoryId: string | null = null

  async function mkUser(label: string): Promise<Actor> {
    const email = ns.email(label)
    const password = `Pw!${tag}${label}Xy`
    const { data, error } = await svc.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { username: ns.username(label) },
    })
    if (error || !data.user) throw new Error(`createUser(${label}): ${error?.message}`)
    created.push(data.user.id)
    const { data: prof } = await svc.from('profiles').select('id').eq('id', data.user.id).maybeSingle()
    if (!prof) {
      const { error: pe } = await svc.from('profiles').insert({ id: data.user.id, username: ns.username(label), email })
      if (pe) throw new Error(`profile insert(${label}): ${pe.message}`)
    }
    const client = createClient(URL!, ANON!, { auth: { persistSession: false } })
    const { error: se } = await client.auth.signInWithPassword({ email, password })
    if (se) throw new Error(`signIn(${label}): ${se.message}`)
    return { id: data.user.id, client }
  }

  const cleanup = async () => {
    const failures: string[] = []
    try {
      await purgeFixtureUsers(svc, created, failures)
      if (createdGameCategoryId) {
        const { data: pair } = await svc.from('game_categories').select('legacy_category_id').eq('id', createdGameCategoryId).maybeSingle()
        const { error } = await svc.from('game_categories').delete().eq('id', createdGameCategoryId)
        if (error) failures.push(`game_categories.delete: ${error.message}`)
        const legacyId = (pair as any)?.legacy_category_id
        if (legacyId) {
          const { error: le } = await svc.from('categories').delete().eq('id', legacyId)
          if (le) failures.push(`categories.delete: ${le.message}`)
        }
      }
      if (createdGameId) {
        const { error } = await svc.from('games').delete().eq('id', createdGameId) // game_categories + categories cascade
        if (error) failures.push(`games.delete: ${error.message}`)
      }
    } finally {
      // Runs even if a delete threw: a leaked fixture must fail the run —
      // this file's own leak only; another file's residue is its own failure.
      await verifyNoGuardTestResidue(svc, failures, ns)
    }
  }

  try {
    const seller = await mkUser('seller')
    const buyer = await mkUser('buyer')
    const admin = await mkUser('admin')
    // ACC-01 (20260925204757): a listing can only become active for an
    // account the DB recognises as a seller — the fixture seller is one.
    const { error: re } = await svc.from('profiles').update({ role: 'seller', seller_status: 'active' }).eq('id', seller.id)
    if (re) throw new Error(`seller role update: ${re.message}`)
    const { error: ae } = await svc.from('admin_roles').insert({ user_id: admin.id, role: 'admin', is_active: true })
    if (ae) throw new Error(`admin_roles insert: ${ae.message}`)

    // A fresh local DB (supabase db reset, no seed.sql) has no catalogue rows —
    // create a throwaway game + category when none exist; cleanup removes them.
    let { data: game } = await svc.from('games').select('id').limit(1).maybeSingle()
    if (!game) {
      const { data: g, error: ge } = await svc.from('games')
        .insert({ name: `Guard Test Game ${tag}`, slug: `guard-test-${tag}` }).select('id').single()
      if (ge) throw new Error(`game insert: ${ge.message}`)
      game = g; createdGameId = (g as any).id
    }
    // Step 1b: game_categories is the category table. A fresh stack has the
    // seeded globals (20260916104417) but no pairs — create one for the game;
    // the Phase-A mirror trigger writes the legacy row and
    // trg_listings_category_sync fills listings.category_id from it.
    let { data: cat } = await svc.from('game_categories').select('id').eq('game_id', (game as any).id).eq('is_enabled', true).limit(1).maybeSingle()
    if (!cat) {
      const { data: gc } = await svc.from('global_categories').select('id').eq('slug', 'items').maybeSingle()
      if (!gc) throw new Error('global_categories has no "items" row — apply migrations first')
      const { data: c, error: ce } = await svc.from('game_categories')
        .insert({ game_id: (game as any).id, global_category_id: (gc as any).id, is_enabled: true, slug: `guard-test-items-${tag}`, name: 'Guard Test Items', type: 'items' })
        .select('id').single()
      if (ce) throw new Error(`game_categories insert: ${ce.message}`)
      cat = c
      if (!createdGameId) createdGameCategoryId = (c as any).id
    }

    const { data: listing, error: le } = await svc.from('listings').insert({
      seller_id: seller.id, game_id: (game as any).id, game_category_id: (cat as any).id,
      title: ns.listingTitle(), description: 'guard test throwaway', price: 1, quantity: 5, status: 'pending_approval',
    }).select('id').single()
    if (le) throw new Error(`listing insert: ${le.message}`)

    const baseOrder = {
      buyer_id: buyer.id, seller_id: seller.id, listing_id: (listing as any).id, quantity: 1,
      unit_price: 1, subtotal: 1, platform_fee_rate: 0, payment_processing_fee_rate: 0,
      platform_fee: 0, payment_processing_fee: 0, total_amount: 1, seller_payout: 1, currency: 'USD',
    }
    const { data: pending, error: oe } = await svc.from('orders')
      .insert({ ...baseOrder, status: 'pending', escrow_status: 'pending' }).select('id').single()
    if (oe) throw new Error(`pending order insert: ${oe.message}`)
    const { data: completed, error: ce } = await svc.from('orders')
      .insert({ ...baseOrder, status: 'completed', escrow_status: 'released', completed_at: new Date().toISOString() }).select('id').single()
    if (ce) throw new Error(`completed order insert: ${ce.message}`)

    return {
      svc, seller, buyer, admin,
      listingId: (listing as any).id,
      pendingOrderId: (pending as any).id,
      completedOrderId: (completed as any).id,
      ns,
      cleanup,
    }
  } catch (e) {
    await cleanup()
    throw e
  }
}

/** PostgREST surfaces `RAISE … USING ERRCODE = '42501'` as error.code '42501'. */
export function expectGuardRejection(res: { error: { code?: string; message: string } | null; data: unknown }, table: string) {
  if (!res.error) throw new Error(`expected ${table} guard to reject, but the update succeeded: ${JSON.stringify(res.data)}`)
  if (res.error.code !== '42501' && !/protected/.test(res.error.message)) {
    throw new Error(`expected 42501/protected from ${table} guard, got ${res.error.code}: ${res.error.message}`)
  }
}
