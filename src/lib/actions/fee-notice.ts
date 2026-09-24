'use server'

/**
 * Admin-only "send fee notice" (PR 7, Part 5).
 *
 *   previewFeeNotice()  — DRY RUN: the facts (all from the DB), the recipient
 *                         list (active sellers with an email, minus those
 *                         already sent this notice) and the rendered HTML.
 *   sendFeeNotice()     — SEND: for each recipient, claim the (key, seller)
 *                         row FIRST (seller_notice_claim → true exactly once),
 *                         then hand the email to Resend and record the result.
 *                         A second click, a retry or a parallel run can never
 *                         send the same notice to the same seller twice.
 */

import { createServiceRoleClient } from '@/lib/supabase/service'
import { requireRole } from '@/lib/actions/admin-permissions'
import { describeWithdrawalFee } from '@/lib/fees/public-rates'
import { buildFeeNoticeEmail, feeNoticeKey, sendFeeNoticeEmail, type FeeNoticeFacts } from '@/lib/email/fee-notice'

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://dropmarket.gg').replace(/\/$/, '')
/** The announced start when no dated PR 4 rule exists yet (never expected in prod). */
const FALLBACK_START = '2026-10-07T00:00:00.000Z'

export interface FeeNoticeRecipient { id: string; email: string; name: string }

function monthsText(months: number): string {
  if (months === 12) return 'first year'
  if (months % 12 === 0) return `first ${months / 12} years`
  return `first ${months} month${months === 1 ? '' : 's'}`
}

export async function loadFeeNoticeFacts(): Promise<FeeNoticeFacts> {
  const service = createServiceRoleClient()
  const [{ data: rule }, { data: settings }, { data: methods }] = await Promise.all([
    (service as any).from('fee_rules').select('starts_at').like('note', 'PR4:%').order('starts_at', { ascending: true }).limit(1).maybeSingle(),
    (service as any).from('platform_fee_settings').select('founding_discount_pct, founding_months, completion_hold_hours, dispute_window_days, withdrawal_min_account_age_days, payout_details_freeze_hours').eq('id', true).maybeSingle(),
    (service as any).from('withdrawal_methods').select('display_name, method_type, fee_percentage, fee_fixed, fee_min, min_withdrawal, sort_order').eq('is_active', true).eq('coming_soon', false).order('sort_order'),
  ])
  // One line per DISTINCT fee term (every USDT network shares one term).
  const seen = new Set<string>()
  const lines: FeeNoticeFacts['methods'] = []
  for (const m of (methods ?? []) as any[]) {
    const feeText = describeWithdrawalFee({ feePct: Number(m.fee_percentage ?? 0), feeFixed: Number(m.fee_fixed ?? 0), feeMin: Number(m.fee_min ?? 0) })
    const label = m.method_type === 'crypto' ? 'Crypto (USDT)' : String(m.display_name)
    const key = `${label}|${feeText}|${m.min_withdrawal}`
    if (seen.has(key)) continue
    seen.add(key)
    lines.push({ displayName: label, feeText, minWithdrawal: Number(m.min_withdrawal ?? 0) })
  }
  return {
    ratesStartAt: rule?.starts_at ? new Date(rule.starts_at).toISOString() : FALLBACK_START,
    foundingPeriodText: monthsText(Number(settings?.founding_months ?? 12)),
    foundingDiscountPct: Number(settings?.founding_discount_pct ?? 50),
    methods: lines,
    minAccountAgeDays: Number(settings?.withdrawal_min_account_age_days ?? 30),
    completionHoldHours: Number(settings?.completion_hold_hours ?? 24),
    disputeWindowDays: Number(settings?.dispute_window_days ?? 7),
    payoutFreezeHours: Number(settings?.payout_details_freeze_hours ?? 48),
    sellFeesUrl: `${APP_URL}/sell/fees`,
    settingsUrl: `${APP_URL}/account/settings?tab=payouts`,
  }
}

