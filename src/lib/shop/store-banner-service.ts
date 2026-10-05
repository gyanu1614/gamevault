/**
 * Store banner upload / remove — the logic behind the server actions in
 * `src/lib/actions/store-banner.ts`, with its I/O injected so the tier gate
 * can be tested without a database.
 *
 * Enforcement (the action is the ONLY writer):
 *   1. the caller is signed in and is a seller;
 *   2. their CURRENT rank (`profiles.seller_tier`, read with the service role
 *      at request time — never from the client) is Silver or above;
 *   3. the payload is a real JPG/PNG/WebP of at most 2.5 MB;
 *   4. sharp re-encodes it to a 1500 × 400 WebP (strips metadata);
 *   5. the service role uploads it to the `store-banners` bucket, which has
 *      no write policy for anon/authenticated, and sets `profiles.banner_url`
 *      — the DB trigger re-checks the rank and refuses non-service writers.
 *
 * The focal point (`profiles.banner_focal_y`, 0–100: which horizontal slice
 * of the banner the short header strip shows) follows the same path: same
 * owner + Silver+ gate, strict 0–100 validation, service-role write; the
 * trigger refuses a focal change from any other writer
 * (migration …_store_banner_focal_y).
 */
import 'server-only'

import { tierLabel } from '@/lib/seller/tiers'
import {
  canUploadStoreBanner,
  clampBannerFocalY,
  isStoreBannerUrl,
  parseBannerDataUrl,
  parseBannerFocalY,
  STORE_BANNER_FOCAL_DEFAULT,
  STORE_BANNER_BUCKET,
  STORE_BANNER_MIN_TIER,
} from './store-banner'
import type { StoreBannerImage } from './store-banner-image'

export interface BannerSeller {
  role: string | null
  seller_tier: string | null
  shop_slug: string | null
  username: string | null
  banner_url: string | null
  banner_focal_y?: number | null
}

/** What one profile write changes (omitted keys are left alone). */
export interface BannerPatch {
  url?: string | null
  focalY?: number
}

export interface BannerStore {
  readSeller(userId: string): Promise<BannerSeller | null>
  upload(path: string, bytes: Uint8Array, contentType: string): Promise<{ error: string | null }>
  remove(path: string): Promise<void>
  publicUrl(path: string): string
  setBanner(userId: string, patch: BannerPatch): Promise<{ error: string | null }>
}

export interface BannerDeps {
  userId: string | null
  store: BannerStore
  processImage(bytes: Uint8Array): Promise<StoreBannerImage>
  revalidateShop(slug: string): void
  now?: () => number
}

export type BannerResult = { ok: true; bannerUrl: string | null } | { ok: false; error: string }
export type BannerFocalResult = { ok: true; focalY: number } | { ok: false; error: string }

export interface MyStoreBanner {
  tier: string
  tierLabel: string
  canUpload: boolean
  /** The stored banner when it is one of ours (shown in settings even if hidden). */
  bannerUrl: string | null
  /** Saved vertical focal point, 0–100. */
  focalY: number
  shopHref: string | null
}

export const BANNER_TIER_ERROR = `Store banners unlock at ${tierLabel(STORE_BANNER_MIN_TIER)} rank.`
const GENERIC_ERROR = 'Could not save your banner. Try again in a moment.'

export function bannerObjectPath(userId: string): string {
  return `${userId}/banner.webp`
}

async function loadSeller(deps: BannerDeps): Promise<{ userId: string; seller: BannerSeller } | { error: string }> {
  if (!deps.userId) return { error: 'Sign in to change your banner.' }
  const seller = await deps.store.readSeller(deps.userId)
  if (!seller || seller.role !== 'seller') return { error: 'Only sellers can set a store banner.' }
  return { userId: deps.userId, seller }
}

export async function getMyStoreBannerCore(deps: BannerDeps): Promise<{ ok: true; data: MyStoreBanner } | { ok: false; error: string }> {
  const loaded = await loadSeller(deps)
  if ('error' in loaded) return { ok: false, error: loaded.error }
  const { seller } = loaded
  const slug = seller.shop_slug?.trim() || seller.username?.trim() || null
  return {
    ok: true,
    data: {
      tier: seller.seller_tier ?? 'bronze',
      tierLabel: tierLabel(seller.seller_tier),
      canUpload: canUploadStoreBanner(seller.seller_tier),
      bannerUrl: isStoreBannerUrl(seller.banner_url) ? seller.banner_url : null,
      focalY: clampBannerFocalY(seller.banner_focal_y),
      shopHref: slug ? `/shop/${slug}` : null,
    },
  }
}

/**
 * `focalY` (optional) is the position the seller chose in the editor before
 * saving; it is stored with the new banner in the same write. Omitted → the
 * new banner starts centred.
 */
