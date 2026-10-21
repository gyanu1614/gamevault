import { NextRequest, NextResponse } from 'next/server'

import { isCronAuthorized } from '@/lib/security/cron-auth'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { bingApiFromEnv } from '@/lib/seo/bing/api'
import { runBingSync } from '@/lib/seo/bing/sync'
import { supabaseBingStore } from '@/lib/seo/bing/store'
import { readSeoReport } from '@/lib/seo/report'
import { weeklyMessage } from '@/lib/seo/weekly'
import { postSeoMessage } from '@/lib/seo/gsc/notify'

/**
 * Once a day (vercel.json): pull Bing Webmaster data into the small seo_bing_*
 * tables that /admin/seo reads — four API calls, a few hundred row upserts.
 * On Thursdays (or ?weekly=1) it also posts the weekly SEO check to
 * #seo-alerts, built from the same tables. No Bing key → the sync is skipped
 * and the weekly post still goes out with Google's numbers.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request.headers)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const db = createServiceRoleClient()
  const now = new Date()

  let bing: Record<string, unknown>
  const api = bingApiFromEnv()
  if (!api) {
    bing = { skipped: 'BING_WEBMASTER_API_KEY not set' }
  } else {
    try {
      bing = { ok: true, ...(await runBingSync(api, supabaseBingStore(db), now)) }
    } catch (e) {
      console.error('[seo-bing] sync failed:', (e as Error).message)
      bing = { ok: false, error: (e as Error).message }
    }
  }

  const weekly = new URL(request.url).searchParams.get('weekly') === '1' || now.getUTCDay() === 4
  let posted: boolean | null = null
  if (weekly) {
    const report = await readSeoReport(db)
    const weekEnding = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
    posted = await postSeoMessage(weeklyMessage(report.weekly, weekEnding))
  }
  return NextResponse.json({ ok: true, bing, weekly: weekly ? { posted } : 'not today' })
}
