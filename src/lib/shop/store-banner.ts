/**
 * Store banner rules — pure, client-safe (no server imports).
 *
 *  - WHO may upload: a seller whose CURRENT rank (`profiles.seller_tier`) is
 *    Silver or above. The server action checks this before it writes, and
 *    the DB trigger `validate_banner_update` checks it again against
 *    `seller_tier_config.banner_access` (migration …_store_banners).
 *  - WHAT renders: a stored banner only while the seller is still Silver+
 *    and only when it lives in our own `store-banners` bucket. A seller who
 *    drops below Silver keeps the file (no destructive cleanup); the shop
 *    just shows the default art until they climb back.
 *  - The default art is generated in code from the seller id, so every shop
 *    has its own consistent banner without an image request.
 */

import { isValidTier, tierIndex } from '@/lib/seller/tiers'

export const STORE_BANNER_BUCKET = 'store-banners'
/** Lowest rank that may upload a banner. */
export const STORE_BANNER_MIN_TIER = 'silver' as const
/** Largest file the uploader accepts (its base64 request fits bodySizeLimit = 4mb). */
export const STORE_BANNER_MAX_BYTES = 2.5 * 1024 * 1024
export const STORE_BANNER_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const
export type StoreBannerMime = (typeof STORE_BANNER_MIME)[number]
/** What the stored banner is cropped to (3.75 : 1). */
export const STORE_BANNER_WIDTH = 1500
export const STORE_BANNER_HEIGHT = 400
/** Narrower than this and the banner is visibly soft on a desktop shop. */
export const STORE_BANNER_MIN_WIDTH = 800

// ─── Display + focal point ──────────────────────────────────────────────────

/**
 * The public header strip, in CSS px: phone / tablet / desktop heights, and
 * the widest content box it is drawn in (max-w-7xl minus lg padding). The
 * settings editor frames the banner at the WIDEST desktop shape, where the
 * vertical crop is deepest, so the slice the seller picks is what visitors
 * see (narrower screens show the same focal point with a little more).
 */
export const STORE_BANNER_DISPLAY = {
  phoneHeight: 132,
  tabletHeight: 172,
  desktopHeight: 212,
  desktopMaxWidth: 1216,
} as const
/** Aspect (w / h) of the settings editor frame. */
export const STORE_BANNER_FRAME_ASPECT = STORE_BANNER_DISPLAY.desktopMaxWidth / STORE_BANNER_DISPLAY.desktopHeight
/** Aspect of the stored image. */
export const STORE_BANNER_ASPECT = 1500 / 400

/** Vertical focal point, 0 (top) – 100 (bottom). 50 = centred. */
export const STORE_BANNER_FOCAL_DEFAULT = 50
/** Keyboard step in the editor (arrow keys). */
export const STORE_BANNER_FOCAL_STEP = 5

/**
 * Lenient: any stored / client value → an integer 0–100 (non-numbers and
 * NaN → centred). For rendering and for the editor's live value.
 */
export function clampBannerFocalY(value: unknown): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN
  if (!Number.isFinite(n)) return STORE_BANNER_FOCAL_DEFAULT
  return Math.min(100, Math.max(0, Math.round(n)))
}

/**
 * Strict: what the server action accepts. A finite NUMBER within 0–100
 * (rounded to an integer); anything else is refused, never silently clamped.
 */
export function parseBannerFocalY(value: unknown): { ok: true; value: number } | { ok: false; error: string } {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
    return { ok: false, error: 'Banner position must be between 0 and 100.' }
  }
  return { ok: true, value: Math.round(value) }
}

/** CSS `object-position` for a focal point. */
export function bannerObjectPosition(focalY: unknown): string {
  return `50% ${clampBannerFocalY(focalY)}%`
}

/**
 * Editor geometry: with the image drawn full-width at its own aspect inside
 * the frame, how far (px) it can travel up, and the translate for a focal
 * point (0 → top edge visible, 100 → bottom edge visible). Matches
 * `object-fit: cover` + `object-position: 50% y%` whenever the frame is
 * wider than the image's aspect (always true for the desktop strip).
 */
export function bannerTravel(frameWidth: number, frameAspect = STORE_BANNER_FRAME_ASPECT, imageAspect = STORE_BANNER_ASPECT): number {
  if (!(frameWidth > 0)) return 0
  return Math.max(0, frameWidth / imageAspect - frameWidth / frameAspect)
}
export function focalToOffset(focalY: number, travel: number): number {
  return travel > 0 ? -(clampBannerFocalY(focalY) / 100) * travel : 0
}
export function offsetToFocal(offset: number, travel: number): number {
  return travel > 0 ? clampBannerFocalY((-offset / travel) * 100) : STORE_BANNER_FOCAL_DEFAULT
}

/** True when this rank may upload (and show) a custom store banner. */
export function canUploadStoreBanner(tier: string | null | undefined): boolean {
  if (!isValidTier(tier)) return false
  return tierIndex(tier) >= tierIndex(STORE_BANNER_MIN_TIER)
}

