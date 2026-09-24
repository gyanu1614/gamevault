/**
 * Post-deploy fix 1 — withdrawal_methods rows == the fee-engine spec.
 *
 * PR 7 seeded Payoneer with INSERT … IF NOT EXISTS. Production already had a
 * payoneer row (plus paypal / bank) from before the baseline, so the insert
 * was skipped and Payoneer went live with the old row's fees; local stacks had
 * no such row, so every local test passed. Migration 20260924043931 UPSERTs
 * the spec by method_name. This guard pins:
 *
 *   · the rows as they are now equal SPEC (the PR 7 terms quoted on /fees:
 *     USDT 3% + $5, min $50 · Payoneer 3%, $5 minimum fee, min $100);
 *   · every other fiat rail is hidden behind "coming soon"; every crypto row
 *     shares the crypto fee terms;
 *   · replayed against prod's pre-fix shape (wrong Payoneer row, PayPal live,
 *     a legacy BTC row at 3% + $10), the migration restores SPEC, hides PayPal
 *     without touching its fees, aligns BTC's fees without touching its
 *     visibility, audits each change once — and a second run changes nothing.
 *     The replay runs inside one psql transaction that is rolled back, so it
 *     leaves no row behind;
 *   · /admin/fees' coming-soon switch writes through withdrawal_methods_set_fees
 *     with an audit row, and the state it labels a method with (live / coming
 *     soon / hidden) is what a seller's session actually gets.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { hasEnv, URL, SVC, assertGuardTargetAllowed, makeFixture, type Fixture } from './throwaway'
import { payoutMethodState } from '@/lib/wallet/payout-method-state'

let adminId = ''
vi.mock('@/lib/actions/admin-permissions', () => ({
  requireRole: async () => ({ userId: adminId, role: 'admin' }),
  requireAdmin: async () => ({ userId: adminId, role: 'admin' }),
  requirePermission: async () => ({ userId: adminId, role: 'admin' }),
}))
vi.mock('next/cache', () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined, unstable_cache: (fn: unknown) => fn }))
vi.mock('server-only', () => ({}))

const DB_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const MIGRATION = join(__dirname, '../../../supabase/migrations/20260924043931_withdrawal_methods_spec.sql')

const CRYPTO_TERMS = { fee_percentage: 3, fee_fixed: 5, fee_min: 0, min_withdrawal: 50 }
const usdt = (method_name: string, display_name: string, chain: string, description: string, sort_order: number) => ({
  method_name, display_name, method_type: 'crypto', coin: 'usdt', chain, ...CRYPTO_TERMS, fee_currency: 'USD', max_withdrawal: 25000,
  processing_time: '1-2 business days', is_active: true, requires_kyc: false, icon_name: 'Coins', description, coming_soon: false, sort_order,
})
const SPEC = [
  {
    method_name: 'payoneer', display_name: 'Payoneer', method_type: 'fiat', coin: null, chain: null,
    fee_percentage: 3, fee_fixed: 0, fee_min: 5, fee_currency: 'USD', min_withdrawal: 100, max_withdrawal: 25000,
    processing_time: '1–3 business days after approval', is_active: true, requires_kyc: false, icon_name: 'payoneer',
    description: 'Paid to the Payoneer account saved in your payout settings.', coming_soon: false, sort_order: 5,
  },
  usdt('usdt_trc20', 'USDT (TRC-20)', 'tron', 'Lowest network fees. Send only over the Tron network.', 10),
  usdt('usdt_erc20', 'USDT (ERC-20)', 'ethereum', 'Send only over the Ethereum network.', 20),
  usdt('usdt_polygon', 'USDT (Polygon)', 'polygon', 'Low fees. Send only over the Polygon network.', 30),
]
const NUMERIC = ['fee_percentage', 'fee_fixed', 'fee_min', 'min_withdrawal', 'max_withdrawal', 'sort_order']
const SPEC_KEYS = Object.keys(SPEC[0])

/** The spec columns of a DB row, numerics as numbers (PostgREST / json return numeric as number or string). */
function pick(row: Record<string, unknown>, keys = SPEC_KEYS): Record<string, unknown> {
  return Object.fromEntries(keys.map((k) => [k, NUMERIC.includes(k) && row[k] != null ? Number(row[k]) : row[k] ?? null]))
}

