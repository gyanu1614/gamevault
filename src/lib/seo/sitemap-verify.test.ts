import { describe, it, expect } from 'vitest'

import { parseSitemapLocs, problemsFor, readPageFacts } from '@/lib/seo/sitemap-verify'

const headers = (h: Record<string, string> = {}) => ({ get: (n: string) => h[n.toLowerCase()] ?? null })
const page = (head: string) => `<!DOCTYPE html><html><head>${head}</head><body></body></html>`
const URL_ = 'https://dropmarket.gg/valorant/buy-vp'
const canonical = (href: string) => `<link rel="canonical" href="${href}"/>`

describe('parseSitemapLocs', () => {
  it('reads every <loc> and decodes entities', () => {
    const xml = `<?xml version="1.0"?><urlset><url><loc>https://dropmarket.gg</loc></url>
      <url><loc>https://dropmarket.gg/a?x=1&amp;y=2</loc><lastmod>2026-09-01</lastmod></url></urlset>`
    expect(parseSitemapLocs(xml)).toEqual(['https://dropmarket.gg', 'https://dropmarket.gg/a?x=1&y=2'])
  })
})

describe('readPageFacts', () => {
  it('finds the canonical whatever the attribute order', () => {
    expect(readPageFacts(200, page(`<link href="${URL_}" rel="canonical"/>`), headers()).canonical).toBe(URL_)
    expect(readPageFacts(200, page(canonical(URL_)), headers()).canonical).toBe(URL_)
  })
  it('detects noindex in the robots meta (and the googlebot meta)', () => {
    expect(readPageFacts(200, page('<meta name="robots" content="noindex, follow"/>'), headers()).noindex).toBe(true)
    expect(readPageFacts(200, page('<meta name="googlebot" content="noindex"/>'), headers()).noindex).toBe(true)
    expect(readPageFacts(200, page('<meta content="noindex" name="robots"/>'), headers()).noindex).toBe(true)
  })
  it('detects noindex in the X-Robots-Tag header', () => {
    expect(readPageFacts(200, page(''), headers({ 'x-robots-tag': 'noindex' })).noindex).toBe(true)
  })
  it('index,follow is not noindex', () => {
    expect(readPageFacts(200, page('<meta name="robots" content="index, follow"/>'), headers()).noindex).toBe(false)
  })
})

describe('problemsFor: a sitemap URL must return 200, be indexable and be self-canonical', () => {
  const ok = { status: 200, noindex: false, canonical: URL_ }
  it('a good page has no problems', () => expect(problemsFor(URL_, ok)).toEqual([]))
  it('flags a 404 (the /gta-vi/buy-items case)', () => expect(problemsFor(URL_, { ...ok, status: 404 })).toEqual(['returns 404, not 200']))
  it('flags a redirect', () => expect(problemsFor(URL_, { ...ok, status: 307 })).toEqual(['returns 307, not 200']))
  it('flags noindex (the /grow-a-garden/buy-items case)', () => expect(problemsFor(URL_, { ...ok, noindex: true })).toEqual(['is noindex']))
  it('flags a missing canonical', () => expect(problemsFor(URL_, { ...ok, canonical: null })).toEqual(['has no canonical link']))
  it('flags a canonical that is not exactly the listed URL, trailing slash included', () => {
    expect(problemsFor(URL_, { ...ok, canonical: `${URL_}/` })).toEqual([`canonical is ${URL_}/, not the listed URL`])
    expect(problemsFor('https://dropmarket.gg', { ...ok, canonical: 'https://dropmarket.gg/' })).toHaveLength(1)
  })
  it('reports every problem at once', () => {
    expect(problemsFor(URL_, { status: 200, noindex: true, canonical: 'https://elsewhere.example/x' })).toHaveLength(2)
  })
})
