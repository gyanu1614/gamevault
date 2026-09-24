'use server'

/**
 * Admin fee actions — the ONLY app-side writer of fee_rules
 * (docs/design/fee-engine.md §5). Discipline, exactly as admin-games.ts:
 *
 *   · requireAdmin() first, always;
 *   · SERVICE-ROLE client — fee_rules deliberately has no write policy;
 *   · nothing the client sends is trusted: every rate, date and id is
 *     re-validated here, and the database enforces the same rules again
 *     (CHECKs, the exclusion constraint, the notice trigger). The action
 *     only rewords the database's refusal;
 *   · ONE fee_config_audit row per write, in the same request, with the
 *     admin as actor (a trigger could not see who acted through a
 *     service-role client), written BEFORE revalidation;
 *   · revalidateFeeReaders() after a successful write + audit. A failed
 *     revalidate never rolls back the write; a failed write never revalidates.
 *
 * Rates are read back through resolve_seller_fee (p_seller_id NULL) — this
 * module never computes a percentage.
 */

import { createClient as createServiceClient } from '@supabase/supabase-js'

import { requireAdmin } from '@/lib/actions/admin-permissions'
import {
  ACCOUNT_RISK_BAND_PCT,
  earliestBaseStartUtc,
  feeRuleErrorMessage,
  parsePct,
  parseUtcDate,
  riskBandForPct,
  type AccountRiskBandKey,
} from '@/lib/fees/admin-rules'
import { revalidateFeeReaders } from '@/lib/revalidation/fees'

function getAdminSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FeeRuleRow {
  id: string
  kind: 'base' | 'promo'
  scope: 'category' | 'game_category'
  category_type: string
  game_category_id: string | null
  pct: number
  starts_at: string
  ends_at: string | null
  note: string | null
  created_by: string | null
  created_at: string
}

export interface PairFeeState {
  pair: { id: string; slug: string; name: string; type: string; game_slug: string; game_name: string }
  /** resolve_seller_fee(NULL, pair, now()) — the headline rate right now. */
  resolved: { pct: number; base_pct: number; rule_id: string | null; rule_kind: string | null; rule_scope: string | null; fallback: boolean }
  /** The fee_rules row the resolver named, when it named one. */
  current_rule: FeeRuleRow | null
  /** The category-scope base rule active now (what the pair gets with no pair rule). */
  category_default: FeeRuleRow | null
  /** Base rules (pair or this category type) that start in the future, soonest first. */
  upcoming: FeeRuleRow[]
  /** Pair-scope promos that are running or scheduled. */
  promos: FeeRuleRow[]
  /** Accounts only: which band the pair's CURRENT pair-scope base rate is, null = category default. */
  risk_band: AccountRiskBandKey | 'custom' | null
  notice_days: number
  /** ISO 00:00 UTC — the first date a new base rule may start. */
  earliest_start: string
}

type Result<T = object> = ({ success: true } & T) | { success: false; error: string }

const RULE_COLS = 'id, kind, scope, category_type, game_category_id, pct, starts_at, ends_at, note, created_by, created_at'
const toRule = (r: any): FeeRuleRow => ({ ...r, pct: Number(r.pct) })

async function auditWrite(
  supabase: ReturnType<typeof getAdminSupabase>,
  actor: string,
  key: string,
  oldValue: unknown,
  newValue: unknown,
): Promise<string | null> {
  const { error } = await supabase.from('fee_config_audit').insert({
    actor,
    scope: 'fee_rule',
    key,
    old_value: oldValue ?? null,
    new_value: newValue ?? null,
  } as any)
  return error ? error.message : null
}

async function loadPair(supabase: ReturnType<typeof getAdminSupabase>, gameCategoryId: string) {
  const { data, error } = await supabase
    .from('game_categories')
    .select('id, slug, name, type, game:games!game_categories_game_id_fkey ( slug, name )')
    .eq('id', gameCategoryId)
    .maybeSingle()
  if (error || !data) return null
  const row = data as any
  return {
    id: row.id as string,
    slug: (row.slug ?? '') as string,
    name: (row.name ?? '') as string,
    type: (row.type ?? '') as string,
    game_slug: (row.game?.slug ?? '') as string,
    game_name: (row.game?.name ?? '') as string,
  }
}