describe.skipIf(!hasEnv)('withdrawal_methods == fee-engine spec (integration)', () => {
  let svc: SupabaseClient
  let rows: any[] = []

  beforeAll(async () => {
    svc = createClient(URL!, SVC!, { auth: { persistSession: false } })
    const { data, error } = await svc.from('withdrawal_methods').select('*')
    if (error) throw new Error(`withdrawal_methods: ${error.message}`)
    rows = data ?? []
  })

  it('every spec method exists with exactly the spec values', () => {
    for (const want of SPEC) {
      const got = rows.find((r) => r.method_name === want.method_name)
      expect(got, `${want.method_name} row`).toBeTruthy()
      expect(pick(got), want.method_name).toEqual(want)
    }
  })

  it('every other fiat rail is hidden behind coming soon; every crypto row shares the crypto fee terms', () => {
    for (const r of rows.filter((x) => x.method_type === 'fiat' && x.method_name !== 'payoneer')) {
      expect({ is_active: r.is_active, coming_soon: r.coming_soon }, r.method_name).toEqual({ is_active: false, coming_soon: true })
    }
    for (const r of rows.filter((x) => x.method_type === 'crypto')) {
      expect(pick(r, Object.keys(CRYPTO_TERMS)), r.method_name).toEqual(CRYPTO_TERMS)
    }
  })

  it('replayed on prod\'s pre-fix shape: restores the spec, hides other fiat rails only, audits once, is idempotent', () => {
    assertGuardTargetAllowed(URL, process.env)
    const snapshot = (tag: string) =>
      `SELECT '${tag}|' || json_agg(to_jsonb(w) - 'id' - 'created_at' - 'updated_at' ORDER BY w.method_name)::text FROM withdrawal_methods w;`
    const script = `
BEGIN;
-- Payoneer as prod had it before the hand fix; PayPal live; bank already hidden; a legacy BTC row at 3% + $10.
UPDATE withdrawal_methods SET fee_percentage = 2.00, fee_fixed = 1.00, fee_min = 0, min_withdrawal = 10, max_withdrawal = 10000,
  is_active = false, coming_soon = true, sort_order = 200, description = 'Receive funds to your Payoneer account',
  processing_time = '1-3 business days', icon_name = 'Wallet' WHERE method_name = 'payoneer';
UPDATE withdrawal_methods SET fee_fixed = 10.00 WHERE method_name = 'usdt_polygon';
INSERT INTO withdrawal_methods (method_name, display_name, method_type, fee_percentage, fee_fixed, min_withdrawal, max_withdrawal, description, is_active, coming_soon, sort_order)
VALUES ('paypal', 'PayPal', 'fiat', 2.50, 0.30, 10, 10000, 'Legacy PayPal rail', true, false, 200),
       ('bank', 'Bank Transfer', 'fiat', 1.50, 2.00, 50, 10000, 'Legacy bank rail', false, true, 200)
ON CONFLICT (method_name) DO UPDATE SET is_active = excluded.is_active, coming_soon = excluded.coming_soon;
INSERT INTO withdrawal_methods (method_name, display_name, method_type, coin, chain, fee_percentage, fee_fixed, min_withdrawal, max_withdrawal, is_active, coming_soon, sort_order)
VALUES ('btc', 'Bitcoin', 'crypto', 'btc', 'bitcoin', 3.00, 10.00, 100, 10000, true, false, 60)
ON CONFLICT (method_name) DO UPDATE SET fee_fixed = excluded.fee_fixed, min_withdrawal = excluded.min_withdrawal;
${snapshot('before')}
SELECT coalesce(max(id), 0) AS mark FROM fee_config_audit \\gset
\\i ${MIGRATION}
${snapshot('run1')}
SELECT 'audit1|' || coalesce(json_agg(key ORDER BY key), '[]')::text FROM fee_config_audit WHERE id > :mark;
SELECT coalesce(max(id), 0) AS mark2 FROM fee_config_audit \\gset
\\i ${MIGRATION}
${snapshot('run2')}
SELECT 'audit2|' || count(*) FROM fee_config_audit WHERE id > :mark2;
ROLLBACK;
`
    const out = execFileSync('psql', [DB_URL, '-v', 'ON_ERROR_STOP=1', '-q', '-A', '-t'], { input: script, stdio: ['pipe', 'pipe', 'pipe'] }).toString()
    const line = (tag: string) => {
      const l = out.split('\n').find((x) => x.startsWith(`${tag}|`))
      if (!l) throw new Error(`no ${tag} line in psql output:\n${out}`)
      return JSON.parse(l.slice(tag.length + 1))
    }
    const before: any[] = line('before')
    const run1: any[] = line('run1')
    const by = (list: any[], name: string) => list.find((r) => r.method_name === name)

    for (const want of SPEC) expect(pick(by(run1, want.method_name)), `run1 ${want.method_name}`).toEqual(want)

    // Other fiat rails: hidden, and nothing else about them changed.
    const rest = (r: any) => { const { is_active, coming_soon, ...other } = r; void is_active; void coming_soon; return other }
    for (const name of ['paypal', 'bank']) {
      expect(pick(by(run1, name), ['is_active', 'coming_soon']), name).toEqual({ is_active: false, coming_soon: true })
      expect(rest(by(run1, name)), `${name} untouched apart from visibility`).toEqual(rest(by(before, name)))
    }
    // Legacy crypto: fee terms aligned, visibility / ordering / limits left alone.
    expect(pick(by(run1, 'btc'), Object.keys(CRYPTO_TERMS))).toEqual(CRYPTO_TERMS)
    expect(pick(by(run1, 'btc'), ['is_active', 'coming_soon', 'sort_order', 'max_withdrawal'])).toEqual(pick(by(before, 'btc'), ['is_active', 'coming_soon', 'sort_order', 'max_withdrawal']))

    // One audit row per changed method (bank was already hidden → none).
    expect(line('audit1')).toEqual(['btc', 'payoneer', 'paypal', 'usdt_polygon'])
    // Idempotent: the second run writes nothing and changes nothing.
    expect(line('audit2')).toBe(0)
    expect(line('run2')).toEqual(run1)
  }, 60_000)
})

