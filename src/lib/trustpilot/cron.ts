/**
 * The daily Trustpilot invite run (/api/cron/send-trustpilot-invitations).
 *
 * The completion path sends almost every invite itself. This picks up what
 * it missed — rows still `scheduled` an hour after completion (the path never
 * ran, e.g. a dispute or admin completion, which are recorded as skipped) and
 * `failed` rows with attempts left — and re-runs the same seam. It also
 * sweeps orders completed in the last 3 days that have NO invite row at all
 * (prod audit 2026-10-12: 2 of 10 completed orders had none); the seam
 * creates the row with its outcome. The window stops an old order from ever
 * getting a late receipt.
 *
 * Ops alert: an invite that failed on an earlier day and fails again in this
 * run has been failing two days in a row → one Discord message per run.
 */
import 'server-only'

import { createServiceRoleClient } from '@/lib/supabase/service'
import { SITE_URL } from '@/config/site'
import { postOpsAlert } from '@/lib/ops/discord-alert'
import { MAX_ATTEMPTS, runCompletionInvite, type InviteResult } from './invite'

const BATCH_SIZE = 50
const SWEEP_WINDOW_MS = 3 * 24 * 60 * 60 * 1000

export interface DueInvite {
  orderId: string
  firstFailedAt: string | null
}

export interface CronDeps {
  now(): Date
  listDue(now: Date, limit: number): Promise<DueInvite[]>
  /** Orders completed since `since` with no trustpilot_invitations row. */
  listMissing(since: Date, limit: number): Promise<string[]>
  run(orderId: string): Promise<InviteResult>
  alert(message: string): Promise<boolean>
}

export interface CronSummary {
  processed: number
  sent: number
  skipped: number
  failed: number
  failingTwoDays: number
  /** Completed orders that had no invite row and were swept in this run. */
  missingRows: number
  alerted: boolean
}

const utcDay = (d: Date) => d.toISOString().slice(0, 10)

export async function runInviteCron(deps: CronDeps = defaultDeps): Promise<CronSummary> {
  const now = deps.now()
  const due = await deps.listDue(now, BATCH_SIZE)
  const seen = new Set(due.map((d) => d.orderId))
  const missing = (await deps.listMissing(new Date(now.getTime() - SWEEP_WINDOW_MS), BATCH_SIZE)).filter((id) => !seen.has(id))
  const summary: CronSummary = { processed: 0, sent: 0, skipped: 0, failed: 0, failingTwoDays: 0, missingRows: missing.length, alerted: false }
  const stuck: Array<{ orderId: string; error: string }> = []

  for (const row of [...due, ...missing.map((orderId) => ({ orderId, firstFailedAt: null }))]) {
    let result: InviteResult
    try {
      result = await deps.run(row.orderId)
    } catch (e) {
      result = { status: 'failed', error: (e as Error).message }
    }
    summary.processed++
    if (result.status === 'sent') summary.sent++
    else if (result.status === 'skipped') summary.skipped++
    else if (result.status === 'failed' || result.status === 'missing') {
      summary.failed++
      if (result.status === 'failed' && row.firstFailedAt && utcDay(new Date(row.firstFailedAt)) < utcDay(now)) {
        stuck.push({ orderId: row.orderId, error: result.error ?? 'unknown error' })
      }
    }
  }

  summary.failingTwoDays = stuck.length
  if (stuck.length > 0) {
    const errors = [...new Set(stuck.map((s) => s.error))].slice(0, 3)
    const message =
      `${stuck.length} Trustpilot invite${stuck.length === 1 ? ' has' : 's have'} failed two days in a row.\n` +
      errors.map((e) => `• ${e}`).join('\n') +
      `\nDetails: ${SITE_URL}/admin`
    summary.alerted = await deps.alert(message)
  }
  return summary
}

const defaultDeps: CronDeps = {
  now: () => new Date(),
  async listDue(now, limit) {
    const { data, error } = await (createServiceRoleClient() as any)
      .from('trustpilot_invitations')
      .select('order_id, first_failed_at')
      .in('status', ['scheduled', 'failed'])
      .lt('attempts', MAX_ATTEMPTS)
      .lte('scheduled_for', now.toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(limit)
    if (error) throw new Error(`trustpilot_invitations read failed: ${error.message}`)
    return ((data ?? []) as Array<{ order_id: string; first_failed_at: string | null }>).map((r) => ({
      orderId: r.order_id,
      firstFailedAt: r.first_failed_at,
    }))
  },
  async listMissing(since, limit) {
    const { data, error } = await (createServiceRoleClient() as any).rpc('trustpilot_orders_missing_invite', {
      p_since: since.toISOString(),
      p_limit: limit,
    })
    if (error) throw new Error(`trustpilot_orders_missing_invite failed: ${error.message}`)
    return ((data ?? []) as Array<{ order_id: string }>).map((r) => r.order_id)
  },
  run: (orderId) => runCompletionInvite(orderId, 'retry'),
  alert: (message) => postOpsAlert(message),
}
