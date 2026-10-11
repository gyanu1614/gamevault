import { describe, it, expect, vi } from 'vitest'
import { createImageMaterialiser, previewImage, importImagePath } from './images'
import type { CatalogueItem, GameImportConfig } from './types'

const item = (ref: string, imageUrl: string | null = null): CatalogueItem =>
  ({ ref, name: ref.replace(/-/g, ' '), aliases: [], facts: {}, imageUrl })

const CONFIG = {
  wikiHost: 'adoptme.fandom.com',
  placeholderImage: '/icons/categories/items.svg',
} as GameImportConfig

/** Records uploads and hands back a predictable public URL. */
function storageStub(failOn?: string) {
  const uploads: Array<{ path: string; bytes: number; contentType?: string; cacheControl?: string; upsert?: boolean }> = []
  return {
    uploads,
    from(bucket: string) {
      return {
        async upload(p: string, body: Buffer, opts?: any) {
          if (failOn && p.includes(failOn)) return { error: { message: 'storage exploded' } }
          uploads.push({ path: p, bytes: body.length, ...opts })
          return { error: null }
        },
        getPublicUrl(p: string) {
          return { data: { publicUrl: `https://cdn.test/${bucket}/${p}` } }
        },
      }
    },
  }
}

const okResponse = (body: string) =>
  ({ ok: true, headers: new Headers(), arrayBuffer: async () => Buffer.from(body) }) as unknown as Response

const deps = (over: Partial<Parameters<typeof createImageMaterialiser>[0]> = {}) => ({
  storage: storageStub(),
  sellerId: 'store-1',
  encode: async (b: Buffer) => b,
  hash: async (b: Buffer) => `hash-${b.toString().replace(/\W/g, '')}`,
  readLocalAsset: async () => Buffer.from('placeholder-bytes'),
  fetchImpl: vi.fn(async () => okResponse('catalogue-bytes')) as any,
  ...over,
})

describe('previewImage — no network in a preview', () => {
  it('reports the catalogue image when there is one', () => {
    expect(previewImage(item('owl', 'https://x.test/owl.png'))).toEqual({ kind: 'catalogue', url: 'https://x.test/owl.png' })
  })

  it('reports pending when there is none, rather than guessing', () => {
    expect(previewImage(item('owl'))).toEqual({ kind: 'pending', url: null })
  })
})

describe('importImagePath', () => {
  it('lands under the store prefix the storage policy expects', () => {
    expect(importImagePath('store-1', 'abcdef0123456789aaaa')).toBe('store-1/import/abcdef0123456789.webp')
  })
})

