/**
 * Fee engine PR 7, Part 3 — withdrawal rules and fees (integration, real RPCs).
 *
 *   · fee_round_cents is half-up; withdrawal_quote applies pct + fixed with a
 *     minimum fee (crypto 3% + $5, Payoneer 3% min $5) — TS computes nothing;
 *   · refusals in order: account age (30 d from approval), payout-details
 *     freeze (48 h), negative balance, open withdrawal, missing payout details,
 *     minimum, insufficient available;
 *   · withdrawal_request snapshots every fee field from the SAME quote
 *     (parity: row == quote), posts the hold, notifies once; one open
 *     withdrawal per seller is a DB index, not a TS count;
 *   · Payoneer state machine: request → approve → paid (reference) / reject
 *     (funds return), each notified exactly once;
 *   · payout details: change stamps the freeze, re-saving the same value does
 *     not, one Payoneer email per seller;
 *   · a fault after the hold rolls back the request row and the hold;
 *   · the risk snapshot the admin queue shows.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { execFileSync } from 'node:child_process'
import { hasEnv, makeFixture, promoteToEstablishedSeller, type Fixture } from './throwaway'

vi.mock('next/cache', () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/email', async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>()
  return Object.fromEntries(Object.keys(real).map((k) => [k, async () => undefined]))
})

const CUR = 'USD'
const DB_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const targetHost = (() => { try { return new globalThis.URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname } catch { return '' } })()
const TARGET_IS_LOCAL = ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(targetHost)
const RUN = `test:ledger:withdrawal-rules:${Math.random().toString(36).slice(2, 8)}`
const TRON_ADDR = 'TJRyWwFs9wTFGZg3JbrVriFbNfCug5tDeC'

let fx: Fixture | null = null
let ready = false
let crypto: any = null
let payoneer: any = null
const createdRequestIds: string[] = []
let applicationId: string | null = null

function withFault(point: string, sql: string): string {
  const script = `BEGIN;\nSET LOCAL app.money_fault = '${point}';\n${sql};\nCOMMIT;`
  try {
    execFileSync('psql', [DB_URL, '-v', 'ON_ERROR_STOP=1', '-q', '-c', script], { stdio: 'pipe' })
    return ''
  } catch (e: any) {
    return e?.stderr?.toString() ?? String(e)
  }
}
async function rpc<T = any>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (fx!.svc.rpc as any)(name, args)
  if (error) throw new Error(`${name}: ${error.message}`)
  return data as T
}
async function quote(methodId: string, amount: number) {
  return rpc('withdrawal_quote', { p_seller_id: fx!.seller.id, p_method_id: methodId, p_amount: amount })
}
async function request(methodId: string, amount: number) {
  const r = await rpc('withdrawal_request', { p_seller_id: fx!.seller.id, p_method_id: methodId, p_amount: amount })
  if (r.request_id) createdRequestIds.push(r.request_id)
  return r
}
async function fundSeller(minor: number, suffix: string) {
  await rpc('post_journal', {
    p_idempotency_key: `${RUN}:fund:${suffix}`,
    p_entries: [
      { owner_type: 'platform', owner_id: null, kind: 'escrow_held', direction: 'debit', amount_minor: minor, currency: CUR },
      { owner_type: 'seller', owner_id: fx!.seller.id, kind: 'seller_available', direction: 'credit', amount_minor: minor, currency: CUR },
    ],
    p_event_ref: 'TEST_FUND_SELLER',
  })
}
async function debitSeller(minor: number, suffix: string) {
  await rpc('post_journal', {
    p_idempotency_key: `${RUN}:debit:${suffix}`,
    p_entries: [
      { owner_type: 'seller', owner_id: fx!.seller.id, kind: 'seller_available', direction: 'debit', amount_minor: minor, currency: CUR },
      { owner_type: 'platform', owner_id: null, kind: 'refunds', direction: 'credit', amount_minor: minor, currency: CUR },
    ],
    p_event_ref: 'TEST_DEBIT_SELLER',
  })
}
async function matured(): Promise<number> {
  return Number(await rpc('seller_matured_balance', { p_seller_id: fx!.seller.id, p_currency: CUR }))
}
async function setDetails(kind: 'crypto' | 'payoneer', v: Record<string, string | null>) {
  return rpc('seller_payout_details_set', {
    p_seller_id: fx!.seller.id, p_kind: kind, p_coin: v.coin ?? null, p_chain: v.chain ?? null, p_address: v.address ?? null, p_email: v.email ?? null,
  })
}
async function ageDetails(hoursAgo: number) {
  await fx!.svc.from('seller_payout_details').update({ details_changed_at: new Date(Date.now() - hoursAgo * 3_600_000).toISOString() }).eq('seller_id', fx!.seller.id)
}
async function notifCount(key: string): Promise<number> {
  const { count } = await fx!.svc.from('notifications').select('id', { count: 'exact', head: false }).eq('dedupe_key', key)
  return count ?? 0
}
async function row(id: string) {
  const { data } = await fx!.svc.from('withdrawal_requests').select('*').eq('id', id).single()
  return data as any
}

describe.skipIf(!hasEnv)('PR 7 Part 3 — withdrawal quote, gate, request, Payoneer, payout details (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    ready = !(await fx.svc.rpc('withdrawal_rules_version' as any)).error
    await promoteToEstablishedSeller(fx.svc, fx.seller.id)
    const { data: methods } = await fx.svc.from('withdrawal_methods').select('*').in('method_name', ['usdt_trc20', 'payoneer'])
    crypto = (methods ?? []).find((m: any) => m.method_name === 'usdt_trc20')
    payoneer = (methods ?? []).find((m: any) => m.method_name === 'payoneer')
  }, 60_000)

  afterAll(async () => {
    if (!fx) return
    for (const id of createdRequestIds) await fx.svc.rpc('ledger_test_cleanup_by_withdrawal' as any, { p_request_id: id })
    await fx.svc.rpc('ledger_test_cleanup' as any, { p_prefix: `${RUN}%` })
    await fx.svc.from('withdrawal_requests').delete().in('id', createdRequestIds)
    await fx.svc.from('seller_payout_details').delete().in('seller_id', [fx.seller.id, fx.buyer.id])
    if (applicationId) await fx.svc.from('seller_applications').delete().eq('id', applicationId)
    await fx.cleanup()
  }, 60_000)

  it('migration is applied; the method rows carry the new terms', () => {
    expect(ready, 'apply 20260923031644_withdrawal_rules first').toBe(true)
    expect(crypto).toMatchObject({ fee_percentage: 3, fee_fixed: 5, fee_min: 0, min_withdrawal: 50, is_active: true })
    expect(payoneer).toMatchObject({ fee_percentage: 3, fee_fixed: 0, fee_min: 5, min_withdrawal: 100, is_active: true, coming_soon: false, method_type: 'fiat' })
  })

  it('fee_round_cents is half-up to the cent (one helper)', async () => {
    expect(Number(await rpc('fee_round_cents', { p_amount: 6.005 }))).toBe(6.01)
    expect(Number(await rpc('fee_round_cents', { p_amount: 5.9999 }))).toBe(6)
    expect(Number(await rpc('fee_round_cents', { p_amount: 0.125 }))).toBe(0.13)
  })

  it('quote math: crypto 3% + $5; Payoneer 3% with a $5 minimum fee', async () => {
    const c100 = await quote(crypto.id, 100)
    expect(c100).toMatchObject({ fee_pct: 3, fee_fixed: 5, fee_min: 0, fee_amount: 8, net: 92, minimum: 50 })
    const c33 = await quote(crypto.id, 133.5) // 4.005 + 5 = 9.005 → 9.01 half-up
    expect(c33.fee_amount).toBe(9.01)
    expect(c33.net).toBe(124.49)
    const p100 = await quote(payoneer.id, 100) // 3.00 < 5 → 5
    expect(p100).toMatchObject({ fee_pct: 3, fee_fixed: 0, fee_min: 5, fee_amount: 5, net: 95, minimum: 100 })
    const p500 = await quote(payoneer.id, 500) // 15 > 5 → 15
    expect(p500).toMatchObject({ fee_amount: 15, net: 485 })
    const dead = await quote('00000000-0000-0000-0000-000000000000', 100)
    expect(dead).toMatchObject({ ok: false, refusal: 'method_unavailable' })
  })

  it('refusals, in order: account age → payout freeze → negative → open → details → minimum → insufficient', async () => {
    await fundSeller(20_000, 'a') // $200
    // 1. fresh seller → account_age with the unlock date
    let q = await quote(crypto.id, 100)
    expect(q).toMatchObject({ ok: false, refusal: 'account_age' })
    expect(q.gate.unlock_at).toBeTruthy()
    expect(q.message).toMatch(/30 days/)

    // approval 31 days ago → gate opens
    const { data: app, error } = await fx!.svc.from('seller_applications').insert({
      user_id: fx!.seller.id, status: 'approved', reviewed_at: new Date(Date.now() - 31 * 86_400_000).toISOString(),
      is_18_or_older: true, seller_type: 'individual', display_name: 'Guard Test Seller',
    } as any).select('id').single()
    if (error) throw new Error(error.message)
    applicationId = (app as any).id

    // 2. no payout details yet → payout_details_missing
    q = await quote(crypto.id, 100)
    expect(q).toMatchObject({ ok: false, refusal: 'payout_details_missing' })

    // saving details freezes for 48 h → payout_details_freeze
    const saved = await setDetails('crypto', { coin: 'usdt', chain: 'tron', address: TRON_ADDR })
    expect(saved).toMatchObject({ saved: true, changed: true })
    expect(saved.freeze_until).toBeTruthy()
    q = await quote(crypto.id, 100)
    expect(q).toMatchObject({ ok: false, refusal: 'payout_details_freeze' })
    expect(q.gate.freeze_until).toBe(saved.freeze_until)
    // re-saving the same address does NOT restart the freeze
    const again = await setDetails('crypto', { coin: 'usdt', chain: 'tron', address: TRON_ADDR })
    expect(again.changed).toBe(false)
    await ageDetails(49)
    q = await quote(crypto.id, 100)
    expect(q.ok).toBe(true)

    // 3. negative matured balance (a post-completion refund larger than the balance)
    await debitSeller(30_000, 'neg')
    expect(await matured()).toBeLessThan(0)
    q = await quote(crypto.id, 100)
    expect(q).toMatchObject({ ok: false, refusal: 'negative_balance' })
    await fundSeller(30_000, 'b') // back to $200

    // 4. below minimum / insufficient
    q = await quote(crypto.id, 49.99)
    expect(q).toMatchObject({ ok: false, refusal: 'below_minimum' })
    q = await quote(crypto.id, 250)
    expect(q).toMatchObject({ ok: false, refusal: 'insufficient_available' })
    expect(q.available_minor).toBe(20_000)
    // Payoneer needs its own details
    q = await quote(payoneer.id, 100)
    expect(q).toMatchObject({ ok: false, refusal: 'payout_details_missing' })
  })

  it('withdrawal_request: the row is a snapshot of the SAME quote, the hold posts, notified once, one open per seller', async () => {
    const q = await quote(crypto.id, 100)
    expect(q.ok).toBe(true)
    const maturedBefore = await matured()
    const r = await request(crypto.id, 100)
    expect(r.requested).toBe(true)
    const w = await row(r.request_id)
    // Parity: every fee field on the row == the quote the page rendered.
    expect(Number(w.amount)).toBe(q.amount)
    expect(Number(w.fee_amount)).toBe(q.fee_amount)
    expect(Number(w.fee_percentage)).toBe(q.fee_pct)
    expect(Number(w.fee_fixed)).toBe(q.fee_fixed)
    expect(Number(w.fee_min)).toBe(q.fee_min)
    expect(Number(w.net_amount)).toBe(q.net)
    expect(w.quote.fee_amount).toBe(q.fee_amount)
    expect(w.payment_details).toEqual({ wallet_address: TRON_ADDR, network: 'tron', coin: 'usdt' })
    expect(w.status).toBe('pending')
    expect(await matured()).toBe(maturedBefore - 10_000) // hold left seller_available
    const { data: hold } = await fx!.svc.from('ledger_transactions').select('id').eq('idempotency_key', `withdrawal:${r.request_id}`).maybeSingle()
    expect(hold).toBeTruthy()
    expect(await notifCount(`withdrawal:${r.request_id}:requested`)).toBe(1)

    // second request while one is open: quote refuses…
    const second = await request(crypto.id, 50)
    expect(second.requested).toBe(false)
    expect(second.quote.refusal).toBe('open_withdrawal')
    // …and even a raw service-role INSERT hits the partial unique index.
    const { error } = await fx!.svc.from('withdrawal_requests').insert({
      user_id: fx!.seller.id, amount: 50, method_id: crypto.id, method_name: 'usdt_trc20', fee_amount: 6.5, net_amount: 43.5, payment_details: {}, status: 'pending',
    } as any)
    expect(error?.code).toBe('23505')

    // wallet_available_balance shows it as locked
    const bal = await rpc('wallet_available_balance', { p_seller_id: fx!.seller.id, p_currency: CUR })
    expect(bal.locked_minor).toBe(10_000)

    // cancel → funds back, quote OK again
    const c = await rpc('withdrawal_cancel', { p_request_id: r.request_id, p_user_id: fx!.seller.id })
    expect(c.changed).toBe(true)
    expect(await matured()).toBe(maturedBefore)
    expect((await quote(crypto.id, 100)).ok).toBe(true)
  })

  it.skipIf(!TARGET_IS_LOCAL)('a fault after the hold rolls back the request row and the hold', async () => {
    const { count: before } = await fx!.svc.from('withdrawal_requests').select('id', { count: 'exact', head: false }).eq('user_id', fx!.seller.id)
    const maturedBefore = await matured()
    const err = withFault('withdrawal_request:after_hold',
      `SELECT public.withdrawal_request('${fx!.seller.id}'::uuid, '${crypto.id}'::uuid, 60)`)
    expect(err).toMatch(/injected fault/)
    const { count: after } = await fx!.svc.from('withdrawal_requests').select('id', { count: 'exact', head: false }).eq('user_id', fx!.seller.id)
    expect(after).toBe(before)
    expect(await matured()).toBe(maturedBefore)
  })

  it('Payoneer: save email (one per seller) → request → approve → mark paid with a reference; notified once per step', async () => {
    const saved = await setDetails('payoneer', { email: `guard-${RUN.slice(-6)}@example.com` })
    expect(saved).toMatchObject({ saved: true, changed: true })
    // another seller cannot claim the same email
    const dup = await rpc('seller_payout_details_set', {
      p_seller_id: fx!.buyer.id, p_kind: 'payoneer', p_coin: null, p_chain: null, p_address: null, p_email: `GUARD-${RUN.slice(-6)}@example.com`,
    })
    expect(dup).toMatchObject({ saved: false, reason: 'email_in_use' })
    await ageDetails(49)

    const r = await request(payoneer.id, 100)
    expect(r.requested).toBe(true)
    expect(r.quote).toMatchObject({ fee_amount: 5, net: 95 })
    expect((await row(r.request_id)).payment_details).toEqual({ payoneer_email: `guard-${RUN.slice(-6)}@example.com` })

    // mark paid before approval is refused
    const early = await rpc('withdrawal_mark_paid', { p_request_id: r.request_id, p_admin_id: fx!.admin.id, p_reference: 'PYN-1', p_notes: null })
    expect(early).toMatchObject({ changed: false, reason: 'not_approved' })

    const a = await rpc('withdrawal_approve', { p_request_id: r.request_id, p_admin_id: fx!.admin.id, p_notes: 'ok' })
    expect(a).toMatchObject({ changed: true, status: 'approved', net_amount: 95 })
    expect((await row(r.request_id))).toMatchObject({ status: 'approved', processed_by: fx!.admin.id })
    expect(await notifCount(`withdrawal:${r.request_id}:approved`)).toBe(1)
    const a2 = await rpc('withdrawal_approve', { p_request_id: r.request_id, p_admin_id: fx!.admin.id, p_notes: null })
    expect(a2.changed).toBe(false)
    expect(await notifCount(`withdrawal:${r.request_id}:approved`)).toBe(1)

    // reference required
    const { error } = await (fx!.svc.rpc as any)('withdrawal_mark_paid', { p_request_id: r.request_id, p_admin_id: fx!.admin.id, p_reference: '  ', p_notes: null })
    expect(error?.message).toMatch(/reference/)

    const p = await rpc('withdrawal_mark_paid', { p_request_id: r.request_id, p_admin_id: fx!.admin.id, p_reference: ' PYN-2026-42 ', p_notes: null })
    expect(p).toMatchObject({ changed: true, status: 'completed', reference: 'PYN-2026-42' })
    const w = await row(r.request_id)
    expect(w).toMatchObject({ status: 'completed', payment_reference: 'PYN-2026-42' })
    expect(w.transaction_hash).toBeNull() // fiat: no chain hash
    const { data: payout } = await fx!.svc.from('ledger_transactions').select('id').eq('idempotency_key', `payout:${r.request_id}`).maybeSingle()
    expect(payout).toBeTruthy()
    expect(await notifCount(`withdrawal:${r.request_id}:paid`)).toBe(1)
    const p2 = await rpc('withdrawal_mark_paid', { p_request_id: r.request_id, p_admin_id: fx!.admin.id, p_reference: 'PYN-2026-42', p_notes: null })
    expect(p2.changed).toBe(false)

    // the seller's balance: $200 − $100 gross
    expect(await matured()).toBe(10_000)
  })

  it('reject returns the funds and notifies once', async () => {
    const r = await request(crypto.id, 60)
    expect(r.requested).toBe(true)
    const before = await matured()
    const rej = await rpc('withdrawal_reject', { p_request_id: r.request_id, p_admin_id: fx!.admin.id, p_reason: 'guard test' })
    expect(rej.changed).toBe(true)
    expect(await matured()).toBe(before + 6_000)
    expect(await notifCount(`withdrawal:${r.request_id}:rejected`)).toBe(1)
    const again = await rpc('withdrawal_reject', { p_request_id: r.request_id, p_admin_id: fx!.admin.id, p_reason: 'x' })
    expect(again.changed).toBe(false)
    expect(await notifCount(`withdrawal:${r.request_id}:rejected`)).toBe(1)
  })

  it('risk snapshot for the admin queue', async () => {
    const s = await rpc('withdrawal_risk_snapshot', { p_seller_id: fx!.seller.id })
    expect(s.account_age_days).toBeGreaterThanOrEqual(31)
    expect(typeof s.completed_sales).toBe('number')
    expect(typeof s.open_disputes).toBe('number')
    expect(typeof s.refund_rate_90d).toBe('number')
    expect(s.payout_details_changed_recently).toBe(true) // changed ~49 h ago (< 7 days)
    expect(s.matured_minor).toBe(await matured())
  })

  it('admin setting writes go through the audited RPCs', async () => {
    const before = await rpc('platform_money_setting_set', { p_admin_id: fx!.admin.id, p_key: 'payout_details_freeze_hours', p_value: 72 })
    expect(before).toMatchObject({ key: 'payout_details_freeze_hours', old: 48, new: 72 })
    try {
      const { data: audit } = await fx!.svc.from('fee_config_audit').select('*').eq('scope', 'platform_setting').eq('key', 'payout_details_freeze_hours').order('created_at', { ascending: false }).limit(1)
      expect((audit as any[])[0]).toMatchObject({ actor: fx!.admin.id, old_value: 48, new_value: 72 })
      const { error } = await (fx!.svc.rpc as any)('platform_money_setting_set', { p_admin_id: fx!.admin.id, p_key: 'rank_floor_pct', p_value: 1 })
      expect(error?.message).toMatch(/unknown key/)
    } finally {
      await rpc('platform_money_setting_set', { p_admin_id: fx!.admin.id, p_key: 'payout_details_freeze_hours', p_value: 48 })
      await fx!.svc.from('fee_config_audit').delete().eq('actor', fx!.admin.id)
    }
    const w = await rpc('order_completion_window_set', { p_admin_id: fx!.admin.id, p_category_type: 'gift_card', p_hours: 25 })
    expect(w).toMatchObject({ category_type: 'gift_card', old: 24, new: 25 })
    await rpc('order_completion_window_set', { p_admin_id: fx!.admin.id, p_category_type: 'gift_card', p_hours: 24 })
    await fx!.svc.from('fee_config_audit').delete().eq('actor', fx!.admin.id)
  })
})
