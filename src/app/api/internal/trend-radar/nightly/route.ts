import { SITE_URL } from '@/config/site'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { loadConfig } from '@/lib/trend-radar/config'
import { runNightly } from '@/lib/trend-radar/nightly'
import { guard, internalJson } from '../_shared'

// Literals, not re-exports: Next reads these statically at build time.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
/** Precedent: expire-sab-listings. Collect is ~10 s; prepare can fetch icons and wikis. */
export const maxDuration = 300

/**
 * POST /api/internal/trend-radar/nightly
 *
 * Rolls raw metrics past the retention window into game_metrics_daily and
 * prunes them; flags approved trend-radar games that have decayed as
 * `declining` (one admin notification, nothing deactivated).
 */
export async function POST(request: Request): Promise<Response> {
  const denied = await guard(request)
  if (denied) return denied

  try {
    const summary = await runNightly({ db: createServiceRoleClient(), config: loadConfig(), siteUrl: SITE_URL })
    return internalJson({ ok: true, ...summary, ran_at: new Date().toISOString() })
  } catch (error) {
    console.error('[trend-radar/nightly]', error)
    return internalJson({ ok: false, error: error instanceof Error ? error.message : 'nightly failed' }, 500)
  }
}
