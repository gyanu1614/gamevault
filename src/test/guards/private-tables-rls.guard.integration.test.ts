/**
 * fraud_flags / gdpr_requests / inform_disclosures RLS (integration) —
 * migration 20260928154731_private_tables_rls.sql.
 *
 * Each table carried a baseline "Service role full access to <table>" policy
 * with no TO clause (so PUBLIC, USING true / WITH CHECK true) on top of GRANT
 * ALL to anon + authenticated: the public anon key read and wrote every fraud
 * flag, every GDPR request (export_url) and every seller's INFORM identity.
 * Every probe goes through PostgREST as what a caller actually holds — the
 * anon key, a signed-in stranger, the row's own user, an admin session:
 *   · no public policy hands UPDATE / DELETE / ALL to PUBLIC, anon or
 *     authenticated with a `true` predicate (the class of this bug);
 *   · anon can neither read nor write any of the three;
 *   · a signed-in non-admin sees no fraud flag and only their own GDPR
 *     request / INFORM disclosure, updates and deletes nothing, and can't
 *     insert what only an admin sets;
 *   · the app paths still work as the right session: users file and read
 *     their own, admins list, resolve, process and certify, and the
 *     dashboard still counts fraud flags.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { execFileSync } from 'node:child_process'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { hasEnv, makeFixture, URL, ANON, type Fixture } from './throwaway'

const state = vi.hoisted(() => ({ client: null as any, adminId: '' }))

vi.mock('next/cache', () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/email', async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>()
  return Object.fromEntries(Object.keys(real).map((k) => [k, async () => undefined]))
})
// submitInformDisclosure notifies every admin in the DB — other suites' fixture admins included.
vi.mock('@/lib/utils/notifications', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  notifyAdmins: async () => undefined,
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => state.client }))
vi.mock('@/lib/actions/admin-permissions', () => ({
  requireAdmin: async () => ({ userId: state.adminId }),
}))

import { getFraudFlags, getFraudStats, resolveFraudFlag } from '@/lib/actions/fraud-detection'
import { exportMyData, getGdprRequests, getMyGdprRequests, processGdprRequest, submitGdprRequest } from '@/lib/actions/gdpr'
import { certifyInformDisclosure, getInformDisclosures, getMyInformStatus, submitInformDisclosure } from '@/lib/actions/inform-act'
import { getDashboardStats } from '@/lib/actions/admin-dashboard'

const DB_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const TABLES = ['fraud_flags', 'gdpr_requests', 'inform_disclosures'] as const

let fx: Fixture | null = null
const seeded = { flag: '', gdpr: '', inform: '' }
const anon = () => createClient(URL!, ANON!, { auth: { persistSession: false } })

function psql(q: string): string {
  return execFileSync('psql', [DB_URL, '-Atq', '-c', q], { stdio: 'pipe' }).toString().trim()
}

type Res = { error: { code?: string; message: string } | null; data?: unknown }
function expectDenied(res: Res, what: string) {
  if (!res.error) throw new Error(`${what}: expected 42501, but it succeeded: ${JSON.stringify(res.data).slice(0, 200)}`)
  expect(res.error.code, `${what}: ${res.error.message}`).toBe('42501')
}
/** An UPDATE that RLS filters out: no error, no row returned. */
function expectNoRowsTouched(res: Res, what: string) {
  expect(res.error, `${what}: ${res.error?.message}`).toBeNull()
  expect(res.data, what).toEqual([])
}
async function idsVisibleTo(client: SupabaseClient, table: (typeof TABLES)[number]) {
  const { data, error } = await client.from(table).select('id')
  expect(error, `${table}: ${error?.message}`).toBeNull()
  return ((data as { id: string }[] | null) ?? []).map((r) => r.id)
}

function informRow(sellerId: string, extra: Record<string, unknown> = {}) {
  return {
    seller_id: sellerId, legal_name: 'Guard Test Seller Ltd', address_line1: '1 Guard Street',
    city: 'Testville', state_province: 'TS', postal_code: '00000', country: 'US',
    tax_id_last4: '1234', contact_email: 'guard@example.com', contact_phone: '+10000000000', ...extra,
  }
}

async function deleteFixtureRows() {
  if (!fx) return
  const users = [fx.buyer.id, fx.seller.id, fx.admin.id]
  for (const [table, col] of [['fraud_flags', 'user_id'], ['gdpr_requests', 'user_id'], ['inform_disclosures', 'seller_id']] as const) {
    const { error } = await fx.svc.from(table).delete().in(col, users)
    if (error) throw new Error(`${table} cleanup: ${error.message}`)
  }
}

