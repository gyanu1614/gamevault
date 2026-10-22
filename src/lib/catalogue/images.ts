/**
 * Copies a wiki image into our storage: the file's 512 px rendition from the
 * wiki's CDN → WebP (sharp) → the game's bucket. Never throws; a failed copy
 * returns false and the item is inserted without an image (hidden until a later
 * run's fixMissingImages succeeds).
 */
import sharp from 'sharp'
import { WIKI_USER_AGENT } from './wiki'
import type { Db, ImageStore, ImageTarget, WikiClient } from './types'

export const IMAGE_WIDTH = 512

export function createImageStore(options: {
  db: Db
  wiki: WikiClient
  fetchImpl?: typeof fetch
  sleep?: (ms: number) => Promise<void>
  log?: (message: string) => void
}): ImageStore {
  const doFetch = options.fetchImpl ?? fetch
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  const log = options.log ?? console.warn
  return {
    async copy(file: string, target: ImageTarget) {
      try {
        const url = (await options.wiki.imageUrls([file], IMAGE_WIDTH)).get(file)
        if (!url) {
          log(`image: the wiki has no file "${file}"`)
          return false
        }
        await sleep(500) // the CDN is not the API, but stay polite
        const res = await doFetch(url, { headers: { 'User-Agent': WIKI_USER_AGENT }, signal: AbortSignal.timeout(30_000) })
        if (!res.ok) {
          log(`image: ${file} answered HTTP ${res.status}`)
          return false
        }
        const webp = await sharp(Buffer.from(await res.arrayBuffer()))
          .resize({ width: IMAGE_WIDTH, withoutEnlargement: true })
          .webp({ quality: 86 })
          .toBuffer()
        const { error } = await options.db.storage
          .from(target.bucket)
          .upload(target.path, webp, { contentType: 'image/webp', upsert: true, cacheControl: '31536000' })
        if (error) {
          log(`image: upload ${target.bucket}/${target.path} failed: ${error.message}`)
          return false
        }
        return true
      } catch (e) {
        log(`image: ${file} failed: ${(e as Error).message}`)
        return false
      }
    },
  }
}
