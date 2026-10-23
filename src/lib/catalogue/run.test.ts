import { describe, expect, it, vi } from 'vitest'
import { runCatalogue, type RunDeps } from './run'
import type { CatalogueStore, RefWrite, RunRow } from './store'
import type { CatalogueAdapter, CatalogueGame, CatalogueRef, Db, KnownItem, ParsedItem, WikiClient, WikiPage } from './types'

const NOW = new Date('2026-10-21T12:00:00Z')
const db = {} as Db

function memStore(refs: CatalogueRef[] = []) {
  const map = new Map(refs.map((r) => [r.pageId, r]))
  const runs: RunRow[] = []
  const store: CatalogueStore = {
    loadRefs: async () => new Map(map),
    saveRefs: async (_db, _game, rows: RefWrite[], now) => {
      for (const r of rows) map.set(r.pageId, { ...r, firstSeenAt: map.get(r.pageId)?.firstSeenAt ?? now.toISOString(), checkedAt: now.toISOString() })
    },
    recordRun: async (_db, row) => void runs.push(row),
    pruneRuns: async () => {},
  }
  return { store, map, runs }
}

const pages: WikiPage[] = [
  { pageId: 1, title: 'Tralalero Tralala', revisionId: 1, content: 'item', categories: [] },
  { pageId: 2, title: 'Slushi Huski', revisionId: 1, content: 'item', categories: [] },
  { pageId: 3, title: 'Slushi Huski/Gallery', revisionId: 1, content: 'gallery', categories: [] },
]
function fakeWiki(list = pages, sinceCalls: string[] = []): WikiClient {
  let n = 0
  return {
    listPages: async () => (n++, list.map((p) => ({ pageId: p.pageId, title: p.title }))),
    recentChanges: async (since) => (n++, sinceCalls.push(since), []),
    fetchPages: async (ids) => (n++, list.filter((p) => ids.includes(p.pageId))),
    wikitext: async () => '',
    imageUrls: async () => new Map(),
    requests: () => n,
  }
}
function fakeAdapter(over: Partial<CatalogueAdapter> = {}) {
  const inserted: ParsedItem[][] = []
  const adapter: CatalogueAdapter = {
    gameSlug: 'steal-a-brainrot',
    label: 'brainrots',
    wikiHost: 'w.test',
    listQueries: [{ list: 'embeddedin', title: 'Template:X' }],
    parse: (p) =>
      p.content === 'item'
        ? {
            pageId: p.pageId,
            revisionId: 1,
            wikiTitle: p.title,
            pageUrl: 'u',
            slug: p.title.toLowerCase().replace(/ /g, '-'),
            name: p.title,
            rarity: 'Secret',
            imageFile: null,
            releasedAt: null,
            origin: null,
            howToGet: null,
            extra: {},
          }
        : null,
    loadKnown: async (): Promise<KnownItem[]> => [{ slug: 'tralalero-tralala', name: 'Tralalero Tralala', pageId: null }],
    insert: async (_db, items) => (inserted.push(items), items.map((i) => i.slug)),
    ...over,
  }
  return { adapter, inserted }
}
const game = (adapter: CatalogueAdapter): CatalogueGame => ({ key: 'sab', name: 'Steal a Brainrot', adapter })
const opts = { write: true, allowLarge: false, trigger: 'schedule' as const, siteUrl: 'https://dropmarket.test' }
function deps(store: CatalogueStore, extra: Partial<RunDeps> = {}): RunDeps {
  return {
    db,
    wiki: fakeWiki(),
    images: { copy: async () => true },
    revalidate: vi.fn(async () => {}),
    notify: vi.fn(async () => true),
    store,
    now: () => NOW,
    log: () => {},
    ...extra,
  }
}

