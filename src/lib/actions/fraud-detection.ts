'use server'

/**
 * P6.3 — Fraud Detection Engine
 *
 * Rules engine runs on demand (admin-triggered or cron-triggered).
 * Each rule scans the DB for suspicious patterns and inserts `fraud_flags`
 * records for newly discovered violations, skipping users who already
 * have an open flag for the same rule.
 *
 * Rules:
 *  1. high_order_velocity   — buyer > 5 orders in last 24 h        → HIGH
 *  2. high_dispute_rate     — user has > 2 disputes                 → MEDIUM
 *  3. new_account_high_value— account < 7 days + order > $100      → MEDIUM
 *  4. multiple_refunds      — user has > 2 refunded orders          → MEDIUM
 *  5. promo_abuse           — user used > 5 promo codes             → LOW
 *  6. seller_balance_anomaly— seller 0 sales + pending_balance > 50 → HIGH
 */

import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/actions/admin-permissions'

// ── Types ──────────────────────────────────────────────────────────────────

export type FraudSeverity = 'low' | 'medium' | 'high'
export type FraudStatus   = 'open' | 'resolved' | 'dismissed'

export interface FraudFlag {
  id:           string
  user_id:      string | null
  rule_id:      string
  severity:     FraudSeverity
  description:  string
  metadata:     Record<string, unknown>
  status:       FraudStatus
  created_at:   string
  resolved_at:  string | null
  resolved_by:  string | null
  // Joined from profiles
  username?:    string | null
  email?:       string | null
  role?:        string | null
}

export interface FraudScanResult {
  success:     boolean
  newFlags:    number
  rulesRun:    number
  error?:      string
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Returns a Set of user_ids that already have an open flag for `ruleId`. */
async function existingOpenFlags(supabase: any, ruleId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('fraud_flags')
    .select('user_id')
    .eq('rule_id', ruleId)
    .eq('status', 'open')
  const ids = ((data as { user_id: string }[] | null) ?? []).map(r => r.user_id)
  return new Set(ids)
}

/** Inserts a batch of fraud flags, returns count inserted. */
async function insertFlags(
  supabase: any,
  flags: Array<{
    user_id:    string
    rule_id:    string
    severity:   FraudSeverity
    description: string
    metadata:   Record<string, unknown>
  }>
): Promise<number> {
  if (flags.length === 0) return 0
  const { error } = await (supabase.from('fraud_flags') as any).insert(flags)
  if (error) {
    console.error('[fraud] insert error:', error.message)
    return 0
  }

  // Notify admins about high and medium severity fraud flags
  try {
    const highSeverityFlags = flags.filter(f => f.severity === 'high')
    const mediumSeverityFlags = flags.filter(f => f.severity === 'medium')

    if (highSeverityFlags.length > 0 || mediumSeverityFlags.length > 0) {
      const { notifyAdmins } = await import('@/lib/utils/notifications')

      for (const flag of highSeverityFlags) {
        await notifyAdmins({
          permission: 'fraud.view',
          type: 'fraud_alert_high',
          title: '🚨 High-Risk Fraud Alert',
          message: flag.description,
          link: `/admin/fraud`,
        })
      }

      for (const flag of mediumSeverityFlags) {
        await notifyAdmins({
          permission: 'fraud.view',
          type: 'fraud_alert_medium',
          title: '⚠️ Fraud Alert',
          message: flag.description,
          link: `/admin/fraud`,
        })
      }

      console.log(`[fraud] Notified admins about ${highSeverityFlags.length} high + ${mediumSeverityFlags.length} medium severity flags`)
    }
  } catch (error) {
    console.error('[fraud] Failed to notify admins:', error)
    // Non-fatal - flags are already created
  }

  return flags.length
}

// ── Rules ──────────────────────────────────────────────────────────────────

/** Rule 1 — High order velocity: buyer > 5 orders in last 24 h */
async function ruleHighOrderVelocity(supabase: any): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: rows } = await supabase
    .from('orders')
    .select('buyer_id, created_at')
    .gte('created_at', since)
    .not('buyer_id', 'is', null)

  const counts: Record<string, number> = {}
  for (const r of (rows as any[] | null) ?? []) {
    counts[r.buyer_id] = (counts[r.buyer_id] ?? 0) + 1
  }

  const violators = Object.entries(counts).filter(([, n]) => n > 5)
  if (violators.length === 0) return 0

  const alreadyFlagged = await existingOpenFlags(supabase, 'high_order_velocity')
  const newViolators = violators.filter(([id]) => !alreadyFlagged.has(id))

  return insertFlags(supabase, newViolators.map(([userId, count]) => ({
    user_id:     userId,
    rule_id:     'high_order_velocity',
    severity:    'high',
    description: `Buyer placed ${count} orders in the last 24 hours (threshold: 5).`,
    metadata:    { order_count_24h: count },
  })))
}