describe.skipIf(!hasEnv)('/admin/fees — coming-soon switch and the state label (integration)', () => {
  let fx: Fixture | null = null
  let method: any = null

  beforeAll(async () => {
    fx = await makeFixture()
    adminId = fx.admin.id
    const { data, error } = await fx.svc.from('withdrawal_methods').select('*').eq('method_name', 'usdt_polygon').single()
    if (error) throw new Error(`usdt_polygon: ${error.message}`)
    method = data
  }, 60_000)

  afterAll(async () => {
    if (!fx) return
    const failures: string[] = []
    if (method) {
      const { error } = await fx.svc.from('withdrawal_methods').update({ is_active: method.is_active, coming_soon: method.coming_soon }).eq('id', method.id)
      if (error) failures.push(`restore usdt_polygon: ${error.message}`)
    }
    const { error: ae } = await fx.svc.from('fee_config_audit').delete().eq('actor', fx.admin.id)
    if (ae) failures.push(`fee_config_audit: ${ae.message}`)
    try { await fx.cleanup() } catch (e: any) { failures.push(String(e?.message ?? e)) }
    if (failures.length) throw new Error(`cleanup left residue:\n  - ${failures.join('\n  - ')}`)
  }, 60_000)

  const save = async (flags: { isActive: boolean; comingSoon?: boolean }) => {
    const { updateWithdrawalMethodFees } = await import('@/lib/actions/admin-fees')
    return updateWithdrawalMethodFees({
      methodId: method.id, feePct: method.fee_percentage, feeFixed: method.fee_fixed, feeMin: method.fee_min,
      minWithdrawal: method.min_withdrawal, maxWithdrawal: method.max_withdrawal, ...flags,
    })
  }
  /** What the withdraw page's loader returns to a seller session (RLS applies). */
  const sellerSees = async () => {
    const { data, error } = await fx!.seller.client.from('withdrawal_methods').select('id, coming_soon').or('is_active.eq.true,coming_soon.eq.true')
    if (error) throw new Error(error.message)
    return (data ?? []).find((r: any) => r.id === method.id) ?? null
  }

  for (const [flags, state] of [
    [{ isActive: true, comingSoon: true }, 'coming soon'],
    [{ isActive: false, comingSoon: true }, 'hidden'],
    [{ isActive: true, comingSoon: false }, 'live'],
  ] as const) {
    it(`active=${flags.isActive} coming_soon=${flags.comingSoon} → labelled "${state}", audited, and that is what the seller sees`, async () => {
      const before = await fx!.svc.from('withdrawal_methods').select('is_active, coming_soon').eq('id', method.id).single()
      const r = await save(flags)
      expect(r, JSON.stringify(r)).toEqual({ success: true })

      const { fetchMoneySettings } = await import('@/lib/actions/admin-fees')
      const row = (await fetchMoneySettings()).methods.find((m) => m.id === method.id)!
      expect({ is_active: row.is_active, coming_soon: row.coming_soon }).toEqual({ is_active: flags.isActive, coming_soon: flags.comingSoon })
      expect(payoutMethodState(row)).toBe(state)

      const { data: audit } = await fx!.svc.from('fee_config_audit').select('old_value, new_value')
        .eq('actor', fx!.admin.id).eq('key', 'usdt_polygon').order('id', { ascending: false }).limit(1).single()
      expect((audit as any).old_value.coming_soon).toBe((before.data as any).coming_soon)
      expect((audit as any).new_value.coming_soon).toBe(flags.comingSoon)

      const seen = await sellerSees()
      if (state === 'hidden') expect(seen).toBeNull()
      else expect(seen).toEqual({ id: method.id, coming_soon: state === 'coming soon' })
    }, 30_000)
  }

  it('saving without comingSoon leaves it as it is', async () => {
    expect(await save({ isActive: true, comingSoon: true })).toEqual({ success: true })
    expect(await save({ isActive: true })).toEqual({ success: true })
    const { data } = await fx!.svc.from('withdrawal_methods').select('coming_soon').eq('id', method.id).single()
    expect((data as any).coming_soon).toBe(true)
    expect(await save({ isActive: true, comingSoon: false })).toEqual({ success: true })
  }, 30_000)
})
