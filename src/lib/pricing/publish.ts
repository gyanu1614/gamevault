/**
 * Publish step shared by every value game's pricing run (T1, 2026-10-04).
 *
 *   game run → current displayed prices (PublishedPrice[])
 *            → diff vs the last PUBLISHED snapshot (change-rule.ts)
 *            → POST {changedSlugs} to /api/internal/values-revalidate?game=…
 *            → only then commit the moved rows to the snapshot
 *
 * The commit comes AFTER a successful revalidation on purpose: if the POST
 * fails, the snapshot still holds the old values, so the next run reports the
 * same items as changed again instead of losing them.
 *
 * The snapshot lives in `values_published_prices` (migration
 * 20261004214204). Until that migration is on the database this step falls
 * back to the old whole-game refresh (`?full=1`), so shipping the code before
 * the db push is safe — just as expensive as before.
 */
import {
  diffPublishedPrices,
  type PriceChangeRule,
  type PriceDiff,
  type PublishedPrice,
} from './change-rule'

export const PUBLISHED_PRICES_TABLE = 'values_published_prices'

const PAGE_SIZE = 1000
const WRITE_BATCH = 500

/** The slice of a Supabase client this needs (service role). */
export type SnapshotClient = { from: (table: string) => any }

export class PublishedSnapshotUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PublishedSnapshotUnavailableError'
  }
}

/** PostgREST / Postgres shapes of "that table does not exist (yet)". */
function isMissingTable(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  if (error.code === '42P01' || error.code === 'PGRST205') return true
  const message = error.message ?? ''
  return message.includes(PUBLISHED_PRICES_TABLE) && /does not exist|schema cache/i.test(message)
}

type SnapshotRow = {
  item_slug: string
  variant: string
  prices: Record<string, number | null> | null
}

export async function loadPublishedSnapshot(
  client: SnapshotClient,
  gameSlug: string,
): Promise<PublishedPrice[]> {
  const rows: PublishedPrice[] = []
  for (let page = 0; ; page += 1) {
    const from = page * PAGE_SIZE
    const { data, error } = await client
      .from(PUBLISHED_PRICES_TABLE)
      .select('item_slug,variant,prices')
      .eq('game_slug', gameSlug)
      // Unique order: paging without one skips/duplicates rows at the seams.
      .order('item_slug', { ascending: true })
      .order('variant', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) {
      if (isMissingTable(error)) {
        throw new PublishedSnapshotUnavailableError(
          `${PUBLISHED_PRICES_TABLE} is missing — the migration is not on this database yet`,
        )
      }
      throw new Error(`${PUBLISHED_PRICES_TABLE} read: ${error.message ?? String(error)}`)
    }
    const batch = (data ?? []) as SnapshotRow[]
    for (const r of batch) {
      rows.push({ itemSlug: r.item_slug, variant: r.variant, prices: r.prices ?? {} })
    }
    if (batch.length < PAGE_SIZE) break
  }
  return rows
}

export async function commitPublishedSnapshot(
  client: SnapshotClient,
  gameSlug: string,
  diff: Pick<PriceDiff, 'upserts' | 'deletes'>,
  now: string = new Date().toISOString(),
): Promise<{ written: number; deleted: number }> {
  let written = 0
  for (let i = 0; i < diff.upserts.length; i += WRITE_BATCH) {
    const batch = diff.upserts.slice(i, i + WRITE_BATCH).map((r) => ({
      game_slug: gameSlug,
      item_slug: r.itemSlug,
      variant: r.variant,
      prices: r.prices,
      published_at: now,
    }))
    const { error } = await client
      .from(PUBLISHED_PRICES_TABLE)
      .upsert(batch, { onConflict: 'game_slug,item_slug,variant' })
    if (error) throw new Error(`${PUBLISHED_PRICES_TABLE} upsert: ${error.message ?? String(error)}`)
    written += batch.length
  }
  let deleted = 0
  for (const d of diff.deletes) {
    const { error } = await client
      .from(PUBLISHED_PRICES_TABLE)
      .delete()
      .eq('game_slug', gameSlug)
      .eq('item_slug', d.itemSlug)
      .eq('variant', d.variant)
    if (error) throw new Error(`${PUBLISHED_PRICES_TABLE} delete: ${error.message ?? String(error)}`)
    deleted += 1
  }
  return { written, deleted }
}

