/**
 * Checkout B3 Part 1 — the admin buyer-fee writer (docs/handoff/checkout-b3.md).
 *
 *   · requireAdmin gates both actions (a buyer session is bounced);
 *   · the patch is re-validated server-side (ranges, whole minor units, the
 *     gross-up sum) — a bad value writes nothing;
 *   · a successful write leaves ONE fee_config_audit row with the admin as
 *     actor and the before/after rows;
 *   · the edited terms are what buyer_fee_quote prices the next order with;
 *   · currency rates: upsert + audit; a fee row cannot point at a currency
 *     with no rate (FK).
 *
 * Every seed value this file touches is restored in afterAll; audit rows it
 * writes are deleted (the table is service-role only).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

import { hasEnv, makeFixture, type Fixture } from './throwaway'

let fx: Fixture | null = null
let actor: { userId: string } | null = null
let role = 'super_admin'
vi.mock('@/lib/actions/admin-permissions', () => ({
  requireAdmin: async () => {
    if (!actor) throw new Error('redirect:/login')
    return { userId: actor.userId, email: 'guard@example.com', role, permissions: [] }
  },
  requireRole: async (roles: string[]) => {
    if (!actor) throw new Error('redirect:/login')
    if (!roles.includes(role)) throw new Error(`Role not allowed: ${role}`)
    return { userId: actor.userId, email: 'guard@example.com', role, permissions: [] }
  },
}))
vi.mock('next/cache', () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined, unstable_cache: (fn: any) => fn }))
vi.mock('server-only', () => ({}))

const ORIGINAL: Record<string, Record<string, unknown>> = {}
const auditIdsBefore = new Set<string>()

async function feeRow(method: string) {
  const { data } = await fx!.svc.from('payment_method_fees').select('*').eq('method', method).single()
  return data as any
}
async function quote(method: string, subtotal: number) {
  const { data, error } = await fx!.svc.rpc('buyer_fee_quote', { p_method: method, p_subtotal_minor: subtotal, p_currency: 'USD' } as any)
  if (error) throw new Error(error.message)
  return data as any
}
async function auditRows(scope: string, key: string) {
  const { data } = await fx!.svc.from('fee_config_audit').select('id, actor, scope, key, old_value, new_value').eq('scope', scope).eq('key', key).order('created_at', { ascending: false })
  return ((data ?? []) as any[]).filter((r) => !auditIdsBefore.has(r.id))
}

describe.skipIf(!hasEnv)('admin buyer fees (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    actor = { userId: fx.admin.id }
    for (const m of ['qris_id', 'pse_co']) {
      const r = await feeRow(m)
      ORIGINAL[m] = { provider_pct: r.provider_pct, provider_fixed_minor: r.provider_fixed_minor, fx_markup_pct: r.fx_markup_pct, buffer_pct: r.buffer_pct, floor_pct: r.floor_pct, min_fee_minor: r.min_fee_minor, max_total_minor: r.max_total_minor, refundable: r.refundable, instant_clearing: r.instant_clearing, selectable: r.selectable, note: r.note }
    }
    const { data: existing } = await fx.svc.from('fee_config_audit').select('id').in('scope', ['payment_method_fee', 'currency_rate'])
    for (const r of (existing ?? []) as any[]) auditIdsBefore.add(r.id)
  }, 60_000)

  afterAll(async () => {
    if (!fx) return
    const failures: string[] = []
    for (const [m, v] of Object.entries(ORIGINAL)) {
      const { error } = await fx.svc.from('payment_method_fees').update(v as any).eq('method', m)
      if (error) failures.push(`restore ${m}: ${error.message}`)
    }
    await fx.svc.from('currency_rates').delete().eq('currency', 'ZZZ')
    await fx.svc.from('currency_rates').update({ usd_per_unit: 0.0176 } as any).eq('currency', 'PHP')
    const { data: rows } = await fx.svc.from('fee_config_audit').select('id').in('scope', ['payment_method_fee', 'currency_rate'])
    const mine = ((rows ?? []) as any[]).map((r) => r.id).filter((id) => !auditIdsBefore.has(id))
    if (mine.length) {
      const { error } = await fx.svc.from('fee_config_audit').delete().in('id', mine)
      if (error) failures.push(`audit delete: ${error.message}`)
    }
    try { await fx.cleanup() } catch (e: any) { failures.push(String(e?.message ?? e)) }
    if (failures.length) throw new Error(`admin-buyer-fees cleanup:\n  - ${failures.join('\n  - ')}`)
  }, 60_000)

  it('a non-admin session is bounced, and a moderator is refused, before anything is read or written', async () => {
    actor = null
    const { updatePaymentMethodFee, updateCurrencyRate, fetchBuyerFeeConfig } = await import('@/lib/actions/admin-buyer-fees')
    await expect(updatePaymentMethodFee({ method: 'qris_id', patch: { provider_pct: 3 } })).rejects.toThrow(/redirect/)
    actor = { userId: fx!.admin.id }
    role = 'moderator'
    await expect(updatePaymentMethodFee({ method: 'qris_id', patch: { provider_pct: 3 } })).rejects.toThrow(/Role not allowed/)
    await expect(updateCurrencyRate({ currency: 'PHP', usdPerUnit: 1 })).rejects.toThrow(/Role not allowed/)
    await expect(fetchBuyerFeeConfig()).rejects.toThrow(/Role not allowed/)
    role = 'super_admin'
    expect(Number((await feeRow('qris_id')).provider_pct)).toBe(Number(ORIGINAL.qris_id.provider_pct))
  })

  it('bad values are refused server-side and write nothing (range, non-integer minor units, gross-up ≥ 100%)', async () => {
    const { updatePaymentMethodFee } = await import('@/lib/actions/admin-buyer-fees')
    for (const patch of [{ provider_pct: 51 }, { floor_pct: -1 }, { provider_fixed_minor: 1.5 }, { min_fee_minor: 'ten' }, { provider_pct: 60, fx_markup_pct: 45 }]) {
      const res = await updatePaymentMethodFee({ method: 'qris_id', patch })
      expect(res.success, JSON.stringify(patch)).toBe(false)
    }
    // the DB backs the last one even when the action's checks are bypassed
    const { error } = await fx!.svc.from('payment_method_fees').update({ provider_pct: 50, fx_markup_pct: 49, buffer_pct: 1 } as any).eq('method', 'qris_id')
    expect(error?.code).toBe('23514')
    const r = await feeRow('qris_id')
    expect(Number(r.provider_pct)).toBe(Number(ORIGINAL.qris_id.provider_pct))
    expect(await auditRows('payment_method_fee', 'qris_id')).toEqual([])
  })

  it('a write lands, is audited once with the admin as actor, and the next quote prices from the new terms', async () => {
    const { updatePaymentMethodFee } = await import('@/lib/actions/admin-buyer-fees')
    const res = await updatePaymentMethodFee({ method: 'qris_id', patch: { provider_pct: '4', fx_markup_pct: '2', min_fee_minor: '50', selectable: true, note: 'guard edit' } })
    expect(res.success, (res as any).error).toBe(true)
    if (!res.success) return
    expect(res.row.provider_pct).toBe(4)
    expect(res.row.fx_markup_pct).toBe(2)
    expect(res.row.min_fee_minor).toBe(50)
    const audit = await auditRows('payment_method_fee', 'qris_id')
    expect(audit.length).toBe(1)
    expect(audit[0].actor).toBe(fx!.admin.id)
    expect(Number(audit[0].old_value.provider_pct)).toBe(Number(ORIGINAL.qris_id.provider_pct))
    expect(Number(audit[0].new_value.provider_pct)).toBe(4)
    // 2000 / (1 − 0.04 − 0.02 − 0.01) = 2150.54 → 151 (> floor 100, > min 50)
    const q = await quote('qris_id', 2000)
    expect(q.ok).toBe(true)
    expect(q.fee_minor).toBe(151)
  })

  it('hiding a method (selectable=false) makes the quote refuse it', async () => {
    const { updatePaymentMethodFee } = await import('@/lib/actions/admin-buyer-fees')
    const res = await updatePaymentMethodFee({ method: 'pse_co', patch: { selectable: false } })
    expect(res.success).toBe(true)
    const q = await quote('pse_co', 2000)
    expect(q.ok).toBe(false)
    expect(q.reason).toBe('not_selectable')
    expect((await auditRows('payment_method_fee', 'pse_co')).length).toBe(1)
  })

  it('currency rates: upsert + audit; a fee row cannot reference a currency with no rate', async () => {
    const { updateCurrencyRate } = await import('@/lib/actions/admin-buyer-fees')
    const bad = await updateCurrencyRate({ currency: 'PHP', usdPerUnit: '0' })
    expect(bad.success).toBe(false)
    const ok = await updateCurrencyRate({ currency: 'PHP', usdPerUnit: '0.02' })
    expect(ok.success, (ok as any).error).toBe(true)
    expect((await auditRows('currency_rate', 'PHP')).length).toBe(1)
    // GCash's 10 PHP fixed now converts at 0.02: (2000 + 20) / 0.906 = 2229.58 → 230
    expect((await quote('gcash_ph', 2000)).fee_minor).toBe(230)
    const added = await updateCurrencyRate({ currency: 'zzz', usdPerUnit: '2' })
    expect(added.success).toBe(true)
    if (added.success) expect(added.row.currency).toBe('ZZZ')
    const { error } = await fx!.svc.from('payment_method_fees').update({ fee_currency: 'QQQ' } as any).eq('method', 'qris_id')
    expect(error?.code).toBe('23503')
  })
})
