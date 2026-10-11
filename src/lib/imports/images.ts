/**
 * Step 4 bulk importer — every imported listing gets a real image, in OUR bucket.
 *
 * Source order, per the step spec: the game's catalogue → the game's wiki → a
 * per-game placeholder. Nothing is hot-linked: the bytes are fetched once,
 * re-encoded to WebP and uploaded under the store's own prefix in
 * `listing-images`, so a listing keeps its picture even if the source disappears.
 * This is the same content-hash + immutable-cache approach as the game icons
 * (`lib/games/icons.ts`), reusing its cache constants; the encode differs because
 * a listing photo is one larger non-square image rather than three square icons.
 *
 * WHEN the work happens matters:
 *   · preview  — `previewImage` only reports what the catalogue already holds.
 *                No network, so a 500-row preview stays instant, and the admin
 *                sees image coverage before committing to an import.
 *   · apply    — `createImageMaterialiser` does the fetch / encode / upload,
 *                cached per catalogue item so a pet's eight variants share one
 *                upload instead of eight identical ones.
 *
 * A failed image is never a failed row: the chain falls through to the
 * placeholder, because a listing with no image at all is worse than a listing
 * with a generic one (and the step spec forbids the former outright).
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { IMMUTABLE_CACHE_SECONDS, type StorageLike } from '@/lib/games/icons'
import { LISTING_IMAGE_BUCKET } from '@/lib/listings/images'
import { fetchWikiImage, WIKI_UA, type FetchLike } from './wiki'
import type { CatalogueItem, GameImportConfig } from './types'

/** One image per listing, big enough for the detail page's hero. */
export const IMPORT_IMAGE_SIZE = 640
/**
 * Small catalogue renders are upscaled to this long edge at import time.
 *
 * Measured 2026-09-30: the clean per-pet renders every source offers are Roblox
 * INVENTORY ICONS — 128×128 from adoptmevalues (the production catalogue), 70×70
 * from the wiki. No source has a large clean render; the large wiki files are
 * gameplay screenshots or promo art with text baked in. The listing gallery
 * draws at 360 CSS px (720 device px on retina), so the browser was stretching
 * a 128px icon ~5.6× with its blurry default filter. Upscaling once with
 * lanczos3 plus a gentle sharpen is visibly crisper at 2×; beyond ~2× no filter
 * recovers detail that is not there, which is why the page should also draw
 * small images near their own size rather than fill the gallery.
 */
export const SMALL_SOURCE_TARGET = 256
/** Byte budget for the encoded WebP. Well inside any bucket cap. */
export const MAX_IMPORT_IMAGE_BYTES = 120 * 1024
/** Refuse an absurd download before decoding it. */
export const MAX_SOURCE_BYTES = 8 * 1024 * 1024

export type ImageSourceKind = 'catalogue' | 'wiki' | 'placeholder'

export interface MaterialisedImage {
  /** Public URL inside our own bucket. */
  url: string
  kind: ImageSourceKind
}

/** What a preview can say without touching the network. */
export type PreviewImage =
  | { kind: 'catalogue'; url: string }
  /** No catalogue art: the wiki is tried at apply time, placeholder if it misses. */
  | { kind: 'pending'; url: null }

export function previewImage(item: CatalogueItem): PreviewImage {
  return item.imageUrl ? { kind: 'catalogue', url: item.imageUrl } : { kind: 'pending', url: null }
}

// ── encode ──────────────────────────────────────────────────────────────────

/**
 * Re-encode to a single WebP no larger than IMPORT_IMAGE_SIZE on its long edge.
 *
 * `fit: 'inside'` (not the icons' `contain`): a listing photo keeps its own
 * aspect ratio — letterboxing a tall pet render onto a square canvas is what
 * makes a card look wrong. Quality steps down until it fits the byte budget.
 *
 * `sharp` is imported dynamically so this module stays importable from the
 * Next.js app for its pure helpers.
 */
export async function encodeImportImage(source: Buffer): Promise<Buffer> {
  const { default: sharp } = await import('sharp')
  const meta = await sharp(source).metadata()
  const longEdge = Math.max(meta.width ?? 0, meta.height ?? 0)
  const small = longEdge > 0 && longEdge < SMALL_SOURCE_TARGET

  let out: Buffer | null = null
  for (const quality of [88, 80, 70, 58, 45]) {
    const pipeline = small
      ? // An inventory icon: enlarge once, properly, and keep its transparency.
        sharp(source)
          .resize(SMALL_SOURCE_TARGET, SMALL_SOURCE_TARGET, {
            fit: 'inside',
            kernel: 'lanczos3',
            withoutEnlargement: false,
          })
          .sharpen({ sigma: 0.8, m1: 0.8, m2: 2 })
      : // A real photo or render: only ever shrink it.
        sharp(source).resize(IMPORT_IMAGE_SIZE, IMPORT_IMAGE_SIZE, {
          fit: 'inside',
          withoutEnlargement: true,
        })
    out = await pipeline.webp({ quality, effort: 4, alphaQuality: 100 }).toBuffer()
    if (out.length <= MAX_IMPORT_IMAGE_BYTES) break
  }
  if (!out) throw new Error('encode produced no bytes')
  return out
}

