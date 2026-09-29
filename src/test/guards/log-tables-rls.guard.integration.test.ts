/**
 * seller_tier_history / seller_verification_logs RLS (integration) —
 * migration 20260928162611_log_tables_rls.sql.
 *
 * Each carried a baseline INSERT policy with WITH CHECK (true) ("System can
 * create tier history" / "System can create logs" for PUBLIC, "System can
 * create action logs" for authenticated), on top of GRANT ALL to anon +
 * authenticated: the public anon key could forge a seller's tier history and
 * write fake entries into any seller application's verification audit trail,
 * and any account could forge admin_action_logs. The "system" writers never
 * needed it — tier history is written by the service role, the verification
 * log by two triggers that ran as the caller, admin_action_logs by nobody —
 * so the triggers now run as their owner and the open policies are gone.
 *   · no public INSERT policy with WITH CHECK (true) for PUBLIC, anon or
 *     authenticated outside the allow-list below (the class of this bug);
 *   · anon can neither read nor write either table;
 *   · a signed-in non-admin can't forge a tier change or a log entry, even
 *     on their own application;
 *   · the legitimate writers still work: an applicant creating an
 *     application and uploading a KYC document still logs it (the triggers),
 *     an admin session still writes and reads the log, a seller still reads
 *     their own tier history.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { hasEnv, makeFixture, URL, ANON, type Fixture } from './throwaway'

const DB_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

/** Tables anyone may INSERT into by design, with the reason. A new entry is a security decision. */
const OPEN_INSERT_ALLOWLIST: Record<string, string> = {
  shop_visits: 'anonymous shop-page visit counter; no PII, nothing reads it as a trusted record',
}

let fx: Fixture | null = null
let applicationId = ''
let tierRowId = ''
const anon = () => createClient(URL!, ANON!, { auth: { persistSession: false } })

function psql(q: string): string {
  return execFileSync('psql', [DB_URL, '-Atq', '-c', q], { stdio: 'pipe' }).toString().trim()
}

type Res = { error: { code?: string; message: string } | null; data?: unknown }
function expectDenied(res: Res, what: string) {
  if (!res.error) throw new Error(`${what}: expected 42501, but it succeeded: ${JSON.stringify(res.data).slice(0, 200)}`)
  expect(res.error.code, `${what}: ${res.error.message}`).toBe('42501')
}
async function logActions(client: SupabaseClient, appId: string) {
  const { data, error } = await client.from('seller_verification_logs').select('action').eq('application_id', appId)
  expect(error, error?.message).toBeNull()
  return ((data as { action: string }[] | null) ?? []).map((r) => r.action).sort()
}
function tierRow(userId: string) {
  return { user_id: userId, previous_tier: 'bronze', new_tier: 'legendary', reason: 'manual_upgrade' }
}

