/**
 * ACC-08 — uploadSellImage: sell-access gate, byte sniffing, size cap,
 * owner-prefixed path; deleteListingImage: own prefix only.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({ kind: 'seller', uploads: [] as Array<{ path: string; opts: any }>, removes: [] as string[][] }))
vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/seo/indexnow', () => ({ pingIndexNow: vi.fn() }))
vi.mock('@/lib/actions/new-schema', () => ({ getGlobalCategories: vi.fn(), getGamesForGlobalCategory: vi.fn(), getAttributeTemplateFull: vi.fn() }))
vi.mock('@/lib/revalidation/listings', () => ({ revalidateListingSurfaces: vi.fn(async () => ({ tags: [] })) }))
vi.mock('@/lib/supabase/service', () => ({ createServiceRoleClient: () => ({}) }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u-1' } }, error: null }) },
    rpc: async () => ({ data: h.kind, error: null }),
    storage: {
      from: () => ({
        upload: async (path: string, _bytes: unknown, opts: any) => { h.uploads.push({ path, opts }); return { data: { path }, error: null } },
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://x/storage/v1/object/public/listing-images/${path}` } }),
        remove: async (paths: string[]) => { h.removes.push(paths); return { error: null } },
      }),
    },
  }),
}))

import { uploadSellImage } from '@/lib/actions/sell-wizard'
import { deleteListingImage } from '@/lib/actions/listings'

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
function form(file: File) { const fd = new FormData(); fd.set('file', file); return fd }

beforeEach(() => { h.kind = 'seller'; h.uploads = []; h.removes = [] })

describe('uploadSellImage', () => {
  it('a buyer (no sell access) cannot upload; nothing reaches storage', async () => {
    h.kind = 'none'
    const res = await uploadSellImage(form(new File([PNG], 'a.png', { type: 'image/png' })))
    expect(res.success).toBe(false)
    expect(h.uploads).toEqual([])
  })

  it('an applicant may upload (drafts need images)', async () => {
    h.kind = 'applicant'
    const res = await uploadSellImage(form(new File([PNG], 'a.png', { type: 'image/png' })))
    expect(res.success).toBe(true)
  })

  it('extension and content type come from the bytes; the object lives under the caller prefix', async () => {
    const res = await uploadSellImage(form(new File([PNG], 'payload.php', { type: 'image/jpeg' })))
    expect(res.success).toBe(true)
    expect(h.uploads).toHaveLength(1)
    expect(h.uploads[0].path).toMatch(/^u-1\/\d+-[a-z0-9]+\.png$/)
    expect(h.uploads[0].opts.contentType).toBe('image/png')
  })

  it('a non-image with an image name / type is refused', async () => {
    const res = await uploadSellImage(form(new File([new TextEncoder().encode('<svg onload=alert(1)>')], 'a.png', { type: 'image/png' })))
    expect(res.success).toBe(false)
    expect(h.uploads).toEqual([])
  })

  it('the 5 MB cap is enforced from the file itself', async () => {
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'a.png', { type: 'image/png' })
    const res = await uploadSellImage(form(big))
    expect(res.success).toBe(false)
    expect(h.uploads).toEqual([])
  })
})

describe('deleteListingImage', () => {
  it("removes only under the caller's own prefix", async () => {
    expect((await deleteListingImage('https://x/storage/v1/object/public/listing-images/u-1/1-a.png')).success).toBe(true)
    expect(h.removes).toEqual([['u-1/1-a.png']])
    h.removes = []
    expect((await deleteListingImage('https://x/storage/v1/object/public/listing-images/u-2/1-a.png')).success).toBe(false)
    expect((await deleteListingImage('https://x/storage/v1/object/public/listing-images/u-1/../u-2/a.png')).success).toBe(false)
    expect((await deleteListingImage('https://cdn.example.com/game.png')).success).toBe(false)
    expect(h.removes).toEqual([])
  })
})
