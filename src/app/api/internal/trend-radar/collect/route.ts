import { createServiceRoleClient } from '@/lib/supabase/service'
import { loadConfig } from '@/lib/trend-radar/config'
import { runCollect } from '@/lib/trend-radar/collect'
import { guard, internalJson, isDry } from '../_shared'

// Literals, not re-exports: Next reads these statically at build time.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
/** Precedent: expire-sab-listings. Collect is ~10 s; prepare can fetch icons and wikis. */
export const maxDuration = 300

/**
 * POST /api/internal/trend-radar/collect[?dry=1][&rmt=1]
 *
 * Discovery + metrics + signals. `rmt=1` also runs the weekly Eldorado chart
 * diff (the workflow passes it on Mondays). `dry=1` evaluates and writes
 * nothing.
 */
export async function POST(request: Request): Promise<Response> {
  const denied = await guard(request)
  if (denied) return denied

  const url = new URL(request.url)
  const includeRmt = url.searchParams.get('rmt') === '1'
  try {
    const summary = await runCollect({
      db: createServiceRoleClient(),
      config: loadConfig(),
      includeRmt,
      dryRun: isDry(request),
    })
    return internalJson({ ...summary, ran_at: new Date().toISOString() })
  } catch (error) {
    console.error('[trend-radar/collect]', error)
    return internalJson({ ok: false, error: error instanceof Error ? error.message : 'collect failed' }, 500)
  }
}