/** Rule 2 — High dispute rate: user has > 2 disputes total */
async function ruleHighDisputeRate(supabase: any): Promise<number> {
  const { data: rows } = await supabase
    .from('disputes')
    .select('buyer_id:orders(buyer_id), seller_id:orders(seller_id), order_id')

  // Disputes are joined through orders — simpler: query orders with status=disputed
  const { data: disputedOrders } = await supabase
    .from('orders')
    .select('buyer_id, seller_id')
    .eq('status', 'disputed')
    .not('buyer_id', 'is', null)

  const counts: Record<string, number> = {}
  for (const o of (disputedOrders as any[] | null) ?? []) {
    if (o.buyer_id) counts[o.buyer_id] = (counts[o.buyer_id] ?? 0) + 1
  }

  const violators = Object.entries(counts).filter(([, n]) => n > 2)
  if (violators.length === 0) return 0

  const alreadyFlagged = await existingOpenFlags(supabase, 'high_dispute_rate')
  const newViolators = violators.filter(([id]) => !alreadyFlagged.has(id))

  return insertFlags(supabase, newViolators.map(([userId, count]) => ({
    user_id:     userId,
    rule_id:     'high_dispute_rate',
    severity:    'medium',
    description: `User has been involved in ${count} disputed orders (threshold: 2).`,
    metadata:    { disputed_order_count: count },
  })))
}

/** Rule 3 — New account high-value order: account < 7 days + any order > $100 */
async function ruleNewAccountHighValue(supabase: any): Promise<number> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Find new accounts
  const { data: newProfiles } = await supabase
    .from('profiles')
    .select('id, created_at')
    .gte('created_at', sevenDaysAgo)

  const newUserIds = ((newProfiles as any[] | null) ?? []).map(p => p.id)
  if (newUserIds.length === 0) return 0

  // Find high-value orders from those users
  const { data: bigOrders } = await supabase
    .from('orders')
    .select('buyer_id, total_amount')
    .in('buyer_id', newUserIds)
    .gt('total_amount', 100)

  const byUser: Record<string, number> = {}
  for (const o of (bigOrders as any[] | null) ?? []) {
    byUser[o.buyer_id] = Math.max(byUser[o.buyer_id] ?? 0, o.total_amount ?? 0)
  }

  const violators = Object.entries(byUser)
  if (violators.length === 0) return 0

  const alreadyFlagged = await existingOpenFlags(supabase, 'new_account_high_value')
  const newViolators = violators.filter(([id]) => !alreadyFlagged.has(id))

  return insertFlags(supabase, newViolators.map(([userId, maxAmount]) => ({
    user_id:     userId,
    rule_id:     'new_account_high_value',
    severity:    'medium',
    description: `Account created within 7 days placed a high-value order ($${maxAmount.toFixed(2)}).`,
    metadata:    { max_order_amount: maxAmount },
  })))
}

/** Rule 4 — Multiple refunds: user has > 2 refunded orders */
async function ruleMultipleRefunds(supabase: any): Promise<number> {
  const { data: refundedOrders } = await supabase
    .from('orders')
    .select('buyer_id')
    .eq('status', 'refunded')
    .not('buyer_id', 'is', null)

  const counts: Record<string, number> = {}
  for (const o of (refundedOrders as any[] | null) ?? []) {
    counts[o.buyer_id] = (counts[o.buyer_id] ?? 0) + 1
  }

  const violators = Object.entries(counts).filter(([, n]) => n > 2)
  if (violators.length === 0) return 0

  const alreadyFlagged = await existingOpenFlags(supabase, 'multiple_refunds')
  const newViolators = violators.filter(([id]) => !alreadyFlagged.has(id))

  return insertFlags(supabase, newViolators.map(([userId, count]) => ({
    user_id:     userId,
    rule_id:     'multiple_refunds',
    severity:    'medium',
    description: `Buyer has had ${count} orders refunded (threshold: 2).`,
    metadata:    { refund_count: count },
  })))
}

/** Rule 5 — Promo abuse: user redeemed > 5 promo codes */
async function rulePromoAbuse(supabase: any): Promise<number> {
  const { data: usages } = await supabase
    .from('promo_code_usages')
    .select('user_id')
    .not('user_id', 'is', null)

  const counts: Record<string, number> = {}
  for (const u of (usages as any[] | null) ?? []) {
    counts[u.user_id] = (counts[u.user_id] ?? 0) + 1
  }

  const violators = Object.entries(counts).filter(([, n]) => n > 5)
  if (violators.length === 0) return 0

  const alreadyFlagged = await existingOpenFlags(supabase, 'promo_abuse')
  const newViolators = violators.filter(([id]) => !alreadyFlagged.has(id))

  return insertFlags(supabase, newViolators.map(([userId, count]) => ({
    user_id:     userId,
    rule_id:     'promo_abuse',
    severity:    'low',
    description: `User redeemed ${count} promo codes (threshold: 5). Possible code-sharing abuse.`,
    metadata:    { promo_usage_count: count },
  })))
}

