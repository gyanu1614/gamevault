/**
 * Every value item page render must anchor to BOTH revalidation tags, or the
 * jobs that change its data cannot reach it (item pages are an open set,
 * revalidated by tag, not by path):
 *
 *   • `values:<game>`       — catalogue/content edits, via
 *                             /api/internal/values-revalidate
 *   • `price:<game>:<item>` — the price crawl's publish step, which only names
 *                             the items whose prices actually moved
 *                             (/api/internal/sab-market-revalidate)
 *
 * Both must be bound before the first game-specific branch, so every variant
 * of the page (SAB, Adopt Me, the generic pipeline) carries them.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const page = readFileSync('src/app/(marketplace)/[gameSlug]/values/[itemSlug]/page.tsx', 'utf8')

describe('value item page — revalidation tag', () => {
  it('binds the game content tag before any branch renders', () => {
    const body = page.slice(page.indexOf('export default async function'))
    const bind = body.indexOf('bindValuesTag(gameSlug)')
    expect(bind, 'bindValuesTag(gameSlug) missing from the page body').toBeGreaterThan(0)
    // Before the first game-specific branch (Adopt Me is the first `if`).
    expect(bind).toBeLessThan(body.indexOf("gameSlug === 'adopt-me'"))
  })

  it('binds the per-item price tag before any branch renders', () => {
    const body = page.slice(page.indexOf('export default async function'))
    const bind = body.indexOf('bindValueItemPriceTag(gameSlug, itemSlug)')
    expect(
      bind,
      'bindValueItemPriceTag(gameSlug, itemSlug) missing from the page body — ' +
        'the price crawl revalidates item pages by this tag',
    ).toBeGreaterThan(0)
    expect(bind).toBeLessThan(body.indexOf("gameSlug === 'adopt-me'"))
  })

  it('keeps the shell on a long window, not a price-length one', () => {
    // The refresh path is the tags above; the window is only a safety net.
    // A short window here would rebuild every item page on a timer and undo
    // the point of the per-item tag.
    const match = page.match(/export const revalidate = (\d+)/)
    expect(match, 'the page must declare a revalidate window').toBeTruthy()
    expect(Number(match![1])).toBeGreaterThanOrEqual(86400)
  })
})
