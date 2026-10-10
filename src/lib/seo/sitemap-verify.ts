/**
 * Checks for the sitemap promise: every listed URL returns 200, is indexable
 * and is self-canonical. Pure (no network): scripts/verify-sitemap.ts fetches a
 * running build and feeds each response through these.
 */
export interface PageFacts {
  status: number
  noindex: boolean
  canonical: string | null
}

const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")

/** Every <loc> in a sitemap, entities decoded. */
export function parseSitemapLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((m) => decode(m[1]))
}

const attr = (tag: string, name: string) => tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, 'i'))?.[1] ?? null

export function readPageFacts(
  status: number,
  html: string,
  headers: { get(name: string): string | null },
): PageFacts {
  const metas = html.match(/<meta\b[^>]*>/gi) ?? []
  const robotsMetaNoindex = metas.some((m) => {
    const name = attr(m, 'name')?.toLowerCase()
    return (name === 'robots' || name === 'googlebot') && /noindex/i.test(attr(m, 'content') ?? '')
  })
  const links = html.match(/<link\b[^>]*>/gi) ?? []
  const canonicalTag = links.find((l) => attr(l, 'rel')?.toLowerCase() === 'canonical')
  return {
    status,
    noindex: robotsMetaNoindex || /noindex/i.test(headers.get('x-robots-tag') ?? ''),
    canonical: canonicalTag ? decode(attr(canonicalTag, 'href') ?? '') || null : null,
  }
}

/** What is wrong with a sitemap entry, in words. Empty = fine. */
export function problemsFor(listedUrl: string, facts: PageFacts): string[] {
  const out: string[] = []
  if (facts.status !== 200) out.push(`returns ${facts.status}, not 200`)
  if (facts.noindex) out.push('is noindex')
  if (facts.status === 200) {
    if (!facts.canonical) out.push('has no canonical link')
    else if (facts.canonical !== listedUrl) out.push(`canonical is ${facts.canonical}, not the listed URL`)
  }
  return out
}

export interface SitemapFailure {
  url: string
  problems: string[]
}

/**
 * Fetch `${base}/sitemap.xml` and check every URL in it against the same path on
 * `base` (the sitemap lists production URLs; a local build serves the same
 * paths). `redirect: 'manual'` so a 3xx is reported rather than followed.
 */
export async function verifySitemapAt(
  base: string,
  opts: { concurrency?: number } = {},
): Promise<{ checked: number; failures: SitemapFailure[] }> {
  const root = base.replace(/\/$/, '')
  const res = await fetch(`${root}/sitemap.xml`)
  if (!res.ok) throw new Error(`${root}/sitemap.xml returned ${res.status}`)
  const xml = await res.text()
  // /sitemap.xml is an index of per-section sitemaps: read each child from `base`.
  const locs: string[] = []
  if (/<sitemapindex[\s>]/i.test(xml)) {
    for (const child of parseSitemapLocs(xml)) {
      const r = await fetch(`${root}${new URL(child).pathname}`)
      if (!r.ok) throw new Error(`${child} returned ${r.status}`)
      locs.push(...parseSitemapLocs(await r.text()))
    }
  } else {
    locs.push(...parseSitemapLocs(xml))
  }

  const failures: SitemapFailure[] = []
  let next = 0
  await Promise.all(
    Array.from({ length: opts.concurrency ?? 8 }, async () => {
      while (next < locs.length) {
        const url = locs[next++]
        try {
          const r = await fetch(`${root}${new URL(url).pathname}`, { redirect: 'manual', headers: { 'user-agent': 'sitemap-verify' } })
          const html = r.status === 200 ? await r.text() : ''
          const problems = problemsFor(url, readPageFacts(r.status, html, r.headers))
          if (problems.length) failures.push({ url, problems })
        } catch (e) {
          failures.push({ url, problems: [`request failed: ${(e as Error).message}`] })
        }
      }
    }),
  )
  return { checked: locs.length, failures: failures.sort((a, b) => a.url.localeCompare(b.url)) }
}
