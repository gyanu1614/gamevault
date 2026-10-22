/**
 * catalogue_refs + catalogue_runs (service role). Kept apart from run.ts so
 * the orchestrator's tests swap in an in-memory store.
 */
import type { CatalogueRef, Db, RunReport } from './types'

const PAGE = 1000
export const RUN_RETENTION_DAYS = 180

export async function loadRefs(db: Db, gameSlug: string): Promise<Map<number, CatalogueRef>> {
  const out = new Map<number, CatalogueRef>()
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('catalogue_refs')
      .select('page_id,wiki_title,item_slug,status,first_seen_at,checked_at')
      .eq('game_slug', gameSlug)
      .order('page_id')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`catalogue_refs: ${error.message}`)
    for (const r of data ?? []) {
      out.set(Number(r.page_id), {
        pageId: Number(r.page_id),
        wikiTitle: r.wiki_title,
        itemSlug: r.item_slug,
        status: r.status,
        firstSeenAt: r.first_seen_at,
        checkedAt: r.checked_at,
      })
    }
    if (!data || data.length < PAGE) return out
  }
}

export interface RefWrite {
  pageId: number
  wikiTitle: string
  itemSlug: string | null
  status: 'item' | 'ignored'
}

/** first_seen_at is never sent, so it keeps its insert-time default on update. */
export async function saveRefs(db: Db, gameSlug: string, refs: RefWrite[], now: Date): Promise<void> {
  const rows = refs.map((r) => ({
    game_slug: gameSlug,
    page_id: r.pageId,
    wiki_title: r.wikiTitle,
    item_slug: r.itemSlug,
    status: r.status,
    checked_at: now.toISOString(),
  }))
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from('catalogue_refs').upsert(rows.slice(i, i + 500), { onConflict: 'game_slug,page_id' })
    if (error) throw new Error(`catalogue_refs upsert: ${error.message}`)
  }
}

export interface RunRow {
  report: RunReport
  startedAt: Date
  finishedAt: Date
  trigger: 'schedule' | 'manual'
}

export async function recordRun(db: Db, row: RunRow): Promise<void> {
  const r = row.report
  const { error } = await db.from('catalogue_runs').insert({
    game_slug: r.gameSlug,
    started_at: row.startedAt.toISOString(),
    finished_at: row.finishedAt.toISOString(),
    trigger: row.trigger,
    status: r.status,
    listed: r.listed,
    candidates: r.candidates,
    adopted: r.adopted,
    added_slugs: r.added.map((a) => a.slug),
    ignored: r.ignored,
    images_fixed: r.imagesFixed,
    message: r.message,
    details: { parse_errors: r.parseErrors.slice(0, 20), wiki_requests: r.wikiRequests },
  })
  if (error) throw new Error(`catalogue_runs insert: ${error.message}`)
}

export async function pruneRuns(db: Db, now: Date): Promise<void> {
  const before = new Date(now.getTime() - RUN_RETENTION_DAYS * 86_400_000).toISOString()
  const { error } = await db.from('catalogue_runs').delete().lt('started_at', before)
  if (error) throw new Error(`catalogue_runs prune: ${error.message}`)
}

export interface CatalogueStore {
  loadRefs: typeof loadRefs
  saveRefs: typeof saveRefs
  recordRun: typeof recordRun
  pruneRuns: typeof pruneRuns
}

export const dbStore: CatalogueStore = { loadRefs, saveRefs, recordRun, pruneRuns }
