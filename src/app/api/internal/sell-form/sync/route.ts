import { revalidateTag } from 'next/cache'
import { authorizeInternalRequest, internalJson } from '@/lib/security/internal-route-auth'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { CATALOGUE_GAMES } from '@/lib/catalogue/registry'
import { findSellFormConfig } from '@/lib/catalogue/sell-form/config'
import { syncMessage, syncSellForm } from '@/lib/catalogue/sell-form/run'
import { linkListingsToValueItems } from '@/lib/value-listings/link'
import { revalidateGameCategorySurfaces, revalidateListingSurfaces } from '@/lib/revalidation/listings'
import { SELL_TEMPLATE_TAG } from '@/lib/sell/template-tags'
import { postOpsAlert } from '@/lib/ops/discord-alert'

// Literals, not re-exports: Next reads these statically at build time.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
/** The MM2 cutover writes ~30 fields and ~1,100 options in batches of 500; daily runs write a handful. */
export const maxDuration = 60

/**
 * POST /api/internal/sell-form/sync?game=<slug>[&dry=1][&allowLarge=1]
 * x-values-revalidate-secret: $VALUES_REVALIDATE_SECRET
 *
 * Derives the game's items form (Item Type → Rarity → Item) from its values
 * catalogue and moves listings' answers along with their item
 * (lib/catalogue/sell-form). Runs here, not in the CLI, because a repair must
 * re-link value items and refresh the listing pages, and a form change must
 * refresh the seller form and the market filters (all next/cache). Called by
 * the daily catalogue workflow after each game's run. A game with no config
 * is a no-op, so the workflow can call it for every game.
 */
export async function POST(request: Request): Promise<Response> {
  const auth = await authorizeInternalRequest(request, {
    header: 'x-values-revalidate-secret',
    secret: process.env.VALUES_REVALIDATE_SECRET,
  })
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const key = url.searchParams.get('game') ?? ''
  // The workflow passes its matrix key ("sab"); a slug works too.
  const entry = CATALOGUE_GAMES.find((g) => g.key === key || g.adapter.gameSlug === key)
  const game = entry?.adapter.gameSlug ?? key
  const config = findSellFormConfig(game)
  if (!config) return internalJson({ ok: true, skipped: 'no sell-form config for this game' })
  const write = url.searchParams.get('dry') !== '1'

  const db = createServiceRoleClient()
  try {
    const { report } = await syncSellForm(
      config,
      {
        db,
        afterRepairs: async (ids) => {
          await linkListingsToValueItems(db, ids)
          await revalidateListingSurfaces(db as never, { listingIds: ids })
        },
        afterFormChange: async ({ gameId }) => {
          revalidateTag(SELL_TEMPLATE_TAG)
          await revalidateGameCategorySurfaces(db as never, gameId)
        },
      },
      { write, allowLarge: url.searchParams.get('allowLarge') === '1' },
    )
    const text = syncMessage(entry?.name ?? game, report)
    if (text && write) await postOpsAlert(text)
    return internalJson({ ok: report.status !== 'failed', report }, report.status === 'blocked' ? 409 : 200)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[sell-form/sync]', game, message)
    await postOpsAlert(`❌ **${game}** sell form sync failed: ${message}`)
    return internalJson({ ok: false, error: message }, 500)
  }
}
