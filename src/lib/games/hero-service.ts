/**
 * Game hero upload / reposition / remove — the logic behind the admin server
 * actions in `src/lib/actions/game-hero.ts`, with its I/O injected so it can
 * be tested without storage or a database.
 *
 * Upload is two calls, because a 6 MB source does not fit a server-action
 * body (bodySizeLimit 4 MB, and Vercel caps a function request at 4.5 MB):
 *
 *   1. createHeroUploadCore — validates the declared type/size, checks the
 *      game exists, and mints a signed upload URL (service role) for a fresh
 *      `{gameId}/_source/{uuid}.{ext}` path. The browser PUTs the file there
 *      directly; the bucket's own 6 MB / MIME limits apply.
 *   2. processHeroCore — accepts only a source path minted for this game,
 *      downloads it, re-encodes it with sharp (hero-image.ts: WebP 960 /
 *      1600 / 2400 + LQIP, content-hashed names), uploads the variants with a
 *      one-year immutable cache, writes games.hero_bg_*, deletes the source
 *      and the previous hero's files, and revalidates that game's pages.
 *
 * The caller (the action) has already passed `requireAdmin()`.
 */
import 'server-only'

import {
  GAME_HERO_FOCAL_DEFAULT,
  GAME_HERO_MAX_BYTES,
  heroObjectPathFromUrl,
  heroSourcePath,
  isHeroSourcePath,
  parseHeroFocalY,
  parseHeroUploadRequest,
  resolveGameHero,
  type GameHero,
} from './hero'
import { heroColumnsFor, type HeroCrop, type ProcessedHero } from './hero-image'

export interface HeroGameRow {
  id: string
  slug: string
  hero_bg_url: string | null
  hero_bg_srcset: unknown
  hero_bg_blur: string | null
  hero_bg_focal_y: number | null
  hero_bg_updated_at: string | null
}

export type HeroColumnsPatch = Partial<Omit<HeroGameRow, 'id' | 'slug'>>

export interface HeroStore {
  readGame(gameId: string): Promise<HeroGameRow | null>
  createSignedUpload(path: string): Promise<{ token: string } | { error: string }>
  download(path: string): Promise<Uint8Array | null>
  upload(path: string, bytes: Uint8Array, contentType: string): Promise<{ error: string | null }>
  remove(paths: string[]): Promise<void>
  publicUrl(path: string): string
  updateGame(gameId: string, patch: HeroColumnsPatch): Promise<{ error: string | null }>
}

export interface HeroDeps {
  store: HeroStore
  processImage(gameId: string, bytes: Uint8Array, crop?: HeroCrop | null): Promise<ProcessedHero>
  /** Refresh every page of this game (revalidateTag(gameHeroTag(slug))). */
  revalidateGame(slug: string): void
  supabaseUrl: string | undefined
  now?: () => Date
  newId?: () => string
}

