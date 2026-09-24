'use server'

/**
 * Admin buyer-fee actions — the ONLY app-side writer of payment_method_fees
 * and currency_rates (checkout B3 Part 1). Same discipline as admin-fees.ts:
 *
 *   · requireRole(['admin','super_admin']) first, always — money terms are
 *     not a moderator's to edit (the sidebar hides the page from them too);
 *   · SERVICE-ROLE client — neither table has a write policy;
 *   · nothing the client sends is trusted: every number is re-validated here
 *     and the database CHECKs enforce the same ranges again;
 *   · ONE fee_config_audit row per write (scope 'payment_method_fee' /
 *     'currency_rate'), with the admin as actor, BEFORE revalidation;
 *   · revalidateBuyerFeeReaders() after a successful write + audit.
 *
 * Nothing here computes a fee. The admin edits TERMS; buyer_fee_quote turns
 * them into money at checkout.
 */

import { createClient as createServiceClient } from '@supabase/supabase-js'

import { requireRole, type AdminRole } from '@/lib/actions/admin-permissions'
import { revalidateBuyerFeeReaders } from '@/lib/revalidation/fees'

const EDITORS: AdminRole[] = ['admin', 'super_admin']

function getAdminSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export interface PaymentMethodFeeRow {
  method: string
  label: string
  provider: string
  fee_currency: string
  provider_pct: number
  provider_fixed_minor: number
  fx_markup_pct: number
  buffer_pct: number
  floor_pct: number
  min_fee_minor: number
  max_total_minor: number | null
  refundable: boolean
  instant_clearing: boolean
  selectable: boolean
  currencies: string[]
  note: string | null
  updated_at: string
}

export interface CurrencyRateRow {
  currency: string
  usd_per_unit: number
  note: string | null
  updated_at: string
}

export interface AuditRow {
  id: string
  actor: string | null
  scope: string
  key: string
  created_at: string
}

type Result<T = object> = ({ success: true } & T) | { success: false; error: string }

const FEE_COLS =
  'method, label, provider, fee_currency, provider_pct, provider_fixed_minor, fx_markup_pct, buffer_pct, floor_pct, min_fee_minor, max_total_minor, refundable, instant_clearing, selectable, currencies, note, updated_at'

const toFee = (r: any): PaymentMethodFeeRow => ({
  ...r,
  fee_currency: String(r.fee_currency).trim(),
  provider_pct: Number(r.provider_pct),
  provider_fixed_minor: Number(r.provider_fixed_minor),
  fx_markup_pct: Number(r.fx_markup_pct),
  buffer_pct: Number(r.buffer_pct),
  floor_pct: Number(r.floor_pct),
  min_fee_minor: Number(r.min_fee_minor),
  max_total_minor: r.max_total_minor == null ? null : Number(r.max_total_minor),
})
const toRate = (r: any): CurrencyRateRow => ({ ...r, currency: String(r.currency).trim(), usd_per_unit: Number(r.usd_per_unit) })

// ─── Validation (mirrors the CHECK constraints; the DB enforces them again) ──

function num(v: unknown, label: string, min: number, max: number, dp: number): { n: number } | { error: string } {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').trim())
  if (!Number.isFinite(n)) return { error: `${label} must be a number` }
  if (n < min || n > max) return { error: `${label} must be between ${min} and ${max}` }
  const rounded = Number(n.toFixed(dp))
  return { n: rounded }
}
function minor(v: unknown, label: string, nullable = false): { n: number | null } | { error: string } {
  const s = String(v ?? '').trim()
  if (s === '' && nullable) return { n: null }
  const n = Number(s)
  if (!Number.isInteger(n) || n < 0) return { error: `${label} must be a whole number of minor units (cents) ≥ 0` }
  if (!nullable && n === 0) return { n: 0 }
  if (nullable && n === 0) return { n: null }
  return { n }
}

export interface PaymentMethodFeePatch {
  provider_pct?: unknown
  provider_fixed_minor?: unknown
  fx_markup_pct?: unknown
  buffer_pct?: unknown
  floor_pct?: unknown
  min_fee_minor?: unknown
  max_total_minor?: unknown
  refundable?: unknown
  instant_clearing?: unknown
  selectable?: unknown
  note?: unknown
}

/** Server-side re-validation of an admin patch (module-private: a 'use server' export is an endpoint). */
async function validateMethodFeePatch(patch: PaymentMethodFeePatch): Promise<{ values: Record<string, unknown> } | { error: string }> {
  const values: Record<string, unknown> = {}
  const pcts: Array<[keyof PaymentMethodFeePatch, string, number]> = [
    ['provider_pct', 'Provider rate', 50], ['fx_markup_pct', 'FX markup', 50], ['buffer_pct', 'Buffer', 20], ['floor_pct', 'Floor', 50],
  ]
  for (const [key, label, max] of pcts) {
    if (patch[key] === undefined) continue
    const r = num(patch[key], label, 0, max, 3)
    if ('error' in r) return r
    values[key] = r.n
  }
  for (const [key, label, nullable] of [['provider_fixed_minor', 'Fixed fee', false], ['min_fee_minor', 'Minimum fee', false], ['max_total_minor', 'Provider cap', true]] as const) {
    if (patch[key] === undefined) continue
    const r = minor(patch[key], label, nullable)
    if ('error' in r) return r
    values[key] = r.n
  }
  for (const key of ['refundable', 'instant_clearing', 'selectable'] as const) {
    if (patch[key] === undefined) continue
    if (typeof patch[key] !== 'boolean') return { error: `${key} must be true or false` }
    values[key] = patch[key]
  }
  if (patch.note !== undefined) values.note = String(patch.note ?? '').trim().slice(0, 300) || null
  if (Object.keys(values).length === 0) return { error: 'Nothing to change' }
  return { values }
}