/**
 * True only for a public URL in our own `store-banners` bucket. Anything
 * else in `profiles.banner_url` (a legacy value, a hand-set external URL) is
 * never rendered on the public page.
 */
export function isStoreBannerUrl(
  url: string | null | undefined,
  supabaseUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL,
): url is string {
  if (!url || !supabaseUrl) return false
  const base = supabaseUrl.replace(/\/+$/, '')
  const prefix = `${base}/storage/v1/object/public/${STORE_BANNER_BUCKET}/`
  if (!url.startsWith(prefix)) return false
  // No quotes, whitespace or parens: the URL is used inside CSS/HTML attrs.
  return !/["'()\s<>\\]/.test(url)
}

export type ResolvedStoreBanner = { kind: 'custom'; url: string; focalY: number } | { kind: 'default' }

/** The render rule: custom only for a Silver+ seller with a banner in our bucket. */
export function resolveStoreBanner(
  input: { bannerUrl: string | null | undefined; tier: string | null | undefined; focalY?: unknown },
  supabaseUrl?: string,
): ResolvedStoreBanner {
  if (canUploadStoreBanner(input.tier) && isStoreBannerUrl(input.bannerUrl, supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL)) {
    return { kind: 'custom', url: input.bannerUrl, focalY: clampBannerFocalY(input.focalY) }
  }
  return { kind: 'default' }
}

// ─── Default art ────────────────────────────────────────────────────────────

/** FNV-1a — a stable 32-bit hash of the seller id. */
function hash32(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

/**
 * Muted washes laid at low alpha over the near-black card base. No lime and
 * no glow (card-surface system): each one reads as a tint of black.
 */
const WASHES = [
  '94,114,160', // slate blue
  '72,140,140', // teal
  '124,104,168', // violet
  '168,128,84', // amber
  '160,96,116', // rose
  '96,140,108', // sage
] as const

export interface DefaultBannerArt {
  /** CSS `background` for the banner box. */
  background: string
}

/**
 * Generated banner for a seller with no custom one: the card gradient, a
 * soft wash in one of six muted tints, a neutral light pool, and a fine
 * diagonal line texture. Seeded by the seller id, so the same shop always
 * gets the same art and neighbouring shops differ.
 */
export function defaultBannerArt(seed: string): DefaultBannerArt {
  const h = hash32(seed || 'dropmarket')
  const wash = WASHES[h % WASHES.length]
  const washX = 15 + ((h >>> 3) % 70) // 15–84 %
  const lightX = 100 - washX
  const angle = 30 + ((h >>> 9) % 4) * 30 // 30 / 60 / 90 / 120 deg
  const spacing = 14 + ((h >>> 13) % 3) * 4 // 14 / 18 / 22 px

  const layers = [
    // fine line texture
    `repeating-linear-gradient(${angle}deg, rgba(255,255,255,0.028) 0 1px, transparent 1px ${spacing}px)`,
    // tinted wash
    `radial-gradient(ellipse 60% 120% at ${washX}% 100%, rgba(${wash},0.22), transparent 70%)`,
    // neutral light pool
    `radial-gradient(ellipse 50% 90% at ${lightX}% 0%, rgba(255,255,255,0.05), transparent 70%)`,
    // base (card gradient)
    'linear-gradient(180deg, #212228 0%, #16171B 100%)',
  ]
  return { background: layers.join(', ') }
}

// ─── Upload payload ─────────────────────────────────────────────────────────

export type ParsedBanner =
  | { ok: true; mime: StoreBannerMime; bytes: Uint8Array }
  | { ok: false; error: string }

/** The magic bytes each accepted type starts with. */
function sniffMime(bytes: Uint8Array): StoreBannerMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return 'image/png'
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return 'image/webp'
  return null
}

function base64ToBytes(b64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(b64, 'base64'))
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/**
 * Validate the data URL the settings card posts: an accepted type, at most
 * 2.5 MB, and bytes that really are that type (the declared type alone is
 * whatever the browser — or a hand-made request — says).
 */
export function parseBannerDataUrl(dataUrl: unknown): ParsedBanner {
  if (typeof dataUrl !== 'string') return { ok: false, error: 'Choose an image to upload.' }
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl)
  if (!match) return { ok: false, error: 'Use a JPG, PNG or WebP image.' }
  const declared = match[1] as StoreBannerMime
  // Cheap size check before decoding: base64 is 4/3 of the bytes.
  if (Math.floor((match[2].length * 3) / 4) > STORE_BANNER_MAX_BYTES + 3) {
    return { ok: false, error: 'Banner must be 2.5 MB or smaller.' }
  }
  const bytes = base64ToBytes(match[2])
  if (bytes.byteLength === 0) return { ok: false, error: 'That file is empty.' }
  if (bytes.byteLength > STORE_BANNER_MAX_BYTES) return { ok: false, error: 'Banner must be 2.5 MB or smaller.' }
  const actual = sniffMime(bytes)
  if (!actual || actual !== declared) return { ok: false, error: 'That file is not a valid JPG, PNG or WebP image.' }
  return { ok: true, mime: actual, bytes }
}
