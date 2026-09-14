/**
 * ROUTE-014 — freshness guard for the SAB pricing pipeline (route handlers).
 *
 * The checks, thresholds and alert-body construction live in
 * ./freshness-checks so they stay unit-testable: Next.js rejects any export
 * from a route.ts outside its known set, so helpers cannot be exported here.
 */

import { NextRequest, NextResponse } from 'next/server'

import { createServiceRoleClient } from '@/lib/supabase/service'
import { sendAdminNoticeEmail } from '@/lib/email'
import {
  FRESHNESS_ALERT_EMAIL,
  FRESHNESS_CHECKS,
  buildAlertBody,
  evaluate,
  readLatest,
  type CheckResult,
} from './freshness-checks'

export async function GET(request: NextRequest) {
  // Read the secret per request rather than at module load: a module-scope
  // capture is evaluated once per lambda cold start, which makes the gate
  // untestable and silently wrong if the env is set after import.
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Service role, not the session client: a Vercel cron request carries no
  // cookies, so a session client would run as anon and read nothing (the trap
  // documented in CLAUDE.md / migration 20260913100000).
  const admin = createServiceRoleClient()
  const now = Date.now()
  const checkedAt = new Date(now).toISOString()

  const results: CheckResult[] = []
  for (const check of FRESHNESS_CHECKS) {
    const { latest, error } = await readLatest(admin as any, check)
    results.push(evaluate(check, latest, now, error))
  }

  const stale = results.filter((r) => r.stale)

  if (!stale.length) {
    return NextResponse.json({ ok: true, checked_at: checkedAt, results })
  }

  // Alert, then fail. The email is best-effort: if it throws we still return
  // non-200, because the red cron is the signal that must not depend on Resend.
  let emailed = false
  let emailError: string | null = null
  try {
    const result = await sendAdminNoticeEmail({
      to: FRESHNESS_ALERT_EMAIL,
      name: 'DropMarket ops',
      subject: `[DropMarket] SAB pricing data is stale (${stale
        .map((r) => r.table)
        .join(', ')})`,
      bodyText: buildAlertBody(stale, checkedAt),
    })
    emailed = result.success === true
    if (!result.success) {
      emailError = String((result as { error?: unknown }).error ?? 'send failed')
    }
  } catch (error: any) {
    emailError = error?.message ?? String(error)
  }

  console.error(
    `check-sab-freshness: ${stale.length} stale hop(s):`,
    stale.map((r) => `${r.table}.${r.column}=${r.ageHours ?? 'none'}h`).join(' '),
  )

  return NextResponse.json(
    {
      ok: false,
      error: 'SAB pricing data is stale',
      checked_at: checkedAt,
      stale: stale.map((r) => r.table),
      alert_emailed: emailed,
      ...(emailError ? { alert_email_error: emailError } : {}),
      results,
    },
    { status: 500 },
  )
}

export async function POST(request: NextRequest) {
  return GET(request)
}
