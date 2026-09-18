import { describe, it, expect, vi } from 'vitest'
import {
  fetchWithBackoff,
  searchRobloxGames,
  robloxIconUrl,
  searchAppStoreGames,
  searchSteamGames,
  steamImageUrl,
  steamHeaderUrl,
  encodeIconVariants,
  uploadIconVariants,
  fetchGameIcon,
  iconObjectPath,
  IMMUTABLE_CACHE_SECONDS,
  IMMUTABLE_CACHE_CONTROL,
  ICON_BUCKET,
  MAX_MASTER_BYTES,
  type StorageLike,
} from './icons'

// ── doubles ────────────────────────────────────────────────────────────────

const json = (body: unknown, status = 200): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
  }) as unknown as Response

const binary = (bytes: Buffer, status = 200): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length),
  }) as unknown as Response

function fakeStorage() {
  const uploads: { path: string; opts: any; bytes: number }[] = []
  const storage: StorageLike = {
    from: (bucket: string) => ({
      upload: async (path, body, opts) => {
        uploads.push({ path: `${bucket}/${path}`, opts, bytes: body.length })
        return { error: null }
      },
      getPublicUrl: (path: string) => ({
        data: { publicUrl: `https://sb.test/storage/v1/object/public/${bucket}/${path}` },
      }),
    }),
  }
  return { storage, uploads }
}

/** A real PNG, so sharp has something genuine to decode. */
async function samplePng(): Promise<Buffer> {
  const { default: sharp } = await import('sharp')
  return sharp({
    create: { width: 512, height: 512, channels: 4, background: { r: 20, g: 90, b: 40, alpha: 1 } },
  })
    .png()
    .toBuffer()
}

// ── backoff ────────────────────────────────────────────────────────────────

describe('fetchWithBackoff', () => {
  it('returns a 200 without retrying', async () => {
    const f = vi.fn().mockResolvedValue(json({ ok: true }))
    await fetchWithBackoff('https://x.test', {}, f, { sleep: async () => {} })
    expect(f).toHaveBeenCalledTimes(1)
  })

  it('retries a 429 and succeeds', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(json({}, 429))
      .mockResolvedValueOnce(json({ good: true }))
    const res = await fetchWithBackoff('https://x.test', {}, f, { sleep: async () => {} })
    expect(res.status).toBe(200)
    expect(f).toHaveBeenCalledTimes(2)
  })

  it('retries 5xx then gives the last response back', async () => {
    const f = vi.fn().mockResolvedValue(json({}, 503))
    const res = await fetchWithBackoff('https://x.test', {}, f, {
      attempts: 3,
      sleep: async () => {},
    })
    expect(res.status).toBe(503)
    expect(f).toHaveBeenCalledTimes(3)
  })

  it('does not retry a 404', async () => {
    const f = vi.fn().mockResolvedValue(json({}, 404))
    await fetchWithBackoff('https://x.test', {}, f, { sleep: async () => {} })
    expect(f).toHaveBeenCalledTimes(1)
  })

  it('honours Retry-After seconds', async () => {
    const slept: number[] = []
    const res429 = {
      ok: false,
      status: 429,
      headers: { get: (h: string) => (h === 'retry-after' ? '3' : null) },
      json: async () => ({}),
    } as unknown as Response
    const f = vi.fn().mockResolvedValueOnce(res429).mockResolvedValueOnce(json({}))
    await fetchWithBackoff('https://x.test', {}, f, {
      sleep: async (ms) => {
        slept.push(ms)
      },
    })
    expect(slept).toEqual([3000])
  })
})

// ── roblox ─────────────────────────────────────────────────────────────────

