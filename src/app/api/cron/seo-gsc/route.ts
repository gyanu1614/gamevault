import { NextRequest, NextResponse } from 'next/server'

import { isCronAuthorized } from '@/lib/security/cron-auth'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { loadSitemapSections } from '@/lib/seo/sitemap-sections'
import { runDailyGscCheck } from '@/lib/seo/gsc/daily'
import { supabaseGscStore } from '@/lib/seo/gsc/store'
import { gscApiFromEnv, isQuotaError } from '@/lib/seo/gsc/runtime'
import { postSeoAlerts } from '@/lib/seo/gsc/notify'

/**
 * The daily Google check (lib/seo/gsc/daily): URL Inspection for the pages
 * changed in the last 72 h plus a rotating sample (capped at 1,500 a day, under
 * Google's 2,000), Search Analytics per page and per section, the day's index
 * rate per section, and Discord alerts. Read-only against Google
 * (webmasters.readonly). One run inspects what fits in ~4 minutes; the next
 * run continues where it stopped (hourly: .github/workflows/seo-hourly.yml;
 * the vercel.json daily entry is the backstop).
 *
 * `?test-alert=1` posts a clearly labelled test message to the SEO webhook.
 * Auth: the CRON_SECRET bearer; unset → 401.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request.headers)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (new URL(request.url).searchParams.get('test-alert') === '1') {
    const posted = await postSeoAlerts([
      { kind: 'indexed-page-dropped', url: null, section: null, message: 'TEST — not a real alert: the SEO webhook works', details: {} },
    ])
    return NextResponse.json({ ok: posted, test: true })
  }

  let api
  try {
    api = gscApiFromEnv()
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
  if (!api) {
    console.warn('[seo-gsc] GSC_SERVICE_ACCOUNT_KEY_B64 is not set — skipped')
    return NextResponse.json({ ok: false, skipped: 'GSC_SERVICE_ACCOUNT_KEY_B64 is not set' })
  }

  try {
    const sections = await loadSitemapSections()
    const sitemap = new Map([...sections].map(([section, entries]) => [section as string, entries.map((e) => e.url)]))
    const summary = await runDailyGscCheck({
      store: supabaseGscStore(createServiceRoleClient()),
      api,
      sitemap,
      now: new Date(),
      budgetMs: 240_000,
      concurrency: 8,
      notify: (alerts) => postSeoAlerts(alerts),
      isQuotaError,
    })
    return NextResponse.json({
      ok: true,
      inspected: summary.inspected,
      inspection_errors: summary.inspectionErrors,
      quota_exhausted: summary.quotaExhausted,
      search_synced: summary.searchSynced,
      alerts: summary.alerts.length,
      posted: summary.posted,
      sections: summary.sections,
    })
  } catch (e) {
    console.error('[seo-gsc] failed:', e)
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}

export const POST = GET
