/** Reads URLs from a public sitemap (plain GET — no Google API involved). */

import type { FetchLike } from './types'

export interface ParsedSitemap {
  kind: 'urlset' | 'sitemapindex'
  locs: string[]
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return String.fromCodePoint(code)
    }
    return ENTITIES[e.toLowerCase()]
  })
}

export function parseSitemapXml(xml: string): ParsedSitemap {
  const kind = /<sitemapindex[\s>]/i.test(xml) ? 'sitemapindex' : 'urlset'
  const locs: string[] = []
  for (const m of xml.matchAll(/<loc>\s*([\s\S]*?)\s*<\/loc>/gi)) {
    const cdata = m[1].match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/)
    const loc = (cdata ? cdata[1] : decodeEntities(m[1])).trim()
    if (loc) locs.push(loc)
  }
  return { kind, locs }
}

const MAX_DEPTH = 3

export async function collectSitemapUrls(
  sitemapUrl: string,
  fetch: FetchLike,
  depth = 0,
): Promise<string[]> {
  if (depth > MAX_DEPTH) throw new Error(`Sitemap index nesting is deeper than ${MAX_DEPTH} at ${sitemapUrl}`)

  const res = await fetch(sitemapUrl)
  if (!res.ok) throw new Error(`Could not fetch sitemap ${sitemapUrl}: HTTP ${res.status}`)
  const parsed = parseSitemapXml(await res.text())

  const urls: string[] = []
  if (parsed.kind === 'sitemapindex') {
    for (const child of parsed.locs) urls.push(...(await collectSitemapUrls(child, fetch, depth + 1)))
  } else {
    urls.push(...parsed.locs)
  }

  const unique = [...new Set(urls)]
  if (depth === 0 && unique.length === 0) {
    throw new Error(`Sitemap ${sitemapUrl} contained no URLs — refusing to continue with an empty list`)
  }
  return unique
}

/** One URL (or site-relative path) per line; blanks and `#` comments ignored. */
export function parseExtraUrls(text: string, origin = 'https://dropmarket.gg'): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => (l.startsWith('/') ? `${origin}${l}` : l))
}