export type HeroUploadTicket = { ok: true; path: string; token: string } | { ok: false; error: string }
export type HeroResult = { ok: true; hero: GameHero; updatedAt: string | null } | { ok: false; error: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const GENERIC_ERROR = 'Could not save the hero image. Try again in a moment.'
const MISSING_SCHEMA =
  'The hero columns or the game-heroes bucket are missing — push migration 20261005000116_game_hero_backgrounds.sql, then try again.'

async function loadGame(deps: HeroDeps, gameId: unknown): Promise<HeroGameRow | { error: string }> {
  if (typeof gameId !== 'string' || !UUID.test(gameId)) return { error: 'Unknown game.' }
  const game = await deps.store.readGame(gameId)
  if (!game) return { error: 'Unknown game. Save the identity step first.' }
  return game
}

/** Every object path the stored hero points at (our bucket only). */
export function storedHeroPaths(row: Pick<HeroGameRow, 'hero_bg_url' | 'hero_bg_srcset'>, supabaseUrl: string | undefined): string[] {
  const urls: unknown[] = [row.hero_bg_url]
  if (row.hero_bg_srcset && typeof row.hero_bg_srcset === 'object' && !Array.isArray(row.hero_bg_srcset)) {
    urls.push(...Object.values(row.hero_bg_srcset as Record<string, unknown>))
  }
  const out = new Set<string>()
  for (const u of urls) {
    const p = heroObjectPathFromUrl(u, supabaseUrl)
    if (p) out.add(p)
  }
  return [...out]
}

function heroOf(row: HeroGameRow, deps: HeroDeps): GameHero {
  return resolveGameHero(row.slug, row, deps.supabaseUrl)
}

export async function createHeroUploadCore(
  deps: HeroDeps,
  gameId: unknown,
  file: { type?: unknown; size?: unknown } | null | undefined,
): Promise<HeroUploadTicket> {
  const req = parseHeroUploadRequest(file)
  if (!req.ok) return req
  const game = await loadGame(deps, gameId)
  if ('error' in game) return { ok: false, error: game.error }
  const path = heroSourcePath(game.id, (deps.newId ?? (() => crypto.randomUUID()))(), req.ext)
  const signed = await deps.store.createSignedUpload(path)
  if ('error' in signed) {
    console.error('[game-hero] signed upload failed', signed.error)
    return { ok: false, error: /bucket not found|not found/i.test(signed.error) ? MISSING_SCHEMA : GENERIC_ERROR }
  }
  return { ok: true, path, token: signed.token }
}

export async function processHeroCore(
  deps: HeroDeps,
  gameId: unknown,
  sourcePath: unknown,
  focalY?: unknown,
  crop?: unknown,
): Promise<HeroResult> {
  const game = await loadGame(deps, gameId)
  if ('error' in game) return { ok: false, error: game.error }
  if (!isHeroSourcePath(game.id, sourcePath)) return { ok: false, error: 'Upload the image again.' }

  let focal = GAME_HERO_FOCAL_DEFAULT
  if (focalY !== undefined) {
    const f = parseHeroFocalY(focalY)
    if (!f.ok) return { ok: false, error: f.error }
    focal = f.value
  }

  try {
    const bytes = await deps.store.download(sourcePath)
    if (!bytes || bytes.byteLength === 0) return { ok: false, error: 'The upload did not arrive. Try again.' }
    if (bytes.byteLength > GAME_HERO_MAX_BYTES) return { ok: false, error: 'Hero image must be 6 MB or smaller.' }

    const region = parseHeroCrop(crop)
    if (region === false) return { ok: false, error: 'The crop is not valid. Choose the area again.' }
    const processed = await deps.processImage(game.id, bytes, region)
    if (!processed.ok) return { ok: false, error: processed.error }

    for (const v of processed.variants) {
      const up = await deps.store.upload(v.path, v.bytes, 'image/avif')
      if (up.error) {
        console.error('[game-hero] variant upload failed', up.error)
        await deps.store.remove(processed.variants.map((x) => x.path))
        return { ok: false, error: GENERIC_ERROR }
      }
    }

    const nowIso = (deps.now ?? (() => new Date()))().toISOString()
    const patch = heroColumnsFor(processed, (p) => deps.store.publicUrl(p), focal, nowIso)
    const saved = await deps.store.updateGame(game.id, patch)
    if (saved.error) {
      console.error('[game-hero] games update failed', saved.error)
      await deps.store.remove(processed.variants.map((x) => x.path))
      return { ok: false, error: /hero_bg_/.test(saved.error) ? MISSING_SCHEMA : GENERIC_ERROR }
    }

    // The previous hero's files, unless the same image came back (same hash).
    const keep = new Set(processed.variants.map((v) => v.path))
    const stale = storedHeroPaths(game, deps.supabaseUrl).filter((p) => !keep.has(p))
    if (stale.length > 0) await deps.store.remove(stale)

    deps.revalidateGame(game.slug)
    return { ok: true, hero: heroOf({ ...game, ...patch }, deps), updatedAt: nowIso }
  } finally {
    // The untouched source never outlives the request.
    await deps.store.remove([sourcePath]).catch(() => {})
  }
}

/**
 * The admin's crop rectangle (source pixels) from the client: undefined/null
 * → no crop, a well-formed rectangle → it, anything else → false.
 */
export function parseHeroCrop(value: unknown): HeroCrop | null | false {
  if (value === undefined || value === null) return null
  if (typeof value !== 'object') return false
  const { x, y, width, height } = value as Record<string, unknown>
  const nums = [x, y, width, height]
  if (!nums.every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0)) return false
  if ((width as number) < 1 || (height as number) < 1) return false
  return { x: x as number, y: y as number, width: width as number, height: height as number }
}

