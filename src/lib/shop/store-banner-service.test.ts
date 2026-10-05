import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import {
  BANNER_TIER_ERROR,
  getMyStoreBannerCore,
  removeStoreBannerCore,
  setStoreBannerFocalCore,
  uploadStoreBannerCore,
  type BannerDeps,
  type BannerPatch,
  type BannerSeller,
} from './store-banner-service'

const SB = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'
vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', SB)
const PNG = `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]).toString('base64')}`

function makeDeps(seller: Partial<BannerSeller> | null, userId: string | null = 'u1') {
  const calls = { upload: 0, set: [] as (string | null)[], patches: [] as BannerPatch[], revalidated: [] as string[], removed: 0 }
  const deps: BannerDeps = {
    userId,
    store: {
      readSeller: async () =>
        seller
          ? { role: 'seller', seller_tier: 'bronze', shop_slug: 'acme', username: 'acme_u', banner_url: null, ...seller }
          : null,
      upload: async () => {
        calls.upload++
        return { error: null }
      },
      remove: async () => {
        calls.removed++
      },
      publicUrl: (p) => `${SB}/storage/v1/object/public/store-banners/${p}`,
      setBanner: async (_u, patch) => {
        calls.patches.push(patch)
        if (patch.url !== undefined) calls.set.push(patch.url)
        return { error: null }
      },
    },
    processImage: async () => ({ ok: true, bytes: new Uint8Array([1]), mime: 'image/webp' }),
    revalidateShop: (slug) => calls.revalidated.push(slug),
    now: () => 42,
  }
  return { deps, calls }
}

describe('store banner — server-side tier gate', () => {
  it('rejects a Bronze seller before touching storage', async () => {
    const { deps, calls } = makeDeps({ seller_tier: 'bronze' })
    expect(await uploadStoreBannerCore(deps, PNG)).toEqual({ ok: false, error: BANNER_TIER_ERROR })
    expect(calls.upload).toBe(0)
    expect(calls.set).toEqual([])
  })

  it('rejects a missing or unknown rank', async () => {
    for (const seller_tier of [null, 'platinum']) {
      const { deps, calls } = makeDeps({ seller_tier })
      expect(await uploadStoreBannerCore(deps, PNG)).toMatchObject({ ok: false })
      expect(calls.upload).toBe(0)
    }
  })

  it.each(['silver', 'gold', 'diamond', 'legendary'])('allows a %s seller and revalidates the shop', async (tier) => {
    const { deps, calls } = makeDeps({ seller_tier: tier })
    const res = await uploadStoreBannerCore(deps, PNG)
    expect(res).toEqual({ ok: true, bannerUrl: `${SB}/storage/v1/object/public/store-banners/u1/banner.webp?v=42` })
    expect(calls.upload).toBe(1)
    expect(calls.revalidated).toEqual(['acme'])
  })

  it('rejects signed-out callers and non-sellers', async () => {
    expect(await uploadStoreBannerCore(makeDeps({ seller_tier: 'gold' }, null).deps, PNG)).toMatchObject({ ok: false })
    expect(await uploadStoreBannerCore(makeDeps({ seller_tier: 'gold', role: 'buyer' }).deps, PNG)).toMatchObject({ ok: false })
    expect(await uploadStoreBannerCore(makeDeps(null).deps, PNG)).toMatchObject({ ok: false })
  })

  it('rejects a bad payload even for an eligible seller', async () => {
    const { deps, calls } = makeDeps({ seller_tier: 'gold' })
    expect(await uploadStoreBannerCore(deps, 'data:image/svg+xml;base64,PHN2Zy8+')).toMatchObject({ ok: false })
    expect(calls.upload).toBe(0)
  })

  it('surfaces an image the processor refuses', async () => {
    const { deps, calls } = makeDeps({ seller_tier: 'gold' })
    deps.processImage = async () => ({ ok: false, error: 'too narrow' })
    expect(await uploadStoreBannerCore(deps, PNG)).toEqual({ ok: false, error: 'too narrow' })
    expect(calls.upload).toBe(0)
  })
})

