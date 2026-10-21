import { describe, it, expect, vi, beforeAll } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/anon', () => ({ createAnonClient: () => ({}) }))
// Next's bundled React has cache(); plain React 18 in vitest does not.
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<object>()), cache: (fn: unknown) => fn }))

const SB = 'https://abcd.supabase.co'
const url = (w: number) => `${SB}/storage/v1/object/public/game-heroes/g/x-${w}.avif`

// 2026-10-20 usage audit (A1): the hero is preloaded at high priority on every
// page of a game; it is served through /media (Vercel CDN), not from Storage.
describe('heroViaMedia', () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = SB
  })

  it('serves the upload and every srcset width through /media', async () => {
    const { heroViaMedia } = await import('./hero.server')
    const hero = heroViaMedia({
      kind: 'upload',
      src: url(1600),
      sources: [{ width: 960, url: url(960) }, { width: 1600, url: url(1600) }],
      srcSet: `${url(960)} 960w, ${url(1600)} 1600w`,
      blur: null,
      focalY: 50,
    })
    expect(hero.kind === 'upload' && hero.src).toBe('/media/game-heroes/g/x-1600.avif')
    expect(hero.kind === 'upload' && hero.srcSet).toBe('/media/game-heroes/g/x-960.avif 960w, /media/game-heroes/g/x-1600.avif 1600w')
  })

  it('leaves the static art and the no-hero fallback alone', async () => {
    const { heroViaMedia } = await import('./hero.server')
    expect(heroViaMedia({ kind: 'static', src: '/heroes/sab.webp', focalY: 50 })).toEqual({ kind: 'static', src: '/heroes/sab.webp', focalY: 50 })
    expect(heroViaMedia({ kind: 'none', focalY: 50 })).toEqual({ kind: 'none', focalY: 50 })
  })
})
