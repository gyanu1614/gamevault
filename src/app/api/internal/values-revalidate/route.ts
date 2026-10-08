import { revalidatePath, revalidateTag } from 'next/cache'
import {
  authorizeInternalRequest,
  internalJson,
} from '@/lib/security/internal-route-auth'
import { CONTENT_HUB_GAME_SLUGS, hasHubPage } from '@/lib/content/theme'
import {
  parseChangedSlugs,
  valueGamePriceTag,
  valueItemPriceTag,
  valuesTag,
} from '@/lib/values/revalidation'
import { submitChangedValuePages } from '@/lib/seo/indexnow'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

/**
 * The ONE revalidation contract for every value game's pricing run (T1,
 * 2026-10-04). The runner (scripts/reprice.mjs --publish) diffs the prices the
 * pages show against the last published snapshot, with the shared threshold
 * (src/lib/pricing/change-rule.ts: |Δ| > max(3%, $0.05)), and sends ONLY the
 * items that moved:
 *
 *   POST /api/internal/values-revalidate?game=<slug>
 *   x-values-revalidate-secret: $VALUES_REVALIDATE_SECRET
 *   { "changedSlugs": ["owl", "frost-dragon"] }
 *
 *   • each changed item  → revalidateTag(price:<game>:<item>) — that page only
 *   • any item changed   → revalidateTag(price:<game>), the tag every LIST
 *                          read carries (values hub, calculator, neon
 *                          calculator, price index, methodology, blog hub,
 *                          SAB landing), plus the list paths. No item page
 *                          carries price:<game> (lib/values/revalidation.ts).
 *   • nothing changed    → nothing revalidated (logged). The common case.
 *
 * The tags reach the DATA, not only the page shell: every values read is
 * cached under exactly these tags by the tagged read client
 * (lib/values/read-client.ts). Before 2026-10-05 the reads were cached
 * untagged, so a tag-triggered re-render reused the old responses.
 *
 * `?full=1` (same auth) is the manual escape hatch: the whole-game
 * `values:<game>` tag (carried by EVERY values read, item and list) plus
 * every hub path — what every run did before T1, at
 * ~50 ISR write units per item page. Use it after a catalogue edit or a
 * pricing-model change, not on a schedule.
 *
 * A request with neither is a 400, so an old caller can never silently turn
 * into a whole-game refresh again (or into a no-op).
 *
 * Auth: the shared internal-route helper (rate limit → configured-secret check
 * → constant-time compare).
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  const auth = await authorizeInternalRequest(request, {
    header: 'x-values-revalidate-secret',
    secret: process.env.VALUES_REVALIDATE_SECRET,
  })
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const gameSlug = url.searchParams.get('game')?.trim() ?? ''

  if (!gameSlug || !CONTENT_HUB_GAME_SLUGS.includes(gameSlug)) {
    return internalJson(
      { ok: false, error: 'Unknown or missing ?game=<slug>' },
      400,
    )
  }

  const full = url.searchParams.get('full') === '1'
  let changedSlugs: string[] | null = null
  if (!full) {
    let body: unknown = null
    try {
      body = await request.json()
    } catch {
      // No / non-JSON body — handled below.
    }
    changedSlugs = parseChangedSlugs(body)
    if (changedSlugs === null) {
      return internalJson(
        {
          ok: false,
          error:
            'Send {"changedSlugs": [...]} (the items whose price moved), or ?full=1 for a whole-game refresh',
        },
        400,
      )
    }
  }

  const revalidated: string[] = []
  const listPaths = (): void => {
    if (hasHubPage(gameSlug, 'values')) {
      revalidatePath(`/${gameSlug}/values`)
      revalidated.push(`/${gameSlug}/values`)
      // The full list the page fetches after hydration (lib/values/lazy-list.ts).
      revalidatePath(`/${gameSlug}/values/rows.json`)
      revalidated.push(`/${gameSlug}/values/rows.json`)
    }
    if (hasHubPage(gameSlug, 'calculator')) {
      revalidatePath(`/${gameSlug}/calculator`)
      revalidated.push(`/${gameSlug}/calculator`)
    }
    if (hasHubPage(gameSlug, 'priceIndex')) {
      revalidatePath(`/${gameSlug}/price-index`)
      revalidated.push(`/${gameSlug}/price-index`)
    }
  }

  if (full) {
    listPaths()
    if (hasHubPage(gameSlug, 'values')) {
      // Every item page of THIS game, by tag. Not by path: the concrete
      // '/<game>/values/[itemSlug]' matches nothing, and the route pattern
      // drops every game's pages.
      revalidateTag(valuesTag(gameSlug))
      revalidated.push(valuesTag(gameSlug))
    }
    if (hasHubPage(gameSlug, 'methodology')) {
      // Quotes live counts; refreshed on a full pass, else its 24 h window.
      revalidatePath(`/${gameSlug}/values/methodology`)
      revalidated.push(`/${gameSlug}/values/methodology`)
    }
  } else if (changedSlugs && changedSlugs.length > 0) {
    for (const slug of changedSlugs) {
      const tag = valueItemPriceTag(gameSlug, slug)
      revalidateTag(tag)
      revalidated.push(tag)
    }
    // The lists rank every item by price: their reads carry the game price
    // tag (item pages never do, so this rebuilds no item page).
    revalidateTag(valueGamePriceTag(gameSlug))
    revalidated.push(valueGamePriceTag(gameSlug))
    listPaths()
  } else {
    console.log(`[values-revalidate] ${gameSlug}: 0 changed items — nothing revalidated`)
  }

  const changedCount = full ? null : (changedSlugs?.length ?? 0)

  // IndexNow: submit only the value pages whose cash value really moved against
  // the game's previous daily snapshot. Skipped when nothing moved past the
  // publish threshold (IndexNow's own bar is higher: 5% / $0.25). Steal a
  // Brainrot is left to its own daily snapshot cron, which runs the same
  // comparison. Production only, never throws.
  const indexNowChanged =
    gameSlug === 'steal-a-brainrot' || changedCount === 0
      ? 0
      : await submitChangedValuePages(createServiceRoleClient(), gameSlug)

  return internalJson({
    ok: true,
    game: gameSlug,
    mode: full ? 'full' : 'changed-items',
    changed_count: changedCount,
    revalidated,
    indexnow_changed: indexNowChanged,
    revalidated_at: new Date().toISOString(),
  })
}
