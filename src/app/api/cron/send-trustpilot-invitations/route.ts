/**
 * Trustpilot invites cron — daily 09:00 UTC (vercel.json).
 *
 * The order-complete receipt carries the Trustpilot BCC for qualifying orders
 * (src/lib/trustpilot/invite.ts). This run picks up what the completion path
 * missed or what failed, records every outcome on trustpilot_invitations, and
 * posts a Discord ops alert when an invite has failed two days in a row
 * (src/lib/trustpilot/cron.ts).
 */
import { NextRequest, NextResponse } from 'next/server'

import { isCronAuthorized } from '@/lib/security/cron-auth'
import { runInviteCron } from '@/lib/trustpilot/cron'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // PAY-020: constant-time bearer compare, fails closed when CRON_SECRET is unset.
  if (!isCronAuthorized(request.headers)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const summary = await runInviteCron()
    console.log('[trustpilot-cron]', JSON.stringify(summary))
    return NextResponse.json({ success: true, ...summary })
  } catch (error: any) {
    console.error('[trustpilot-cron] failed:', error)
    return NextResponse.json({ error: 'Internal server error', details: error?.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
