import { describe, it, expect } from 'vitest'
import { renderUrlset } from './sitemap-xml'

describe('renderUrlset', () => {
  it('writes loc, an ISO lastmod, changefreq and priority, escaping the URL', () => {
    const xml = renderUrlset([
      { url: 'https://dropmarket.gg/a?x=1&y=2', lastModified: '2026-10-08T09:25:40.988Z', changeFrequency: 'daily', priority: 0.7 },
      { url: 'https://dropmarket.gg/b' },
    ])
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(xml).toContain('<url><loc>https://dropmarket.gg/a?x=1&amp;y=2</loc><lastmod>2026-10-08T09:25:40.988Z</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>')
    expect(xml).toContain('<url><loc>https://dropmarket.gg/b</loc></url>')
  })
  it('turns a date-only lastmod into a full ISO date', () => {
    expect(renderUrlset([{ url: 'https://dropmarket.gg/terms', lastModified: '2026-10-09' }])).toContain('<lastmod>2026-10-09T00:00:00.000Z</lastmod>')
  })
})
