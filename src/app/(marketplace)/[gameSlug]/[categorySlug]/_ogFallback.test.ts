/**
 * Step 7b — the embedded long-tail OG card must be the PNG in public/ (the
 * one reviewers can open), byte for byte, or someone replaced one and not
 * the other. Regenerate with scripts/og/embed-category-fallback.mjs.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { ogCategoryFallbackBytes } from './_ogFallback'

describe('OG category fallback', () => {
  it('is a 1200×630 PNG identical to public/og/category-fallback.png', () => {
    const embedded = Buffer.from(ogCategoryFallbackBytes())
    const file = readFileSync('public/og/category-fallback.png')
    expect(embedded.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    // IHDR width/height at bytes 16..24
    expect(embedded.readUInt32BE(16)).toBe(1200)
    expect(embedded.readUInt32BE(20)).toBe(630)
    expect(embedded.equals(file)).toBe(true)
  })
})
