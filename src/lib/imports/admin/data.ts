import 'server-only'

/**
 * Step 4 — server-side reads shared by the import actions: a game's catalogue
 * and prices, the pair's live attribute template, batch counts and the live
 * state of the listings a batch applied. Service-role client in, plain data
 * out; no auth here — every caller is an action that ran `requireAdmin()`.
 */
import { createServiceRoleClient } from '@/lib/supabase/service'
import { fetchAllRows } from '@/lib/db/fetch-all'
import { listingOwnerUrl } from '@/lib/listings/url'
import { getAttributeTemplateFull } from '@/lib/actions/new-schema'
import type { ResolvedRow } from '@/lib/imports/resolve'
import type { TemplateAttributeLike } from '@/lib/imports/attributes'
import type { GameImportConfig, ImportCatalogue, MarketPriceMap } from '@/lib/imports/types'
import type { AppliedListingView, BatchSummaryRow } from './types'

/** Load a game's catalogue + prices once, with its config. */
export async function loadGameData(
  svc: ReturnType<typeof createServiceRoleClient>,
  config: GameImportConfig,
  gameId: string,
): Promise<{ catalogue: ImportCatalogue; prices: MarketPriceMap; aliases: Array<{ alias: string; itemRef: string }> }> {
  const [catalogue, prices, aliasRows] = await Promise.all([
    config.loadCatalogue(svc as never, gameId),
    config.loadMarketPrices(svc as never, gameId),
    // Paged — taught aliases only ever grow.
    fetchAllRows((from, to) =>
      svc.from('listing_import_aliases').select('alias, item_ref').eq('game_id', gameId).order('id').range(from, to),
    ),
  ])
  const aliases = ((aliasRows.data ?? []) as Array<{ alias: string; item_ref: string }>).map((a) => ({
    alias: a.alias,
    itemRef: a.item_ref,
  }))
  return { catalogue, prices, aliases }
}

/**
 * The live attribute template for the pair, as the items page's filters read it.
 * An empty list (no template, or a read failure) means nothing is filterable,
 * which the resolver treats as "nothing to fill" rather than an error.
 */
export async function loadTemplateAttributes(gameCategoryId: string): Promise<TemplateAttributeLike[]> {
  const res = await getAttributeTemplateFull(gameCategoryId)
  if (!res.success || !res.data) return []
  return (res.data.attributes ?? []).map((a) => ({
    id: a.id,
    slug: a.slug,
    name: a.name,
    type: a.type,
    options: (a.options ?? []).map((o) => ({ slug: o.slug, value: o.value, label: o.label })),
    // The wizard's show/hide rules (Pet Name only when Item Type = pets).
    conditional_rules: (a.conditional_rules ?? []).map((r) => ({
      trigger_attribute_id: r.trigger_attribute_id,
      operator: r.operator,
      trigger_values: (r.trigger_values ?? []) as string[],
    })),
  }))
}

export function rowToDbPayload(batchId: string, row: ResolvedRow) {
  return {
    batch_id: batchId,
    row_no: row.rowNo,
    raw: row.raw,
    match_status: row.status,
    item_ref: row.itemRef,
    item_name: row.itemName,
    variant_ref: row.variantRef,
    variant_label: row.variantLabel,
    quantity: row.quantity,
    price_mode: row.priceMode,
    price_input: row.priceInput,
    resolved_price: row.resolvedPrice,
    market_price: row.marketPrice,
    image_url: row.imageUrl,
    candidates: row.candidates,
    template_data: row.templateData,
    error: row.error ?? row.warning,
  }
}

/** Counts come from the rows, never from a stored counter that could drift. */
export async function countsFor(svc: ReturnType<typeof createServiceRoleClient>, b: any): Promise<BatchSummaryRow> {
  // Paged: a batch holds up to MAX_INPUT_ROWS (2,000) rows, and an unpaged read
  // stops at 1,000 — every count past that would silently be wrong.
  const { data } = await fetchAllRows((from, to) =>
    svc.from('listing_import_rows').select('match_status, action').eq('batch_id', b.id).order('id').range(from, to),
  )
  const rows = (data ?? []) as Array<{ match_status: string; action: string | null }>
  // A GET count (head:false) — HEAD counts break keep-alive on this client.
  const { count: live } = await svc
    .from('listings')
    .select('id', { count: 'exact', head: false })
    .eq('import_batch_id', b.id)
    .eq('status', 'active')
    .limit(1)
  const game = Array.isArray(b.games) ? b.games[0] : b.games
  const seller = Array.isArray(b.profiles) ? b.profiles[0] : b.profiles
  return {
    id: b.id,
    label: b.label,
    status: b.status,
    gameSlug: game?.slug ?? '',
    gameName: game?.name ?? '',
    sellerName: seller?.shop_name || seller?.username || '—',
    pricingMode: b.pricing_mode,
    undercutPct: Number(b.undercut_pct ?? 0),
    rowCount: b.row_count ?? rows.length,
    matched: rows.filter((r) => r.match_status === 'matched').length,
    applied: rows.filter((r) => r.action === 'created' || r.action === 'updated').length,
    live: live ?? 0,
    failed: rows.filter((r) => r.action === 'failed').length,
    needsReview: rows.filter((r) => r.match_status === 'ambiguous' || r.match_status === 'unmatched').length,
    createdAt: b.created_at,
    appliedAt: b.applied_at,
  }
}

/**
 * The listings a batch's rows point at, read live — so an updated row shows
 * the listing's real title and image (it keeps its original copy on
 * re-import), and a paused or removed batch shows that state. In slices: a
 * batch can point at up to 2,000 listings, too many ids for one request URL.
 */
const LIVE_SLICE = 100

export async function loadAppliedListings(
  svc: ReturnType<typeof createServiceRoleClient>,
  listingIds: string[],
): Promise<Map<string, AppliedListingView>> {
  const out = new Map<string, AppliedListingView>()
  const ids = [...new Set(listingIds)]
  for (let i = 0; i < ids.length; i += LIVE_SLICE) {
    const { data } = await svc
      .from('listings')
      .select(
        'id, slug, status, title, images, price, quantity, game:games!listings_game_id_fkey(slug), category:game_categories!listings_game_category_id_fkey(slug, type)',
      )
      .in('id', ids.slice(i, i + LIVE_SLICE))
    for (const l of (data ?? []) as any[]) {
      const game = Array.isArray(l.game) ? l.game[0] : l.game
      const category = Array.isArray(l.category) ? l.category[0] : l.category
      out.set(l.id, {
        title: l.title ?? '',
        status: l.status,
        price: Number(l.price),
        quantity: Number(l.quantity ?? 0),
        imageUrl: Array.isArray(l.images) && typeof l.images[0] === 'string' ? l.images[0] : null,
        href: listingOwnerUrl({ id: l.id, slug: l.slug, status: l.status, game, category }),
      })
    }
  }
  return out
}
