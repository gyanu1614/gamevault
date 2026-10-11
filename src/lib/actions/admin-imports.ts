'use server'

/**
 * Step 4 — admin bulk importer: reading batches, previewing a new one, and
 * teaching the matcher. Applying a batch and its Pause / Resume / Remove live
 * in `./admin-import-apply` (the only part that writes listings).
 *
 * Every action is `requireAdmin()` first, then the service-role client: the
 * three `listing_import_*` tables have RLS on with zero policies, so a JWT
 * caller cannot reach them at all and these modules are the only way in.
 */
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/actions/admin-permissions'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { fetchAllRows } from '@/lib/db/fetch-all'
import { logAdminActivity } from '@/lib/admin/activity-log'
import { findEnabledGameCategory } from '@/lib/categories'
import { importConfigFor, importableGameSlugs } from '@/lib/imports/config'
import { parseImportInput } from '@/lib/imports/csv'
import { buildMatchIndex } from '@/lib/imports/match'
import { resolveRows, type ResolveSummary } from '@/lib/imports/resolve'
import { countsFor, loadAppliedListings, loadGameData, loadTemplateAttributes, rowToDbPayload } from '@/lib/imports/admin/data'
import type {
  BatchDetail,
  BatchRowView,
  BatchSummaryRow,
  CreateBatchInput,
  ImportableGame,
  Result,
  StoreSellerOption,
} from '@/lib/imports/admin/types'

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

// ── create + preview ────────────────────────────────────────────────────────

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
