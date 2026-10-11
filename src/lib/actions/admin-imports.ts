'use server'

/**
 * Step 4 — admin bulk listing importer.
 *
 * Every action here is `requireAdmin()` first, then the service-role client: the
 * three `listing_import_*` tables have RLS on with zero policies, so a JWT
 * caller cannot reach them at all and this module is the only way in.
 *
 * The listings themselves are written through `@/lib/listings/create`, the same
 * seam the sell wizard uses — validated by `@/lib/listings/validate`, moderated
 * by the same DB triggers, revalidated through `@/lib/revalidation/listings`.
 * There is no second listing-creation path, and
 * `imports-use-publish-seam.guard.test.ts` pins that.
 *
 * Chunking: applying a batch is one call per CHUNK_SIZE rows so a 1,000-row
 * import cannot exceed a function's time limit. Image work happens inside the
 * chunk, cached per catalogue item.
 */
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/actions/admin-permissions'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { fetchAllRows } from '@/lib/db/fetch-all'
import { logAdminActivity } from '@/lib/admin/activity-log'
import { findEnabledGameCategory } from '@/lib/categories'
import { revalidateListingSurfaces } from '@/lib/revalidation/listings'
import { insertListing, type ListingsWriter } from '@/lib/listings/create'
import { validateListingWrite, validateListingPatch } from '@/lib/listings/validate'
import { linkListingsToValueItems } from '@/lib/value-listings/link'
import { listingOwnerUrl } from '@/lib/listings/url'
import { loadListingRuleContext } from '@/lib/listings/rule-context'
import { importConfigFor, importableGameSlugs } from '@/lib/imports/config'
import { parseImportInput } from '@/lib/imports/csv'
import { buildMatchIndex } from '@/lib/imports/match'
import { resolveRows, type ResolvedRow, type ResolveSummary } from '@/lib/imports/resolve'
import { createImageMaterialiser } from '@/lib/imports/images'
import { getAttributeTemplateFull } from '@/lib/actions/new-schema'
import { fillMissingAttributes, type TemplateAttributeLike } from '@/lib/imports/attributes'
import { BATCH_STATUS_FROM, reimportDecision } from '@/lib/imports/lifecycle'
import type { GameImportConfig, ImportCatalogue, MarketPriceMap } from '@/lib/imports/types'

type Result<T> = { success: true; data: T } | { success: false; error: string }

/**
 * Rows per apply call.
 *
 * Measured on the local stack (2026-09-29): the first item of a run costs ~13 s
 * (sharp's native load plus the storage client warming up) and every item after
 * it ~1 s — a wiki lookup, a ~70 KB download, a ~25 ms encode and one upload.
 * 50 rows is therefore ~60 s worst case, well inside a Vercel function's limit,
 * and the client loops chunks until `remaining` is 0 so a 1,000-row batch is a
 * progress bar rather than one long request.
 *
 * NOT exported: a `'use server'` module may only export async functions, so a
 * const here fails the build (tsc does not catch it).
 */
const CHUNK_SIZE = 50

// ── shapes the UI reads ─────────────────────────────────────────────────────

export interface ImportableGame {
  id: string
  slug: string
  name: string
  itemNoun: string
  variantNoun: string | null
  categorySlug: string
  /** False when the (game, category) pair is not enabled in admin yet. */
  categoryEnabled: boolean
}

export interface StoreSellerOption {
  id: string
  username: string | null
  shopName: string | null
  tier: string | null
  activeListings: number
}

export interface BatchSummaryRow {
  id: string
  label: string | null
  status: string
  gameSlug: string
  gameName: string
  sellerName: string
  pricingMode: string
  undercutPct: number
  rowCount: number
  matched: number
  applied: number
  /** Listings this batch owns right now that are on sale (a later batch that
   *  re-imports a row takes it over; Pause / Remove take it off sale). */
  live: number
  failed: number
  needsReview: number
  createdAt: string
  appliedAt: string | null
}

export interface BatchDetail extends BatchSummaryRow {
  allowEstimated: boolean
  rows: BatchRowView[]
}