describe.skipIf(!hasEnv)('seller_tier_history / seller_verification_logs RLS (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    const { data: tier, error: te } = await fx.svc.from('seller_tier_history')
      .insert({ ...tierRow(fx.seller.id), new_tier: 'silver' }).select('id').single()
    if (te) throw new Error(`seller_tier_history insert: ${te.message}`)
    tierRowId = (tier as any).id
  }, 120_000)

  afterAll(async () => {
    if (!fx) return
    const users = [fx.buyer.id, fx.seller.id, fx.admin.id]
    const { error: ke } = await fx.svc.from('seller_kyc_documents').delete().in('user_id', users)
    if (ke) throw new Error(`seller_kyc_documents cleanup: ${ke.message}`)
    const { error: he } = await fx.svc.from('seller_tier_history').delete().in('user_id', users)
    if (he) throw new Error(`seller_tier_history cleanup: ${he.message}`)
    // seller_verification_logs go with their application (FK cascade); the
    // application goes with the fixture user (DEPENDENT_TABLES).
    await fx.cleanup()
  }, 120_000)

  it('no public INSERT policy with WITH CHECK (true) for PUBLIC, anon or authenticated outside the allow-list', () => {
    const open = psql(`
      select c.relname || ': ' || p.polname
      from pg_policy p
      join pg_class c on c.oid = p.polrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and p.polcmd = 'a'
        and (0 = any(p.polroles) or 'anon'::regrole::oid = any(p.polroles) or 'authenticated'::regrole::oid = any(p.polroles))
        and pg_get_expr(p.polwithcheck, p.polrelid) = 'true'
      order by 1`)
    const unexpected = open.split('\n').filter(Boolean).filter((row) => !(row.split(':')[0] in OPEN_INSERT_ALLOWLIST))
    expect(unexpected, `INSERT policies that let anyone write any row:\n${unexpected.join('\n')}`).toEqual([])
  })

  it('the logging trigger functions run as their owner and nobody can call them', () => {
    const rows = psql(`
      select p.proname || ' ' || p.prosecdef || ' ' || coalesce(array_to_string(p.proconfig, ','), '-')
             || ' ' || has_function_privilege('anon', p.oid, 'EXECUTE') || ' ' || has_function_privilege('authenticated', p.oid, 'EXECUTE')
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname in ('log_document_upload', 'log_seller_application_event') order by 1`)
    expect(rows.split('\n')).toEqual([
      'log_document_upload true search_path=public false false',
      'log_seller_application_event true search_path=public false false',
    ])
  })

  it('anon can neither read nor write either table', async () => {
    const a = anon()
    expectDenied(await a.from('seller_tier_history').select('id'), 'anon select tier history')
    expectDenied(await a.from('seller_tier_history').insert(tierRow(fx!.seller.id)), 'anon forges a tier change')
    expectDenied(await a.from('seller_verification_logs').select('id'), 'anon select verification logs')
    expectDenied(await a.from('seller_verification_logs').insert({ action: 'approved', is_system_action: true }), 'anon forges a log entry')
  })

  it('admin_action_logs is service-role only: no session reads or writes it', async () => {
    const forged = { admin_id: fx!.buyer.id, action_type: 'user.banned', target_type: 'user', target_id: fx!.seller.id }
    expectDenied(await anon().from('admin_action_logs').select('id'), 'anon select admin_action_logs')
    expectDenied(await fx!.buyer.client.from('admin_action_logs').insert(forged), 'signed-in user forges an admin action')
    expectDenied(await fx!.admin.client.from('admin_action_logs').select('id'), 'admin session select admin_action_logs')
  })

  it('a seller reads their own tier history and nobody else can; a non-admin cannot forge one', async () => {
    const { data: own } = await fx!.seller.client.from('seller_tier_history').select('id')
    expect(((own as any[]) ?? []).map((r) => r.id)).toContain(tierRowId)
    const { data: other } = await fx!.buyer.client.from('seller_tier_history').select('id')
    expect(((other as any[]) ?? []).map((r) => r.id)).not.toContain(tierRowId)
    expectDenied(await fx!.seller.client.from('seller_tier_history').insert(tierRow(fx!.seller.id)), 'seller promotes themselves')
  })

  it('an applicant still logs their application and KYC upload (the triggers), but cannot forge a log entry', async () => {
    const buyer = fx!.buyer.client
    const { data: app, error: ae } = await buyer.from('seller_applications').insert({
      user_id: fx!.buyer.id, seller_type: 'individual', display_name: 'Guard Applicant', is_18_or_older: true,
    }).select('id').single()
    expect(ae, ae?.message).toBeNull()
    applicationId = (app as any).id

    const { error: ke } = await buyer.from('seller_kyc_documents').insert({
      application_id: applicationId, user_id: fx!.buyer.id, document_type: 'id_front',
      file_path: `${fx!.buyer.id}/guard-id-front.png`, file_name: 'guard-id-front.png',
    })
    expect(ke, ke?.message).toBeNull()

    expect(await logActions(fx!.svc, applicationId)).toEqual(['application_started', 'document_uploaded'])
    // …and the applicant reads their own application's log.
    expect(await logActions(buyer, applicationId)).toEqual(['application_started', 'document_uploaded'])

    expectDenied(
      await buyer.from('seller_verification_logs').insert({ application_id: applicationId, action: 'approved', is_system_action: true }),
      'applicant forges an approval in their own log',
    )
    expect(await logActions(fx!.svc, applicationId)).toEqual(['application_started', 'document_uploaded'])
  }, 30_000)

  it('an admin session still writes and reads the verification log', async () => {
    const admin = fx!.admin.client
    const { error } = await admin.from('seller_verification_logs').insert({
      application_id: applicationId, action: 'review_started', performed_by: fx!.admin.id,
    })
    expect(error, error?.message).toBeNull()
    expect(await logActions(admin, applicationId)).toEqual(['application_started', 'document_uploaded', 'review_started'])
  })
})
