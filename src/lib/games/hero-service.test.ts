import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import {
  createHeroUploadCore,
  processHeroCore,
  removeHeroCore,
  setHeroFocalCore,
  storedHeroPaths,
  type HeroDeps,
  type HeroGameRow,
  type HeroStore,
} from './hero-service'
import type { ProcessedHero } from './hero-image'

const SB = 'https://abc.supabase.co'
const pub = (p: string) => `${SB}/storage/v1/object/public/game-heroes/${p}`
const GAME = '11111111-2222-3333-4444-555555555555'
const SOURCE = `${GAME}/_source/fixed-id.jpg`

function game(over: Partial<HeroGameRow> = {}): HeroGameRow {
  return {
    id: GAME,
    slug: 'mm2',
    hero_bg_url: pub(`${GAME}/old-1600.webp`),
    hero_bg_srcset: { '960': pub(`${GAME}/old-960.webp`), '1600': pub(`${GAME}/old-1600.webp`) },
    hero_bg_blur: null,
    hero_bg_focal_y: 50,
    hero_bg_updated_at: null,
    ...over,
  }
}

const processed: ProcessedHero = {
  ok: true,
  hash: 'newhash',
  sourceWidth: 3000,
  sourceHeight: 1500,
  blur: 'data:image/webp;base64,AAAA',
  variants: [960, 1600, 2400].map((w) => ({ width: w, height: w / 2, bytes: new Uint8Array([w % 255]), path: `${GAME}/newhash-${w}.webp` })),
}

function setup(row: HeroGameRow | null = game(), over: Partial<HeroStore> = {}) {
  const base = {
    readGame: vi.fn(async (_id: string) => row),
    createSignedUpload: vi.fn(async (_path: string): Promise<{ token: string } | { error: string }> => ({ token: 'tok' })),
    download: vi.fn(async (_path: string): Promise<Uint8Array | null> => new Uint8Array([1, 2, 3])),
    upload: vi.fn(async (_path: string, _bytes: Uint8Array, _type: string): Promise<{ error: string | null }> => ({ error: null })),
    remove: vi.fn(async (_paths: string[]) => {}),
    publicUrl: vi.fn((p: string) => pub(p)),
    updateGame: vi.fn(async (_id: string, _patch: object): Promise<{ error: string | null }> => ({ error: null })),
  }
  // Overrides are vi.fn mocks too; keep the mock-typed shape for assertions.
  const store = { ...base, ...over } as typeof base
  const deps: HeroDeps = {
    store,
    processImage: vi.fn(async () => processed),
    revalidateGame: vi.fn(),
    supabaseUrl: SB,
    now: () => new Date('2026-10-05T00:00:00Z'),
    newId: () => 'fixed-id',
  }
  return { store, deps }
}

describe('createHeroUploadCore', () => {
  it('mints a signed upload for a fresh per-game source path', async () => {
    const { store, deps } = setup()
    const res = await createHeroUploadCore(deps, GAME, { type: 'image/jpeg', size: 2_000_000 })
    expect(res).toEqual({ ok: true, path: SOURCE, token: 'tok' })
    expect(store.createSignedUpload).toHaveBeenCalledWith(SOURCE)
  })

  it('refuses a bad type / size / game id before touching storage', async () => {
    const { store, deps } = setup()
    expect((await createHeroUploadCore(deps, GAME, { type: 'image/gif', size: 10 })).ok).toBe(false)
    expect((await createHeroUploadCore(deps, GAME, { type: 'image/png', size: 7 * 1024 * 1024 })).ok).toBe(false)
    expect((await createHeroUploadCore(deps, '../etc', { type: 'image/png', size: 10 })).ok).toBe(false)
    expect(store.createSignedUpload).not.toHaveBeenCalled()
  })

  it('an unknown game is refused', async () => {
    const { store, deps } = setup(null)
    expect(await createHeroUploadCore(deps, GAME, { type: 'image/png', size: 10 })).toMatchObject({ ok: false })
    expect(store.createSignedUpload).not.toHaveBeenCalled()
  })

  it('a missing bucket says which migration to push', async () => {
    const { deps } = setup(game(), { createSignedUpload: vi.fn(async () => ({ error: 'Bucket not found' })) })
    const res = await createHeroUploadCore(deps, GAME, { type: 'image/png', size: 10 })
    expect(!res.ok && res.error).toMatch(/20261005000116/)
  })
})

