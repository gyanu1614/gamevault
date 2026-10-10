/**
 * Every public page's metadata passes through `seoMeta()` (src/lib/seo/fit.ts),
 * so no template ships a title over 60 characters or a description over 155.
 *
 * Why: the 2026-10-07 Bing site scan of 500 pages flagged 26 long titles and
 * a long or short description on most item pages; our own crawl of 3,000
 * pages found 598 titles over 60 and 1,098 descriptions over 160, because
 * every template grew its copy on its own. One seam fixes all of them, and
 * this guard keeps a new page from bypassing it.
 *
 * A new public page that exports `metadata` or `generateMetadata` fails here
 * until it wraps its return in `seoMeta(...)`, or is added to EXEMPT with a
 * reason.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(__dirname, '..', '..', '..')
const APP = join(ROOT, 'src/app')

/** Not public, robots-blocked or noindex: their titles never show in a result. */
const PRIVATE = [
  /^\((admin|admin-auth|seller|sell)\)\//,
  /^(account|checkout|dev|orders|wallet|purchases|notifications|cart|kyc|auth|support|listings|listing-preview|reviews|shop|login|signup|signup-become-seller|forgot-password|api)\//,
]

const EXEMPT: Record<string, string> = {
  'layout.tsx': 'the root template and defaults; each page fits its own title',
  'not-found.tsx': 'noindex 404 page',
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/^(page|layout|not-found)\.tsx$/.test(name)) out.push(p)
  }
  return out
}

const files = walk(APP)
  .map((p) => relative(APP, p))
  .filter((rel) => !PRIVATE.some((re) => re.test(rel)))
  .filter((rel) => /export (async )?function generateMetadata|export const metadata/.test(readFileSync(join(APP, rel), 'utf8')))

describe('public page metadata goes through seoMeta()', () => {
  it('finds the public pages (the scan is live)', () => {
    expect(files.length).toBeGreaterThan(30)
    expect(files).toContain('(marketplace)/[gameSlug]/values/[itemSlug]/page.tsx')
  })

  it.each(files.filter((f) => !(f in EXEMPT)))('%s wraps its metadata in seoMeta()', (rel) => {
    const src = readFileSync(join(APP, rel), 'utf8')
    expect(src, `${rel}: wrap the metadata in seoMeta() from @/lib/seo/fit`).toMatch(/seoMeta\(/)
  })
})
