import { revalidateTag } from 'next/cache'

import { createServiceRoleClient } from '@/lib/supabase/service'
import { valueItemPriceTag } from '@/lib/values/revalidation'

import { refreshValueEvidence, type RefreshResult } from './refresh'

/**
 * Run the evidence refresh for a game from a route (price publish, snapshot
 * cron, nightly backstop): service role, item pages revalidated by their price
 * tag. Never throws — a failed refresh is logged and must not fail the price
 * publish that called it; the nightly cron re-runs it.
 */
export async function runEvidenceRefresh(gameSlug: string): Promise<RefreshResult | null> {
  try {
    return await refreshValueEvidence(createServiceRoleClient(), gameSlug, {
      revalidateItem: (game, item) => revalidateTag(valueItemPriceTag(game, item)),
    })
  } catch (e) {
    console.error(`[seo-gate] evidence refresh failed for ${gameSlug} (non-fatal):`, e)
    return null
  }
}