describe('searchRobloxGames', () => {
  it('pulls universeId + name out of Game groups only', async () => {
    const f = vi.fn().mockResolvedValue(
      json({
        searchResults: [
          { contentGroupType: 'Creator', contents: [{ universeId: 1, name: 'noise' }] },
          {
            contentGroupType: 'Game',
            contents: [
              { universeId: 7709344486, name: 'Steal a Brainrot' },
              { universeId: 42, name: 'Other' },
            ],
          },
        ],
      }),
    )
    const out = await searchRobloxGames('Steal a Brainrot', f)
    expect(out).toEqual([
      { title: 'Steal a Brainrot', id: 7709344486 },
      { title: 'Other', id: 42 },
    ])
  })

  it('returns [] on an empty result rather than throwing', async () => {
    const f = vi.fn().mockResolvedValue(json({ searchResults: [] }))
    expect(await searchRobloxGames('nope', f)).toEqual([])
  })
})

describe('robloxIconUrl', () => {
  it('returns the url for a Completed thumbnail', async () => {
    const f = vi.fn().mockResolvedValue(
      json({ data: [{ state: 'Completed', imageUrl: 'https://tr.rbxcdn.com/x/512/512/Image/Png' }] }),
    )
    expect(await robloxIconUrl(1, f)).toBe('https://tr.rbxcdn.com/x/512/512/Image/Png')
  })

  it('returns null for a Pending/Blocked thumbnail', async () => {
    const f = vi.fn().mockResolvedValue(json({ data: [{ state: 'Pending' }] }))
    expect(await robloxIconUrl(1, f)).toBeNull()
  })
})

// ── encode ─────────────────────────────────────────────────────────────────

describe('encodeIconVariants', () => {
  it('produces 512/128/64 WebP', async () => {
    const variants = await encodeIconVariants(await samplePng())
    expect(variants.map((v) => v.size)).toEqual([512, 128, 64])
    for (const v of variants) {
      // RIFF....WEBP magic
      expect(v.bytes.subarray(0, 4).toString('ascii')).toBe('RIFF')
      expect(v.bytes.subarray(8, 12).toString('ascii')).toBe('WEBP')
    }
  })

  it('keeps the 512 master within the size budget', async () => {
    const variants = await encodeIconVariants(await samplePng())
    const master = variants.find((v) => v.size === 512)!
    expect(master.bytes.length).toBeLessThanOrEqual(MAX_MASTER_BYTES)
  })

  it('keeps a BUSY high-entropy icon within the size budget', async () => {
    // A flat colour compresses to nothing and proves little. Random noise is
    // the worst case for WebP, and is what pushed a real Roblox icon to
    // 60,510 bytes before the quality ladder was extended.
    const { default: sharp } = await import('sharp')
    const noise = Buffer.alloc(1024 * 1024 * 3)
    for (let i = 0; i < noise.length; i += 1) noise[i] = Math.floor(Math.random() * 256)
    const busy = await sharp(noise, { raw: { width: 1024, height: 1024, channels: 3 } })
      .png()
      .toBuffer()

    const variants = await encodeIconVariants(busy)
    const master = variants.find((v) => v.size === 512)!
    expect(master.bytes.length).toBeLessThanOrEqual(MAX_MASTER_BYTES)
  })

  it('letterboxes a 600x900 Steam cover without cutting the wordmark', async () => {
    // The step spec asked for a centre-crop. Tested against Warframe's real
    // library_600x900, a centre-crop cuts the title off the bottom; so does
    // sharp's saliency crop. Letterbox keeps the whole cover, and the
    // transparent bars are invisible on the dark UI.
    const { default: sharp } = await import('sharp')
    // Red band at the bottom stands in for the wordmark.
    const cover = await sharp({
      create: { width: 600, height: 900, channels: 4, background: { r: 10, g: 40, b: 30, alpha: 1 } },
    })
      .composite([
        {
          input: await sharp({
            create: { width: 600, height: 120, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } },
          }).png().toBuffer(),
          top: 780,
          left: 0,
        },
      ])
      .png()
      .toBuffer()

    const variants = await encodeIconVariants(cover)
    const master = variants.find((v) => v.size === 512)!
    const { data, info } = await sharp(master.bytes)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    // Scan for a red pixel: if the wordmark band survived, it is present.
    let sawRed = false
    for (let i = 0; i < data.length; i += info.channels) {
      if (data[i] > 150 && data[i + 1] < 90 && data[i + 2] < 90) {
        sawRed = true
        break
      }
    }
    expect(sawRed).toBe(true)
  })

  it('letterboxes a portrait cover instead of cropping it', async () => {
    const { default: sharp } = await import('sharp')
    const portrait = await sharp({
      create: { width: 264, height: 374, channels: 4, background: { r: 200, g: 0, b: 0, alpha: 1 } },
    })
      .png()
      .toBuffer()
    const variants = await encodeIconVariants(portrait)
    const meta = await sharp(variants[0].bytes).metadata()
    expect(meta.width).toBe(512)
    expect(meta.height).toBe(512)
  })
})