export interface BatchRowView {
  id: string
  rowNo: number
  status: string
  itemRef: string | null
  itemName: string | null
  variantRef: string | null
  variantLabel: string | null
  quantity: number | null
  priceMode: string | null
  resolvedPrice: number | null
  marketPrice: number | null
  imageUrl: string | null
  title: string | null
  candidates: Array<{ ref: string; name: string; score: number }>
  error: string | null
  action: string | null
  listingId: string | null
  /** The listing this row created or updated, as it is NOW (not as previewed). */
  listing: AppliedListingView | null
  raw: Record<string, string>
}

export interface AppliedListingView {
  title: string
  status: string
  price: number
  quantity: number
  imageUrl: string | null
  /** The live page when active, else the owner/admin preview. */
  href: string
}

// ── shared helpers ──────────────────────────────────────────────────────────

/** Load a game's catalogue + prices once, with its config. */
async function loadGameData(
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
async function loadTemplateAttributes(gameCategoryId: string): Promise<TemplateAttributeLike[]> {
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

function rowToDbPayload(batchId: string, row: ResolvedRow) {
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

// ── reads ───────────────────────────────────────────────────────────────────

/** The games that have an import config, with whether their category is live. */
export async function fetchImportableGames(): Promise<Result<ImportableGame[]>> {
  try {
    await requireAdmin()
    const svc = createServiceRoleClient()
    const slugs = importableGameSlugs()
    const { data, error } = await svc.from('games').select('id, slug, name').in('slug', slugs)
    if (error) return { success: false, error: error.message }

    const out: ImportableGame[] = []
    for (const g of (data ?? []) as Array<{ id: string; slug: string; name: string }>) {
      const config = importConfigFor(g.slug)
      if (!config) continue
      const pair = await findEnabledGameCategory(svc as never, g.id, config.categorySlug)
      out.push({
        id: g.id,
        slug: g.slug,
        name: g.name,
        itemNoun: config.itemNoun,
        variantNoun: config.variantNoun,
        categorySlug: config.categorySlug,
        categoryEnabled: !!pair,
      })
    }
    return { success: true, data: out.sort((a, b) => a.name.localeCompare(b.name)) }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Unknown error' }
  }
}

/** Seller accounts a batch can be imported on behalf of. */
export async function fetchStoreSellers(): Promise<Result<StoreSellerOption[]>> {
  try {
    await requireAdmin()
    const svc = createServiceRoleClient()
    const { data, error } = await svc
      .from('profiles')
      .select('id, username, shop_name, seller_tier')
      .eq('role', 'seller')
      .eq('seller_status', 'active')
      .order('shop_name')
    if (error) return { success: false, error: error.message }

    const sellers = (data ?? []) as Array<{ id: string; username: string | null; shop_name: string | null; seller_tier: string | null }>
    const counts = await Promise.all(
      sellers.map(async (s) => {
        const { count } = await svc
          .from('listings')
          .select('id', { count: 'exact', head: false })
          .eq('seller_id', s.id)
          .eq('status', 'active')
          .limit(1)
        return count ?? 0
      }),
    )
    return {
      success: true,
      data: sellers.map((s, i) => ({
        id: s.id,
        username: s.username,
        shopName: s.shop_name,
        tier: s.seller_tier,
        activeListings: counts[i],
      })),
    }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Unknown error' }
  }
}

export async function fetchImportBatches(): Promise<Result<BatchSummaryRow[]>> {
  try {
    await requireAdmin()
    const svc = createServiceRoleClient()
    const { data, error } = await svc
      .from('listing_import_batches')
      .select('id, label, status, pricing_mode, undercut_pct, row_count, created_at, applied_at, games!inner(slug, name), profiles!listing_import_batches_seller_id_fkey(username, shop_name)')
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) return { success: false, error: error.message }

    const batches = (data ?? []) as any[]
    const withCounts = await Promise.all(batches.map(async (b) => countsFor(svc, b)))
    return { success: true, data: withCounts }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Unknown error' }
  }
}

/** Counts come from the rows, never from a stored counter that could drift. */
async function countsFor(svc: ReturnType<typeof createServiceRoleClient>, b: any): Promise<BatchSummaryRow> {
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

export async function fetchImportBatch(batchId: string): Promise<Result<BatchDetail>> {
  try {
    await requireAdmin()
    const svc = createServiceRoleClient()
    const { data: batch, error } = await svc
      .from('listing_import_batches')
      .select('id, label, status, pricing_mode, undercut_pct, row_count, created_at, applied_at, allow_estimated, games!inner(slug, name), profiles!listing_import_batches_seller_id_fkey(username, shop_name)')
      .eq('id', batchId)
      .maybeSingle()
    if (error) return { success: false, error: error.message }
    if (!batch) return { success: false, error: 'That import batch no longer exists.' }

    const summary = await countsFor(svc, batch as any)
    // Paged, ordered by row_no — unique within a batch (unique (batch_id, row_no)).
    const { data: rowData } = await fetchAllRows((from, to) =>
      svc.from('listing_import_rows').select('*').eq('batch_id', batchId).order('row_no').range(from, to),
    )

    const live = await loadAppliedListings(
      svc,
      ((rowData ?? []) as any[]).map((r) => r.listing_id).filter(Boolean),
    )
    const rows: BatchRowView[] = ((rowData ?? []) as any[]).map((r) => ({
      id: r.id,
      rowNo: r.row_no,
      status: r.match_status,
      itemRef: r.item_ref,
      itemName: r.item_name,
      variantRef: r.variant_ref,
      variantLabel: r.variant_label,
      quantity: r.quantity,
      priceMode: r.price_mode,
      resolvedPrice: r.resolved_price == null ? null : Number(r.resolved_price),
      marketPrice: r.market_price == null ? null : Number(r.market_price),
      imageUrl: r.image_url,
      title: r.title ?? null,
      candidates: Array.isArray(r.candidates) ? r.candidates : [],
      error: r.error,
      action: r.action,
      listingId: r.listing_id,
      listing: (r.listing_id && live.get(r.listing_id)) || null,
      raw: r.raw ?? {},
    }))

    return { success: true, data: { ...summary, allowEstimated: (batch as any).allow_estimated === true, rows } }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Unknown error' }
  }
}

/**
 * The listings a batch's rows point at, read live — so an updated row shows
 * the listing's real title and image (it keeps its original copy on
 * re-import), and a paused or removed batch shows that state. In slices: a
 * batch can point at up to 2,000 listings, too many ids for one request URL.
 */
const LIVE_SLICE = 100

async function loadAppliedListings(
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

// ── create + preview ────────────────────────────────────────────────────────

export interface CreateBatchInput {
  sellerId: string
  gameId: string
  source: 'csv' | 'paste'
  label?: string | null
  pricingMode: 'auto' | 'explicit'
  undercutPct: number
  allowEstimated: boolean
  defaultQuantity?: number
  text: string
}

/**
 * Parse → match → price → store. Writes the batch and EVERY row, including the
 * ones that cannot become listings: that table is the review file.
 * Creates nothing in `listings` — that is `applyImportBatch`.
 */
export async function createImportBatch(
  input: CreateBatchInput,
): Promise<Result<{ batchId: string; summary: ResolveSummary; inputErrors: string[] }>> {
  try {
    const admin = await requireAdmin()
    const svc = createServiceRoleClient()

    const { data: game } = await svc.from('games').select('id, slug, name').eq('id', input.gameId).maybeSingle()
    if (!game) return { success: false, error: 'That game does not exist.' }
    const config = importConfigFor((game as any).slug)
    if (!config) return { success: false, error: `${(game as any).name} is not set up for importing yet.` }

    // AUTH-010 — the pair must be enabled before a batch can exist for it.
    const pair = await findEnabledGameCategory(svc as never, input.gameId, config.categorySlug)
    if (!pair) {
      return { success: false, error: `The "${config.categorySlug}" category is not enabled for ${(game as any).name}. Turn it on in Admin → Games first.` }
    }

    const parsed = parseImportInput(input.text)
    if (parsed.rows.length === 0) {
      return { success: false, error: parsed.errors[0] ?? 'There is nothing to import.' }
    }

    const [{ catalogue, prices, aliases }, templateAttributes] = await Promise.all([
      loadGameData(svc, config, input.gameId),
      loadTemplateAttributes(pair.id),
    ])
    const index = buildMatchIndex(catalogue, aliases)
    const { rows, summary } = resolveRows(parsed.rows, {
      config,
      index,
      prices,
      pricingMode: input.pricingMode,
      undercutPct: input.undercutPct,
      allowEstimated: input.allowEstimated,
      defaultQuantity: input.defaultQuantity,
      templateAttributes,
    })

    const { data: created, error: batchErr } = await (svc.from('listing_import_batches') as any)
      .insert({
        seller_id: input.sellerId,
        game_id: input.gameId,
        game_category_id: pair.id,
        source: input.source,
        status: 'previewed',
        pricing_mode: input.pricingMode,
        undercut_pct: input.undercutPct,
        allow_estimated: input.allowEstimated,
        label: input.label?.trim() || null,
        created_by: admin.userId,
        row_count: parsed.rows.length,
      })
      .select('id')
      .single()
    if (batchErr) return { success: false, error: batchErr.message }
    const batchId = (created as { id: string }).id

    // Store the generated copy alongside the row so the preview and the apply
    // cannot diverge, and so a reviewer sees the real title.
    const payload = rows.map((r) => ({ ...rowToDbPayload(batchId, r), title: r.title, description: r.description }))
    for (let i = 0; i < payload.length; i += 500) {
      const { error } = await (svc.from('listing_import_rows') as any).insert(payload.slice(i, i + 500))
      if (error) return { success: false, error: error.message }
    }

    await logAdminActivity({
      action: 'import_batch_previewed',
      actionCategory: 'system',
      resourceType: 'listing_import_batch',
      resourceId: batchId,
      resourceName: `${(game as any).name} — ${parsed.rows.length} rows`,
      metadata: { summary, pricingMode: input.pricingMode, undercutPct: input.undercutPct },
    })

    revalidatePath('/admin/imports')
    return { success: true, data: { batchId, summary, inputErrors: parsed.errors } }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Unknown error' }
  }
}

// ── apply ───────────────────────────────────────────────────────────────────

export interface ApplyProgress {
  processed: number
  created: number
  updated: number
  failed: number
  /** Rows still to go; 0 means the batch is done. */
  remaining: number
  images: { uploaded: number; reused: number }
}

/**
 * Apply one chunk. Call repeatedly until `remaining` is 0.
 *
 * Idempotent per row: a row already carrying a `listing_id` is skipped, so a
 * retried chunk cannot double-create. Across batches the unique index on
 * (seller, game, item_ref, variant) is the backstop — a re-import finds the
 * existing listing and updates its price and stock instead.
 *
 * Each run tries a row once: a row that fails is marked `failed` and leaves
 * the queue, so 60 failing rows cannot keep the loop busy forever. The first
 * call of a run passes `restart`, which puts the previous run's failures back
 * in the queue — clicking Apply again is the retry.
 */
export async function applyImportBatch(
  batchId: string,
  opts: { restart?: boolean } = {},
): Promise<Result<ApplyProgress>> {
  try {
    const admin = await requireAdmin()
    const svc = createServiceRoleClient()

    const { data: batch } = await svc
      .from('listing_import_batches')
      .select('id, seller_id, game_id, game_category_id, status, pricing_mode, undercut_pct, allow_estimated, games!inner(slug, name)')
      .eq('id', batchId)
      .maybeSingle()
    if (!batch) return { success: false, error: 'That import batch no longer exists.' }
    const b = batch as any
    if (b.status === 'removed') return { success: false, error: 'This batch was removed.' }

    const config = importConfigFor(b.games.slug)
    if (!config) return { success: false, error: 'This game is no longer set up for importing.' }

    const pair = await findEnabledGameCategory(svc as never, b.game_id, config.categorySlug)
    if (!pair) return { success: false, error: 'The category for this game is no longer enabled.' }

    if (opts.restart) {
      await (svc.from('listing_import_rows') as any)
        .update({ action: null, error: null })
        .eq('batch_id', batchId)
        .eq('match_status', 'matched')
        .is('listing_id', null)
        .eq('action', 'failed')
    }

    const { data: pending } = await svc
      .from('listing_import_rows')
      .select('*')
      .eq('batch_id', batchId)
      .eq('match_status', 'matched')
      .is('listing_id', null)
      .is('action', null)
      .order('row_no')
      .limit(CHUNK_SIZE)

    const chunk = (pending ?? []) as any[]
    const { count: remainingAfter } = await svc
      .from('listing_import_rows')
      .select('id', { count: 'exact', head: false })
      .eq('batch_id', batchId)
      .eq('match_status', 'matched')
      .is('listing_id', null)
      .is('action', null)
      .limit(1)

    if (chunk.length === 0) {
      await (svc.from('listing_import_batches') as any)
        .update({ status: 'applied', applied_at: new Date().toISOString() })
        .eq('id', batchId)
      revalidatePath('/admin/imports')
      revalidatePath(`/admin/imports/${batchId}`)
      return { success: true, data: { processed: 0, created: 0, updated: 0, failed: 0, remaining: 0, images: { uploaded: 0, reused: 0 } } }
    }

    const { catalogue } = await loadGameData(svc, config, b.game_id)
    const byRef = new Map(catalogue.items.map((i) => [i.ref, i]))
    const rules = await loadListingRuleContext(svc as never, b.game_id, pair.type)
    const materialiser = createImageMaterialiser({ storage: svc.storage as never, sellerId: b.seller_id })
    const writer = svc as unknown as ListingsWriter

    let created = 0
    let updated = 0
    let failed = 0
    const createdIds: string[] = []
    const updatedIds: string[] = []
    /** Existing listings whose template_data this chunk filled in. */
    const touchedIds: string[] = []

    for (const row of chunk) {
      try {
        const item = byRef.get(row.item_ref)
        if (!item) {
          await markRow(svc, row.id, { action: 'failed', error: 'that item is no longer in the catalogue' })
          failed += 1
          continue
        }

        // Does this store already have this (item, variant)? Then it is an
        // update — whatever its status: the identity is permanent (see
        // lib/imports/lifecycle), so a removed or sold-out row comes back
        // rather than gaining a twin.
        let existingQuery = svc
          .from('listings')
          .select('id, status, quantity, min_quantity, is_unlimited, delivery_method, bundle_id, template_data')
          .eq('seller_id', b.seller_id)
          .eq('game_id', b.game_id)
          .eq('import_item_ref', row.item_ref)
        existingQuery = row.variant_ref
          ? existingQuery.eq('import_variant', row.variant_ref)
          : existingQuery.is('import_variant', null)
        const { data: existing, error: existingError } = await existingQuery.maybeSingle()
        if (existingError) {
          await markRow(svc, row.id, { action: 'failed', error: existingError.message })
          failed += 1
          continue
        }

        if (existing) {
          // Re-import: price and stock. Same validator as a seller edit.
          const patch = validateListingPatch(
            { price: Number(row.resolved_price), quantity: row.quantity },
            rules,
            existing as any,
          )
          if (!patch.ok) {
            await markRow(svc, row.id, { action: 'failed', error: patch.error })
            failed += 1
            continue
          }
          const current = existing as any
          const decision = reimportDecision({
            status: current.status,
            quantity: Number((patch.value as any).quantity ?? current.quantity ?? 0),
            isUnlimited: current.is_unlimited === true,
          })
          if (decision.kind === 'refuse') {
            await markRow(svc, row.id, { action: 'failed', error: decision.reason })
            failed += 1
            continue
          }
          // Plus any filter value the listing is still missing (e.g. Pet Name
          // once its option exists) — values it already has are never touched.
          const filled = fillMissingAttributes(current.template_data, row.template_data)
          const { error } = await (svc.from('listings') as any)
            .update({
              ...patch.value,
              ...(filled ? { template_data: filled } : {}),
              ...(decision.status ? { status: decision.status } : {}),
              // A paused listing stays with the batch that paused it, so that
              // batch's Resume still brings it back.
              ...(current.status === 'paused' ? {} : { import_batch_id: batchId }),
            })
            .eq('id', current.id)
          if (error) {
            await markRow(svc, row.id, { action: 'failed', error: error.message })
            failed += 1
            continue
          }
          await markRow(svc, row.id, { action: 'updated', listing_id: current.id, error: null })
          // A template change clears the value link (trg_listings_value_ref): re-link.
          if (filled) touchedIds.push(current.id)
          updatedIds.push(current.id)
          updated += 1
          continue
        }

        // New listing: image first, because a listing is never image-less.
        const image = await materialiser.materialise(item, config)

        const validated = validateListingWrite(
          {
            title: row.title ?? '',
            description: row.description ?? '',
            price: Number(row.resolved_price),
            original_price: null,
            quantity: row.quantity,
            min_quantity: 1,
            delivery_method: config.delivery.method,
            delivery_time: config.delivery.window,
            images: [image.url],
            // Resolved at preview against the live template and stored on the
            // row, so what was previewed is what gets written.
            template_data: (row.template_data ?? {}) as Record<string, string>,
            region: null,
            platform: null,
            bundle_id: null,
            status: 'active',
          },
          rules,
        )
        if (!validated.ok) {
          await markRow(svc, row.id, { action: 'failed', error: validated.error })
          failed += 1
          continue
        }

        const result = await insertListing(writer, {
          sellerId: b.seller_id,
          target: { gameId: b.game_id, gameCategoryId: pair.id, legacyCategoryId: pair.legacy_category_id },
          write: validated.value,
          status: 'active',
          // Owner decision: an admin importing for their own store publishes
          // live. check_listing_moderation returns early when approved_by is
          // set, which is the same end state as approve_listing() per row.
          approvedBy: admin.userId,
          metadata: { source: 'import', import_batch_id: batchId },
          importBatchId: batchId,
          importItemRef: row.item_ref,
          importVariant: row.variant_ref,
        })
        if (!result.ok) {
          await markRow(svc, row.id, { action: 'failed', error: result.error })
          failed += 1
          continue
        }
        await markRow(svc, row.id, { action: 'created', listing_id: result.id, error: null, image_url: image.url })
        if (result.id) createdIds.push(result.id)
        created += 1
      } catch (e: any) {
        await markRow(svc, row.id, { action: 'failed', error: e?.message ?? 'Unknown error' })
        failed += 1
      }
    }

    // Bundle 2 — link the new listings to their value item pages (never
    // throws; the nightly reconcile retries a miss). Before revalidating, so
    // the re-render reads the link.
    const toLink = [...createdIds, ...touchedIds]
    if (toLink.length > 0) await linkListingsToValueItems(svc, toLink)

    // One revalidation for the whole chunk, not one per listing. The listing
    // ids also name their value items, so each pet's value page ("Available
    // Now", buy button) follows its new stock and price straight away.
    if (created > 0 || updated > 0) {
      await revalidateListingSurfaces(svc as never, {
        gameCategoryIds: [pair.id],
        listingIds: [...createdIds, ...updatedIds],
      })
    }

    const remaining = Math.max(0, (remainingAfter ?? chunk.length) - chunk.length)
    if (remaining === 0) {
      await (svc.from('listing_import_batches') as any)
        .update({ status: 'applied', applied_at: new Date().toISOString() })
        .eq('id', batchId)
      await logAdminActivity({
        action: 'import_batch_applied',
        actionCategory: 'system',
        resourceType: 'listing_import_batch',
        resourceId: batchId,
        resourceName: `${b.games.name}`,
        metadata: { created, updated, failed },
      })
    }

    revalidatePath('/admin/imports')
    revalidatePath(`/admin/imports/${batchId}`)
    const stats = materialiser.stats()
    return {
      success: true,
      data: { processed: chunk.length, created, updated, failed, remaining, images: { uploaded: stats.uploaded, reused: stats.reused } },
    }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Unknown error' }
  }
}

async function markRow(
  svc: ReturnType<typeof createServiceRoleClient>,
  rowId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  await (svc.from('listing_import_rows') as any).update(patch).eq('id', rowId)
}

// ── lifecycle ───────────────────────────────────────────────────────────────

/**
 * Pause / resume / remove every listing a batch created.
 *
 * Remove ARCHIVES — never deletes. An archived listing keeps its order history,
 * and the idempotency index excludes archived rows, so the same stock list can
 * be imported again afterwards.
 */
async function setBatchListingStatus(
  batchId: string,
  listingStatus: 'paused' | 'active' | 'archived',
  batchStatus: 'paused' | 'applied' | 'removed',
  action: string,
): Promise<Result<{ affected: number }>> {
  try {
    await requireAdmin()
    const svc = createServiceRoleClient()

    const { data: batch } = await svc
      .from('listing_import_batches')
      .select('id, game_category_id, games!inner(name)')
      .eq('id', batchId)
      .maybeSingle()
    if (!batch) return { success: false, error: 'That import batch no longer exists.' }

    // Only this batch's listings, and only from the statuses each action owns
    // (lib/imports/lifecycle): a sold-out listing is never switched back on
    // with no stock, and moderation's decisions are never undone.
    const { data: affected, error } = await (svc.from('listings') as any)
      .update({ status: listingStatus })
      .eq('import_batch_id', batchId)
      .in('status', [...BATCH_STATUS_FROM[listingStatus]])
      .select('id')
    if (error) return { success: false, error: error.message }

    await (svc.from('listing_import_batches') as any).update({ status: batchStatus }).eq('id', batchId)
    await revalidateListingSurfaces(svc as never, { gameCategoryIds: [(batch as any).game_category_id] })

    await logAdminActivity({
      action,
      actionCategory: 'system',
      resourceType: 'listing_import_batch',
      resourceId: batchId,
      resourceName: (batch as any).games?.name ?? '',
      metadata: { affected: (affected ?? []).length },
    })

    revalidatePath('/admin/imports')
    revalidatePath(`/admin/imports/${batchId}`)
    return { success: true, data: { affected: (affected ?? []).length } }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Unknown error' }
  }
}

export async function pauseImportBatch(batchId: string) {
  return setBatchListingStatus(batchId, 'paused', 'paused', 'import_batch_paused')
}

export async function resumeImportBatch(batchId: string) {
  return setBatchListingStatus(batchId, 'active', 'applied', 'import_batch_resumed')
}

export async function removeImportBatch(batchId: string) {
  return setBatchListingStatus(batchId, 'archived', 'removed', 'import_batch_removed')
}

// ── teaching the matcher ────────────────────────────────────────────────────

/**
 * Record "this spelling means that item" so every later batch matches it.
 * Import-only: it never touches a game's market-title alias table, which the
 * pricing crawlers depend on.
 */
export async function teachImportAlias(input: {
  batchId: string
  rowId: string
  itemRef: string
}): Promise<Result<{ alias: string }>> {
  try {
    const admin = await requireAdmin()
    const svc = createServiceRoleClient()

    const { data: row } = await svc
      .from('listing_import_rows')
      .select('id, raw, batch_id, listing_import_batches!inner(game_id)')
      .eq('id', input.rowId)
      .maybeSingle()
    if (!row) return { success: false, error: 'That row no longer exists.' }

    const raw = ((row as any).raw ?? {}) as Record<string, string>
    const alias = (raw.item ?? '').trim()
    if (!alias) return { success: false, error: 'That row has no item text to learn from.' }

    const batch = Array.isArray((row as any).listing_import_batches)
      ? (row as any).listing_import_batches[0]
      : (row as any).listing_import_batches

    const { error } = await (svc.from('listing_import_aliases') as any).insert({
      game_id: batch.game_id,
      alias,
      item_ref: input.itemRef,
      created_by: admin.userId,
    })
    // A duplicate alias is not an error: someone already taught it.
    if (error && !/duplicate key|unique/i.test(error.message)) {
      return { success: false, error: error.message }
    }

    revalidatePath(`/admin/imports/${input.batchId}`)
    return { success: true, data: { alias } }
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Unknown error' }
  }
}
