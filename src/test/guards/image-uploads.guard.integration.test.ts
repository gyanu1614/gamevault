/**
 * Uploaded images are stored small (integration, real action + local
 * storage, the seller's own session):
 *   · a phone-size listing photo is stored as a <=1600 px WebP, cached a year;
 *   · the storage buckets carry the hard caps (migration
 *     20260928174233_storage_upload_caps): blog images 5 MB, delivery-evidence
 *     accepts the chat's PDFs and GIFs (avatars 2 MB where the bucket exists).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import sharp from 'sharp'
import { hasEnv, makeFixture, promoteToEstablishedSeller, type Fixture } from './throwaway'

const state = vi.hoisted(() => ({ client: null as any }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => state.client }))
vi.mock('next/cache', () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined, unstable_cache: (fn: any) => fn }))
vi.mock('server-only', () => ({}))

import { uploadListingImage } from '@/lib/actions/listings'

let fx: Fixture | null = null
const storedPaths: string[] = []

describe.skipIf(!hasEnv)('image uploads are stored small (integration)', () => {
  beforeAll(async () => {
    fx = await makeFixture()
    await promoteToEstablishedSeller(fx.svc, fx.seller.id)
    state.client = fx.seller.client
  }, 60_000)

  afterAll(async () => {
    if (!fx) return
    if (storedPaths.length) await fx.svc.storage.from('listing-images').remove(storedPaths)
    await fx.cleanup()
  }, 60_000)

  it('a 3200 px listing photo is stored as a <=1600 px WebP', async () => {
    const png = await sharp('public/hero/roblox.jpg').resize({ width: 3200 }).png().toBuffer()
    // Stay under the 5 MB upload cap with a real photo at camera size.
    const upload = png.byteLength < 5 * 1024 * 1024 ? png : await sharp(png).jpeg({ quality: 92 }).toBuffer()
    const type = upload === png ? 'image/png' : 'image/jpeg'
    const form = new FormData()
    form.append('file', new File([upload], 'photo.' + (type === 'image/png' ? 'png' : 'jpg'), { type }))

    const res = await uploadListingImage(form)
    expect(res.success, res.error).toBe(true)
    expect(res.url).toMatch(/\.webp$/)

    const path = res.url!.split('/listing-images/')[1]
    storedPaths.push(path)
    const { data, error } = await fx!.svc.storage.from('listing-images').download(path)
    expect(error).toBeNull()
    const bytes = Buffer.from(await data!.arrayBuffer())
    const meta = await sharp(bytes).metadata()
    expect(meta.format).toBe('webp')
    expect(Math.max(meta.width!, meta.height!)).toBe(1600)
    expect(bytes.byteLength).toBeLessThan(upload.byteLength)
  })

  it('buckets enforce the caps', async () => {
    // avatars exists only where it was created on the dashboard (prod); the
    // migration never creates it, so a local stack may not have it.
    const avatars = await fx!.svc.storage.getBucket('avatars')
    if (avatars.data) {
      expect(avatars.data.file_size_limit).toBe(2097152)
      expect(avatars.data.allowed_mime_types).toEqual(['image/jpeg', 'image/png', 'image/webp'])
    }

    const blog = await fx!.svc.storage.getBucket('blog-images')
    expect(blog.data?.file_size_limit).toBe(5242880)

    const evidence = await fx!.svc.storage.getBucket('delivery-evidence')
    expect(evidence.data?.allowed_mime_types).toEqual(
      expect.arrayContaining(['application/pdf', 'image/gif', 'image/webp', 'video/mp4']),
    )
    expect(evidence.data?.allowed_mime_types).not.toContain('image/mp4')
  })
})
