/**
 * A URL the sitemap advertises must be one robots.txt lets crawlers fetch.
 *
 * Listing a URL that robots.txt disallows is a contradiction Google reports
 * ("Submitted URL blocked by robots.txt"). robots.ts now blocks ~25 query
 * params, `_rsc`, and several path prefixes, so this pins that none of them can
 * swallow a page the sitemap emits. If it fails, fix the robots rule (or the
 * sitemap), not this test.
 *
 * Runs the REAL robots() output through Google's matching (longest rule wins,
 * Allow wins a tie) against the REAL sitemap builder, on a fixture that covers
 * every page type.
 */
import { describe, it, expect } from 'vitest'

import { buildSitemap } from '@/lib/seo/sitemap-builder'
import { SITEMAP_BASE, sitemapFixture } from '../fixtures/sitemap-input'
import { isBlockedByRobots } from '../helpers/robots-match'

const emitted = buildSitemap(sitemapFixture()).map((e) => e.url)

describe('every URL the sitemap emits is allowed by robots()', () => {
  it('the fixture is rich enough to mean something (every page type present)', () => {
    expect(emitted.length).toBeGreaterThan(40)
    for (const fragment of ['/steal-a-brainrot/buy-items', '/values/', '/blog/', '/sell', '/calculator', '/buy/']) {
      expect(emitted.some((u) => u.includes(fragment)), `no sitemap URL contains ${fragment}`).toBe(true)
    }
  })

  it('none of them is blocked', () => {
    const blocked = emitted.filter((u) => isBlockedByRobots(u))
    expect(blocked, `robots.txt blocks URLs the sitemap advertises:\n  ${blocked.join('\n  ')}`).toEqual([])
  })

  it('the check is live: a URL robots really blocks would be caught', () => {
    expect(isBlockedByRobots(`${SITEMAP_BASE}/valorant/buy-vp?sort=price`)).toBe(true)
    expect(isBlockedByRobots(`${SITEMAP_BASE}/valorant?_rsc=abc12`)).toBe(true)
    expect(isBlockedByRobots(`${SITEMAP_BASE}/api/anything`)).toBe(true)
  })
})

/** One example of each main page type: it must be in the sitemap AND crawlable. */
const PAGE_TYPES: [string, string][] = [
  ['home', SITEMAP_BASE],
  ['game hub', `${SITEMAP_BASE}/valorant`],
  ['category', `${SITEMAP_BASE}/valorant/buy-vp`],
  ['item category', `${SITEMAP_BASE}/steal-a-brainrot/buy-items`],
  ['values hub', `${SITEMAP_BASE}/steal-a-brainrot/values`],
  ['value item', `${SITEMAP_BASE}/steal-a-brainrot/values/cavallo-virtuoso`],
  ['blog post (game)', `${SITEMAP_BASE}/valorant/blog/vp-guide`],
  ['blog post (general)', `${SITEMAP_BASE}/blog/how-we-work`],
  ['sell page', `${SITEMAP_BASE}/valorant/sell`],
]

describe('listing pages (noindex, follow)', () => {
  it('are never in the sitemap but stay crawlable, so engines can read the noindex', () => {
    const listing = `${SITEMAP_BASE}/steal-a-brainrot/buy-items/sab-item`
    expect(emitted).not.toContain(listing)
    expect(isBlockedByRobots(listing)).toBe(false)
  })
})

describe('one example of each main page type', () => {
  it.each(PAGE_TYPES)('%s is in the sitemap and allowed by robots()', (_type, url) => {
    expect(emitted, `${url} is not emitted by the sitemap fixture`).toContain(url)
    expect(isBlockedByRobots(url), `${url} is blocked by robots.txt`).toBe(false)
  })
})
