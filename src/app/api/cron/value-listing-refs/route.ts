import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { isCronAuthorized } from '@/lib/security/cron-auth'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { revalidateListingSurfaces } from '@/lib/revalidation/listings'
import { reconcileValueRefs } from '@/lib/value-listings/link'
import { VALUE_CATALOG_GAMES } from '@/lib/value-listings/catalogs'
import { valueStockTag } from '@/lib/value-listings/stock-server'

/**
 * Nightly safety net for the listing → value item link (Bundle 2).
 *
 * Every create/edit path links through `linkListingsToValueItems`; this links
 * whatever is still waiting (`value_matched_at IS NULL`: a failed link, a DB-
 * side edit the trigger cleared, rows from before the migration), then marks
 * the value stock stale so value pages and item listings pages pick it up.
 * Also the production backfill: call it once after the migration is pushed.
 *
 * Auth: the same CRON_SECRET bearer every cron uses; unset → 401.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request.headers)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = createServiceRoleClient()
  const out = await reconcileValueRefs(service, { limit: 5000 })

  if (out.gameCategoryIds.length) {
    await revalidateListingSurfaces(service as never, { gameCategoryIds: out.gameCategoryIds })
  }
  for (const game of VALUE_CATALOG_GAMES) revalidateTag(valueStockTag(game))

  return NextResponse.json({
    ok: out.errors.length === 0,
    checked: out.checked,
    linked: out.linked,
    unmatched: out.unmatched.length,
    errors: out.errors.slice(0, 20),
    ran_at: new Date().toISOString(),
  })
}