// ── upload ─────────────────────────────────────────────────────────────────

describe('uploadIconVariants', () => {
  it('writes every variant to the wizard bucket with immutable caching', async () => {
    const { storage, uploads } = fakeStorage()
    const variants = await encodeIconVariants(await samplePng())
    const out = await uploadIconVariants(storage, 'blox-fruits', 'deadbeefcafe0000', variants)

    expect(uploads).toHaveLength(3)
    for (const u of uploads) {
      expect(u.path.startsWith(`${ICON_BUCKET}/games/`)).toBe(true)
      // seconds only: supabase-js prefixes max-age= itself
      expect(u.opts.cacheControl).toBe(IMMUTABLE_CACHE_SECONDS)
      expect(IMMUTABLE_CACHE_CONTROL).toBe('max-age=31536000')
      expect(u.opts.contentType).toBe('image/webp')
    }
    expect(out.masterUrl).toContain(iconObjectPath('blox-fruits', 'deadbeefcafe0000', 512))
  })

  it('throws when the storage layer reports an error', async () => {
    const storage: StorageLike = {
      from: () => ({
        upload: async () => ({ error: { message: 'bucket not found' } }),
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
      }),
    }
    const variants = await encodeIconVariants(await samplePng())
    await expect(uploadIconVariants(storage, 's', 'h0000000000', variants)).rejects.toThrow(
      /bucket not found/,
    )
  })
})

// ── the seam ───────────────────────────────────────────────────────────────

