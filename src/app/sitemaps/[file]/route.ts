/**
 * The per-section sitemaps: /sitemaps/<section>.xml (static, hubs, buy, sell,
 * blog, values-<game>), listed by the /sitemap.xml index. Split so Search
 * Console reports an index rate per page type.
 *
 * A route handler rather than `generateSitemaps`: on Next 14 that convention
 * serves `/sitemap.xml/<id>` in dev and `/sitemap/<id>.xml` in a build, so an
 * index could not name one URL for both. This file serves one URL everywhere.
 *
 * Which URLs appear and their lastmod: lib/seo/sitemap-builder.ts (pure,
 * unit-tested), sharing its verdicts with the pages' robots meta
 * (lib/games/indexability.ts). Static-first: anon reads only, hourly ISR.
 */
import { loadSitemapSections, sitemapSectionIds } from '@/lib/seo/sitemap-sections'
import { renderUrlset } from '@/lib/seo/sitemap-xml'
import type { SitemapSection } from '@/lib/seo/sitemap-builder'

export const revalidate = 3600
export const dynamicParams = false

export function generateStaticParams() {
  return sitemapSectionIds().map((id) => ({ file: `${id}.xml` }))
}

export async function GET(_req: Request, { params }: { params: { file: string } }) {
  const section = params.file.replace(/\.xml$/, '') as SitemapSection
  // dynamicParams=false is not enforced on Vercel: reject an unknown file here too.
  if (!params.file.endsWith('.xml') || !sitemapSectionIds().includes(section)) {
    return new Response('Not Found', { status: 404 })
  }
  const entries = (await loadSitemapSections()).get(section) ?? []
  return new Response(renderUrlset(entries), { headers: { 'Content-Type': 'application/xml; charset=utf-8' } })
}
