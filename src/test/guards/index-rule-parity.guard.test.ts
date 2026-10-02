/**
 * The category page and the value item page decide their own robots meta in
 * files this bundle may not edit (Bundle 2). Until they call the shared
 * predicates in lib/games/indexability.ts, these tests pin their inline rules to
 * the same definition the sitemap uses, so the two cannot drift again
 * (`/grow-a-garden/buy-items` was listed while the page said noindex).
 *
 * Each rule passes if the page either still contains the inline expression OR
 * calls the shared predicate: swapping in the predicate is the intended fix.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import {
  hasCuratedCurrencyContent,
  isCategoryPageIndexable,
  isValueItemIndexable,
  MIN_VALUE_SAMPLE_SIZE,
} from '@/lib/games/indexability'

const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), 'utf8')
const CATEGORY_PAGE = 'src/app/(marketplace)/[gameSlug]/[categorySlug]/page.tsx'
const ITEM_PAGE = 'src/app/(marketplace)/[gameSlug]/values/[itemSlug]/page.tsx'

describe('category page rule == shared rule', () => {
  const src = read(CATEGORY_PAGE)

  it('noindexes exactly when there is no buyable listing and no curated content', () => {
    const inline = /stats\.count\s*===\s*0\s*&&\s*!hasCuratedContent/.test(src)
    const shared = /isCategoryPageIndexable|categoryPageVerdict/.test(src)
    expect(inline || shared, 'the category page noindex rule changed: update lib/games/indexability.ts and the sitemap to match').toBe(true)
    // The inline rule, evaluated by the shared function: same truth table.
    for (const count of [0, 1, 7]) for (const curated of [false, true]) {
      expect(isCategoryPageIndexable({ buyableListingCount: count, hasCuratedContent: curated })).toBe(!(count === 0 && !curated))
    }
  })

  it('treats a currency config as curated only with a non-empty FAQ or steps list', () => {
    const inline = /\(currencyCfg\.faq\?\.length \?\? 0\) > 0 \|\| \(currencyCfg\.steps\?\.length \?\? 0\) > 0/.test(src)
    const shared = /hasCuratedCurrencyContent/.test(src)
    expect(inline || shared, 'the page changed what counts as curated content: update hasCuratedCurrencyContent and the sitemap').toBe(true)
    expect(hasCuratedCurrencyContent({ faq: [], steps: [] })).toBe(false)
    expect(hasCuratedCurrencyContent({ faq: [{}] })).toBe(true)
  })

  it('counts stats the way the sitemap does: not paused, not test, price above 0', () => {
    const stats = read('src/lib/seo/page-stats.ts')
    expect(stats).toMatch(/getPausedSellerIds\(\)/)
    expect(stats).toMatch(/getTestSellerIds\(\)/)
    expect(stats).toMatch(/Number\(r\.price\) > 0/)
    expect(stats).toMatch(/\.eq\('game_id', gameId\)/)
    expect(stats).toMatch(/\.eq\('game_category_id', categoryId\)/)
  })
})

describe('value item page rule == shared rule', () => {
  const src = read(ITEM_PAGE)

  it('noindexes a pipeline value without a price backed by enough live listings', () => {
    const inline = /const thin = !priced \|\| \(price\?\.sampleSize \?\? 0\) < 3/.test(src)
    const shared = /isValueItemIndexable/.test(src)
    expect(inline || shared, 'the item page thin-content rule changed: update isValueItemIndexable and the sitemap').toBe(true)
    expect(MIN_VALUE_SAMPLE_SIZE).toBe(3)
    expect(isValueItemIndexable({ priced: true, sampleSize: 2 })).toBe(false)
    expect(isValueItemIndexable({ priced: true, sampleSize: 3 })).toBe(true)
  })
})
