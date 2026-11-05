import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { marketImagePath, marketRow, planMarketItems } from '../../../scripts/lib/adoptme-market-items.mjs'

const bytes = Buffer.from('picture')
const sha = createHash('sha256').update(bytes).digest('hex')
const egg = { slug: 'crystal-egg', name: 'Crystal Egg', kind: 'egg', out_file: 'pictures/crystal-egg.webp', out_sha256: sha }
const potion = { slug: 'fly-potion', name: 'Fly Potion', kind: 'potion', out_file: 'pictures/fly-potion.webp', out_sha256: sha }

describe('planMarketItems', () => {
  it('plans what is missing and leaves a row already there alone', () => {
    const plan = planMarketItems({ rows: [egg, potion] }, new Set(['fly-potion']), () => bytes)
    expect(plan.rows.map((r: { slug: string }) => r.slug)).toEqual(['crystal-egg'])
    expect(plan.skipped).toEqual(['fly-potion'])
  })

  it('stops on a picture that is not the one reviewed', () => {
    expect(() => planMarketItems({ rows: [egg] }, new Set(), () => Buffer.from('other'))).toThrow(/changed since/)
  })

  it('stops on a kind the column would refuse', () => {
    expect(() => planMarketItems({ rows: [{ ...egg, kind: 'pet' }] }, new Set(), () => bytes)).toThrow(/not egg or potion/)
  })
})

describe('marketRow', () => {
  it('stays off every is_active reader: the Values pages, calculator, sitemap and blog', () => {
    const row = marketRow({ slug: 'crystal-egg', name: 'Crystal Egg', kind: 'egg', bytes }, 'https://x/storage/v1/object/public/adopt-me-pets/')
    expect(row).toEqual({
      slug: 'crystal-egg',
      name: 'Crystal Egg',
      is_active: false,
      item_kind: 'egg',
      rarity: 'common',
      image_url: `https://x/storage/v1/object/public/adopt-me-pets/${marketImagePath('crystal-egg')}`,
    })
  })
})