const auditKey = (pair: { game_slug: string; slug: string }, kind: string) => `${pair.game_slug}/${pair.slug}:${kind}`

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function fetchPairFeeState(gameCategoryId: string): Promise<PairFeeState | null> {
  await requireAdmin()
  const supabase = getAdminSupabase()
  const pair = await loadPair(supabase, gameCategoryId)
  if (!pair) return null

  const nowIso = new Date().toISOString()
  const [resolvedRes, rulesRes, settingsRes] = await Promise.all([
    supabase.rpc('resolve_seller_fee', { p_seller_id: null, p_game_category_id: pair.id } as any),
    supabase
      .from('fee_rules')
      .select(RULE_COLS)
      .or(`game_category_id.eq.${pair.id},and(scope.eq.category,category_type.eq.${pair.type})`)
      .order('starts_at', { ascending: true }),
    supabase.from('platform_fee_settings').select('base_change_notice_days').eq('id', true).maybeSingle(),
  ])
  if (resolvedRes.error) throw new Error(`resolve_seller_fee: ${resolvedRes.error.message}`)
  if (rulesRes.error) throw new Error(`fee_rules: ${rulesRes.error.message}`)

  const r = ((resolvedRes.data as any[]) ?? [])[0] ?? {}
  const rules = ((rulesRes.data as any[]) ?? []).map(toRule)
  const activeNow = (x: FeeRuleRow) => x.starts_at <= nowIso && (x.ends_at == null || x.ends_at > nowIso)
  const noticeDays = Number((settingsRes.data as any)?.base_change_notice_days ?? 14)

  const currentPairBase = rules.find((x) => x.kind === 'base' && x.scope === 'game_category' && activeNow(x)) ?? null

  return {
    pair,
    resolved: {
      pct: Number(r.pct),
      base_pct: Number(r.base_pct),
      rule_id: r.rule_id ?? null,
      rule_kind: r.rule_kind ?? null,
      rule_scope: r.rule_scope ?? null,
      fallback: Number(r.fallback_count ?? 0) > 0,
    },
    current_rule: rules.find((x) => x.id === r.rule_id) ?? null,
    category_default: rules.find((x) => x.kind === 'base' && x.scope === 'category' && activeNow(x)) ?? null,
    upcoming: rules.filter((x) => x.kind === 'base' && x.starts_at > nowIso),
    promos: rules.filter((x) => x.kind === 'promo' && x.scope === 'game_category' && (x.ends_at == null || x.ends_at > nowIso)),
    risk_band: pair.type === 'account' ? riskBandForPct(currentPairBase?.pct ?? null) : null,
    notice_days: noticeDays,
    earliest_start: earliestBaseStartUtc(noticeDays).toISOString(),
  }
}

// ─── Writes ───────────────────────────────────────────────────────────────────

/**
 * Schedule a new pair-scope base rate. starts_at ≥ now + notice days — the
 * database trigger enforces it; the RPC closes the pair's current open-ended
 * base rule at the new start and inserts the new one atomically.
 */
export async function scheduleBaseFeeRule(input: {
  gameCategoryId: string
  pct: unknown
  startsAt: unknown
  note?: string | null
}): Promise<Result<{ rule: FeeRuleRow }>> {
  const admin = await requireAdmin()
  const supabase = getAdminSupabase()

  const pct = parsePct(input.pct)
  if ('error' in pct) return { success: false, error: pct.error }
  const date = parseUtcDate(input.startsAt)
  if ('error' in date) return { success: false, error: date.error }
  const pair = await loadPair(supabase, String(input.gameCategoryId ?? ''))
  if (!pair) return { success: false, error: 'Unknown game category' }

  const { data: settings } = await supabase.from('platform_fee_settings').select('base_change_notice_days').eq('id', true).maybeSingle()
  const noticeDays = Number((settings as any)?.base_change_notice_days ?? 14)
  const earliest = earliestBaseStartUtc(noticeDays)
  if (date.ms < earliest.getTime()) {
    return { success: false, error: `A base rate change needs ${noticeDays} days' notice — the earliest permitted start is ${earliest.toISOString().slice(0, 10)}.` }
  }

  const note = (input.note ?? '').toString().trim().slice(0, 200) || null
  const { data, error } = await supabase.rpc('fee_rule_schedule_base', {
    p_game_category_id: pair.id,
    p_pct: pct.pct,
    p_starts_at: date.iso,
    p_note: note,
    p_created_by: admin.userId,
  } as any)
  if (error) return { success: false, error: feeRuleErrorMessage(error) }

  const out = (data ?? {}) as { closed: any; inserted: any }
  const inserted = toRule(out.inserted)
  const auditErr = await auditWrite(supabase, admin.userId, auditKey(pair, 'base'), out.closed ?? null, out.inserted)
  if (auditErr) console.error('[admin-fees] audit row failed after a successful write:', auditErr)
  revalidateFeeReaders()
  return { success: true, rule: inserted }
}

