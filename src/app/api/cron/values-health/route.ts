/**
 * Daily values health (Vercel cron): every hub game's catalogue, pricing and
 * value list in one Discord post when anything is wrong (src/lib/values/health.ts).
 * 500 when there are problems, so the cron shows red in Vercel too.
 */
import { NextRequest, NextResponse } from 'next/server'

import { postOpsAlert } from '@/lib/ops/discord-alert'
import { isCronAuthorized } from '@/lib/security/cron-auth'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { evaluateGameHealth, healthMessage, readGameHealth, VALUES_HEALTH_GAMES, type HealthProblem } from '@/lib/values/health'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request.headers)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Service role: a Vercel cron request has no cookies (CLAUDE.md).
  const db = createServiceRoleClient()
  const now = Date.now()
  const problems: HealthProblem[] = []
  for (const game of VALUES_HEALTH_GAMES) {
    problems.push(...evaluateGameHealth(game, await readGameHealth(db as any, game), now))
  }
  const text = healthMessage(problems)
  const posted = text ? await postOpsAlert(text) : false
  return NextResponse.json({ ok: problems.length === 0, problems, posted }, { status: problems.length ? 500 : 200 })
}