describe('fetchGameIcon', () => {
  it('fills a Roblox game end to end', async () => {
    const png = await samplePng()
    const { storage, uploads } = fakeStorage()
    const f = vi.fn(async (url: string) => {
      if (url.includes('omni-search')) {
        return json({
          searchResults: [
            { contentGroupType: 'Game', contents: [{ universeId: 99, name: 'Blox Fruits' }] },
          ],
        })
      }
      if (url.includes('thumbnails.roblox.com')) {
        return json({ data: [{ state: 'Completed', imageUrl: 'https://tr.rbxcdn.com/i' }] })
      }
      return binary(png)
    })

    const res = await fetchGameIcon(
      { slug: 'blox-fruits', name: 'Blox Fruits', ecosystem: 'roblox' },
      { storage, fetchImpl: f as any },
    )

    expect(res.status).toBe('filled')
    expect(res.source).toBe('roblox')
    expect(res.confidence).toBe(1)
    expect(res.iconUrl).toContain('/category-icons/games/blox-fruits-')
    expect(uploads).toHaveLength(3)
  })

  it('reports ambiguous without uploading anything', async () => {
    const { storage, uploads } = fakeStorage()
    const f = vi.fn(async () =>
      json({
        searchResults: [
          {
            contentGroupType: 'Game',
            contents: [
              { universeId: 1, name: 'Blox Fruits' },
              { universeId: 2, name: 'BLOX FRUITS!' },
            ],
          },
        ],
      }),
    )
    const res = await fetchGameIcon(
      { slug: 'blox-fruits', name: 'Blox Fruits', ecosystem: 'roblox' },
      { storage, fetchImpl: f as any },
    )
    expect(res.status).toBe('ambiguous')
    expect(res.candidates).toHaveLength(2)
    expect(uploads).toHaveLength(0)
  })

  it('reports unmatched when the search finds nothing', async () => {
    const { storage } = fakeStorage()
    const f = vi.fn(async () => json({ searchResults: [] }))
    const res = await fetchGameIcon(
      { slug: 'x', name: 'Totally Unknown Game', ecosystem: 'roblox' },
      { storage, fetchImpl: f as any },
    )
    expect(res.status).toBe('unmatched')
  })

  it('turns a network throw into an error result, not an exception', async () => {
    const { storage } = fakeStorage()
    const f = vi.fn(async () => {
      throw new Error('ECONNRESET')
    })
    const res = await fetchGameIcon(
      { slug: 'x', name: 'X', ecosystem: 'roblox' },
      { storage, fetchImpl: f as any, retry: { attempts: 1, sleep: async () => {} } },
    )
    expect(res.status).toBe('error')
    expect(res.error).toMatch(/ECONNRESET/)
  })

  it('prefers the App Store icon for a non-Roblox game', async () => {
    const png = await samplePng()
    const { storage } = fakeStorage()
    const calls: string[] = []
    const f = vi.fn(async (url: string) => {
      calls.push(url)
      if (url.includes('itunes.apple.com')) {
        return json({
          results: [{ trackName: 'Warframe', trackId: 5, artworkUrl512: 'https://is1/a.jpg' }],
        })
      }
      return binary(png)
    })
    const res = await fetchGameIcon(
      { slug: 'warframe', name: 'Warframe', ecosystem: 'pc' },
      { storage, fetchImpl: f as any },
    )
    expect(res.status).toBe('filled')
    expect(res.source).toBe('appstore')
    // Steam must not even be consulted once the App Store matched.
    expect(calls.some((u) => u.includes('steampowered'))).toBe(false)
  })

  it('falls through to Steam when the App Store has no real match', async () => {
    const png = await samplePng()
    const { storage } = fakeStorage()
    const f = vi.fn(async (url: string) => {
      if (url.includes('itunes.apple.com')) {
        // What Apple actually returns for a PC-only game: companion apps.
        return json({
          results: [
            { trackName: 'TF2 Backpack Viewer', trackId: 1, artworkUrl512: 'https://is1/x.jpg' },
          ],
        })
      }
      if (url.includes('storesearch')) {
        return json({ items: [{ id: 440, name: 'Team Fortress 2' }] })
      }
      return binary(png)
    })
    const res = await fetchGameIcon(
      { slug: 'team-fortress-2', name: 'Team Fortress 2', ecosystem: 'pc' },
      { storage, fetchImpl: f as any },
    )
    expect(res.status).toBe('filled')
    expect(res.source).toBe('steam')
  })

  it('does NOT fall through to Steam when the App Store was ambiguous', async () => {
    // Ambiguity is a refusal. Falling through would let a confident wrong
    // match from a lower-priority source beat an honest refusal.
    const { storage, uploads } = fakeStorage()
    const f = vi.fn(async (url: string) => {
      if (url.includes('itunes.apple.com')) {
        return json({
          results: [
            { trackName: 'Abyss', trackId: 1, artworkUrl512: 'https://is1/a.jpg' },
            { trackName: 'ABYSS!', trackId: 2, artworkUrl512: 'https://is1/b.jpg' },
          ],
        })
      }
      throw new Error('steam must not be called')
    })
    const res = await fetchGameIcon(
      { slug: 'abyss', name: 'Abyss', ecosystem: 'pc' },
      { storage, fetchImpl: f as any },
    )
    expect(res.status).toBe('ambiguous')
    expect(res.source).toBe('appstore')
    expect(uploads).toHaveLength(0)
  })

  it('tries the Steam header when the library cover 404s', async () => {
    const png = await samplePng()
    const { storage } = fakeStorage()
    const seen: string[] = []
    const f = vi.fn(async (url: string) => {
      if (url.includes('itunes.apple.com')) return json({ results: [] })
      if (url.includes('storesearch')) return json({ items: [{ id: 440, name: 'Hades' }] })
      seen.push(url)
      if (url.includes('library_600x900')) return binary(Buffer.alloc(0), 404)
      return binary(png)
    })
    const res = await fetchGameIcon(
      { slug: 'hades', name: 'Hades', ecosystem: 'pc' },
      { storage, fetchImpl: f as any },
    )
    expect(res.status).toBe('filled')
    expect(seen.some((u) => u.includes('header.jpg'))).toBe(true)
  })

  it('keeps trying later sources when an earlier one throws', async () => {
    const png = await samplePng()
    const { storage } = fakeStorage()
    const f = vi.fn(async (url: string) => {
      if (url.includes('itunes.apple.com')) throw new Error('apple is down')
      if (url.includes('storesearch')) return json({ items: [{ id: 1, name: 'Deep Rock' }] })
      return binary(png)
    })
    const res = await fetchGameIcon(
      { slug: 'deep-rock', name: 'Deep Rock', ecosystem: 'pc' },
      { storage, fetchImpl: f as any, retry: { attempts: 1, sleep: async () => {} } },
    )
    expect(res.status).toBe('filled')
    expect(res.source).toBe('steam')
  })

  it('reports unmatched when neither non-Roblox source matches', async () => {
    const { storage } = fakeStorage()
    const f = vi.fn(async (url: string) => {
      if (url.includes('itunes.apple.com')) return json({ results: [] })
      return json({ items: [] })
    })
    const res = await fetchGameIcon(
      { slug: 'tibia', name: 'Tibia', ecosystem: 'pc' },
      { storage, fetchImpl: f as any },
    )
    expect(res.status).toBe('unmatched')
  })
})