/**
 * Accounts only: the risk band is which of three base rates the admin picked
 * (§5.1) — a scheduled pair base rule at 10 / 15 / 20, same notice as any base
 * change.
 */
export async function setAccountRiskBand(input: {
  gameCategoryId: string
  band: unknown
  startsAt: unknown
}): Promise<Result<{ rule: FeeRuleRow }>> {
  const band = String(input.band ?? '') as AccountRiskBandKey
  if (!(band in ACCOUNT_RISK_BAND_PCT)) return { success: false, error: 'Pick a risk band: low, mid or high' }
  await requireAdmin()
  const pair = await loadPair(getAdminSupabase(), String(input.gameCategoryId ?? ''))
  if (!pair) return { success: false, error: 'Unknown game category' }
  if (pair.type !== 'account') return { success: false, error: 'Risk bands apply to account categories only' }
  return scheduleBaseFeeRule({
    gameCategoryId: pair.id,
    pct: ACCOUNT_RISK_BAND_PCT[band],
    startsAt: input.startsAt,
    note: `risk band ${band}`,
  })
}

/** Delete a scheduled (not yet started) pair base rule; re-opens the rule it closed. */
export async function cancelScheduledBaseRule(input: { ruleId: string }): Promise<Result> {
  const admin = await requireAdmin()
  const supabase = getAdminSupabase()
  const ruleId = String(input.ruleId ?? '')
  const { data: before } = await supabase.from('fee_rules').select(RULE_COLS).eq('id', ruleId).maybeSingle()
  if (!before) return { success: false, error: 'That rule no longer exists' }
  const pair = await loadPair(supabase, String((before as any).game_category_id ?? ''))
  if (!pair) return { success: false, error: 'Only a game-category rule can be cancelled here' }

  const { data, error } = await supabase.rpc('fee_rule_cancel_scheduled', { p_rule_id: ruleId } as any)
  if (error) return { success: false, error: feeRuleErrorMessage(error) }
  const out = (data ?? {}) as { deleted: any; reopened: any }
  const auditErr = await auditWrite(supabase, admin.userId, auditKey(pair, 'base:cancel'), out.deleted, out.reopened ?? null)
  if (auditErr) console.error('[admin-fees] audit row failed after a successful write:', auditErr)
  revalidateFeeReaders()
  return { success: true }
}

/**
 * A promotional rate: 0–50%, end date REQUIRED, may start now — the Terms
 * exempt promotions from the notice period and the database trigger agrees.
 */
export async function createPromoFeeRule(input: {
  gameCategoryId: string
  pct: unknown
  startsAt?: unknown
  endsAt: unknown
  note?: string | null
}): Promise<Result<{ rule: FeeRuleRow }>> {
  const admin = await requireAdmin()
  const supabase = getAdminSupabase()

  const pct = parsePct(input.pct)
  if ('error' in pct) return { success: false, error: pct.error }
  const end = parseUtcDate(input.endsAt)
  if ('error' in end) return { success: false, error: 'A promotional rate must have an end date (YYYY-MM-DD)' }
  let startIso = new Date().toISOString()
  if (input.startsAt != null && String(input.startsAt).trim() !== '') {
    const start = parseUtcDate(input.startsAt)
    if ('error' in start) return { success: false, error: start.error }
    // A start earlier today means "now"; a past date would backdate a promo.
    startIso = start.ms > Date.now() ? start.iso : startIso
    if (start.ms < Date.now() - 86_400_000) return { success: false, error: 'A promotion cannot start in the past' }
  }
  if (end.iso <= startIso) return { success: false, error: 'The end date must be after the start date' }
  const pair = await loadPair(supabase, String(input.gameCategoryId ?? ''))
  if (!pair) return { success: false, error: 'Unknown game category' }

  const note = (input.note ?? '').toString().trim().slice(0, 200) || null
  const { data, error } = await supabase
    .from('fee_rules')
    .insert({
      kind: 'promo',
      scope: 'game_category',
      category_type: pair.type,
      game_category_id: pair.id,
      pct: pct.pct,
      starts_at: startIso,
      ends_at: end.iso,
      note,
      created_by: admin.userId,
    } as any)
    .select(RULE_COLS)
    .single()
  if (error) return { success: false, error: feeRuleErrorMessage(error) }
  const rule = toRule(data)
  const auditErr = await auditWrite(supabase, admin.userId, auditKey(pair, 'promo'), null, data)
  if (auditErr) console.error('[admin-fees] audit row failed after a successful write:', auditErr)
  revalidateFeeReaders()
  return { success: true, rule }
}

