/**
 * Bundle 2 — every listing create/edit path calls the ONE link function
 * (`linkListingsToValueItems`, src/lib/value-listings/link.ts) once, before
 * it revalidates. Pinned so a refactor (e.g. the importer's create seam) moves
 * the call instead of dropping it. The trigger + nightly reconcile repair a
 * missed link within a day, but a missed call means a new listing doesn't show
 * on its value page until then.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

/** Body of `export async function <name>(` up to the next top-level export. */
function body(src: string, name: string): string {
  const start = src.indexOf(`export async function ${name}(`)
  expect(start, `${name} not found`).toBeGreaterThan(-1)
  const next = src.indexOf('\nexport ', start + 10)
  return src.slice(start, next === -1 ? undefined : next)
}

const SEAMS: Array<[file: string, fn: string]> = [
  ['src/lib/actions/sell-wizard.ts', 'publishListing'],
  ['src/lib/actions/sell-wizard.ts', 'updateListingFromWizard'],
  ['src/lib/actions/sell-wizard.ts', 'bulkPublishListings'],
  ['src/lib/actions/listings.ts', 'updateListing'],
  ['src/lib/actions/listings.ts', 'bulkUpdateListings'],
  // Step 4 — the admin bulk importer (links the listings each chunk created).
  ['src/lib/actions/admin-imports.ts', 'applyImportBatch'],
]

describe('value item link seams', () => {
  for (const [file, fn] of SEAMS) {
    it(`${fn} links exactly once, before revalidating`, () => {
      const b = body(read(file), fn)
      const calls = b.split('linkListingsToValueItems(').length - 1
      expect(calls).toBe(1)
      expect(b.indexOf('linkListingsToValueItems(')).toBeLessThan(b.indexOf('revalidateListingSurfaces('))
    })
  }
})
