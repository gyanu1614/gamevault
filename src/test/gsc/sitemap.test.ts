import { describe, expect, it, vi } from 'vitest'

import {
  collectSitemapUrls,
  parseExtraUrls,
  parseSitemapXml,
} from '../../../scripts/lib/gsc/sitemap'
import { blockNetwork } from './no-network'

blockNetwork()

const urlset = (...locs: string[]) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${locs
    .map((l) => `<url><loc>${l}</loc><changefreq>daily</changefreq></url>`)
    .join('')}</urlset>`

describe('parseSitemapXml', () => {
  it('reads every <loc> of a urlset', () => {
    const r = parseSitemapXml(urlset('https://dropmarket.gg/', 'https://dropmarket.gg/browse'))
    expect(r).toEqual({ kind: 'urlset', locs: ['https://dropmarket.gg/', 'https://dropmarket.gg/browse'] })
  })

  it('decodes XML entities and trims whitespace', () => {
    const r = parseSitemapXml(urlset('  https://dropmarket.gg/a?x=1&amp;y=2  '))
    expect(r.locs).toEqual(['https://dropmarket.gg/a?x=1&y=2'])
  })

  it('reads CDATA locs', () => {
    expect(parseSitemapXml(urlset('<![CDATA[https://dropmarket.gg/c?a=1&b=2]]>')).locs).toEqual([
      'https://dropmarket.gg/c?a=1&b=2',
    ])
  })

  it('recognises a sitemap index', () => {
    const xml = '<sitemapindex><sitemap><loc>https://dropmarket.gg/s1.xml</loc></sitemap></sitemapindex>'
    expect(parseSitemapXml(xml)).toEqual({ kind: 'sitemapindex', locs: ['https://dropmarket.gg/s1.xml'] })
  })

  it('returns no locs for non-sitemap input', () => {
    expect(parseSitemapXml('<html>oops</html>').locs).toEqual([])
  })
})

describe('collectSitemapUrls', () => {
  const xmlResponse = (body: string, status = 200) => new Response(body, { status })

  it('fetches the sitemap and returns de-duplicated URLs in order', async () => {
    const fetch = vi.fn(async () =>
      xmlResponse(urlset('https://dropmarket.gg/', 'https://dropmarket.gg/a', 'https://dropmarket.gg/')),
    )
    await expect(collectSitemapUrls('https://dropmarket.gg/sitemap.xml', fetch)).resolves.toEqual([
      'https://dropmarket.gg/',
      'https://dropmarket.gg/a',
    ])
  })

  it('follows a sitemap index into its child sitemaps', async () => {
    const bodies: Record<string, string> = {
      'https://dropmarket.gg/index.xml':
        '<sitemapindex><sitemap><loc>https://dropmarket.gg/s1.xml</loc></sitemap><sitemap><loc>https://dropmarket.gg/s2.xml</loc></sitemap></sitemapindex>',
      'https://dropmarket.gg/s1.xml': urlset('https://dropmarket.gg/one'),
      'https://dropmarket.gg/s2.xml': urlset('https://dropmarket.gg/two', 'https://dropmarket.gg/one'),
    }
    const fetch = vi.fn(async (url: string) => xmlResponse(bodies[url]))
    await expect(collectSitemapUrls('https://dropmarket.gg/index.xml', fetch)).resolves.toEqual([
      'https://dropmarket.gg/one',
      'https://dropmarket.gg/two',
    ])
  })

  it('fails clearly on an HTTP error', async () => {
    const fetch = vi.fn(async () => xmlResponse('', 500))
    await expect(collectSitemapUrls('https://dropmarket.gg/sitemap.xml', fetch)).rejects.toThrow(
      /sitemap.*HTTP 500/i,
    )
  })

  it('fails when the document holds no URLs (a silent empty run would look like success)', async () => {
    const fetch = vi.fn(async () => xmlResponse('<html>blocked</html>'))
    await expect(collectSitemapUrls('https://dropmarket.gg/sitemap.xml', fetch)).rejects.toThrow(/no URLs/i)
  })

  it('stops following indexes past the depth limit', async () => {
    const fetch = vi.fn(async (url: string) =>
      xmlResponse(`<sitemapindex><sitemap><loc>${url}</loc></sitemap></sitemapindex>`),
    )
    await expect(collectSitemapUrls('https://dropmarket.gg/loop.xml', fetch)).rejects.toThrow()
    expect(fetch.mock.calls.length).toBeLessThanOrEqual(5)
  })
})

describe('parseExtraUrls', () => {
  it('reads one URL per line, skipping blanks and # comments', () => {
    const text = '# extra\nhttps://dropmarket.gg/x\n\n  https://dropmarket.gg/y  \r\n'
    expect(parseExtraUrls(text)).toEqual(['https://dropmarket.gg/x', 'https://dropmarket.gg/y'])
  })

  it('resolves site-relative paths against the origin', () => {
    expect(parseExtraUrls('/adopt-me/values\n', 'https://dropmarket.gg')).toEqual([
      'https://dropmarket.gg/adopt-me/values',
    ])
  })
})
