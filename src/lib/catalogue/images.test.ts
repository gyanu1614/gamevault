import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { createImageStore } from './images'
import type { Db, WikiClient } from './types'

const png = () => sharp({ create: { width: 900, height: 900, channels: 3, background: '#ff0000' } }).png().toBuffer()
const wiki = (urls: Record<string, string>) =>
  ({ imageUrls: async (files: string[]) => new Map(files.filter((f) => urls[f]).map((f) => [f, urls[f]])) }) as unknown as WikiClient
function fakeDb(fail = false) {
  const uploads: { bucket: string; path: string; bytes: Buffer; opts: Record<string, unknown> }[] = []
  const db = {
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, bytes: Buffer, opts: Record<string, unknown>) => {
          uploads.push({ bucket, path, bytes, opts })
          return { error: fail ? { message: 'denied' } : null }
        },
      }),
    },
  } as unknown as Db
  return { db, uploads }
}
const quiet = { sleep: async () => {}, log: () => {} }

describe('createImageStore', () => {
  it('downloads the rendition, converts to a 512 px WebP and uploads it', async () => {
    const body = await png()
    const { db, uploads } = fakeDb()
    const store = createImageStore({ ...quiet, db, wiki: wiki({ 'A.png': 'https://img/a.png' }), fetchImpl: (async () => new Response(body)) as typeof fetch })
    expect(await store.copy('A.png', { bucket: 'sab-brainrots', path: 'a.webp' })).toBe(true)
    expect(uploads[0]).toMatchObject({ bucket: 'sab-brainrots', path: 'a.webp', opts: { contentType: 'image/webp', upsert: true } })
    const meta = await sharp(uploads[0].bytes).metadata()
    expect([meta.format, meta.width]).toEqual(['webp', 512])
  })

  it('returns false, never throws, when the file, download or upload fails', async () => {
    expect(await createImageStore({ ...quiet, db: fakeDb().db, wiki: wiki({}) }).copy('Gone.png', { bucket: 'b', path: 'p' })).toBe(false)
    const notFound = (async () => new Response('', { status: 404 })) as typeof fetch
    expect(await createImageStore({ ...quiet, db: fakeDb().db, wiki: wiki({ 'A.png': 'https://img/a' }), fetchImpl: notFound }).copy('A.png', { bucket: 'b', path: 'p' })).toBe(false)
    const body = await png()
    const ok = (async () => new Response(body)) as typeof fetch
    expect(await createImageStore({ ...quiet, db: fakeDb(true).db, wiki: wiki({ 'A.png': 'https://img/a' }), fetchImpl: ok }).copy('A.png', { bucket: 'b', path: 'p' })).toBe(false)
    const broken = (async () => new Response('not an image')) as typeof fetch
    expect(await createImageStore({ ...quiet, db: fakeDb().db, wiki: wiki({ 'A.png': 'https://img/a' }), fetchImpl: broken }).copy('A.png', { bucket: 'b', path: 'p' })).toBe(false)
  })
})
