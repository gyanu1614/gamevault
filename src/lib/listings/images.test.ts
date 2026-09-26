/** ACC-08 — image type from bytes, owner-prefixed paths. */
import { describe, it, expect } from 'vitest'
import { sniffImageType, isOwnedListingImagePath, listingImagePathFromUrl, listingImagePathFor, checkListingImage, LISTING_IMAGE_MAX_BYTES } from './images'

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])
const GIF = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0])
const HTML = new TextEncoder().encode('<html><script>alert(1)</script>')

describe('sniffImageType', () => {
  it('recognises JPEG / PNG / WebP by magic bytes and nothing else', () => {
    expect(sniffImageType(JPEG)).toEqual({ mime: 'image/jpeg', ext: 'jpg' })
    expect(sniffImageType(PNG)).toEqual({ mime: 'image/png', ext: 'png' })
    expect(sniffImageType(WEBP)).toEqual({ mime: 'image/webp', ext: 'webp' })
    expect(sniffImageType(GIF)).toBeNull()
    expect(sniffImageType(HTML)).toBeNull()
    expect(sniffImageType(new Uint8Array(0))).toBeNull()
  })
})

describe('checkListingImage', () => {
  it('derives the type from the bytes, not the name or the declared type', async () => {
    const f = new File([PNG], 'evil.exe', { type: 'image/jpeg' })
    const r = await checkListingImage(f)
    expect(r.ok && r.image).toEqual({ mime: 'image/png', ext: 'png' })
  })
  it('refuses a fake image with an image name/type, and anything over the cap', async () => {
    expect((await checkListingImage(new File([HTML], 'a.png', { type: 'image/png' }))).ok).toBe(false)
    const big = new File([new Uint8Array(LISTING_IMAGE_MAX_BYTES + 1)], 'a.png', { type: 'image/png' })
    expect((await checkListingImage(big)).ok).toBe(false)
  })
})

describe('owner-prefixed paths', () => {
  it('stored paths start with the user id and carry the sniffed extension', () => {
    expect(listingImagePathFor('u-1', 'webp', 1000)).toMatch(/^u-1\/1000-[a-z0-9]+\.webp$/)
  })
  it('a delete may only touch the caller\'s own prefix, one file, no traversal', () => {
    expect(isOwnedListingImagePath('u-1/123-abc.png', 'u-1')).toBe(true)
    expect(isOwnedListingImagePath('u-2/123-abc.png', 'u-1')).toBe(false)
    expect(isOwnedListingImagePath('u-1/../u-2/x.png', 'u-1')).toBe(false)
    expect(isOwnedListingImagePath('u-1/', 'u-1')).toBe(false)
    expect(isOwnedListingImagePath('u-1/sub/x.png', 'u-1')).toBe(false)
    expect(isOwnedListingImagePath('u-10/x.png', 'u-1')).toBe(false)
  })
  it('extracts the object path from our public URL only', () => {
    expect(listingImagePathFromUrl('https://x.supabase.co/storage/v1/object/public/listing-images/u-1/1-a.png?x=1')).toBe('u-1/1-a.png')
    expect(listingImagePathFromUrl('https://cdn.example.com/game.png')).toBeNull()
  })
})
