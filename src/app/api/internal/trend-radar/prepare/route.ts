import { SITE_URL } from '@/config/site'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { loadConfig } from '@/lib/trend-radar/config'
import { runPrepare } from '@/lib/trend-radar/prepare'
import { guard, internalJson, isDry } from '../_shared'

// Literals, not re-exports: Next reads these statically at build time.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
/** Precedent: expire-sab-listings. Collect is ~10 s; prepare can fetch icons and wikis. */
export const maxDuration = 300

/**
 * POST /api/internal/trend-radar/prepare[?dry=1]
 *
 * Turns unhandled events into pending games (row, external id, category
 * templates, icon, draft taxonomy, one Discord alert). Idempotent-repair:
 * safe to call any number of times. `dry=1` returns what it would create and
 * the Discord payloads it would send, and writes nothing.
 */
export async function POST(request: Request): Promise<Response> {
  const denied = await guard(request)
  if (denied) return denied

  try {
    const summary = await runPrepare({
      db: createServiceRoleClient(),
      config: loadConfig(),
      siteUrl: SITE_URL,
      webhookUrl: process.env.DISCORD_TREND_RADAR_WEBHOOK_URL ?? null,
      dryRun: isDry(request),
    })
    return internalJson({ ok: true, ...summary, ran_at: new Date().toISOString() })
  } catch (error) {
    console.error('[trend-radar/prepare]', error)
    return internalJson({ ok: false, error: error instanceof Error ? error.message : 'prepare failed' }, 500)
  }
}