describe('the source chain', () => {
  it('1. uses the catalogue image and copies it into our own bucket', async () => {
    const storage = storageStub()
    const m = createImageMaterialiser(deps({ storage }))
    const res = await m.materialise(item('owl', 'https://x.test/owl.png'), CONFIG)
    expect(res.kind).toBe('catalogue')
    // path carries the first 16 chars of the content hash
    expect(res.url).toBe('https://cdn.test/listing-images/store-1/import/hash-catalogueby.webp')
    // never hot-linked: the stored URL is ours, not the source's
    expect(res.url).not.toContain('x.test')
    expect(storage.uploads[0]).toMatchObject({ contentType: 'image/webp', upsert: true })
  })

  it('2. falls back to the wiki when the catalogue has no art', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes('fandom.com')) {
        return { ok: true, headers: new Headers(), json: async () => ({
          query: { pages: [{ title: 'File:Owl Pet.png', imageinfo: [{ url: 'https://static.test/owl.png' }] }] },
        }) } as unknown as Response
      }
      return okResponse('wiki-bytes')
    })
    const m = createImageMaterialiser(deps({ fetchImpl: fetchImpl as any }))
    const res = await m.materialise(item('owl'), CONFIG)
    expect(res.kind).toBe('wiki')
    expect(String((fetchImpl.mock.calls as unknown as string[][])[0][0])).toContain('generator=images')
  })

  it('3. falls back to the placeholder — a listing is never image-less', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes('fandom.com')) {
        return { ok: true, headers: new Headers(), json: async () => ({ query: { pages: [] } }) } as unknown as Response
      }
      return { ok: false, headers: new Headers() } as unknown as Response
    })
    const m = createImageMaterialiser(deps({ fetchImpl: fetchImpl as any }))
    const res = await m.materialise(item('owl'), CONFIG)
    expect(res.kind).toBe('placeholder')
    expect(res.url).toContain('/import/')
  })

  it('skips the wiki entirely for a game that declares no host', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, headers: new Headers() }) as unknown as Response)
    const m = createImageMaterialiser(deps({ fetchImpl: fetchImpl as any }))
    const res = await m.materialise(item('owl'), { placeholderImage: '/icons/categories/items.svg' } as GameImportConfig)
    expect(res.kind).toBe('placeholder')
    for (const call of fetchImpl.mock.calls as unknown as string[][]) expect(String(call[0])).not.toContain('fandom')
  })

  it('falls through when a download fails rather than throwing', async () => {
    const fetchImpl = vi.fn(async () => { throw new Error('network down') })
    const m = createImageMaterialiser(deps({ fetchImpl: fetchImpl as any }))
    const res = await m.materialise(item('owl', 'https://x.test/owl.png'), CONFIG)
    expect(res.kind).toBe('placeholder')
  })

  it('refuses an absurdly large source', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      headers: new Headers({ 'content-length': String(50 * 1024 * 1024) }),
      arrayBuffer: async () => Buffer.alloc(0),
    }) as unknown as Response)
    const m = createImageMaterialiser(deps({ fetchImpl: fetchImpl as any, readLocalAsset: async () => Buffer.from('ph') }))
    const res = await m.materialise(item('owl', 'https://x.test/huge.png'), CONFIG)
    expect(res.kind).toBe('placeholder')
  })
})

describe('the per-item cache', () => {
  it('uploads ONCE for an item however many variants reference it', async () => {
    const storage = storageStub()
    const m = createImageMaterialiser(deps({ storage }))
    const owl = item('owl', 'https://x.test/owl.png')
    const results = await Promise.all(['FR', 'NFR', 'MFR', 'N', 'NEON', 'MEGA', 'F', 'R'].map(() => m.materialise(owl, CONFIG)))
    expect(storage.uploads).toHaveLength(1)
    expect(new Set(results.map((r) => r.url)).size).toBe(1)
    expect(m.stats()).toMatchObject({ uploaded: 1, reused: 7 })
  })

  it('uploads separately for different items', async () => {
    const storage = storageStub()
    const m = createImageMaterialiser(deps({ storage, fetchImpl: vi.fn(async (u: string) => okResponse(u.includes('owl') ? 'owl-bytes' : 'crow-bytes')) as any }))
    await m.materialise(item('owl', 'https://x.test/owl.png'), CONFIG)
    await m.materialise(item('crow', 'https://x.test/crow.png'), CONFIG)
    expect(storage.uploads).toHaveLength(2)
  })

  it('counts what came from where, for the batch report', async () => {
    const m = createImageMaterialiser(deps())
    await m.materialise(item('owl', 'https://x.test/owl.png'), CONFIG)
    await m.materialise(item('no-art'), { placeholderImage: '/icons/categories/items.svg' } as GameImportConfig)
    expect(m.stats().byKind).toEqual({ catalogue: 1, wiki: 0, placeholder: 1 })
  })
})

describe('a storage failure is surfaced, not swallowed', () => {
  it('throws so the row is recorded as failed', async () => {
    const m = createImageMaterialiser(deps({ storage: storageStub('import') }))
    await expect(m.materialise(item('owl', 'https://x.test/owl.png'), CONFIG)).rejects.toThrow(/storage exploded/)
  })
})
