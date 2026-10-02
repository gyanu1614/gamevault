/**
 * Every URL in /sitemap.xml returns 200, is indexable and is self-canonical.
 *
 * Needs a RUNNING production build on the local stack (it skips otherwise):
 *   NEXT_DIST_DIR=.next-check pnpm build && NEXT_DIST_DIR=.next-check pnpm start -p 3102
 *   SITEMAP_VERIFY_BASE_URL=http://127.0.0.1:3102 pnpm exec vitest run sitemap-urls
 * `pnpm sitemap:verify --base=…` runs the same check from the command line.
 */
import { describe, it, expect } from 'vitest'

import { verifySitemapAt } from '@/lib/seo/sitemap-verify'

const BASE = process.env.SITEMAP_VERIFY_BASE_URL

describe.skipIf(!BASE)('every sitemap URL (local build)', () => {
  it('returns 200, is indexable and is self-canonical', async () => {
    const { checked, failures } = await verifySitemapAt(BASE!)
    expect(checked).toBeGreaterThan(0)
    expect(failures.map((f) => `${f.url}: ${f.problems.join('; ')}`)).toEqual([])
  }, 300_000)
})
