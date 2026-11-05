/**
 * The pet page and the all-pets page stay on one scale (page-scale.ts): only the
 * listed text sizes, one section title, one gap. A static read of the source.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (p: string) => readFileSync(join(root, p), 'utf8')

const dirFiles = (dir: string) =>
  readdirSync(join(root, dir))
    .filter((f) => f.endsWith('.tsx') && !f.includes('.test.'))
    .map((f) => `${dir}/${f}`)

const FILES = [
  ...dirFiles('src/features/item-buy'),
  ...dirFiles('src/features/items-grid'),
  'src/app/(marketplace)/[gameSlug]/[categorySlug]/item/_ItemListingsView.tsx',
  'src/components/marketplace/CategoryHeader.tsx',
  'src/components/marketplace/CategoryGuide.tsx',
  'src/components/marketplace/WhyBuyCard.tsx',
  'src/components/marketplace/Pagination.tsx',
  'src/components/marketplace/CurrencySellerRow.tsx',
  'src/components/marketplace/ShowAllLink.tsx',
  'src/components/seller/SellerPrompt.tsx',
  'src/features/home/components/BuyerSteps.tsx',
]

/** Text sizes on the two pages, in px (page-scale.ts). 11 is the small trait and "Yours" chips. */
const ALLOWED = new Set(['11', '12', '13', '14', '16', '18', '20', '24', '28', '34'])

describe('pet page + all-pets page: one scale', () => {
  it.each(FILES)('%s uses only the scale\'s text sizes', (file) => {
    const sizes = [...read(file).matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)].map((m) => m[1])
    expect(sizes.filter((s) => !ALLOWED.has(s))).toEqual([])
  })

  it.each(FILES)('%s: hover never moves anything, no large corners on cards', (file) => {
    const src = read(file)
    expect(src).not.toMatch(/hover:-?translate-y|hover:scale/)
    expect(src).not.toMatch(/\brounded-(xl|2xl|3xl)\b/)
  })

  it('every section title on both pages uses the one style', () => {
    expect(read('src/features/item-buy/layout.ts')).toMatch(/ITEM_H2 = SECTION_TITLE/)
    for (const f of ['src/components/marketplace/CategoryGuide.tsx', 'src/components/marketplace/WhyBuyCard.tsx', 'src/features/home/components/BuyerSteps.tsx']) {
      expect(read(f), f).toContain('SECTION_TITLE')
      expect(read(f), f).not.toContain('section-title')
      expect(read(f), f).not.toContain('text-subheading')
    }
  })

  it('the grid leaves the gap above the guide to the guide, so it is not counted twice', () => {
    expect(read('src/features/items-grid/ItemsGridClient.tsx')).not.toMatch(/pb-20/)
    expect(read('src/app/(marketplace)/[gameSlug]/[categorySlug]/_ItemsPageClient.tsx')).not.toMatch(/px-4 pb-20 pt-3/)
    const guide = read('src/components/marketplace/CategoryGuide.tsx')
    expect(guide).toContain('SECTION_GAP')
    expect(guide).toContain('SECTION_STACK')
    expect(guide).toContain('PAGE_END')
  })

  it('the numbered steps line up: content from the top, the row flush with the page', () => {
    const css = read('src/app/globals.css')
    const card = css.slice(css.indexOf('.buyer-step__card {'), css.indexOf('.buyer-step__icon {'))
    expect(card).toContain('justify-content: flex-start')
    expect(card).not.toMatch(/max-width:\s*195px/)
  })
})