describe('store banner — remove + read', () => {
  it('lets any seller clear their banner', async () => {
    const { deps, calls } = makeDeps({ seller_tier: 'bronze' })
    expect(await removeStoreBannerCore(deps)).toEqual({ ok: true, bannerUrl: null })
    expect(calls.set).toEqual([null])
    expect(calls.patches).toEqual([{ url: null, focalY: 50 }])
    expect(calls.removed).toBe(1)
  })

  it('reports the gate and the stored banner', async () => {
    const stored = `${SB}/storage/v1/object/public/store-banners/u1/banner.webp?v=1`
    const bronze = await getMyStoreBannerCore(makeDeps({ seller_tier: 'bronze', banner_url: stored }).deps)
    expect(bronze).toMatchObject({ ok: true, data: { canUpload: false, tierLabel: 'Bronze', bannerUrl: stored, shopHref: '/shop/acme' } })
    const gold = await getMyStoreBannerCore(makeDeps({ seller_tier: 'gold', banner_url: 'https://evil.example/x.png' }).deps)
    expect(gold).toMatchObject({ ok: true, data: { canUpload: true, bannerUrl: null } })
  })
})

const STORED = `${SB}/storage/v1/object/public/store-banners/u1/banner.webp?v=1`

describe('store banner — focal point (position)', () => {
  it('stores the chosen position with a new upload, centred when omitted', async () => {
    const a = makeDeps({ seller_tier: 'gold' })
    await uploadStoreBannerCore(a.deps, PNG, 30)
    expect(a.calls.patches).toEqual([{ url: `${SB}/storage/v1/object/public/store-banners/u1/banner.webp?v=42`, focalY: 30 }])
    const b = makeDeps({ seller_tier: 'gold' })
    await uploadStoreBannerCore(b.deps, PNG)
    expect(b.calls.patches[0]).toMatchObject({ focalY: 50 })
  })

  it('refuses an out-of-range position before touching storage', async () => {
    for (const bad of [-1, 101, NaN, '40']) {
      const { deps, calls } = makeDeps({ seller_tier: 'gold' })
      expect(await uploadStoreBannerCore(deps, PNG, bad)).toMatchObject({ ok: false })
      expect(calls.upload).toBe(0)
      expect(calls.patches).toEqual([])
    }
  })

  it('repositions the saved banner for a Silver+ owner and revalidates the shop', async () => {
    const { deps, calls } = makeDeps({ seller_tier: 'silver', banner_url: STORED })
    expect(await setStoreBannerFocalCore(deps, 72.4)).toEqual({ ok: true, focalY: 72 })
    expect(calls.patches).toEqual([{ focalY: 72 }])
    expect(calls.revalidated).toEqual(['acme'])
  })

  it('refuses Bronze, a missing banner, bad values and non-sellers', async () => {
    const cases: [Partial<BannerSeller> | null, unknown, string | null][] = [
      [{ seller_tier: 'bronze', banner_url: STORED }, 40, 'u1'],
      [{ seller_tier: 'gold', banner_url: null }, 40, 'u1'],
      [{ seller_tier: 'gold', banner_url: 'https://evil.example/x.png' }, 40, 'u1'],
      [{ seller_tier: 'gold', banner_url: STORED }, 120, 'u1'],
      [{ seller_tier: 'gold', banner_url: STORED }, '40', 'u1'],
      [{ seller_tier: 'gold', banner_url: STORED, role: 'buyer' }, 40, 'u1'],
      [{ seller_tier: 'gold', banner_url: STORED }, 40, null],
    ]
    for (const [seller, value, userId] of cases) {
      const { deps, calls } = makeDeps(seller, userId)
      expect(await setStoreBannerFocalCore(deps, value)).toMatchObject({ ok: false })
      expect(calls.patches).toEqual([])
      expect(calls.revalidated).toEqual([])
    }
  })

  it('reports the saved position (clamped; centred when unset)', async () => {
    const set = await getMyStoreBannerCore(makeDeps({ seller_tier: 'gold', banner_url: STORED, banner_focal_y: 15 }).deps)
    expect(set).toMatchObject({ ok: true, data: { focalY: 15 } })
    const unset = await getMyStoreBannerCore(makeDeps({ seller_tier: 'gold', banner_url: STORED }).deps)
    expect(unset).toMatchObject({ ok: true, data: { focalY: 50 } })
  })
})