/** Rule 6 — Seller balance anomaly: 0 completed sales + pending_balance > $50 */
async function ruleSellerBalanceAnomaly(supabase: any): Promise<number> {
  const { data: sellers } = await supabase
    .from('profiles')
    .select('id, total_sales, pending_balance, seller_balance')
    .eq('role', 'seller')
    .eq('total_sales', 0)
    .gt('pending_balance', 50)

  const violators = ((sellers as any[] | null) ?? [])
  if (violators.length === 0) return 0

  const alreadyFlagged = await existingOpenFlags(supabase, 'seller_balance_anomaly')
  const newViolators = violators.filter((s: any) => !alreadyFlagged.has(s.id))

  return insertFlags(supabase, newViolators.map((s: any) => ({
    user_id:     s.id,
    rule_id:     'seller_balance_anomaly',
    severity:    'high',
    description: `Seller has $${(s.pending_balance ?? 0).toFixed(2)} pending balance with 0 recorded sales. Possible payment manipulation.`,
    metadata:    { pending_balance: s.pending_balance, total_sales: s.total_sales },
  })))
}

// ── Main scan ──────────────────────────────────────────────────────────────

export async function runFraudScan(): Promise<FraudScanResult> {
  try {
    await requireAdmin()
    const supabase = await createClient()

    const rules = [
      ruleHighOrderVelocity,
      ruleHighDisputeRate,
      ruleNewAccountHighValue,
      ruleMultipleRefunds,
      rulePromoAbuse,
      ruleSellerBalanceAnomaly,
    ]

    let newFlags = 0
    for (const rule of rules) {
      newFlags += await rule(supabase)
    }

    return { success: true, newFlags, rulesRun: rules.length }
  } catch (err: any) {
    console.error('[fraud] runFraudScan error:', err)
    return { success: false, newFlags: 0, rulesRun: 0, error: err.message }
  }
}

// ── Flag management ────────────────────────────────────────────────────────

export async function getFraudFlags(statusFilter: FraudStatus = 'open'): Promise<{
  success: boolean
  flags?: FraudFlag[]
  error?: string
}> {
  try {
    await requireAdmin()
    const supabase = await createClient()

    // Fetch flags
    const { data: rawFlags, error: flagErr } = await supabase
      .from('fraud_flags')
      .select('*')
      .eq('status', statusFilter)
      .order('created_at', { ascending: false })
      .limit(200)

    if (flagErr) throw new Error(flagErr.message)

    const flags = (rawFlags as any[] | null) ?? []
    if (flags.length === 0) return { success: true, flags: [] }

    // Join profile info (username, email, role)
    const userIds = Array.from(new Set(flags.map((f: any) => f.user_id).filter(Boolean)))
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, email, role')
      .in('id', userIds)

    const profileMap: Record<string, { username: string | null; email: string | null; role: string | null }> = {}
    for (const p of (profiles as any[] | null) ?? []) {
      profileMap[p.id] = { username: p.username, email: p.email, role: p.role }
    }

    const enriched: FraudFlag[] = flags.map(f => ({
      ...f,
      username: profileMap[f.user_id]?.username ?? null,
      email:    profileMap[f.user_id]?.email    ?? null,
      role:     profileMap[f.user_id]?.role     ?? null,
    }))

    return { success: true, flags: enriched }
  } catch (err: any) {
    console.error('[fraud] getFraudFlags error:', err)
    return { success: false, error: err.message }
  }
}

export async function resolveFraudFlag(
  flagId: string,
  action: 'resolved' | 'dismissed'
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin()
    const supabase = await createClient()

    const { error } = await (supabase.from('fraud_flags') as any)
      .update({
        status:      action,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', flagId)

    if (error) throw new Error(error.message)
    return { success: true }
  } catch (err: any) {
    console.error('[fraud] resolveFraudFlag error:', err)
    return { success: false, error: err.message }
  }
}

export async function getFraudStats(): Promise<{
  success: boolean
  open: number
  high: number
  medium: number
  low: number
  resolvedToday: number
  error?: string
}> {
  try {
    await requireAdmin()
    const supabase = await createClient()

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)

    const [
      { count: open },
      { count: high },
      { count: medium },
      { count: low },
      { count: resolvedToday },
    ] = await Promise.all([
      supabase.from('fraud_flags').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.from('fraud_flags').select('id', { count: 'exact', head: true }).eq('status', 'open').eq('severity', 'high'),
      supabase.from('fraud_flags').select('id', { count: 'exact', head: true }).eq('status', 'open').eq('severity', 'medium'),
      supabase.from('fraud_flags').select('id', { count: 'exact', head: true }).eq('status', 'open').eq('severity', 'low'),
      supabase.from('fraud_flags').select('id', { count: 'exact', head: true })
        .in('status', ['resolved', 'dismissed'])
        .gte('resolved_at', todayStart.toISOString()),
    ])

    return {
      success:      true,
      open:         open         ?? 0,
      high:         high         ?? 0,
      medium:       medium       ?? 0,
      low:          low          ?? 0,
      resolvedToday: resolvedToday ?? 0,
    }
  } catch (err: any) {
    return { success: false, open: 0, high: 0, medium: 0, low: 0, resolvedToday: 0, error: err.message }
  }
}
