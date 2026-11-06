/**
 * Every picture stored for the public goes in at a standard size
 * (IMAGE_STANDARDS in src/lib/images/resize-server.ts), so what we store can't
 * grow with what people happen to upload. On 2026-11-05 profile pictures averaged
 * 888 KB and listing photos 246 KB. A new upload path fails here until it uses
 * toStoredImage or is listed with a reason.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/** Files whose uploads go through toStoredImage, and how many uploads that is. */
const STANDARD: Record<string, number> = {
  'src/lib/actions/admin-category-configs.ts': 1,
  'src/lib/actions/admin-game-wizard.ts': 2,
  'src/lib/actions/admin-games.ts': 1,
  'src/lib/actions/admin-template-builder.ts': 1,
  'src/lib/actions/auth.ts': 2,
  'src/lib/actions/listings.ts': 1,
  'src/lib/actions/sell-wizard.ts': 1,
}

/** Files that size their uploads another way, or must keep the file untouched. */
const OTHER_WAY: Record<string, string> = {
  'src/app/account/orders/[orderId]/_MarkDeliveredModal.tsx': 'Shrunk in the browser first (compressImageForUpload, <=1600 px)',
  'src/lib/actions/admin-blog-images.ts': 'processBlogImage makes its own sized AVIF + WebP set',
  'src/lib/actions/admin-game-wizard.ts': 'One hero upload encoded to sized AVIF, beside the two standard ones',
  'src/lib/actions/founding-onboarding.ts': 'A drawn signature PNG, a few KB',
  'src/lib/actions/seller-application.ts': 'KYC originals: identity documents stay exactly as sent',
  'src/lib/catalogue/images.ts': 'Catalogue art, encoded to WebP by the run',
  'src/lib/chat/attachments.ts': 'Shrunk in the browser first (compressImageForUpload, <=1600 px)',
  'src/lib/games/hero-service.ts': 'Own sized AVIF set',
  'src/lib/games/icons.ts': 'Own sized set',
  'src/lib/imports/images.ts': 'Bulk import, re-encoded to one square WebP',
  'src/lib/shop/store-banner-service.ts': 'Own fixed-size WebP',
  'src/lib/storage/delivery-evidence.ts': 'Private bucket; not called by anything today',
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      if (name === 'test' || name === 'node_modules') continue
      walk(path, out)
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(path)
    }
  }
  return out
}

const uploadsIn = (source: string) => (source.match(/\.upload\(/g) ?? []).length
const STORAGE_SHAPED = /\.from\([^)]*\)\s*\.upload\(|bucket\.upload\(|deps\.store\.upload\(|\.storage\.from\(/

describe('image upload sizes', () => {
  const files = walk('src').filter((file) => {
    const source = readFileSync(file, 'utf8')
    return uploadsIn(source) > 0 && STORAGE_SHAPED.test(source)
  })

  it('finds the upload paths (guards a vacuous pass)', () => {
    expect(files).toContain('src/lib/actions/sell-wizard.ts')
    expect(files.length).toBeGreaterThan(10)
  })

  it('every upload path is sized on the way in, or listed with a reason', () => {
    const unknown = files.filter((file) => !(file in STANDARD) && !(file in OTHER_WAY))
    expect(unknown).toEqual([])
  })

  it.each(Object.entries(STANDARD))('%s stores through toStoredImage', (file, count) => {
    const calls = (readFileSync(file, 'utf8').match(/toStoredImage\(/g) ?? []).length
    expect(calls).toBeGreaterThanOrEqual(count)
  })

  it('the old raw listing upload is gone', () => {
    expect(files).not.toContain('src/lib/storage/listing-images.ts')
  })
})