/**
 * `${sellerId}/import/${hash}.webp`.
 *
 * The seller prefix is the convention the `listing-images` storage policy
 * checks for JWT callers (`isOwnedListingImagePath`); the importer writes with
 * the service role but keeps the shape so the object is owned like any other of
 * that store's images. Content-hashed, so re-importing the same art is an
 * idempotent overwrite rather than a new object.
 */
export function importImagePath(sellerId: string, hash: string): string {
  return `${sellerId}/import/${hash.slice(0, 16)}.webp`
}

// ── the materialiser ────────────────────────────────────────────────────────

export interface MaterialiserDeps {
  storage: StorageLike
  /** The store the listings belong to; its prefix owns the objects. */
  sellerId: string
  fetchImpl?: FetchLike
  /** Injected for tests; defaults to sharp. */
  encode?: (source: Buffer) => Promise<Buffer>
  /** Injected for tests; defaults to sha256. */
  hash?: (b: Buffer) => Promise<string>
  /** Injected for tests; defaults to reading from public/. */
  readLocalAsset?: (assetPath: string) => Promise<Buffer>
}

async function defaultHash(b: Buffer): Promise<string> {
  const { createHash } = await import('node:crypto')
  return createHash('sha256').update(b).digest('hex')
}

/** Local placeholder assets live in `public/`. */
async function defaultReadLocalAsset(assetPath: string): Promise<Buffer> {
  return readFile(path.join(process.cwd(), 'public', assetPath.replace(/^\//, '')))
}

async function download(url: string, fetchImpl: FetchLike): Promise<Buffer | null> {
  try {
    const res = await fetchImpl(url, { headers: { 'user-agent': WIKI_UA } })
    if (!res.ok) return null
    const len = Number(res.headers.get('content-length') ?? 0)
    if (len > MAX_SOURCE_BYTES) return null
    const buf = Buffer.from(await res.arrayBuffer())
    return buf.length > 0 && buf.length <= MAX_SOURCE_BYTES ? buf : null
  } catch {
    return null
  }
}

export interface ImageMaterialiser {
  /** Fetch → encode → upload, or reuse the upload a sibling variant already did. */
  materialise(item: CatalogueItem, config: GameImportConfig): Promise<MaterialisedImage>
  /** How many distinct uploads this run performed (for the batch report). */
  stats(): { uploaded: number; reused: number; byKind: Record<ImageSourceKind, number> }
}

/**
 * One materialiser per import run. The per-item cache is the reason a 1,000-row
 * batch of eight variants each is ~125 uploads, not 1,000.
 */
export function createImageMaterialiser(deps: MaterialiserDeps): ImageMaterialiser {
  const fetchImpl = deps.fetchImpl ?? fetch
  const encode = deps.encode ?? encodeImportImage
  const hash = deps.hash ?? defaultHash
  const readLocalAsset = deps.readLocalAsset ?? defaultReadLocalAsset

  const cache = new Map<string, Promise<MaterialisedImage>>()
  let uploaded = 0
  let reused = 0
  const byKind: Record<ImageSourceKind, number> = { catalogue: 0, wiki: 0, placeholder: 0 }

  async function upload(bytes: Buffer, kind: ImageSourceKind): Promise<MaterialisedImage> {
    const encoded = await encode(bytes)
    const digest = await hash(encoded)
    const objectPath = importImagePath(deps.sellerId, digest)
    const bucket = deps.storage.from(LISTING_IMAGE_BUCKET)
    const { error } = await bucket.upload(objectPath, encoded, {
      contentType: 'image/webp',
      cacheControl: IMMUTABLE_CACHE_SECONDS,
      // Same bytes → same path, so a repeat is a no-op overwrite.
      upsert: true,
    })
    if (error) throw new Error(`upload ${objectPath}: ${error.message}`)
    uploaded += 1
    byKind[kind] += 1
    return { url: bucket.getPublicUrl(objectPath).data.publicUrl, kind }
  }

  async function resolve(item: CatalogueItem, config: GameImportConfig): Promise<MaterialisedImage> {
    // 1. the catalogue's own art
    if (item.imageUrl) {
      const bytes = await download(item.imageUrl, fetchImpl)
      if (bytes) return upload(bytes, 'catalogue')
    }
    // 2. the game's wiki, by the item's own name
    if (config.wikiHost) {
      const wikiUrl = await fetchWikiImage(config.wikiHost, item.name, fetchImpl)
      if (wikiUrl) {
        const bytes = await download(wikiUrl, fetchImpl)
        if (bytes) return upload(bytes, 'wiki')
      }
    }
    // 3. the per-game placeholder — a listing is never image-less
    const bytes = await readLocalAsset(config.placeholderImage)
    return upload(bytes, 'placeholder')
  }

  return {
    materialise(item, config) {
      const key = item.ref
      const hit = cache.get(key)
      if (hit) {
        reused += 1
        return hit
      }
      const promise = resolve(item, config)
      cache.set(key, promise)
      return promise
    },
    stats: () => ({ uploaded, reused, byKind: { ...byKind } }),
  }
}
