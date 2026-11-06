// @vitest-environment node
/**
 * A paused store's offers are off sale everywhere (owner, 2026-11-06). The listing
 * pages hid them, but until that day a saved link still opened with Buy Now and the
 * order went through. Buying is proven against the database in
 * sell-security-checkout.guard.integration.test.ts; this pins the link.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const page = readFileSync(join(process.cwd(), 'src/app/(marketplace)/[gameSlug]/[categorySlug]/[listingSlug]/page.tsx'), 'utf8')

describe('a paused store on the listing page', () => {
  it('checks the pause on both ways a listing is found', () => {
    expect(page.match(/storeIsPaused\(/g)?.length).toBe(3)
  })

  it('reads the shared list that pausing refreshes', () => {
    expect(page).toContain('getPausedSellerIds()')
  })
})
