import { describe, it, expect } from 'vitest'
import { gameCtaFallback, gameCtaImage, gameCtaSources } from './game-cta-art'

const ADMIN = 'https://x.supabase.co/storage/v1/object/public/game-covers/blog-cta/sab.png'

describe('one CTA image per game', () => {
  it('admin upload (games.blog_cta_image_url) wins', () => {
    expect(gameCtaImage({ slug: 'steal-a-brainrot', ctaImageUrl: ADMIN })).toBe(ADMIN)
    expect(gameCtaImage({ slug: 'adopt-me', ctaImageUrl: `  ${ADMIN}  ` })).toBe(ADMIN)
  })

  it('falls back to the static art: seller-cta for SAB, cta-heroes otherwise', () => {
    expect(gameCtaImage({ slug: 'steal-a-brainrot', ctaImageUrl: null })).toBe('/seller-cta/steal-a-brainrot.png')
    expect(gameCtaImage({ slug: 'adopt-me' })).toBe('/cta-heroes/adopt-me.jpg')
    expect(gameCtaImage({ slug: 'steal-an-egg', ctaImageUrl: '  ' })).toBe('/cta-heroes/steal-an-egg.jpg')
    expect(gameCtaFallback('adopt-me')).toBe('/cta-heroes/adopt-me.jpg')
  })

  it('band candidates: chosen image, then the static art, never duplicated', () => {
    expect(gameCtaSources('steal-a-brainrot', ADMIN)).toEqual([ADMIN, '/seller-cta/steal-a-brainrot.png'])
    expect(gameCtaSources('adopt-me', '/cta-heroes/adopt-me.jpg')).toEqual(['/cta-heroes/adopt-me.jpg'])
    expect(gameCtaSources('adopt-me')).toEqual(['/cta-heroes/adopt-me.jpg'])
  })
})