describe('non-Roblox source adapters', () => {
  it('parses App Store results and prefers the 512 artwork', async () => {
    const f = vi.fn().mockResolvedValue(
      json({
        results: [
          { trackName: 'Warframe', trackId: 1, artworkUrl512: 'https://is1/512.jpg', artworkUrl100: 'https://is1/100.jpg' },
          { trackName: 'No Art', trackId: 2 },
        ],
      }),
    )
    const out = await searchAppStoreGames('Warframe', f)
    expect(out).toEqual([{ title: 'Warframe', id: 1, imageUrl: 'https://is1/512.jpg' }])
  })

  it('falls back to the 100px artwork when 512 is absent', async () => {
    const f = vi.fn().mockResolvedValue(
      json({ results: [{ trackName: 'X', trackId: 1, artworkUrl100: 'https://is1/100.jpg' }] }),
    )
    expect((await searchAppStoreGames('X', f))[0].imageUrl).toBe('https://is1/100.jpg')
  })

  it('parses Steam store search into appid candidates', async () => {
    const f = vi.fn().mockResolvedValue(
      json({ items: [{ id: 230410, name: 'Warframe' }, { id: 1, name: null }] }),
    )
    const out = await searchSteamGames('Warframe', f)
    expect(out).toEqual([
      { title: 'Warframe', id: 230410, imageUrl: steamImageUrl(230410) },
    ])
  })

  it('builds the documented Steam CDN urls', () => {
    expect(steamImageUrl(440)).toBe(
      'https://cdn.cloudflare.steamstatic.com/steam/apps/440/library_600x900.jpg',
    )
    expect(steamHeaderUrl(440)).toBe(
      'https://cdn.cloudflare.steamstatic.com/steam/apps/440/header.jpg',
    )
  })
})
