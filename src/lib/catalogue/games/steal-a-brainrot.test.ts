import { describe, expect, it } from 'vitest'
import pages from './__fixtures__/sab-pages.json'
import { firstImageFile, parseAmount, parseSabPage, sabRarity, sabRow, stealABrainrot } from './steal-a-brainrot'
import type { WikiPage } from '../types'

const page = (title: string) => (pages as WikiPage[]).find((p) => p.title === title)!
const UPDATES = new Map([[40, '2026-10-18']])

describe('SAB field parsers', () => {
  it('maps infobox rarities to our labels', () => {
    expect(sabRarity('Brainrot god')).toBe('Brainrot God')
    expect(sabRarity('[[Secret]]')).toBe('Secret')
    expect(sabRarity('Celestial')).toBeNull()
  })
  it('reads K/M/B amounts', () => {
    expect(parseAmount('322.5K')).toBe(322_500)
    expect(parseAmount('$23.5B')).toBe(23_500_000_000)
    expect(parseAmount('78M')).toBe(78_000_000)
    expect(parseAmount('Unknown')).toBeNull()
  })
})

describe('firstImageFile', () => {
  // 2026-10-22 first prod fill: 10 brainrots list "normal|egg" art in image1, so the
  // whole field was taken as one file name and no picture was copied.
  it('takes the first file when the infobox lists several', () => {
    expect(firstImageFile('<gallery>\nYetimatic.png|Brainrot\nYetimatic Egg.png|Egg\n</gallery>')).toBe('Yetimatic.png')
    // What the first fill stored for those 10 rows: the retry must clean it too.
    expect(firstImageFile('Yetimatic.png|Brainrot Yetimatic Egg.png|Egg')).toBe('Yetimatic.png')
    expect(firstImageFile('File:Slushi Huski.png')).toBe('Slushi Huski.png')
    expect(firstImageFile('  ')).toBeNull()
  })
})

describe('parseSabPage', () => {
  it('turns a brainrot page into an item with facts, image and stats', () => {
    const item = parseSabPage(page('Slushi Huski'), UPDATES, '2026-10-21')!
    expect(item).toMatchObject({
      slug: 'slushi-huski',
      name: 'Slushi Huski',
      rarity: 'Brainrot God',
      imageFile: 'Slushi Huski.png',
      pageUrl: 'https://stealabrainrot.fandom.com/wiki/Slushi_Huski',
      extra: { income: 322_500, cost: 78_000_000, obtainability: 'obtainable' },
    })
    expect(item.howToGet?.method).toMatch(/MerchShop DLC|Official Merch Code/)
  })
  it('skips subpages, pages without the infobox, unknown rarities and unreleased brainrots', () => {
    expect(parseSabPage(page('Slushi Huski/Gallery'), UPDATES, '2026-10-21')).toBeNull()
    const base = page('Cobra Gelato')
    expect(parseSabPage({ ...base, content: 'no infobox' }, UPDATES, '2026-10-21')).toBeNull()
    expect(parseSabPage({ ...base, content: base.content.replace('rarity=Secret', 'rarity=Celestial') }, UPDATES, '2026-10-21')).toBeNull()
    expect(parseSabPage({ ...base, content: base.content.replace('{{Obtainment|', '{{Obtainment|Upcoming=yes|') }, UPDATES, '2026-10-21')).toBeNull()
  })
  it('reads the first picture when the infobox lists normal and egg art', () => {
    const base = page('Cobra Gelato')
    // The real shape (Yetimatic, 2026-10-22): a <gallery> with one file per line.
    const gallery = 'image1=<gallery>\nCobra Gelato.png|Brainrot\nCobra Gelato Egg.png|Egg\n</gallery>'
    const item = parseSabPage({ ...base, content: base.content.replace('image1=Cobra Gelato.png', gallery) }, UPDATES, '2026-10-21')!
    expect(item.imageFile).toBe('Cobra Gelato.png')
  })
  it('skips lucky blocks and event items: no income, or tagged Non-Indexable by the wiki', () => {
    const base = page('Cobra Gelato')
    expect(parseSabPage({ ...base, content: base.content.replace('income=77.5M|', '') }, UPDATES, '2026-10-21')).toBeNull()
    expect(parseSabPage({ ...base, content: base.content.replace('income=77.5M', 'income=0') }, UPDATES, '2026-10-21')).toBeNull()
    expect(parseSabPage({ ...base, categories: [...base.categories, 'Category:Non-Indexable Brainrots'] }, UPDATES, '2026-10-21')).toBeNull()
  })
})

describe('sabRow', () => {
  it('shapes a row like the July wiki import and marks it as pipeline-added', () => {
    const item = parseSabPage(page('Cobra Gelato'), UPDATES, '2026-10-21')!
    expect(sabRow(item, 'cobra-gelato.webp', '2026-10-21T00:00:00Z')).toMatchObject({
      slug: 'cobra-gelato',
      name: 'Cobra Gelato',
      rarity: 'Secret',
      image_path: 'cobra-gelato.webp',
      image_status: 'approved',
      source_name: 'Steal a Brainrot Wiki',
      source_page_id: 32151,
      needs_review: false,
      is_active: true,
      source_payload: { image_file: 'Cobra Gelato.png', imported_by: 'catalogue-pipeline' },
    })
    expect(sabRow(item, null, '2026-10-21T00:00:00Z')).toMatchObject({ image_path: null, image_status: 'missing' })
  })
  it('lists every brainrot page through the infobox', () => {
    expect(stealABrainrot.listQueries).toEqual([{ list: 'embeddedin', title: 'Template:Brainrot Infobox' }])
  })
})
