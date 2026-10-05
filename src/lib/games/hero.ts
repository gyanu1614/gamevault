/**
 * Game hero background — the rules, pure and client-safe.
 *
 * ONE hero image per game, shared by every page of that game (marketplace
 * category pages, the game landing, values / calculator / blog / sell hubs).
 * `GameHeroBackdrop` renders it; the admin game wizard uploads it; the
 * import script (`pnpm game-hero:import`) bulk-loads it.
 *
 * Resolution order (resolveGameHero):
 *   1. the admin upload — games.hero_bg_* (srcset of pre-sized WebPs + LQIP),
 *      only when every URL lives in our own `game-heroes` bucket;
 *   2. the static art the repo already ships for that game (STATIC_GAME_HEROES);
 *   3. nothing → the backdrop paints a neutral gradient from the page tokens.
 *
 * Self-contained on purpose (no `@/` imports, no TS-only runtime syntax): the
 * import script loads it with Node's type-stripper.
 */

export const GAME_HERO_BUCKET = 'game-heroes'
/** Largest source the uploader accepts (the bucket's file_size_limit). */
export const GAME_HERO_MAX_BYTES = 6 * 1024 * 1024
export const GAME_HERO_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const
export type GameHeroMime = (typeof GAME_HERO_MIME)[number]
export const GAME_HERO_EXT: Record<GameHeroMime, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
}

/** Vertical focal point, 0 (top) – 100 (bottom). 50 = centred. */
export const GAME_HERO_FOCAL_DEFAULT = 50
export const GAME_HERO_FOCAL_STEP = 5

/**
 * The desktop band the admin editor frames: a full-width hero at a 1440 px
 * viewport is ~560 px tall (`hub` size), so the slice the admin picks there
 * is what visitors see (narrower screens show the same focal point).
 */
export const GAME_HERO_FRAME_ASPECT = 1440 / 560

/**
 * Art the repo already ships per game — the fallback behind the upload.
 * Steal a Brainrot / Adopt Me: the values-hub art. Fortnite / Roblox /
 * Valorant: the landing art. Any other game: neutral gradient.
 */
export const STATIC_GAME_HEROES: Readonly<Record<string, string>> = {
  'steal-a-brainrot': '/assets/heroes/steal-a-brainrot.avif',
  'adopt-me': '/assets/heroes/adopt-me.avif',
  fortnite: '/hero/fortnite.jpg',
  roblox: '/hero/roblox.jpg',
  valorant: '/hero/valorant.jpg',
}

/** The columns the public read selects. */
export const GAME_HERO_COLUMNS = 'slug, hero_bg_url, hero_bg_srcset, hero_bg_blur, hero_bg_focal_y, hero_bg_updated_at'

export interface GameHeroRow {
  slug: string
  hero_bg_url?: string | null
  hero_bg_srcset?: unknown
  hero_bg_blur?: string | null
  hero_bg_focal_y?: number | null
  hero_bg_updated_at?: string | null
}

export interface HeroSource {
  width: number
  url: string
}

export type GameHero =
  | {
      kind: 'upload'
      /** Default src (the 1600 w file, else the widest under it). */
      src: string
      /** Ascending by width. */
      sources: HeroSource[]
      /** `srcset` attribute value. */
      srcSet: string
      /** LQIP data: URL, or null. */
      blur: string | null
      focalY: number
    }
  | { kind: 'static'; src: string; focalY: number }
  | { kind: 'none'; focalY: number }

// ─── Focal point ────────────────────────────────────────────────────────────

/** Lenient: any stored / client value → an integer 0–100 (junk → centred). */
export function clampHeroFocalY(value: unknown): number {
  const n =
    typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN
  if (!Number.isFinite(n)) return GAME_HERO_FOCAL_DEFAULT
  return Math.min(100, Math.max(0, Math.round(n)))
}

/** Strict: what the server action accepts — a finite number 0–100, never clamped. */
export function parseHeroFocalY(value: unknown): { ok: true; value: number } | { ok: false; error: string } {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
    return { ok: false, error: 'Hero position must be between 0 and 100.' }
  }
  return { ok: true, value: Math.round(value) }
}

/** CSS `object-position` for a focal point. */
export function heroObjectPosition(focalY: unknown): string {
  return `50% ${clampHeroFocalY(focalY)}%`
}

// ─── URLs ───────────────────────────────────────────────────────────────────

/**
 * True only for a public URL in our own `game-heroes` bucket, with no
 * characters that could break out of an HTML/CSS attribute. Anything else in
 * the hero columns is never rendered.
 */