/**
 * End a promo early: a running promo ends now (ends_at = now); one that has
 * not started yet is deleted (it never applied to any order).
 */
export async function endPromoFeeRule(input: { ruleId: string }): Promise<Result> {
  const admin = await requireAdmin()
  const supabase = getAdminSupabase()
  const ruleId = String(input.ruleId ?? '')
  const { data: before } = await supabase.from('fee_rules').select(RULE_COLS).eq('id', ruleId).maybeSingle()
  if (!before) return { success: false, error: 'That promotion no longer exists' }
  const rule = toRule(before)
  if (rule.kind !== 'promo' || rule.scope !== 'game_category' || !rule.game_category_id) {
    return { success: false, error: 'Only a game-category promotion can be ended here' }
  }
  const pair = await loadPair(supabase, rule.game_category_id)
  if (!pair) return { success: false, error: 'Unknown game category' }
  const nowIso = new Date().toISOString()
  if (rule.ends_at && rule.ends_at <= nowIso) return { success: false, error: 'That promotion has already ended' }

  let after: any = null
  if (rule.starts_at > nowIso) {
    const { error } = await supabase.from('fee_rules').delete().eq('id', ruleId)
    if (error) return { success: false, error: feeRuleErrorMessage(error) }
  } else {
    const { data, error } = await supabase.from('fee_rules').update({ ends_at: nowIso } as any).eq('id', ruleId).select(RULE_COLS).single()
    if (error) return { success: false, error: feeRuleErrorMessage(error) }
    after = data
  }
  const auditErr = await auditWrite(supabase, admin.userId, auditKey(pair, 'promo:end'), before, after)
  if (auditErr) console.error('[admin-fees] audit row failed after a successful write:', auditErr)
  revalidateFeeReaders()
  return { success: true }
}


// ── PR 7: post-delivery money numbers (hold, windows, gate, freeze, payout fees) ──
// Every write is ONE service-role RPC that also writes the fee_config_audit row.

export type MoneySettingKey = 'completion_hold_hours' | 'dispute_window_days' | 'withdrawal_min_account_age_days' | 'payout_details_freeze_hours'

export async function fetchMoneySettings(): Promise<{
  settings: Record<MoneySettingKey, number>
  windows: Array<{ category_type: string; auto_complete_hours: number; updated_at: string }>
  methods: Array<{ id: string; method_name: string; display_name: string; method_type: string; fee_percentage: number; fee_fixed: number; fee_min: number; min_withdrawal: number; max_withdrawal: number; is_active: boolean; coming_soon: boolean }>
}> {
  await requireAdmin()
  const supabase = getAdminSupabase()
  const [{ data: s }, { data: w }, { data: m }] = await Promise.all([
    supabase.from('platform_fee_settings').select('completion_hold_hours, dispute_window_days, withdrawal_min_account_age_days, payout_details_freeze_hours').eq('id', true).maybeSingle(),
    (supabase as any).from('order_completion_windows').select('category_type, auto_complete_hours, updated_at').order('category_type'),
    (supabase as any).from('withdrawal_methods').select('id, method_name, display_name, method_type, fee_percentage, fee_fixed, fee_min, min_withdrawal, max_withdrawal, is_active, coming_soon').order('sort_order'),
  ])
  const row = (s ?? {}) as any
  return {
    settings: {
      completion_hold_hours: Number(row.completion_hold_hours ?? 24),
      dispute_window_days: Number(row.dispute_window_days ?? 7),
      withdrawal_min_account_age_days: Number(row.withdrawal_min_account_age_days ?? 30),
      payout_details_freeze_hours: Number(row.payout_details_freeze_hours ?? 48),
    },
    windows: ((w ?? []) as any[]).map((x) => ({ category_type: x.category_type, auto_complete_hours: Number(x.auto_complete_hours), updated_at: x.updated_at })),
    methods: ((m ?? []) as any[]).map((x) => ({
      id: x.id, method_name: x.method_name, display_name: x.display_name, method_type: x.method_type,
      fee_percentage: Number(x.fee_percentage ?? 0), fee_fixed: Number(x.fee_fixed ?? 0), fee_min: Number(x.fee_min ?? 0),
      min_withdrawal: Number(x.min_withdrawal ?? 0), max_withdrawal: Number(x.max_withdrawal ?? 0),
      is_active: Boolean(x.is_active), coming_soon: Boolean(x.coming_soon),
    })),
  }
}

