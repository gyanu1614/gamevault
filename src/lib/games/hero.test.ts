import { describe, it, expect } from 'vitest'
import {
  STATIC_GAME_HEROES,
  clampHeroFocalY,
  heroObjectPathFromUrl,
  heroObjectPosition,
  heroSourcePath,
  isGameHeroUrl,
  isHeroBlur,
  isHeroSourcePath,
  parseHeroFocalY,
  parseHeroSrcset,
  parseHeroUploadRequest,
  pickDefaultSource,
  resolveGameHero,
} from './hero'

const SB = 'https://abc.supabase.co'
const pub = (p: string) => `${SB}/storage/v1/object/public/game-heroes/${p}`
const GAME = '11111111-2222-3333-4444-555555555555'
const BLUR = 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAQAcJaQAA3AA/v3AgAA='

describe('focal point', () => {
  it('clamps anything to an integer 0–100, junk → centred', () => {
    expect(clampHeroFocalY(-20)).toBe(0)
    expect(clampHeroFocalY(140)).toBe(100)
    expect(clampHeroFocalY(33.6)).toBe(34)
    expect(clampHeroFocalY('70')).toBe(70)
    expect(clampHeroFocalY(null)).toBe(50)
    expect(clampHeroFocalY('abc')).toBe(50)
    expect(clampHeroFocalY(NaN)).toBe(50)
    expect(heroObjectPosition(12)).toBe('50% 12%')
  })

  it('the server accepts only a finite number in range (never clamps)', () => {
    expect(parseHeroFocalY(40.4)).toEqual({ ok: true, value: 40 })
    expect(parseHeroFocalY(0)).toEqual({ ok: true, value: 0 })
    expect(parseHeroFocalY(100)).toEqual({ ok: true, value: 100 })
    for (const bad of [-1, 101, NaN, Infinity, '50', null, undefined]) {
      expect(parseHeroFocalY(bad).ok).toBe(false)
    }
  })
})

describe('URLs', () => {
  it('only our own bucket, no attribute-breaking characters', () => {
    expect(isGameHeroUrl(pub(`${GAME}/abc-1600.webp`), SB)).toBe(true)
    expect(isGameHeroUrl(pub(`${GAME}/abc-1600.webp`), `${SB}/`)).toBe(true)
    expect(isGameHeroUrl('https://evil.example/x.webp', SB)).toBe(false)
    expect(isGameHeroUrl(`${SB}/storage/v1/object/public/store-banners/x.webp`, SB)).toBe(false)
    expect(isGameHeroUrl(pub('a b.webp'), SB)).toBe(false)
    expect(isGameHeroUrl(pub('a").webp'), SB)).toBe(false)
    expect(isGameHeroUrl(pub('a,1600w.webp'), SB)).toBe(false)
    expect(isGameHeroUrl(pub(''), SB)).toBe(false)
    expect(isGameHeroUrl(pub('x.webp'), undefined)).toBe(false)
  })

  it('maps a public URL back to its object path', () => {
    expect(heroObjectPathFromUrl(pub(`${GAME}/h-960.webp`), SB)).toBe(`${GAME}/h-960.webp`)
    expect(heroObjectPathFromUrl('https://evil.example/x', SB)).toBeNull()
  })

  it('accepts only a tiny data:image LQIP', () => {
    expect(isHeroBlur(BLUR)).toBe(true)
    expect(isHeroBlur('data:image/svg+xml;base64,PHN2Zz4=')).toBe(false)
    expect(isHeroBlur('https://x/y.webp')).toBe(false)
    expect(isHeroBlur(`data:image/webp;base64,${'A'.repeat(2000)}`)).toBe(false)
    expect(isHeroBlur('data:image/webp;base64,abc")')).toBe(false)
  })
})

describe('srcset', () => {
  it('keeps valid widths in our bucket, ascending', () => {
    const sources = parseHeroSrcset(
      {
        '2400': pub('g/h-2400.webp'),
        '960': pub('g/h-960.webp'),
        '1600': pub('g/h-1600.webp'),
        wide: pub('g/h-x.webp'),
        '50': pub('g/h-50.webp'),
        '1200': 'https://evil.example/h.webp',
      },
      SB,
    )
    expect(sources.map((s) => s.width)).toEqual([960, 1600, 2400])
    expect(pickDefaultSource(sources)?.width).toBe(1600)
    expect(parseHeroSrcset(['x'], SB)).toEqual([])
    expect(parseHeroSrcset(null, SB)).toEqual([])
  })

  it('default src: 1600, else the widest under it, else the narrowest', () => {
    expect(pickDefaultSource([{ width: 960, url: 'a' }, { width: 1400, url: 'b' }])?.url).toBe('b')
    expect(pickDefaultSource([{ width: 2000, url: 'a' }, { width: 2400, url: 'b' }])?.url).toBe('a')
    expect(pickDefaultSource([])).toBeNull()
  })
})

