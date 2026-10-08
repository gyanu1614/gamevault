import { describe, it, expect, vi } from 'vitest'
import React, { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { GameHero } from '@/lib/games/hero'

vi.stubGlobal('React', React)
vi.mock('server-only', () => ({}))

const getGameHero = vi.fn<(slug: string) => Promise<GameHero>>()
vi.mock('@/lib/games/hero.server', () => ({ getGameHero: (slug: string) => getGameHero(slug) }))

import { GameHeroArt } from './GameHeroArt'
import { GameHeroBackdrop } from './GameHeroBackdrop'

const BLUR = 'data:image/webp;base64,AAAA'
const upload: GameHero = {
  kind: 'upload',
  src: 'https://x.supabase.co/storage/v1/object/public/game-heroes/g/h-1600.webp',
  sources: [],
  srcSet: 'https://x/h-960.webp 960w, https://x/h-1600.webp 1600w',
  blur: BLUR,
  focalY: 30,
}

describe('GameHeroArt', () => {
  it('upload: inline LQIP + eager high-priority srcset image + the recipe layers', () => {
    const html = renderToStaticMarkup(createElement(GameHeroArt, { hero: upload, size: 'market' }))
    expect(html).toContain('class="game-hero"')
    expect(html).toContain('data-size="market"')
    expect(html).toContain('--game-hero-focal:30%')
    expect(html).toContain(`background-image:url(&quot;${BLUR}&quot;)`)
    const img = html.match(/<img[^>]*>/)?.[0] ?? ''
    expect(img).toContain('srcSet="https://x/h-960.webp 960w, https://x/h-1600.webp 1600w"')
    expect(img).toContain('sizes="100vw"')
    expect(img).toMatch(/fetchPriority="high"|fetchpriority="high"/)
    expect(img).toContain('decoding="async"')
    expect(img).not.toContain('loading="lazy"')
    expect(img).toContain('alt="Game background art"')
    for (const layer of ['game-hero__veil', 'game-hero__light', 'game-hero__fade']) expect(html).toContain(layer)
    expect(html).toContain('aria-hidden="true"')
  })

  it('static art: one plain src, neutral ground under it', () => {
    const html = renderToStaticMarkup(
      createElement(GameHeroArt, { hero: { kind: 'static', src: '/hero/roblox.jpg', focalY: 50 }, size: 'hub' }),
    )
    expect(html).toContain('src="/hero/roblox.jpg"')
    expect(html).not.toMatch(/srcSet|srcset/)
    expect(html).toContain('game-hero__ground--neutral')
  })

  it('no art: no image request at all, just the neutral gradient', () => {
    const html = renderToStaticMarkup(createElement(GameHeroArt, { hero: { kind: 'none', focalY: 50 }, size: 'hub' }))
    expect(html).not.toContain('<img')
    expect(html).toContain('game-hero__ground--neutral')
  })
})

describe('GameHeroBackdrop', () => {
  it('reads the hero for the given game and stacks children above the band', async () => {
    getGameHero.mockResolvedValue(upload)
    const el = await GameHeroBackdrop({ gameSlug: 'mm2', size: 'tall', children: createElement('p', null, 'page body') })
    const html = renderToStaticMarkup(el)
    expect(getGameHero).toHaveBeenCalledWith('mm2')
    expect(html).toMatch(/^<div class="game-hero-scope"><div aria-hidden="true" class="game-hero" data-size="tall"/)
    expect(html).toContain('<div class="relative z-20"><p>page body</p></div>')
  })
})