describe.skipIf(!hasEnv)('fraud_flags / gdpr_requests / inform_disclosures RLS (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    state.adminId = fx.admin.id

    const { data: flag, error: fe } = await fx.svc.from('fraud_flags').insert({
      user_id: fx.buyer.id, rule_id: 'guard_test', severity: 'high', description: `Guard flag ${fx.ns.key}`,
    }).select('id').single()
    if (fe) throw new Error(`fraud_flags insert: ${fe.message}`)
    const { data: gdpr, error: ge } = await fx.svc.from('gdpr_requests').insert({
      user_id: fx.buyer.id, type: 'export',
    }).select('id').single()
    if (ge) throw new Error(`gdpr_requests insert: ${ge.message}`)
    const { data: inform, error: ie } = await fx.svc.from('inform_disclosures')
      .insert(informRow(fx.seller.id)).select('id').single()
    if (ie) throw new Error(`inform_disclosures insert: ${ie.message}`)
    Object.assign(seeded, { flag: (flag as any).id, gdpr: (gdpr as any).id, inform: (inform as any).id })
  }, 120_000)

  afterAll(async () => {
    if (!fx) return
    await deleteFixtureRows()
    await fx.cleanup()
  }, 120_000)

  it('no public policy gives UPDATE / DELETE / ALL to PUBLIC, anon or authenticated with a `true` predicate', () => {
    const open = psql(`
      select c.relname || ': ' || p.polname
      from pg_policy p
      join pg_class c on c.oid = p.polrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and p.polcmd in ('*', 'w', 'd')
        and (0 = any(p.polroles) or 'anon'::regrole::oid = any(p.polroles) or 'authenticated'::regrole::oid = any(p.polroles))
        and (pg_get_expr(p.polqual, p.polrelid) = 'true' or pg_get_expr(p.polwithcheck, p.polrelid) = 'true')
      order by 1`)
    expect(open, `policies that let any caller change any row:\n${open}`).toBe('')
  })

  it('anon holds no privilege on the three tables; authenticated cannot delete or truncate', () => {
    const rows = psql(`
      select t || ' ' || has_table_privilege('anon', 'public.' || t, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
                 || ' ' || has_table_privilege('authenticated', 'public.' || t, 'DELETE,TRUNCATE')
      from unnest(array['fraud_flags', 'gdpr_requests', 'inform_disclosures']) t order by 1`)
    expect(rows.split('\n')).toEqual(['fraud_flags false false', 'gdpr_requests false false', 'inform_disclosures false false'])
  })

  it('anon can neither read nor write any of the three', async () => {
    const a = anon()
    const probes: Record<(typeof TABLES)[number], { id: string; row: Record<string, unknown> }> = {
      fraud_flags: { id: seeded.flag, row: { user_id: fx!.buyer.id, rule_id: 'anon', severity: 'low', description: 'anon' } },
      gdpr_requests: { id: seeded.gdpr, row: { user_id: fx!.buyer.id, type: 'deletion' } },
      inform_disclosures: { id: seeded.inform, row: informRow(fx!.seller.id) },
    }
    for (const table of TABLES) {
      const { id, row } = probes[table]
      expectDenied(await a.from(table).select('id'), `anon select ${table}`)
      expectDenied(await a.from(table).insert(row), `anon insert ${table}`)
      expectDenied(await a.from(table).update({ status: 'rejected' }).eq('id', id).select('id'), `anon update ${table}`)
      expectDenied(await a.from(table).delete().eq('id', id), `anon delete ${table}`)
    }
  }, 30_000)

  it('a signed-in non-admin sees no fraud flag — not even one about themselves — and cannot write one', async () => {
    for (const actor of [fx!.buyer, fx!.seller]) {
      expect(await idsVisibleTo(actor.client, 'fraud_flags')).toEqual([])
    }
    const buyer = fx!.buyer.client
    expectDenied(
      await buyer.from('fraud_flags').insert({ user_id: fx!.seller.id, rule_id: 'forged', severity: 'high', description: 'forged' }),
      'non-admin insert fraud_flags',
    )
    expectNoRowsTouched(
      await buyer.from('fraud_flags').update({ status: 'dismissed' }).eq('id', seeded.flag).select('id'),
      'non-admin dismisses the flag about them',
    )
    expectDenied(await buyer.from('fraud_flags').delete().eq('id', seeded.flag), 'non-admin delete fraud_flags')
    const { data } = await fx!.svc.from('fraud_flags').select('status').eq('id', seeded.flag).single()
    expect((data as any).status).toBe('open')
  }, 30_000)

  it('GDPR requests: a user reads only their own, updates and deletes nothing, and cannot insert admin fields', async () => {
    const buyer = fx!.buyer.client
    const seller = fx!.seller.client
    expect(await idsVisibleTo(buyer, 'gdpr_requests')).toContain(seeded.gdpr)
    expect(await idsVisibleTo(seller, 'gdpr_requests')).not.toContain(seeded.gdpr)

    expectNoRowsTouched(
      await buyer.from('gdpr_requests').update({ status: 'completed', export_url: 'https://evil.example' }).eq('id', seeded.gdpr).select('id'),
      'user completes their own request',
    )
    expectNoRowsTouched(
      await seller.from('gdpr_requests').update({ status: 'rejected' }).eq('id', seeded.gdpr).select('id'),
      'another user rejects the request',
    )
    expectDenied(await buyer.from('gdpr_requests').delete().eq('id', seeded.gdpr), 'user deletes their own request')

    const base = { user_id: fx!.buyer.id, type: 'export' }
    expectDenied(await buyer.from('gdpr_requests').insert({ ...base, export_url: 'https://evil.example' }), 'insert with export_url')
    expectDenied(await buyer.from('gdpr_requests').insert({ ...base, processed_by: fx!.admin.id }), 'insert with processed_by')
    expectDenied(await buyer.from('gdpr_requests').insert({ ...base, type: 'deletion', status: 'completed' }), 'insert a completed deletion')
    expectDenied(await buyer.from('gdpr_requests').insert({ ...base, user_id: fx!.seller.id }), 'insert for another user')

    const { data } = await fx!.svc.from('gdpr_requests').select('status, export_url').eq('id', seeded.gdpr).single()
    expect(data).toEqual({ status: 'pending', export_url: null })
  }, 30_000)

  it('INFORM disclosures: a seller reads only their own, updates and deletes nothing, and cannot submit one already certified', async () => {
    const buyer = fx!.buyer.client
    const seller = fx!.seller.client
    expect(await idsVisibleTo(seller, 'inform_disclosures')).toContain(seeded.inform)
    expect(await idsVisibleTo(buyer, 'inform_disclosures')).not.toContain(seeded.inform)

    expectNoRowsTouched(
      await seller.from('inform_disclosures').update({ status: 'certified' }).eq('id', seeded.inform).select('id'),
      'seller certifies their own disclosure',
    )
    expectNoRowsTouched(
      await buyer.from('inform_disclosures').update({ legal_name: 'Hijacked' }).eq('id', seeded.inform).select('id'),
      'another user edits the disclosure',
    )
    expectDenied(await seller.from('inform_disclosures').delete().eq('id', seeded.inform), 'seller deletes their disclosure')

    expectDenied(await seller.from('inform_disclosures').insert(informRow(fx!.seller.id, { status: 'certified' })), 'insert certified')
    expectDenied(
      await seller.from('inform_disclosures').insert(informRow(fx!.seller.id, { certified_by: fx!.admin.id, certified_at: new Date().toISOString() })),
      'insert with a certifier',
    )
    expectDenied(await buyer.from('inform_disclosures').insert(informRow(fx!.seller.id)), 'insert for another seller')

    const { data } = await fx!.svc.from('inform_disclosures').select('status, legal_name').eq('id', seeded.inform).single()
    expect(data).toEqual({ status: 'submitted', legal_name: 'Guard Test Seller Ltd' })
  }, 30_000)

  it('an admin session reads all three and inserts fraud flags, but deletes nothing', async () => {
    const admin = fx!.admin.client
    expect(await idsVisibleTo(admin, 'fraud_flags')).toContain(seeded.flag)
    expect(await idsVisibleTo(admin, 'gdpr_requests')).toContain(seeded.gdpr)
    expect(await idsVisibleTo(admin, 'inform_disclosures')).toContain(seeded.inform)

    const { error } = await admin.from('fraud_flags').insert({
      user_id: fx!.buyer.id, rule_id: 'guard_test_admin', severity: 'low', description: 'admin-created (runFraudScan path)',
    })
    expect(error, error?.message).toBeNull()
    for (const [table, id] of [['fraud_flags', seeded.flag], ['gdpr_requests', seeded.gdpr], ['inform_disclosures', seeded.inform]] as const) {
      expectDenied(await admin.from(table).delete().eq('id', id), `admin delete ${table}`)
    }
  }, 30_000)

  it('fraud actions work for an admin: list, stats, dashboard count, resolve', async () => {
    state.client = fx!.admin.client
    const flags = await getFraudFlags('open')
    expect(flags.success, flags.error).toBe(true)
    expect(flags.flags!.map((f) => f.id)).toContain(seeded.flag)

    // Counts are ≥ 1, not an exact match: other suites write fraud flags in parallel.
    const stats = await getFraudStats()
    expect(stats.success, stats.error).toBe(true)
    expect(stats.open).toBeGreaterThanOrEqual(1)
    expect(stats.high).toBeGreaterThanOrEqual(1)

    const dash = await getDashboardStats()
    expect(dash.success, dash.error).toBe(true)
    expect(dash.stats!.openFraudFlags).toBeGreaterThanOrEqual(1)
    expect(dash.stats!.highSeverityFlags).toBeGreaterThanOrEqual(1)

    const resolved = await resolveFraudFlag(seeded.flag, 'resolved')
    expect(resolved.success, resolved.error).toBe(true)
    const { data } = await fx!.svc.from('fraud_flags').select('status').eq('id', seeded.flag).single()
    expect((data as any).status).toBe('resolved')
  }, 30_000)

  it('GDPR actions: a user files, lists and exports their own; an admin lists and processes', async () => {
    state.client = fx!.buyer.client
    const filed = await submitGdprRequest('deletion')
    expect(filed.success, filed.error).toBe(true)
    const mine = await getMyGdprRequests()
    expect(mine.success, mine.error).toBe(true)
    expect(mine.requests!.map((r) => r.id).sort()).toEqual([seeded.gdpr, filed.requestId!].sort())

    const exported = await exportMyData()
    expect(exported.success, exported.error).toBe(true)
    // exportMyData records its audit row fire-and-forget: wait for it to land.
    let audit: unknown[] = []
    for (let i = 0; i < 50 && audit.length === 0; i++) {
      const { data } = await fx!.svc.from('gdpr_requests').select('id')
        .eq('user_id', fx!.buyer.id).eq('type', 'export').eq('status', 'completed')
      audit = (data as unknown[] | null) ?? []
      if (audit.length === 0) await new Promise((r) => setTimeout(r, 100))
    }
    expect(audit, 'the self-service export audit row was refused').toHaveLength(1)

    state.client = fx!.admin.client
    const pending = await getGdprRequests('pending')
    expect(pending.success, pending.error).toBe(true)
    expect(pending.requests!.map((r) => r.id)).toEqual(expect.arrayContaining([seeded.gdpr, filed.requestId]))
    const processed = await processGdprRequest(filed.requestId!, 'rejected', { rejectionReason: 'guard test' })
    expect(processed.success, processed.error).toBe(true)
    const { data } = await fx!.svc.from('gdpr_requests').select('status, rejection_reason').eq('id', filed.requestId!).single()
    expect(data).toEqual({ status: 'rejected', rejection_reason: 'guard test' })
  }, 30_000)

  it('INFORM actions: a seller submits and reads their own; an admin lists and certifies', async () => {
    // getMyInformStatus only reads the disclosure once the profile needs one.
    const { error: pe } = await fx!.svc.from('profiles').update({ inform_status: 'required' }).eq('id', fx!.seller.id)
    if (pe) throw new Error(`profile inform_status: ${pe.message}`)

    state.client = fx!.seller.client
    const submitted = await submitInformDisclosure({
      legalName: 'Guard Test Seller Ltd', addressLine1: '2 Guard Street', city: 'Testville', stateProvince: 'TS',
      postalCode: '00000', country: 'US', taxIdLast4: '5678', contactEmail: 'guard@example.com', contactPhone: '+10000000000',
    })
    expect(submitted.success, submitted.error).toBe(true)
    const mine = await getMyInformStatus()
    expect(mine.success, mine.error).toBe(true)
    expect(mine.disclosure).toMatchObject({ seller_id: fx!.seller.id, version: 2, tax_id_last4: '5678', status: 'submitted' })

    state.client = fx!.admin.client
    const listed = await getInformDisclosures()
    expect(listed.success, listed.error).toBe(true)
    expect(listed.disclosures!.map((d) => d.id)).toEqual(expect.arrayContaining([seeded.inform, mine.disclosure!.id]))
    const certified = await certifyInformDisclosure(mine.disclosure!.id, 'certified')
    expect(certified.success, certified.error).toBe(true)
    const { data } = await fx!.svc.from('inform_disclosures').select('status, certified_by').eq('id', mine.disclosure!.id).single()
    expect(data).toEqual({ status: 'certified', certified_by: fx!.admin.id })
  }, 30_000)
})