/** What the revalidation call is asked to do. */
export type RevalidateRequest =
  | { gameSlug: string; changedSlugs: string[] }
  | { gameSlug: string; full: true }

export type Revalidator = (request: RevalidateRequest) => Promise<void>

export type PublishOutcome = {
  game: string
  mode: 'changed-items' | 'seeded' | 'full-fallback'
  rows_compared: number
  items_compared: number
  changed_count: number
  changed_slugs: string[]
  snapshot_written: number
  snapshot_deleted: number
  rule: PriceChangeRule
}

/**
 * Plan → revalidate → commit. `revalidate` throws on failure (the caller
 * fails the job), and the snapshot is left untouched in that case.
 */
export async function publishPriceChanges(input: {
  client: SnapshotClient
  gameSlug: string
  current: readonly PublishedPrice[]
  rule: PriceChangeRule
  revalidate: Revalidator
  log?: (line: string) => void
}): Promise<PublishOutcome> {
  const { client, gameSlug, current, rule, revalidate } = input
  const log = input.log ?? ((line: string) => console.log(line))
  const items_compared = new Set(current.map((r) => r.itemSlug)).size
  const base = { game: gameSlug, rows_compared: current.length, items_compared, rule }

  let snapshot: PublishedPrice[]
  try {
    snapshot = await loadPublishedSnapshot(client, gameSlug)
  } catch (error) {
    if (!(error instanceof PublishedSnapshotUnavailableError)) throw error
    log(`⚠️ ${gameSlug}: ${error.message}; falling back to a whole-game refresh (?full=1).`)
    await revalidate({ gameSlug, full: true })
    return {
      ...base,
      mode: 'full-fallback',
      changed_count: items_compared,
      changed_slugs: [],
      snapshot_written: 0,
      snapshot_deleted: 0,
    }
  }

  const diff = diffPublishedPrices(snapshot, current, rule)

  if (diff.seeded) {
    const { written } = await commitPublishedSnapshot(client, gameSlug, diff)
    log(
      `🌱 ${gameSlug}: published-price snapshot was empty — seeded ${written} rows, ` +
        `no page revalidated (pages already show these prices).`,
    )
    return {
      ...base,
      mode: 'seeded',
      changed_count: 0,
      changed_slugs: [],
      snapshot_written: written,
      snapshot_deleted: 0,
    }
  }

  await revalidate({ gameSlug, changedSlugs: diff.changedSlugs })
  const { written, deleted } = await commitPublishedSnapshot(client, gameSlug, diff)

  log(
    diff.changedSlugs.length === 0
      ? `✅ ${gameSlug}: 0 of ${items_compared} items moved past ` +
          `${rule.minRelative * 100}% / $${rule.minAbsoluteUsd} — no page revalidated.`
      : `✅ ${gameSlug}: ${diff.changedSlugs.length} of ${items_compared} items moved past ` +
          `${rule.minRelative * 100}% / $${rule.minAbsoluteUsd} — revalidated those pages only.`,
  )

  return {
    ...base,
    mode: 'changed-items',
    changed_count: diff.changedSlugs.length,
    changed_slugs: diff.changedSlugs,
    snapshot_written: written,
    snapshot_deleted: deleted,
  }
}

/**
 * The HTTP revalidator the runner uses: POST /api/internal/values-revalidate.
 * Throws on a non-2xx so a failed refresh fails the job (ROUTE-010: a pipeline
 * that never revalidated anything must not look healthy).
 */
export function httpRevalidator(options: {
  baseUrl: string
  secret: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
}): Revalidator {
  const doFetch = options.fetchImpl ?? fetch
  return async (request) => {
    const url = new URL('/api/internal/values-revalidate', options.baseUrl)
    url.searchParams.set('game', request.gameSlug)
    if ('full' in request) url.searchParams.set('full', '1')
    const response = await doFetch(url.toString(), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-values-revalidate-secret': options.secret,
      },
      body: JSON.stringify(
        'full' in request ? { reason: 'pricing-run' } : { reason: 'pricing-run', changedSlugs: request.changedSlugs },
      ),
      signal: AbortSignal.timeout(options.timeoutMs ?? 60_000),
    })
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(
        `values-revalidate ${request.gameSlug} failed: HTTP ${response.status} ${text.slice(0, 300)}`,
      )
    }
  }
}
