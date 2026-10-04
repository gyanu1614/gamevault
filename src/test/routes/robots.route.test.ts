/**
 * robots.txt crawl-efficiency rules (Bundle 1, task 1).
 *
 * Google spent ~26% of its requests on `?_rsc=` prefetch payloads and fetched
 * `?search=` and `/login?redirect=` URLs. These tests run the real robots()
 * output through a Google-style matcher, so they pin behaviour (what a crawler
 * may fetch), not the source text.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, statSync } from 'node:fs'
import path from 'node:path'

import robots from '@/app/robots'
import { NON_CANONICAL_PARAMS } from '@/lib/seo/crawl-params'
import { isBlockedByRobots as isBlocked } from '../helpers/robots-match'

describe('robots.txt: prefetch payloads', () => {
  it.each([
    '/valorant/buy-vp?_rsc=1abcd',
    '/?_rsc=xyz12',
    '/adopt-me/values?sort=name&_rsc=9f8e7',
    '/steal-a-brainrot/values/los-tralaleritos?_rsc=k3j2h',
  ])('blocks %s', (url) => {
    expect(isBlocked(url)).toBe(true)
  })
})

describe('robots.txt: non-canonical params', () => {
  it.each(NON_CANONICAL_PARAMS)('blocks ?%s= and &%s= on a normal page', (p) => {
    expect(isBlocked(`/valorant/buy-vp?${p}=x`)).toBe(true)
    expect(isBlocked(`/valorant/buy-vp?z=1&${p}=x`)).toBe(true)
  })

  it('blocks the prefix families (utm_*, attr_*)', () => {
    expect(isBlocked('/?utm_source=newsletter')).toBe(true)
    expect(isBlocked('/valorant/buy-vp?a=1&utm_medium=x')).toBe(true)
    expect(isBlocked('/adopt-me/buy-items?attr_rarity=legendary')).toBe(true)
  })

  it('blocks the login redirect URLs Google was fetching', () => {
    expect(isBlocked('/login?redirect=/sell/new')).toBe(true)
  })

  it('blocks the SAB client param `obtain=` (robots only knew `obtainability=`)', () => {
    expect(isBlocked('/steal-a-brainrot/values?obtain=egg')).toBe(true)
  })

  it('does not over-match: a param must end in "=" right after its name', () => {
    expect(isBlocked('/valorant/buy-vp?pages=2')).toBe(false)
    expect(isBlocked('/valorant/buy-vp?types=a')).toBe(false)
    expect(isBlocked('/valorant/buy-vp?searching=1')).toBe(false)
  })
})

describe('robots.txt: canonical pages and assets stay crawlable', () => {
  it.each([
    '/',
    '/valorant',
    '/valorant/buy-vp',
    '/adopt-me/values',
    '/adopt-me/values/bat-dragon',
    '/steal-a-brainrot/calculator',
    '/adopt-me/sell',
    '/blog',
    '/sitemap.xml',
  ])('allows %s', (url) => {
    expect(isBlocked(url)).toBe(false)
  })

  it.each([
    '/_next/static/chunks/main-app-abc123.js',
    '/_next/static/chunks/pages/_app-9f.js',
    '/_next/static/css/0a1b2c.css',
    '/_next/static/media/inter-var.woff2',
    '/_next/image?url=%2Fassets%2Fx.png&w=640&q=75',
  ])('allows Next.js build output %s', (url) => {
    expect(isBlocked(url)).toBe(false)
  })

  // public/checkout/ holds one image used only by the /checkout page, which is
  // itself disallowed; nothing a crawlable page renders lives there.
  const PUBLIC_DIRS_ONLY_USED_BY_DISALLOWED_PAGES = new Set(['checkout'])

  it('allows every file and folder in public/ (CSS/JS/fonts/images must stay fetchable)', () => {
    const publicDir = path.join(process.cwd(), 'public')
    const blocked: string[] = []
    for (const entry of readdirSync(publicDir)) {
      if (PUBLIC_DIRS_ONLY_USED_BY_DISALLOWED_PAGES.has(entry)) continue
      const isDir = statSync(path.join(publicDir, entry)).isDirectory()
      const sample = isDir ? `/${entry}/sample.avif` : `/${entry}`
      if (isBlocked(sample)) blocked.push(sample)
    }
    expect(blocked).toEqual([])
  })

  it('keeps /_next/ fetchable even though Next image URLs carry `&q=` (a blocked param)', () => {
    expect(isBlocked('/_next/image?url=%2Fx.png&w=640&q=75')).toBe(false)
    // ...while the same param on a page is still blocked.
    expect(isBlocked('/adopt-me/values?q=bat')).toBe(true)
  })

  it('still points crawlers at the sitemap', () => {
    expect(robots().sitemap).toMatch(/\/sitemap\.xml$/)
  })
})