async function auditWrite(
  supabase: ReturnType<typeof getAdminSupabase>,
  actor: string,
  scope: 'payment_method_fee' | 'currency_rate',
  key: string,
  oldValue: unknown,
  newValue: unknown,
): Promise<string | null> {
  const { error } = await supabase.from('fee_config_audit').insert({
    actor, scope, key, old_value: oldValue ?? null, new_value: newValue ?? null,
  } as any)
  return error ? error.message : null
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function fetchBuyerFeeConfig(): Promise<{ methods: PaymentMethodFeeRow[]; rates: CurrencyRateRow[]; audit: AuditRow[] }> {
  await requireRole(EDITORS)
  const supabase = getAdminSupabase()
  const [feesRes, ratesRes, auditRes] = await Promise.all([
    supabase.from('payment_method_fees').select(FEE_COLS).order('provider').order('label'),
    supabase.from('currency_rates').select('currency, usd_per_unit, note, updated_at').order('currency'),
    supabase.from('fee_config_audit').select('id, actor, scope, key, created_at').in('scope', ['payment_method_fee', 'currency_rate']).order('created_at', { ascending: false }).limit(20),
  ])
  if (feesRes.error) throw new Error(`payment_method_fees: ${feesRes.error.message}`)
  if (ratesRes.error) throw new Error(`currency_rates: ${ratesRes.error.message}`)
  return {
    methods: ((feesRes.data as any[]) ?? []).map(toFee),
    rates: ((ratesRes.data as any[]) ?? []).map(toRate),
    audit: ((auditRes.data as any[]) ?? []) as AuditRow[],
  }
}

// ─── Writes ───────────────────────────────────────────────────────────────────

export async function updatePaymentMethodFee(input: { method: string; patch: PaymentMethodFeePatch }): Promise<Result<{ row: PaymentMethodFeeRow }>> {
  const admin = await requireRole(EDITORS)
  const supabase = getAdminSupabase()
  const method = String(input.method ?? '').trim()
  const validated = await validateMethodFeePatch(input.patch ?? {})
  if ('error' in validated) return { success: false, error: validated.error }

  const { data: before } = await supabase.from('payment_method_fees').select(FEE_COLS).eq('method', method).maybeSingle()
  if (!before) return { success: false, error: 'Unknown payment method' }

  const { data, error } = await supabase
    .from('payment_method_fees')
    .update({ ...validated.values, updated_by: admin.userId } as any)
    .eq('method', method)
    .select(FEE_COLS)
    .single()
  if (error) return { success: false, error: feeWriteErrorMessage(error.message) }

  const auditErr = await auditWrite(supabase, admin.userId, 'payment_method_fee', method, before, data)
  if (auditErr) console.error('[admin-buyer-fees] audit row failed after a successful write:', auditErr)
  revalidateBuyerFeeReaders()
  return { success: true, row: toFee(data) }
}

export async function updateCurrencyRate(input: { currency: string; usdPerUnit: unknown; note?: unknown }): Promise<Result<{ row: CurrencyRateRow }>> {
  const admin = await requireRole(EDITORS)
  const supabase = getAdminSupabase()
  const currency = String(input.currency ?? '').trim().toUpperCase()
  if (!/^[A-Z]{3}$/.test(currency)) return { success: false, error: 'Currency must be a 3-letter ISO code' }
  const rate = num(input.usdPerUnit, 'USD per unit', 0.00000001, 100000, 8)
  if ('error' in rate) return { success: false, error: rate.error }
  if (rate.n <= 0) return { success: false, error: 'USD per unit must be positive' }
  const note = input.note === undefined ? undefined : String(input.note ?? '').trim().slice(0, 300) || null

  const { data: before } = await supabase.from('currency_rates').select('currency, usd_per_unit, note, updated_at').eq('currency', currency).maybeSingle()
  const { data, error } = await supabase
    .from('currency_rates')
    .upsert({ currency, usd_per_unit: rate.n, ...(note === undefined ? {} : { note }), updated_by: admin.userId } as any, { onConflict: 'currency' })
    .select('currency, usd_per_unit, note, updated_at')
    .single()
  if (error) return { success: false, error: feeWriteErrorMessage(error.message) }

  const auditErr = await auditWrite(supabase, admin.userId, 'currency_rate', currency, before ?? null, data)
  if (auditErr) console.error('[admin-buyer-fees] audit row failed after a successful write:', auditErr)
  revalidateBuyerFeeReaders()
  return { success: true, row: toRate(data) }
}

function feeWriteErrorMessage(message: string): string {
  if (/gross_up_finite/.test(message)) return 'Provider rate + FX markup + buffer must stay below 100%'
  if (/violates check constraint/.test(message)) return 'A value is outside its permitted range'
  if (/foreign key/.test(message)) return 'That currency has no rate yet — add it under Currency rates first'
  return message
}
