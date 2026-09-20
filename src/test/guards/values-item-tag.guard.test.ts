/**
 * Step 7a — every value item page render must anchor to its game's values tag,
 * or /api/internal/values-revalidate cannot reach it (item pages are an open
 * set revalidated by tag, not by path).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const page = readFileSync('src/app/(marketplace)/[gameSlug]/values/[itemSlug]/page.tsx', 'utf8')

describe('value item page — revalidation tag', () => {
  it('binds the game tag before any branch renders', () => {
    const body = page.slice(page.indexOf('export default async function'))
    const bind = body.indexOf('await bindValuesTag(gameSlug)')
    expect(bind, 'bindValuesTag(gameSlug) missing from the page body').toBeGreaterThan(0)
    // Before the first game-specific branch (Adopt Me is the first `if`).
    expect(bind).toBeLessThan(body.indexOf("gameSlug === 'adopt-me'"))
  })
})
