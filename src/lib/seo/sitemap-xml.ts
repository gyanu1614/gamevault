import type { MetadataRoute } from 'next'

/** <urlset> XML for sitemap entries (what Next's sitemap.ts convention would emit). */
const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

const isoDate = (d: string | Date) => (typeof d === 'string' ? (Number.isNaN(Date.parse(d)) ? d : new Date(d).toISOString()) : d.toISOString())

export function renderUrlset(entries: MetadataRoute.Sitemap): string {
  const urls = entries.map((e) =>
    [
      '<url>',
      `<loc>${escapeXml(e.url)}</loc>`,
      e.lastModified ? `<lastmod>${isoDate(e.lastModified)}</lastmod>` : '',
      e.changeFrequency ? `<changefreq>${e.changeFrequency}</changefreq>` : '',
      e.priority != null ? `<priority>${e.priority}</priority>` : '',
      '</url>',
    ].join(''),
  )
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
}
