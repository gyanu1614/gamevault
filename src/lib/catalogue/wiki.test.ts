import { describe, expect, it } from 'vitest'
import { createWikiClient, WikiError } from './wiki'

/** A fake fetch answering queued bodies; records each URL's params. */
function fakeFetch(answers: Array<{ status?: number; body?: unknown } | Error>) {
  const calls: URLSearchParams[] = []
  const impl = async (url: string | URL | Request) => {
    calls.push(new URL(String(url)).searchParams)
    const a = answers.shift()
    if (!a) throw new Error('no answer queued')
    if (a instanceof Error) throw a
    return new Response(JSON.stringify(a.body ?? {}), { status: a.status ?? 200 })
  }
  return { impl: impl as typeof fetch, calls }
}
const clock = () => {
  let t = 0
  const sleeps: number[] = []
  return {
    now: () => t,
    sleep: async (ms: number) => {
      sleeps.push(ms)
      t += ms
    },
    sleeps,
  }
}

describe('createWikiClient', () => {
  it('pages through continue and spaces calls by the minimum interval', async () => {
    const f = fakeFetch([
      { body: { query: { embeddedin: [{ pageid: 1, title: 'A' }] }, continue: { eicontinue: 'x', continue: '-||' } } },
      { body: { query: { embeddedin: [{ pageid: 2, title: 'B' }] } } },
    ])
    const c = clock()
    const wiki = createWikiClient({ host: 'w.test', fetchImpl: f.impl, now: c.now, sleep: c.sleep, minIntervalMs: 1000 })
    expect(await wiki.listPages({ list: 'embeddedin', title: 'Template:Brainrot Infobox' })).toEqual([
      { pageId: 1, title: 'A' },
      { pageId: 2, title: 'B' },
    ])
    expect(f.calls[0].get('eititle')).toBe('Template:Brainrot Infobox')
    expect(f.calls[1].get('eicontinue')).toBe('x')
    expect(c.sleeps).toEqual([1000])
    expect(wiki.requests()).toBe(2)
  })

  it('retries a 503 and a network error, but not a 404', async () => {
    const c = clock()
    const ok = createWikiClient({
      host: 'w.test',
      now: c.now,
      sleep: c.sleep,
      fetchImpl: fakeFetch([{ status: 503 }, new Error('reset'), { body: { parse: { wikitext: 'hi' } } }]).impl,
    })
    expect(await ok.wikitext('Update_Log')).toBe('hi')
    const notFound = createWikiClient({ host: 'w.test', now: c.now, sleep: c.sleep, fetchImpl: fakeFetch([{ status: 404 }]).impl })
    await expect(notFound.wikitext('X')).rejects.toBeInstanceOf(WikiError)
    const down = createWikiClient({ host: 'w.test', now: c.now, sleep: c.sleep, retries: 1, fetchImpl: fakeFetch([{ status: 500 }, { status: 500 }]).impl })
    await expect(down.wikitext('X')).rejects.toThrow(/gave up after 2 tries/)
  })

  it('fetches pages in batches of 50 and merges categories across continue', async () => {
    const ids = Array.from({ length: 51 }, (_, i) => i + 1)
    const f = fakeFetch([
      {
        body: {
          query: { pages: [{ pageid: 1, title: 'A', revisions: [{ revid: 7, slots: { main: { content: '{{X}}' } } }], categories: [{ title: 'Category:One' }] }] },
          continue: { clcontinue: '1|Two', continue: '||' },
        },
      },
      { body: { query: { pages: [{ pageid: 1, title: 'A', categories: [{ title: 'Category:Two' }] }] } } },
      { body: { query: { pages: [{ pageid: 51, title: 'Z', missing: true }] } } },
    ])
    const c = clock()
    const wiki = createWikiClient({ host: 'w.test', fetchImpl: f.impl, now: c.now, sleep: c.sleep })
    const pages = await wiki.fetchPages(ids)
    expect(pages).toEqual([{ pageId: 1, title: 'A', revisionId: 7, content: '{{X}}', categories: ['Category:One', 'Category:Two'] }])
    expect(f.calls[0].get('pageids')?.split('|')).toHaveLength(50)
    expect(f.calls[2].get('pageids')).toBe('51')
  })

  it('maps image files to their rendition URL through title normalisation', async () => {
    const f = fakeFetch([
      {
        body: {
          query: {
            normalized: [{ from: 'File:Slushi_Huski.png', to: 'File:Slushi Huski.png' }],
            pages: [
              { title: 'File:Slushi Huski.png', imageinfo: [{ url: 'https://img/full.png', thumburl: 'https://img/512.png' }] },
              { title: 'File:Gone.png', missing: true },
            ],
          },
        },
      },
    ])
    const c = clock()
    const wiki = createWikiClient({ host: 'w.test', fetchImpl: f.impl, now: c.now, sleep: c.sleep })
    const urls = await wiki.imageUrls(['Slushi_Huski.png', 'Gone.png'], 512)
    expect([...urls]).toEqual([['Slushi_Huski.png', 'https://img/512.png']])
    expect(f.calls[0].get('iiurlwidth')).toBe('512')
  })

  it('folds recent changes into one entry per page, new if any change created it', async () => {
    const f = fakeFetch([
      {
        body: {
          query: {
            recentchanges: [
              { type: 'edit', pageid: 5, title: 'Embergun' },
              { type: 'new', pageid: 5, title: 'Embergun' },
              { type: 'edit', pageid: 6, title: 'Harvester' },
            ],
          },
        },
      },
    ])
    const c = clock()
    const wiki = createWikiClient({ host: 'w.test', fetchImpl: f.impl, now: c.now, sleep: c.sleep })
    expect(await wiki.recentChanges('2026-10-18T00:00:00.000Z')).toEqual([
      { pageId: 5, title: 'Embergun', isNew: true },
      { pageId: 6, title: 'Harvester', isNew: false },
    ])
    expect(f.calls[0].get('rcend')).toBe('2026-10-18T00:00:00.000Z')
  })
})
