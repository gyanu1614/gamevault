/**
 * One catalogue run for one game: list the wiki's item pages → read only the
 * pages we never decided about → parse → adopt / insert / ignore → guards →
 * insert-only write → refs → images → refresh → run row + Discord.
 * Every dependency is injected (run.test.ts runs it on fakes); the CLI wires
 * the real ones (scripts/catalogue.mjs).
 */
import { runMessage } from './notify'
import { candidatePages, DEFAULT_INSERT_CAP, guardRun, planCatalogue, RECENT_WINDOW_DAYS, type ParsedPage } from './plan'
import { dbStore, type CatalogueStore, type RefWrite } from './store'
import type { CatalogueGame, Db, ImageStore, RunReport, WikiClient } from './types'

export interface RunDeps {
  db: Db
  wiki: WikiClient
  images: ImageStore
  /** POSTs changed slugs to values-revalidate; null skips it (local runs). */
  revalidate: ((gameSlug: string, slugs: string[]) => Promise<void>) | null
  notify: (text: string) => Promise<boolean>
  store?: CatalogueStore
  now?: () => Date
  log?: (message: string) => void
}

export interface RunOptions {
  write: boolean
  /** Lifts the insert cap: manual first runs and big backlogs only. */
  allowLarge: boolean
  trigger: 'schedule' | 'manual'
  siteUrl: string
}

export async function runCatalogue(game: CatalogueGame, deps: RunDeps, opts: RunOptions): Promise<RunReport> {
  const { adapter } = game
  const store = deps.store ?? dbStore
  const now = deps.now ?? (() => new Date())
  const log = deps.log ?? console.log
  const startedAt = now()
  const report: RunReport = {
    gameSlug: adapter.gameSlug,
    status: 'nothing_new',
    listed: 0,
    candidates: 0,
    adopted: 0,
    added: [],
    ignored: 0,
    imagesFixed: 0,
    parseErrors: [],
    message: null,
    wikiRequests: 0,
  }

  const finish = async (): Promise<RunReport> => {
    report.wikiRequests = deps.wiki.requests()
    if (!opts.write) return report
    await store.recordRun(deps.db, { report, startedAt, finishedAt: now(), trigger: opts.trigger })
    await store.pruneRuns(deps.db, startedAt)
    const text = runMessage(game, report, opts.siteUrl)
    if (text) await deps.notify(text)
    return report
  }

  try {
    const listed = new Map<number, { pageId: number; title: string }>()
    for (const q of adapter.listQueries) for (const p of await deps.wiki.listPages(q)) listed.set(p.pageId, p)
    report.listed = listed.size
    const since = new Date(startedAt.getTime() - RECENT_WINDOW_DAYS * 86_400_000).toISOString()
    const recent = await deps.wiki.recentChanges(since)
    const refs = await store.loadRefs(deps.db, adapter.gameSlug)
    const candidates = candidatePages({ listed: [...listed.values()], recent, refs, now: startedAt })
    report.candidates = candidates.length
    log(`${game.name}: ${listed.size} listed, ${recent.length} changed recently, ${refs.size} decided → ${candidates.length} to read`)

    const refWrites: RefWrite[] = []
    if (candidates.length) {
      const ctx = { checkedAt: startedAt.toISOString().slice(0, 10), ...(adapter.prepare ? await adapter.prepare(deps.wiki) : {}) }
      const parsed: ParsedPage[] = []
      for (const page of await deps.wiki.fetchPages(candidates.map((c) => c.pageId))) {
        try {
          parsed.push({ pageId: page.pageId, title: page.title, item: adapter.parse(page, ctx) })
        } catch (e) {
          report.parseErrors.push(`${page.title}: ${(e as Error).message}`)
        }
      }
      const plan = planCatalogue(parsed, await adapter.loadKnown(deps.db))
      report.adopted = plan.adopt.length
      report.ignored = plan.ignore.length
      report.added = plan.insert.map((i) => ({ slug: i.slug, name: i.name }))
      const verdict = guardRun({
        candidates: candidates.length,
        parseErrors: report.parseErrors.length,
        toInsert: plan.insert.length,
        cap: adapter.insertCap ?? DEFAULT_INSERT_CAP,
        allowLarge: opts.allowLarge,
      })
      if (!verdict.ok) {
        report.status = 'blocked'
        report.message = verdict.reason
        return await finish()
      }
      if (!opts.write) {
        report.status = plan.insert.length ? 'ok' : 'nothing_new'
        return await finish()
      }
      const inserted = new Set(plan.insert.length ? await adapter.insert(deps.db, plan.insert, deps.images) : [])
      report.added = report.added.filter((a) => inserted.has(a.slug))
      refWrites.push(
        ...plan.adopt.map((a) => ({ pageId: a.pageId, wikiTitle: a.title, itemSlug: a.slug, status: 'item' as const })),
        // A slug that already existed (insert conflict) is still an item we hold.
        ...plan.insert.map((i) => ({ pageId: i.pageId, wikiTitle: i.wikiTitle, itemSlug: i.slug, status: 'item' as const })),
        ...plan.ignore.map((g) => ({ pageId: g.pageId, wikiTitle: g.title, itemSlug: null, status: 'ignored' as const })),
      )
    }
    if (!opts.write) return await finish()
    if (refWrites.length) await store.saveRefs(deps.db, adapter.gameSlug, refWrites, startedAt)
    const fixed = adapter.fixMissingImages ? await adapter.fixMissingImages(deps.db, deps.images) : []
    report.imagesFixed = fixed.length
    const changed = [...report.added.map((a) => a.slug), ...fixed]
    if (changed.length && deps.revalidate) await deps.revalidate(adapter.gameSlug, changed)
    report.status = report.added.length ? 'ok' : 'nothing_new'
    return await finish()
  } catch (e) {
    report.status = 'failed'
    report.message = (e as Error).message
    report.wikiRequests = deps.wiki.requests()
    if (opts.write) await store.recordRun(deps.db, { report, startedAt, finishedAt: now(), trigger: opts.trigger }).catch(() => {})
    throw e
  }
}
