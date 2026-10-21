/**
 * MediaWiki API client for the catalogue run (Fandom wikis, CC BY-SA).
 * Polite by construction: one call at a time, at least `minIntervalMs` apart
 * (default 1 s), batches of 50, a timeout per call, and a short retry on
 * 429 / 5xx / network errors only. Anything else is a WikiError.
 */
import type { ListedPage, RecentPage, WikiClient, WikiListQuery, WikiPage } from './types'

export const WIKI_USER_AGENT = 'DropMarketBot/1.0 (+https://dropmarket.gg; values catalogue, 1 req/s)'
const BATCH = 50

export class WikiError extends Error {}

export interface WikiClientOptions {
  host: string
  fetchImpl?: typeof fetch
  minIntervalMs?: number
  timeoutMs?: number
  /** Extra attempts after a retryable failure (default 2). */
  retries?: number
  sleep?: (ms: number) => Promise<void>
  now?: () => number
}

/** "File:Slushi_Huski.png" and "File:Slushi Huski.png" are one file. */
const fileKey = (title: string) => title.replace(/_/g, ' ').trim().toLowerCase()

export function createWikiClient(options: WikiClientOptions): WikiClient {
  const doFetch = options.fetchImpl ?? fetch
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  const now = options.now ?? Date.now
  const gap = options.minIntervalMs ?? 1000
  const retries = options.retries ?? 2
  const endpoint = `https://${options.host}/api.php`
  let last = -Infinity
  let count = 0

  async function api(params: Record<string, string>): Promise<any> {
    const url = `${endpoint}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`
    for (let attempt = 0; ; attempt++) {
      const wait = last + gap - now()
      if (wait > 0) await sleep(wait)
      last = now()
      count++
      let status = 0
      try {
        const res = await doFetch(url, { headers: { 'User-Agent': WIKI_USER_AGENT }, signal: AbortSignal.timeout(options.timeoutMs ?? 30_000) })
        status = res.status
        if (res.ok) {
          const body = await res.json()
          if (body?.error) throw new WikiError(`${options.host}: ${body.error.code} ${body.error.info ?? ''}`.trim())
          return body
        }
        if (status !== 429 && status < 500) throw new WikiError(`${options.host}: HTTP ${status}`)
      } catch (e) {
        if (e instanceof WikiError) throw e
      }
      if (attempt >= retries) throw new WikiError(`${options.host}: gave up after ${attempt + 1} tries (last: ${status ? `HTTP ${status}` : 'network error'})`)
      await sleep(2000 * (attempt + 1))
    }
  }

  async function paged(params: Record<string, string>, take: (body: any) => void): Promise<void> {
    let cont: Record<string, string> = {}
    for (;;) {
      const body = await api({ ...params, ...cont })
      take(body)
      if (!body.continue) return
      cont = body.continue
    }
  }

  return {
    requests: () => count,

    async listPages(q: WikiListQuery) {
      const out: ListedPage[] = []
      const params =
        q.list === 'categorymembers'
          ? { action: 'query', list: 'categorymembers', cmtitle: q.title, cmlimit: '500', cmtype: 'page', cmnamespace: '0' }
          : { action: 'query', list: 'embeddedin', eititle: q.title, eilimit: '500', einamespace: '0' }
      await paged(params, (b) => {
        for (const m of b.query?.[q.list] ?? []) out.push({ pageId: m.pageid, title: m.title })
      })
      return out
    },

    async recentChanges(sinceIso: string) {
      const byId = new Map<number, RecentPage>()
      const params = { action: 'query', list: 'recentchanges', rcnamespace: '0', rctype: 'new|edit', rcprop: 'title|ids', rclimit: '500', rcend: sinceIso }
      await paged(params, (b) => {
        for (const c of b.query?.recentchanges ?? []) {
          const isNew = (byId.get(c.pageid)?.isNew ?? false) || c.type === 'new'
          byId.set(c.pageid, { pageId: c.pageid, title: c.title, isNew })
        }
      })
      return [...byId.values()]
    },

    async fetchPages(pageIds: number[]) {
      const pages = new Map<number, WikiPage>()
      for (let i = 0; i < pageIds.length; i += BATCH) {
        const params = {
          action: 'query',
          prop: 'revisions|categories',
          rvprop: 'content|ids',
          rvslots: 'main',
          cllimit: 'max',
          pageids: pageIds.slice(i, i + BATCH).join('|'),
        }
        await paged(params, (b) => {
          for (const p of b.query?.pages ?? []) {
            if (p.missing || p.invalid) continue
            const page = pages.get(p.pageid) ?? { pageId: p.pageid, title: p.title, revisionId: null, content: '', categories: [] }
            const rev = p.revisions?.[0]
            if (rev && !page.content) {
              page.content = rev.slots?.main?.content ?? ''
              page.revisionId = rev.revid ?? null
            }
            for (const c of p.categories ?? []) if (!page.categories.includes(c.title)) page.categories.push(c.title)
            pages.set(p.pageid, page)
          }
        })
      }
      return [...pages.values()]
    },

    async wikitext(title: string) {
      const b = await api({ action: 'parse', page: title, prop: 'wikitext' })
      return b.parse?.wikitext ?? ''
    },

    async imageUrls(files: string[], width: number) {
      const out = new Map<string, string>()
      for (let i = 0; i < files.length; i += BATCH) {
        const chunk = files.slice(i, i + BATCH)
        const b = await api({ action: 'query', prop: 'imageinfo', iiprop: 'url', iiurlwidth: String(width), titles: chunk.map((f) => `File:${f}`).join('|') })
        const back = new Map<string, string>(chunk.map((f) => [fileKey(`File:${f}`), f]))
        for (const n of b.query?.normalized ?? []) {
          const requested = back.get(fileKey(n.from))
          if (requested) back.set(fileKey(n.to), requested)
        }
        for (const p of b.query?.pages ?? []) {
          const info = p.imageinfo?.[0]
          const file = back.get(fileKey(p.title))
          if (info && file) out.set(file, info.thumburl ?? info.url)
        }
      }
      return out
    },
  }
}