export function isGameHeroUrl(url: unknown, supabaseUrl: string | undefined): url is string {
  if (typeof url !== 'string' || !url || !supabaseUrl) return false
  const base = supabaseUrl.replace(/\/+$/, '')
  const prefix = `${base}/storage/v1/object/public/${GAME_HERO_BUCKET}/`
  if (!url.startsWith(prefix) || url.length <= prefix.length) return false
  return !/["'()\s<>\\,]/.test(url)
}

/** A data:image LQIP that is safe to inline into a CSS url(). */
export function isHeroBlur(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= 1600 &&
    /^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/]+=*$/.test(value)
  )
}

/** `{"960": url, …}` → validated sources, ascending by width. */
export function parseHeroSrcset(value: unknown, supabaseUrl: string | undefined): HeroSource[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return []
  const out: HeroSource[] = []
  for (const [key, url] of Object.entries(value as Record<string, unknown>)) {
    const width = Number(key)
    if (!Number.isInteger(width) || width < 100 || width > 8000) continue
    if (!isGameHeroUrl(url, supabaseUrl)) continue
    out.push({ width, url })
  }
  return out.sort((a, b) => a.width - b.width)
}

export function heroSrcSetAttr(sources: HeroSource[]): string {
  return sources.map((s) => `${s.url} ${s.width}w`).join(', ')
}

/** The default `src`: the 1600 w file, else the widest below it, else the narrowest. */
export function pickDefaultSource(sources: HeroSource[]): HeroSource | null {
  if (sources.length === 0) return null
  const under = sources.filter((s) => s.width <= 1600)
  return under.length > 0 ? under[under.length - 1] : sources[0]
}

// ─── Resolution ─────────────────────────────────────────────────────────────

/** Upload → static art → none. `row` may be null (game unknown / read failed). */
export function resolveGameHero(
  slug: string,
  row: GameHeroRow | null | undefined,
  supabaseUrl: string | undefined,
): GameHero {
  const focalY = clampHeroFocalY(row?.hero_bg_focal_y)
  if (row) {
    let sources = parseHeroSrcset(row.hero_bg_srcset, supabaseUrl)
    if (sources.length === 0 && isGameHeroUrl(row.hero_bg_url, supabaseUrl)) {
      sources = [{ width: 1600, url: row.hero_bg_url }]
    }
    const fallbackSrc = pickDefaultSource(sources)
    if (fallbackSrc) {
      const src = isGameHeroUrl(row.hero_bg_url, supabaseUrl) ? row.hero_bg_url : fallbackSrc.url
      return {
        kind: 'upload',
        src,
        sources,
        srcSet: heroSrcSetAttr(sources),
        blur: isHeroBlur(row.hero_bg_blur) ? row.hero_bg_blur : null,
        focalY,
      }
    }
  }
  const staticSrc = STATIC_GAME_HEROES[slug]
  if (staticSrc) return { kind: 'static', src: staticSrc, focalY }
  return { kind: 'none', focalY }
}

// ─── Upload request ─────────────────────────────────────────────────────────

export type HeroUploadRequest = { ok: true; mime: GameHeroMime; ext: string } | { ok: false; error: string }

/** The browser's declared file: an accepted type, non-empty, at most 6 MB. */
export function parseHeroUploadRequest(file: { type?: unknown; size?: unknown } | null | undefined): HeroUploadRequest {
  const type = typeof file?.type === 'string' ? (file.type === 'image/jpg' ? 'image/jpeg' : file.type) : ''
  if (!(GAME_HERO_MIME as readonly string[]).includes(type)) {
    return { ok: false, error: 'Use a JPG, PNG, WebP or AVIF image.' }
  }
  const size = typeof file?.size === 'number' ? file.size : NaN
  if (!Number.isFinite(size) || size <= 0) return { ok: false, error: 'That file is empty.' }
  if (size > GAME_HERO_MAX_BYTES) return { ok: false, error: 'Hero image must be 6 MB or smaller.' }
  const mime = type as GameHeroMime
  return { ok: true, mime, ext: GAME_HERO_EXT[mime] }
}

/** Where the browser uploads the untouched source (deleted after processing). */
export function heroSourcePath(gameId: string, id: string, ext: string): string {
  return `${gameId}/_source/${id}.${ext}`
}

/** True for a source path minted for this game (the process step accepts nothing else). */
export function isHeroSourcePath(gameId: string, path: unknown): path is string {
  if (typeof path !== 'string') return false
  const prefix = `${gameId}/_source/`
  return path.startsWith(prefix) && /^[A-Za-z0-9-]+\.(jpg|png|webp|avif)$/.test(path.slice(prefix.length))
}

/** Storage object path from one of our public URLs (null for anything else). */
export function heroObjectPathFromUrl(url: unknown, supabaseUrl: string | undefined): string | null {
  if (!isGameHeroUrl(url, supabaseUrl)) return null
  const marker = `/storage/v1/object/public/${GAME_HERO_BUCKET}/`
  return url.slice(url.indexOf(marker) + marker.length)
}