/** Active sellers with an email, minus those already claimed for this key. */
export async function loadFeeNoticeRecipients(noticeKey: string): Promise<{ pending: FeeNoticeRecipient[]; alreadySent: number; failed: number }> {
  const service = createServiceRoleClient()
  const [{ data: sellers, error }, { data: sent }] = await Promise.all([
    service.from('profiles').select('id, email, username, full_name').eq('role', 'seller').eq('seller_status', 'active').not('email', 'is', null).order('created_at', { ascending: true }),
    (service as any).from('seller_notice_sends').select('user_id, sent_at, error').eq('notice_key', noticeKey),
  ])
  if (error) throw new Error(`profiles: ${error.message}`)
  const claimed = new Map<string, any>(((sent ?? []) as any[]).map((r) => [r.user_id, r]))
  const pending = ((sellers ?? []) as any[])
    .filter((s) => s.email && !claimed.has(s.id))
    .map((s) => ({ id: s.id, email: String(s.email), name: s.full_name || s.username || 'there' }))
  const rows = Array.from(claimed.values())
  return { pending, alreadySent: rows.filter((r) => r.sent_at).length, failed: rows.filter((r) => r.error).length }
}

export async function previewFeeNotice(): Promise<{
  success: boolean
  facts?: FeeNoticeFacts
  noticeKey?: string
  subject?: string
  html?: string
  recipients?: FeeNoticeRecipient[]
  alreadySent?: number
  failed?: number
  error?: string
}> {
  try {
    await requireRole(['admin', 'super_admin'])
    const facts = await loadFeeNoticeFacts()
    const noticeKey = feeNoticeKey(facts)
    const { pending, alreadySent, failed } = await loadFeeNoticeRecipients(noticeKey)
    const { subject, html } = buildFeeNoticeEmail('Seller', facts)
    return { success: true, facts, noticeKey, subject, html, recipients: pending, alreadySent, failed }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Preview failed' }
  }
}

export async function sendFeeNotice(input: { confirm: 'SEND' }): Promise<{
  success: boolean
  sent?: number
  skipped?: number
  failed?: number
  noticeKey?: string
  error?: string
}> {
  try {
    const admin = await requireRole(['admin', 'super_admin'])
    if (input?.confirm !== 'SEND') return { success: false, error: 'Type SEND to confirm.' }
    const facts = await loadFeeNoticeFacts()
    const noticeKey = feeNoticeKey(facts)
    const { pending } = await loadFeeNoticeRecipients(noticeKey)
    const service = createServiceRoleClient()

    let sent = 0, skipped = 0, failed = 0
    for (const r of pending) {
      // Claim BEFORE sending: exactly one caller wins each (key, seller).
      const { data: claimed, error: claimErr } = await (service.rpc as any)('seller_notice_claim', {
        p_notice_key: noticeKey, p_user_id: r.id, p_email: r.email, p_claimed_by: admin.userId,
      })
      if (claimErr) { failed += 1; console.error('[FeeNotice] claim failed', r.id, claimErr.message); continue }
      if (!claimed) { skipped += 1; continue }
      try {
        const res = await sendFeeNoticeEmail({ to: r.email, name: r.name, facts })
        if (!res.success) throw new Error(String((res as any).error?.message ?? (res as any).error ?? 'send failed'))
        await (service.rpc as any)('seller_notice_record', { p_notice_key: noticeKey, p_user_id: r.id, p_provider_id: (res as any).data?.id ?? null, p_error: null })
        sent += 1
      } catch (e: any) {
        failed += 1
        await (service.rpc as any)('seller_notice_record', { p_notice_key: noticeKey, p_user_id: r.id, p_provider_id: null, p_error: String(e?.message ?? e).slice(0, 500) })
      }
    }
    return { success: true, sent, skipped, failed, noticeKey }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Send failed' }
  }
}
