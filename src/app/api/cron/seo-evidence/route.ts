import { NextRequest, NextResponse } from 'next/server'

import { isCronAuthorized } from '@/lib/security/cron-auth'
import { runEvidenceRefresh } from '@/lib/seo/gate/run'
import { VALUE_EVIDENCE_GAMES } from '@/lib/seo/gate/refresh'

/**
 * Nightly backstop for the value-page data gate: refresh seo_value_evidence
 * for every game with value pages. The price publish (values-revalidate) and
 * the SAB snapshot already refresh their game; this catches a game whose job
 * did not run, grows `history_days` on quiet days, and picks up the daily
 * Google check's protected flags. Idempotent.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request.headers)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const results = []
  for (const game of VALUE_EVIDENCE_GAMES) {
    const r = await runEvidenceRefresh(game)
    results.push(r ? { game, items: r.items, moved: r.moved.length, gate_flips: r.flipped.length } : { game, error: 'refresh failed (see logs)' })
  }
  return NextResponse.json({ ok: results.every((r) => !('error' in r)), results, at: new Date().toISOString() })
}

export const POST = GET
