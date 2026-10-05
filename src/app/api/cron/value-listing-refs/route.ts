import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { isCronAuthorized } from '@/lib/security/cron-auth'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { revalidateListingSurfaces } from '@/lib/revalidation/listings'
import { reconcileValueRefs } from '@/lib/value-listings/link'
import { VALUE_CATALOG_GAMES } from '@/lib/value-listings/catalogs'
import { valueItemStockTag, valueStockTag } from '@/lib/value-listings/stock-server'

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
  const startedAt = new Date().toISOString()
  const out = await reconcileValueRefs(service, { limit: 5000 })
  // Re-check every active listing too: a link stored before its item existed
  // (e.g. "Fairy Bat Dragon NFR" linked to bat-dragon before the pet was in
  // the catalogue) or before the matcher tightened is corrected here. Only
  // rows whose link changes are written.
  const relinkOut = await reconcileValueRefs(service, { limit: 5000, relink: true })
  out.errors.push(...relinkOut.errors)
  out.gameCategoryIds = [...new Set([...out.gameCategoryIds, ...relinkOut.gameCategoryIds])]
  // Item pages whose stock changed (old + new item of every moved link).
  const changedItemTags = new Set(
    [...out.changedItems, ...relinkOut.changedItems].map((c) => valueItemStockTag(c.gameSlug, c.itemSlug)),
  )
  for (const tag of changedItemTags) revalidateTag(tag)

  // Item pages read a per-ITEM stock slice (T1): name the items this run
  // linked, so those pages — and only those — pick the listings up. Resolved
  // through the seam by listing id (it maps each listing to its category and
  // its value item). The per-game tag below no longer reaches item pages.
  let linkedIds: string[] = []
  if (out.linked > 0) {
    const { data, error } = await (service as any)
      .from('listings')
      .select('id')
      .gte('value_matched_at', startedAt)
      .not('value_item_slug', 'is', null)
      .limit(5000)
    if (error) console.error('[value-listing-refs] linked-listing read failed', error.message)
    linkedIds = ((data ?? []) as Array<{ id: string }>).map((r) => r.id)
  }

  if (out.gameCategoryIds.length || linkedIds.length) {
    await revalidateListingSurfaces(service as never, {
      gameCategoryIds: out.gameCategoryIds,
      listingIds: linkedIds,
    })
  }
  // Per-GAME stock reads (calculator, item listings pages) — a handful of
  // pages per game, not the ~500 item pages.
  for (const game of VALUE_CATALOG_GAMES) revalidateTag(valueStockTag(game))

  return NextResponse.json({
    ok: out.errors.length === 0,
    checked: out.checked,
    linked: out.linked,
    relinked: relinkOut.relinked,
    item_pages_refreshed_for: linkedIds.length,
    item_stock_tags_refreshed: changedItemTags.size,
    unmatched: out.unmatched.length,
    errors: out.errors.slice(0, 20),
    ran_at: new Date().toISOString(),
  })
}
