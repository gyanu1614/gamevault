/**
 * /sitemap.xml: the sitemap INDEX, one child per section
 * (/sitemaps/<section>.xml, see app/sitemaps/[file]/route.ts). robots.txt
 * and Search Console point here. Each child's lastmod is the newest lastmod of
 * its entries (a real change date, never "now"). Static, revalidated hourly.
 */
import { loadSitemapSections, sectionSitemapUrl, sitemapSectionIds } from '@/lib/seo/sitemap-sections'

export const revalidate = 3600

const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export async function GET() {
  const sections = await loadSitemapSections()
  const children = sitemapSectionIds().map((id) => {
    const dates = (sections.get(id) ?? [])
      .map((e) => (e.lastModified ? new Date(e.lastModified).toISOString() : null))
      .filter((d): d is string => !!d)
      .sort()
    const lastmod = dates.at(-1)
    return `  <sitemap>\n    <loc>${escapeXml(sectionSitemapUrl(id))}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}\n  </sitemap>`
  })
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${children.join('\n')}\n</sitemapindex>\n`
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } })
}
