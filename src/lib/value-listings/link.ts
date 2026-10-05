/**
 * THE listing → value item link. One function for every write path:
 *
 *   create  publishListing, bulkPublishListings   → linkListingsToValueItems
 *   edit    updateListingFromWizard, updateListing → linkListingsToValueItems
 *   nightly /api/cron/value-listing-refs           → reconcileValueRefs
 *   backfill scripts/value-refs-backfill.mjs        → reconcileValueRefs
 *
 * It must never block a publish: every failure is caught and returned in the
 * outcome. The trigger `trg_listings_value_ref` clears a stale link on any
 * title/template change, and the nightly reconcile re-links whatever is left
 * with `value_matched_at IS NULL` — so a failed or skipped call is repaired
 * within a day and never shows a listing on the wrong item page.
 *
 * Call it BEFORE `revalidateListingSurfaces`, so the re-render reads the link.
 * Takes the service-role client (writes are backend-only). No `server-only`
 * and no `@/` imports, so the tsx backfill script can load it.
 */
import { loadOptionLabels, loadValueCatalog, type LoadedCatalog } from './catalogs'
import { matchListingToValueItem } from './match'

type AnyClient = { from: (table: string) => any }

interface ListingRow {
  id: string
  game_id: string | null
  game_category_id: string | null
  title: string | null
  template_data: Record<string, unknown> | null
  value_item_slug?: string | null
  value_variant?: string | null
  value_matched_at?: string | null
}

export interface UnmatchedListing {
  id: string
  gameSlug: string
  title: string
  templateKeys: string[]
}

export interface LinkOutcome {
  checked: number
  linked: number
  unmatched: UnmatchedListing[]
  errors: string[]
  /** Pairs whose listings changed link — the caller revalidates these. */
  gameCategoryIds: string[]
  /** Value item pages whose stock changed (old AND new item of a re-link). */
  changedItems: Array<{ gameSlug: string; itemSlug: string }>
  /** Rows whose stored link was wrong or stale and was rewritten. */
  relinked: number
}

const ROW_COLUMNS = 'id, game_id, game_category_id, title, template_data, value_item_slug, value_variant, value_matched_at'

const empty = (): LinkOutcome => ({ checked: 0, linked: 0, unmatched: [], errors: [], gameCategoryIds: [], changedItems: [], relinked: 0 })

const message = (e: unknown) => (e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as any).message) : String(e))