export async function setHeroFocalCore(deps: HeroDeps, gameId: unknown, focalY: unknown): Promise<HeroResult> {
  const f = parseHeroFocalY(focalY)
  if (!f.ok) return { ok: false, error: f.error }
  const game = await loadGame(deps, gameId)
  if ('error' in game) return { ok: false, error: game.error }
  const nowIso = (deps.now ?? (() => new Date()))().toISOString()
  const saved = await deps.store.updateGame(game.id, { hero_bg_focal_y: f.value, hero_bg_updated_at: nowIso })
  if (saved.error) {
    console.error('[game-hero] focal update failed', saved.error)
    return { ok: false, error: /hero_bg_/.test(saved.error) ? MISSING_SCHEMA : GENERIC_ERROR }
  }
  deps.revalidateGame(game.slug)
  return { ok: true, hero: heroOf({ ...game, hero_bg_focal_y: f.value }, deps), updatedAt: nowIso }
}

export async function removeHeroCore(deps: HeroDeps, gameId: unknown): Promise<HeroResult> {
  const game = await loadGame(deps, gameId)
  if ('error' in game) return { ok: false, error: game.error }
  const nowIso = (deps.now ?? (() => new Date()))().toISOString()
  const cleared: HeroColumnsPatch = {
    hero_bg_url: null,
    hero_bg_srcset: null,
    hero_bg_blur: null,
    hero_bg_focal_y: GAME_HERO_FOCAL_DEFAULT,
    hero_bg_updated_at: nowIso,
  }
  const saved = await deps.store.updateGame(game.id, cleared)
  if (saved.error) {
    console.error('[game-hero] remove failed', saved.error)
    return { ok: false, error: GENERIC_ERROR }
  }
  const stale = storedHeroPaths(game, deps.supabaseUrl)
  if (stale.length > 0) await deps.store.remove(stale)
  deps.revalidateGame(game.slug)
  return { ok: true, hero: heroOf({ ...game, ...cleared }, deps), updatedAt: nowIso }
}

/** The real store: service-role storage + games writes. */
export function supabaseHeroStore(svc: any, bucket: string): HeroStore {
  return {
    async readGame(gameId) {
      const { data, error } = await svc
        .from('games')
        .select('id, slug, hero_bg_url, hero_bg_srcset, hero_bg_blur, hero_bg_focal_y, hero_bg_updated_at')
        .eq('id', gameId)
        .maybeSingle()
      if (error) throw new Error(error.message)
      return (data as HeroGameRow | null) ?? null
    },
    async createSignedUpload(path) {
      const { data, error } = await svc.storage.from(bucket).createSignedUploadUrl(path)
      if (error || !data?.token) return { error: String(error?.message ?? 'no token') }
      return { token: data.token as string }
    },
    async download(path) {
      const { data, error } = await svc.storage.from(bucket).download(path)
      if (error || !data) return null
      return new Uint8Array(await (data as Blob).arrayBuffer())
    },
    async upload(path, bytes, contentType) {
      const { error } = await svc.storage
        .from(bucket)
        // Content-hashed names never change content: cache for a year.
        .upload(path, bytes, { contentType, upsert: true, cacheControl: '31536000' })
      return { error: error ? String(error.message ?? error) : null }
    },
    async remove(paths) {
      if (paths.length > 0) await svc.storage.from(bucket).remove(paths)
    },
    publicUrl(path) {
      return svc.storage.from(bucket).getPublicUrl(path).data.publicUrl as string
    },
    async updateGame(gameId, patch) {
      const { error } = await svc.from('games').update(patch).eq('id', gameId)
      return { error: error ? String(error.message ?? error) : null }
    },
  }
}
