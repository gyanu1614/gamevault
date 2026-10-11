'use server'

/**
 * Step 4 — applying an import batch, and its Pause / Resume / Remove. The
 * only importer module that writes `listings`.
 *
 * New listings go through `@/lib/listings/create`, the same seam the sell
 * wizard uses — validated by `@/lib/listings/validate`, moderated by the same
 * DB triggers, revalidated through `@/lib/revalidation/listings`. There is no
 * second listing-creation path, and `imports-use-publish-seam.guard.test.ts`
 * pins that. What a re-import may do to an existing listing is decided by
 * `@/lib/imports/lifecycle`.
 *
 * Chunking: applying a batch is one call per CHUNK_SIZE rows so a 1,000-row
 * import cannot exceed a function's time limit. Image work happens inside the
 * chunk, cached per catalogue item.
 */
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/actions/admin-permissions'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { logAdminActivity } from '@/lib/admin/activity-log'
import { findEnabledGameCategory } from '@/lib/categories'
import { revalidateListingSurfaces } from '@/lib/revalidation/listings'
import { insertListing, type ListingsWriter } from '@/lib/listings/create'
import { validateListingWrite, validateListingPatch } from '@/lib/listings/validate'
import { linkListingsToValueItems } from '@/lib/value-listings/link'
import { loadListingRuleContext } from '@/lib/listings/rule-context'
import { importConfigFor } from '@/lib/imports/config'
import { createImageMaterialiser } from '@/lib/imports/images'
import { fillMissingAttributes } from '@/lib/imports/attributes'
import { BATCH_STATUS_FROM, reimportDecision } from '@/lib/imports/lifecycle'
import { loadGameData } from '@/lib/imports/admin/data'
import type { ApplyProgress, Result } from '@/lib/imports/admin/types'

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

// ── apply ───────────────────────────────────────────────────────────────────

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
 * and importing the same rows again re-lists the SAME listings (the identity
 * index is permanent; see lib/imports/lifecycle).
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