describe('processHeroCore', () => {
  it('uploads every variant, saves the columns, deletes the source + old files, revalidates the game', async () => {
    const { store, deps } = setup()
    const res = await processHeroCore(deps, GAME, SOURCE, 40)
    expect(res.ok).toBe(true)
    expect(store.upload.mock.calls.map((c) => c[0])).toEqual(processed.ok ? processed.variants.map((v) => v.path) : [])
    expect(store.upload.mock.calls.every((c) => c[2] === 'image/webp')).toBe(true)
    expect(store.updateGame).toHaveBeenCalledWith(GAME, {
      hero_bg_url: pub(`${GAME}/newhash-1600.webp`),
      hero_bg_srcset: {
        '960': pub(`${GAME}/newhash-960.webp`),
        '1600': pub(`${GAME}/newhash-1600.webp`),
        '2400': pub(`${GAME}/newhash-2400.webp`),
      },
      hero_bg_blur: 'data:image/webp;base64,AAAA',
      hero_bg_focal_y: 40,
      hero_bg_updated_at: '2026-10-05T00:00:00.000Z',
    })
    const removed = store.remove.mock.calls.flatMap((c) => c[0])
    expect(removed).toEqual(expect.arrayContaining([`${GAME}/old-960.webp`, `${GAME}/old-1600.webp`, SOURCE]))
    expect(deps.revalidateGame).toHaveBeenCalledWith('mm2')
    expect(res.ok && res.hero).toMatchObject({ kind: 'upload', focalY: 40, src: pub(`${GAME}/newhash-1600.webp`) })
  })

  it('re-uploading the same image keeps its files (same hash)', async () => {
    const { store, deps } = setup(
      game({ hero_bg_url: pub(`${GAME}/newhash-1600.webp`), hero_bg_srcset: { '1600': pub(`${GAME}/newhash-1600.webp`) } }),
    )
    await processHeroCore(deps, GAME, SOURCE)
    const removed = store.remove.mock.calls.flatMap((c) => c[0])
    expect(removed).toEqual([SOURCE])
  })

  it('only accepts a source path minted for this game', async () => {
    const { store, deps } = setup()
    for (const p of [`other/_source/x.jpg`, `${GAME}/old-1600.webp`, `${GAME}/_source/../../x.jpg`, 42]) {
      expect((await processHeroCore(deps, GAME, p)).ok).toBe(false)
    }
    expect(store.download).not.toHaveBeenCalled()
  })

  it('a processing error is returned and the source is still deleted', async () => {
    const { store, deps } = setup()
    deps.processImage = vi.fn(async () => ({ ok: false as const, error: 'Use a landscape image.' }))
    expect(await processHeroCore(deps, GAME, SOURCE)).toEqual({ ok: false, error: 'Use a landscape image.' })
    expect(store.updateGame).not.toHaveBeenCalled()
    expect(store.remove).toHaveBeenCalledWith([SOURCE])
    expect(deps.revalidateGame).not.toHaveBeenCalled()
  })

  it('a failed DB write removes the new files and leaves the old hero alone', async () => {
    const { store, deps } = setup(game(), { updateGame: vi.fn(async () => ({ error: 'boom' })) })
    expect((await processHeroCore(deps, GAME, SOURCE)).ok).toBe(false)
    const removed = store.remove.mock.calls.flatMap((c) => c[0])
    expect(removed).toContain(`${GAME}/newhash-960.webp`)
    expect(removed).not.toContain(`${GAME}/old-1600.webp`)
  })

  it('a bad focal value is refused before any work', async () => {
    const { store, deps } = setup()
    expect((await processHeroCore(deps, GAME, SOURCE, 140)).ok).toBe(false)
    expect(store.download).not.toHaveBeenCalled()
  })
})

describe('setHeroFocalCore / removeHeroCore', () => {
  it('saves a strict 0–100 focal point and revalidates', async () => {
    const { store, deps } = setup()
    expect((await setHeroFocalCore(deps, GAME, 101)).ok).toBe(false)
    expect((await setHeroFocalCore(deps, GAME, '20')).ok).toBe(false)
    const res = await setHeroFocalCore(deps, GAME, 20)
    expect(res.ok && res.hero.focalY).toBe(20)
    expect(store.updateGame).toHaveBeenCalledWith(GAME, { hero_bg_focal_y: 20, hero_bg_updated_at: '2026-10-05T00:00:00.000Z' })
    expect(deps.revalidateGame).toHaveBeenCalledWith('mm2')
  })

  it('remove clears the columns, deletes our files, and the game falls back', async () => {
    const { store, deps } = setup()
    const res = await removeHeroCore(deps, GAME)
    expect(res.ok && res.hero.kind).toBe('none')
    expect(store.updateGame).toHaveBeenCalledWith(GAME, expect.objectContaining({ hero_bg_url: null, hero_bg_srcset: null, hero_bg_blur: null }))
    expect(store.remove).toHaveBeenCalledWith([`${GAME}/old-1600.webp`, `${GAME}/old-960.webp`])
  })

  it('storedHeroPaths never returns a path outside our bucket', () => {
    expect(storedHeroPaths({ hero_bg_url: 'https://evil.example/a', hero_bg_srcset: { '960': 'x' } }, SB)).toEqual([])
  })
})
