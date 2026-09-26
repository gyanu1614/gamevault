/**
 * Step 7a — every value item page is built at deploy and refreshed by the
 * pricing job, not by time.
 *
 * The page used to cap prerendering at 100 per game because building ~500
 * pages against the remote DB sometimes tripped Next's 60 s per-page limit.
 * The cap left ~360 pages to render on first visit after EVERY deploy
 * (12/day), which is where a large share of the values-route CPU went. The
 * cap is gone; the timeout is raised instead, and the 1 h revalidate becomes a
 * 24 h safety net behind /api/internal/values-revalidate.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const page = readFileSync('src/app/(marketplace)/[gameSlug]/values/[itemSlug]/page.tsx', 'utf8')
const staticParams =
  page.match(/export async function generateStaticParams[\s\S]*?\n\}/)?.[0] ?? ''
const nextConfig = readFileSync('next.config.js', 'utf8')

describe('value item pages — prerender + revalidation', () => {
  it('prerenders every item (no cap, no limit, no slice in generateStaticParams)', () => {
    expect(staticParams.length).toBeGreaterThan(0)
    expect(staticParams).not.toMatch(/PRERENDER_LIMIT|\.limit\(|\.slice\(/)
    expect(page).not.toMatch(/const PRERENDER_LIMIT/)
  })

  it('keeps a LONG time-based safety net behind on-demand revalidation', () => {
    // The refresh path is the tags, not the clock: `values:<game>` for
    // catalogue edits and `price:<game>:<item>` for prices, which the crawl
    // fires only for the items whose numbers actually moved. The window was
    // 24 h; it is a safety net, and a short one just rebuilds every item page
    // on a timer and undoes the per-item tag (build audit 2026-09-22, §4).
    const m = page.match(/export const revalidate = (\d+)/)
    expect(m, 'the page must declare a revalidate window').not.toBeNull()
    expect(Number(m![1])).toBeGreaterThanOrEqual(86400)
  })

  it('gives the build room for the full set (staticPageGenerationTimeout ≥ 180 s)', () => {
    const m = nextConfig.match(/staticPageGenerationTimeout:\s*(\d+)/)
    expect(m, 'staticPageGenerationTimeout missing from next.config.js').not.toBeNull()
    expect(Number(m![1])).toBeGreaterThanOrEqual(180)
  })
})