describe('resolveGameHero — upload → static art → none', () => {
  const upload = {
    slug: 'mm2',
    hero_bg_url: pub('g/h-1600.webp'),
    hero_bg_srcset: { '960': pub('g/h-960.webp'), '1600': pub('g/h-1600.webp'), '2400': pub('g/h-2400.webp') },
    hero_bg_blur: BLUR,
    hero_bg_focal_y: 30,
  }

  it('an upload wins, with srcset, LQIP and focal point', () => {
    const hero = resolveGameHero('mm2', upload, SB)
    expect(hero).toEqual({
      kind: 'upload',
      src: pub('g/h-1600.webp'),
      sources: [
        { width: 960, url: pub('g/h-960.webp') },
        { width: 1600, url: pub('g/h-1600.webp') },
        { width: 2400, url: pub('g/h-2400.webp') },
      ],
      srcSet: `${pub('g/h-960.webp')} 960w, ${pub('g/h-1600.webp')} 1600w, ${pub('g/h-2400.webp')} 2400w`,
      blur: BLUR,
      focalY: 30,
    })
  })

  it('a bad LQIP is dropped, the upload still renders', () => {
    const hero = resolveGameHero('mm2', { ...upload, hero_bg_blur: 'javascript:alert(1)' }, SB)
    expect(hero.kind).toBe('upload')
    expect(hero.kind === 'upload' && hero.blur).toBeNull()
  })

  it('foreign URLs never render: falls back to the static art', () => {
    const hero = resolveGameHero(
      'adopt-me',
      { slug: 'adopt-me', hero_bg_url: 'https://evil.example/x.webp', hero_bg_srcset: { '1600': 'https://evil.example/x.webp' } },
      SB,
    )
    expect(hero).toEqual({ kind: 'static', src: STATIC_GAME_HEROES['adopt-me'], focalY: 50 })
  })

  it('no upload → the static art the repo ships for that game', () => {
    expect(resolveGameHero('steal-a-brainrot', { slug: 'steal-a-brainrot', hero_bg_focal_y: 70 }, SB)).toEqual({
      kind: 'static',
      src: '/assets/heroes/steal-a-brainrot.avif',
      focalY: 70,
    })
    expect(resolveGameHero('fortnite', null, SB)).toMatchObject({ kind: 'static', src: '/hero/fortnite.jpg' })
  })

  it('no upload and no static art → neutral (never another game\'s art)', () => {
    expect(resolveGameHero('murder-mystery-2', null, SB)).toEqual({ kind: 'none', focalY: 50 })
    expect(resolveGameHero('murder-mystery-2', { slug: 'murder-mystery-2', hero_bg_url: null }, SB).kind).toBe('none')
  })

  it('a url without a srcset still renders as a single source', () => {
    const hero = resolveGameHero('mm2', { slug: 'mm2', hero_bg_url: pub('g/h-1600.webp') }, SB)
    expect(hero).toMatchObject({ kind: 'upload', src: pub('g/h-1600.webp'), srcSet: `${pub('g/h-1600.webp')} 1600w` })
  })
})

describe('upload request', () => {
  it('accepts JPG/PNG/WebP/AVIF up to 6 MB', () => {
    expect(parseHeroUploadRequest({ type: 'image/jpeg', size: 1000 })).toEqual({ ok: true, mime: 'image/jpeg', ext: 'jpg' })
    expect(parseHeroUploadRequest({ type: 'image/jpg', size: 1000 })).toMatchObject({ ok: true, mime: 'image/jpeg' })
    expect(parseHeroUploadRequest({ type: 'image/avif', size: 6 * 1024 * 1024 })).toMatchObject({ ok: true, ext: 'avif' })
  })

  it('refuses other types, empty and oversized files', () => {
    expect(parseHeroUploadRequest({ type: 'image/gif', size: 10 }).ok).toBe(false)
    expect(parseHeroUploadRequest({ type: 'image/svg+xml', size: 10 }).ok).toBe(false)
    expect(parseHeroUploadRequest({ type: 'image/png', size: 0 }).ok).toBe(false)
    expect(parseHeroUploadRequest({ type: 'image/png', size: 6 * 1024 * 1024 + 1 })).toEqual({
      ok: false,
      error: 'Hero image must be 6 MB or smaller.',
    })
    expect(parseHeroUploadRequest(null).ok).toBe(false)
  })

  it('source paths: minted per game, nothing else accepted', () => {
    const p = heroSourcePath(GAME, 'a1b2-c3', 'png')
    expect(p).toBe(`${GAME}/_source/a1b2-c3.png`)
    expect(isHeroSourcePath(GAME, p)).toBe(true)
    expect(isHeroSourcePath('other-game', p)).toBe(false)
    expect(isHeroSourcePath(GAME, `${GAME}/_source/../x.png`)).toBe(false)
    expect(isHeroSourcePath(GAME, `${GAME}/h-1600.webp`)).toBe(false)
    expect(isHeroSourcePath(GAME, `${GAME}/_source/x.exe`)).toBe(false)
    expect(isHeroSourcePath(GAME, 42)).toBe(false)
  })
})