describe('runCatalogue', () => {
  it('first run: adopts what we hold, inserts the new item, ignores the gallery, refreshes and announces', async () => {
    const { store, map, runs } = memStore()
    const { adapter, inserted } = fakeAdapter()
    const d = deps(store)
    const report = await runCatalogue(game(adapter), d, opts)
    expect(report).toMatchObject({ status: 'ok', listed: 3, candidates: 3, adopted: 1, ignored: 1, added: [{ slug: 'slushi-huski', name: 'Slushi Huski' }] })
    expect(inserted).toHaveLength(1)
    expect([...map.values()].map((r) => [r.pageId, r.status, r.itemSlug])).toEqual([
      [1, 'item', 'tralalero-tralala'],
      [2, 'item', 'slushi-huski'],
      [3, 'ignored', null],
    ])
    expect(d.revalidate).toHaveBeenCalledWith('steal-a-brainrot', ['slushi-huski'])
    expect(d.notify).toHaveBeenCalledWith(expect.stringContaining('[Slushi Huski]'))
    expect(runs.map((r) => r.report.status)).toEqual(['ok'])
  })

  it('second run reads nothing, writes nothing new and stays quiet', async () => {
    const { store, runs } = memStore()
    const { adapter, inserted } = fakeAdapter()
    await runCatalogue(game(adapter), deps(store), opts)
    const d = deps(store)
    const report = await runCatalogue(game(adapter), d, opts)
    expect(report).toMatchObject({ status: 'nothing_new', candidates: 0, added: [] })
    expect(inserted).toHaveLength(1)
    expect(d.notify).not.toHaveBeenCalled()
    expect(d.revalidate).not.toHaveBeenCalled()
    expect(runs.map((r) => r.report.status)).toEqual(['ok', 'nothing_new'])
  })

  it('a dry run plans but writes, records and announces nothing', async () => {
    const { store, map, runs } = memStore()
    const { adapter, inserted } = fakeAdapter()
    const d = deps(store)
    const report = await runCatalogue(game(adapter), d, { ...opts, write: false })
    expect(report.added).toEqual([{ slug: 'slushi-huski', name: 'Slushi Huski' }])
    expect([inserted.length, map.size, runs.length]).toEqual([0, 0, 0])
    expect(d.notify).not.toHaveBeenCalled()
  })

  it('stops over the cap: records a blocked run, alerts, inserts nothing', async () => {
    const { store, map, runs } = memStore()
    const { adapter, inserted } = fakeAdapter({ insertCap: 0 })
    const d = deps(store)
    const report = await runCatalogue(game(adapter), d, opts)
    expect(report.status).toBe('blocked')
    expect([inserted.length, map.size]).toEqual([0, 0])
    expect(runs[0].report.status).toBe('blocked')
    expect(d.notify).toHaveBeenCalledWith(expect.stringContaining('stopped'))
  })

  it('stops when parsing breaks on many pages (wiki format change)', async () => {
    const { store } = memStore()
    const many = Array.from({ length: 10 }, (_, i) => ({ pageId: i + 1, title: `P${i}`, revisionId: 1, content: 'x', categories: [] }))
    const { adapter, inserted } = fakeAdapter({
      parse: () => {
        throw new Error('boom')
      },
    })
    const report = await runCatalogue(game(adapter), deps(store, { wiki: fakeWiki(many) }), opts)
    expect(report).toMatchObject({ status: 'blocked' })
    expect(report.parseErrors).toHaveLength(10)
    expect(inserted).toHaveLength(0)
  })

  it('records a failed run and rethrows so the workflow alerts', async () => {
    const { store, runs } = memStore()
    const { adapter } = fakeAdapter({
      insert: async () => {
        throw new Error('sab_brainrots insert: denied')
      },
    })
    await expect(runCatalogue(game(adapter), deps(store), opts)).rejects.toThrow(/denied/)
    expect(runs[0].report).toMatchObject({ status: 'failed', message: 'sab_brainrots insert: denied' })
  })

  it('revalidates rows whose missing image was fixed, too', async () => {
    const { store } = memStore()
    const { adapter } = fakeAdapter({ fixMissingImages: async () => ['old-brainrot'] })
    const d = deps(store)
    const report = await runCatalogue(game(adapter), d, opts)
    expect(report.imagesFixed).toBe(1)
    expect(d.revalidate).toHaveBeenCalledWith('steal-a-brainrot', ['slushi-huski', 'old-brainrot'])
  })

  it('looks back 30 days on a game\'s first run (no refs yet), 3 days after that', async () => {
    const { store } = memStore()
    const { adapter } = fakeAdapter()
    const since: string[] = []
    await runCatalogue(game(adapter), deps(store, { wiki: fakeWiki(pages, since) }), opts)
    await runCatalogue(game(adapter), deps(store, { wiki: fakeWiki(pages, since) }), opts)
    const days = since.map((s) => Math.round((NOW.getTime() - Date.parse(s)) / 86_400_000))
    expect(days).toEqual([30, 3])
  })

  it('enriches only the items being inserted, after the guards, and inserts the enriched version', async () => {
    const { store } = memStore()
    const seen: string[][] = []
    const { adapter, inserted } = fakeAdapter({
      enrich: async (items) => {
        seen.push(items.map((i) => i.slug))
        return items.map((i) => ({ ...i, origin: 'enriched' }))
      },
    })
    await runCatalogue(game(adapter), deps(store), opts)
    expect(seen).toEqual([['slushi-huski']])
    expect(inserted[0][0].origin).toBe('enriched')
  })

  it('never enriches a blocked run', async () => {
    const { store } = memStore()
    const enrich = vi.fn(async (items: ParsedItem[]) => items)
    const { adapter } = fakeAdapter({ insertCap: 0, enrich })
    await runCatalogue(game(adapter), deps(store), opts)
    expect(enrich).not.toHaveBeenCalled()
  })

  it('hands the wiki to the image retry', async () => {
    const { store } = memStore()
    const wiki = fakeWiki()
    const fix = vi.fn(async () => [] as string[])
    const { adapter } = fakeAdapter({ fixMissingImages: fix })
    await runCatalogue(game(adapter), deps(store, { wiki }), opts)
    expect(fix).toHaveBeenCalledWith(db, expect.anything(), wiki)
  })
})