async function linkRows(client: AnyClient, rows: ListingRow[], out: LinkOutcome, dryRun = false): Promise<void> {
  const gameIds = [...new Set(rows.map((r) => r.game_id).filter((g): g is string => !!g))]
  if (gameIds.length === 0) return
  const { data: games, error } = await client.from('games').select('id, slug').in('id', gameIds)
  if (error) throw error
  const slugById = new Map(((games ?? []) as Array<{ id: string; slug: string }>).map((g) => [g.id, g.slug]))

  const catalogs = new Map<string, Promise<LoadedCatalog | null>>()
  const labels = new Map<string, Promise<Record<string, Record<string, string>>>>()
  const touched = new Set<string>()
  const now = new Date().toISOString()

  for (const row of rows) {
    out.checked += 1
    try {
      const gameSlug = row.game_id ? slugById.get(row.game_id) : undefined
      let loaded: LoadedCatalog | null = null
      if (gameSlug && row.game_id) {
        if (!catalogs.has(gameSlug)) catalogs.set(gameSlug, loadValueCatalog(client, { id: row.game_id, slug: gameSlug }))
        loaded = await catalogs.get(gameSlug)!
      }

      let match: ReturnType<typeof matchListingToValueItem> = null
      if (loaded) {
        let optionLabels: Record<string, Record<string, string>> = {}
        if (row.game_category_id) {
          if (!labels.has(row.game_category_id)) labels.set(row.game_category_id, loadOptionLabels(client, row.game_category_id))
          optionLabels = await labels.get(row.game_category_id)!
        }
        match = matchListingToValueItem(
          { title: row.title ?? '', templateData: row.template_data, optionLabels },
          loaded.catalog,
        )
        if (!match) {
          out.unmatched.push({
            id: row.id,
            gameSlug: gameSlug!,
            title: row.title ?? '',
            templateKeys: Object.keys(row.template_data ?? {}),
          })
        }
      }

      const nextSlug = match?.itemSlug ?? null
      const nextVariant = match?.variant ?? null
      const storedSlug = row.value_item_slug ?? null
      const unchanged =
        row.value_matched_at != null && storedSlug === nextSlug && (row.value_variant ?? null) === nextVariant
      if (!unchanged) {
        if (!dryRun) {
          const { error: writeError } = await client
            .from('listings')
            .update({ value_item_slug: nextSlug, value_variant: nextVariant, value_matched_at: now })
            .eq('id', row.id)
          if (writeError) throw writeError
        }
        // A link that MOVED (e.g. "Fairy Bat Dragon NFR" stored as bat-dragon
        // before the pet existed): both item pages' stock changes.
        if (row.value_matched_at != null && storedSlug !== nextSlug) out.relinked += 1
        if (gameSlug) {
          if (storedSlug) out.changedItems.push({ gameSlug, itemSlug: storedSlug })
          if (nextSlug && nextSlug !== storedSlug) out.changedItems.push({ gameSlug, itemSlug: nextSlug })
        }
      }
      if (match) {
        out.linked += 1
        if (row.game_category_id) touched.add(row.game_category_id)
      }
    } catch (e) {
      out.errors.push(`${row.id}: ${message(e)}`)
    }
  }
  out.gameCategoryIds = [...new Set([...out.gameCategoryIds, ...touched])]
}

/**
 * Link listings now: by id, or every not-yet-linked listing of one seller
 * (the bulk publish path, which doesn't read its inserted ids back). Never
 * throws.
 */
export async function linkListingsToValueItems(
  client: AnyClient,
  target: readonly string[] | { sellerId: string },
): Promise<LinkOutcome> {
  const out = empty()
  try {
    let query = client.from('listings').select(ROW_COLUMNS)
    if (Array.isArray(target)) {
      const ids = [...new Set(target.filter(Boolean))]
      if (ids.length === 0) return out
      query = query.in('id', ids)
    } else {
      query = query.eq('seller_id', (target as { sellerId: string }).sellerId).is('value_matched_at', null).limit(1000)
    }
    const { data, error } = await query
    if (error) throw error
    await linkRows(client, (data ?? []) as ListingRow[], out)
  } catch (e) {
    out.errors.push(message(e))
  }
  if (out.errors.length) console.error('[value-listings] link failed (nightly reconcile will retry):', out.errors.slice(0, 5))
  return out
}

/**
 * Link every listing still waiting (`value_matched_at IS NULL`), or with
 * `all` re-check every listing (the backfill's dry-run report). `dryRun`
 * matches and reports without writing. Never throws.
 */
export async function reconcileValueRefs(
  client: AnyClient,
  {
    limit = 1000,
    dryRun = false,
    all = false,
    relink = false,
  }: { limit?: number; dryRun?: boolean; all?: boolean; relink?: boolean } = {},
): Promise<LinkOutcome> {
  const out = empty()
  try {
    let query = client.from('listings').select(ROW_COLUMNS)
    // relink: re-check every ACTIVE listing against the current catalogue +
    // matcher (catalogue grew, matcher tightened); only rows whose link
    // actually changes are written.
    if (relink) query = query.eq('status', 'active')
    else if (!all) query = query.is('value_matched_at', null)
    const { data, error } = await query.order('created_at', { ascending: true }).limit(limit)
    if (error) throw error
    await linkRows(client, (data ?? []) as ListingRow[], out, dryRun)
  } catch (e) {
    out.errors.push(message(e))
  }
  return out
}