export async function uploadStoreBannerCore(deps: BannerDeps, dataUrl: unknown, focalY?: unknown): Promise<BannerResult> {
  const loaded = await loadSeller(deps)
  if ('error' in loaded) return { ok: false, error: loaded.error }
  const { userId, seller } = loaded

  // The gate: the rank as stored NOW, read server-side.
  if (!canUploadStoreBanner(seller.seller_tier)) return { ok: false, error: BANNER_TIER_ERROR }

  let focal = STORE_BANNER_FOCAL_DEFAULT
  if (focalY !== undefined) {
    const f = parseBannerFocalY(focalY)
    if (!f.ok) return { ok: false, error: f.error }
    focal = f.value
  }

  const parsed = parseBannerDataUrl(dataUrl)
  if (!parsed.ok) return { ok: false, error: parsed.error }

  const image = await deps.processImage(parsed.bytes)
  if (!image.ok) return { ok: false, error: image.error }

  const path = bannerObjectPath(userId)
  const up = await deps.store.upload(path, image.bytes, image.mime)
  if (up.error) {
    console.error('[store-banner] upload failed', up.error)
    return { ok: false, error: GENERIC_ERROR }
  }

  // Same object path every time; the version query busts browser/CDN caches.
  const url = `${deps.store.publicUrl(path)}?v=${(deps.now ?? Date.now)()}`
  const saved = await deps.store.setBanner(userId, { url, focalY: focal })
  if (saved.error) {
    console.error('[store-banner] profile update failed', saved.error)
    return { ok: false, error: GENERIC_ERROR }
  }

  const slug = seller.shop_slug?.trim() || seller.username?.trim()
  if (slug) deps.revalidateShop(slug)
  return { ok: true, bannerUrl: url }
}

/** Removing is allowed at any rank (it only clears your own banner). */
export async function removeStoreBannerCore(deps: BannerDeps): Promise<BannerResult> {
  const loaded = await loadSeller(deps)
  if ('error' in loaded) return { ok: false, error: loaded.error }
  const { userId, seller } = loaded

  const saved = await deps.store.setBanner(userId, { url: null, focalY: STORE_BANNER_FOCAL_DEFAULT })
  if (saved.error) {
    console.error('[store-banner] profile update failed', saved.error)
    return { ok: false, error: 'Could not remove your banner. Try again in a moment.' }
  }
  await deps.store.remove(bannerObjectPath(userId)).catch(() => {})

  const slug = seller.shop_slug?.trim() || seller.username?.trim()
  if (slug) deps.revalidateShop(slug)
  return { ok: true, bannerUrl: null }
}

/**
 * Move the visible slice of the CURRENT banner. Same gate as an upload (a
 * seller below Silver cannot restyle a banner nobody sees), and there must be
 * a stored banner of ours to position.
 */
export async function setStoreBannerFocalCore(deps: BannerDeps, focalY: unknown): Promise<BannerFocalResult> {
  const loaded = await loadSeller(deps)
  if ('error' in loaded) return { ok: false, error: loaded.error }
  const { userId, seller } = loaded

  if (!canUploadStoreBanner(seller.seller_tier)) return { ok: false, error: BANNER_TIER_ERROR }
  if (!isStoreBannerUrl(seller.banner_url)) return { ok: false, error: 'Upload a banner first.' }

  const f = parseBannerFocalY(focalY)
  if (!f.ok) return { ok: false, error: f.error }

  const saved = await deps.store.setBanner(userId, { focalY: f.value })
  if (saved.error) {
    console.error('[store-banner] focal update failed', saved.error)
    return { ok: false, error: 'Could not save the banner position. Try again in a moment.' }
  }

  const slug = seller.shop_slug?.trim() || seller.username?.trim()
  if (slug) deps.revalidateShop(slug)
  return { ok: true, focalY: f.value }
}

/** The Supabase adapter (service-role client). */
export function supabaseBannerStore(svc: any): BannerStore {
  return {
    async readSeller(userId) {
      const { data, error } = await svc
        .from('profiles')
        .select('role, seller_tier, shop_slug, username, banner_url, banner_focal_y')
        .eq('id', userId)
        .maybeSingle()
      if (error) throw new Error(error.message)
      return (data as BannerSeller | null) ?? null
    },
    async upload(path, bytes, contentType) {
      const { error } = await svc.storage
        .from(STORE_BANNER_BUCKET)
        .upload(path, bytes, { contentType, upsert: true, cacheControl: '3600' })
      return { error: error ? String(error.message ?? error) : null }
    },
    async remove(path) {
      await svc.storage.from(STORE_BANNER_BUCKET).remove([path])
    },
    publicUrl(path) {
      return svc.storage.from(STORE_BANNER_BUCKET).getPublicUrl(path).data.publicUrl as string
    },
    async setBanner(userId, patch) {
      const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (patch.url !== undefined) row.banner_url = patch.url
      if (patch.focalY !== undefined) row.banner_focal_y = patch.focalY
      const { error } = await svc.from('profiles').update(row).eq('id', userId)
      return { error: error ? String(error.message ?? error) : null }
    },
  }
}