function parseInt0(v: unknown, label: string, min: number, max: number): { n: number } | { error: string } {
  const n = Number(v)
  if (!Number.isInteger(n) || n < min || n > max) return { error: `${label} must be a whole number between ${min} and ${max}` }
  return { n }
}

export async function updateMoneySetting(input: { key: MoneySettingKey; value: unknown }): Promise<Result<{ old: number; value: number }>> {
  const admin = await requireAdmin()
  const bounds: Record<MoneySettingKey, [number, number, string]> = {
    completion_hold_hours: [0, 24 * 90, 'Completion hold (hours)'],
    dispute_window_days: [0, 365, 'Dispute window (days)'],
    withdrawal_min_account_age_days: [0, 3650, 'New-seller withdrawal rule (days)'],
    payout_details_freeze_hours: [0, 24 * 30, 'Payout-details freeze (hours)'],
  }
  const b = bounds[input.key]
  if (!b) return { success: false, error: 'Unknown setting' }
  const v = parseInt0(input.value, b[2], b[0], b[1])
  if ('error' in v) return { success: false, error: v.error }
  const { data, error } = await (getAdminSupabase().rpc as any)('platform_money_setting_set', { p_admin_id: admin.userId, p_key: input.key, p_value: v.n })
  if (error) return { success: false, error: error.message }
  revalidateFeeReaders()
  return { success: true, old: Number(data?.old), value: v.n }
}

export async function updateCompletionWindow(input: { categoryType: string; hours: unknown }): Promise<Result<{ old: number; hours: number }>> {
  const admin = await requireAdmin()
  const v = parseInt0(input.hours, 'Auto-complete window (hours)', 1, 24 * 60)
  if ('error' in v) return { success: false, error: v.error }
  const { data, error } = await (getAdminSupabase().rpc as any)('order_completion_window_set', { p_admin_id: admin.userId, p_category_type: String(input.categoryType), p_hours: v.n })
  if (error) return { success: false, error: error.message }
  revalidateFeeReaders()
  return { success: true, old: Number(data?.old), hours: v.n }
}

export async function updateWithdrawalMethodFees(input: {
  methodId: string; feePct: unknown; feeFixed: unknown; feeMin: unknown; minWithdrawal: unknown; maxWithdrawal: unknown; isActive: boolean
  /** Omitted = leave coming_soon as it is. */
  comingSoon?: boolean
}): Promise<Result> {
  const admin = await requireAdmin()
  const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : NaN }
  const vals = [num(input.feePct), num(input.feeFixed), num(input.feeMin), num(input.minWithdrawal), num(input.maxWithdrawal)]
  if (vals.some((n) => Number.isNaN(n) || n < 0)) return { success: false, error: 'Every fee field must be a non-negative number' }
  const { error } = await (getAdminSupabase().rpc as any)('withdrawal_methods_set_fees', {
    p_method_id: String(input.methodId), p_admin_id: admin.userId,
    p_fee_pct: vals[0], p_fee_fixed: vals[1], p_fee_min: vals[2], p_min: vals[3], p_max: vals[4], p_is_active: Boolean(input.isActive),
    p_coming_soon: input.comingSoon === undefined ? null : Boolean(input.comingSoon),
  })
  if (error) return { success: false, error: feeRuleErrorMessage(error) }
  revalidateFeeReaders()
  return { success: true }
}
