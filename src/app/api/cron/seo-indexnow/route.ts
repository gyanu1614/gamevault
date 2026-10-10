import { NextRequest, NextResponse } from 'next/server'

import { isCronAuthorized } from '@/lib/security/cron-auth'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { isProductionDeployment } from '@/lib/env/deployment'
import { recordUrlEvents, sendDueEvents, supabaseUrlEventStore } from '@/lib/seo/events/log'
import { runPostDeployStep } from '@/lib/seo/events/deploy'
import { loadSitemapSections } from '@/lib/seo/sitemap-sections'

/**
 * Hourly (.github/workflows/seo-hourly.yml; vercel.json daily is the backstop):
 * deliver the SEO change log to IndexNow.
 *
 *  1. Post-deploy step (first run of a new deployment): pages whose date lives
 *     in code and moved since the last diff are logged (lib/seo/events/deploy).
 *  2. The due rows of seo_url_events go out, each URL once, 100 per request;
 *     a failed request is retried with backoff (5 min → 1 day), a 422 or the
 *     6th failure is marked `failed` and shows on /admin/seo.
 *
 * Production only (a preview must not advertise canonical URLs). Auth: the
 * CRON_SECRET bearer every cron uses; unset → 401.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request.headers)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const db = createServiceRoleClient()
  const store = supabaseUrlEventStore(db)
  const now = new Date().toISOString()
  const production = isProductionDeployment()

  let deployLogged: number | null = null
  let deployError: string | null = null
  if (production) {
    try {
      deployLogged = await runPostDeployStep(db, {
        // Vercel system vars; either identifies the deployment.
        deployId: process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA,
        now,
        loadSections: loadSitemapSections,
        record: (urls, reason) => recordUrlEvents(urls, reason, { store }),
      })
    } catch (e) {
      // The send below must still run.
      deployError = (e as Error).message
      console.error('[seo-indexnow] post-deploy step failed:', e)
    }
  }

  try {
    const sent = await sendDueEvents({ store, now, production })
    return NextResponse.json({ ok: true, deploy_logged: deployLogged, deploy_error: deployError, ...sent, at: now })
  } catch (e) {
    console.error('[seo-indexnow] send failed:', e)
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}

export const POST = GET
