/**
 * /sitemap.xml: the single entry point (no sitemap index; ~1,000 URLs is far
 * below the 50,000 limit).
 *
 * Reads through sitemap-data.ts (paginated: PostgREST truncates at 1,000 rows)
 * and decides in sitemap-builder.ts (pure, unit-tested). The rule for which URLs
 * appear and what their lastmod is lives there; the rule for whether a page is
 * indexable lives in lib/games/indexability.ts and is shared with the pages'
 * own robots meta so the two cannot drift.
 *
 * lastmod policy: the real change date of the row or copy behind each page. Never
 * `new Date()`: an always-changing field trains Google to ignore it.
 */

import { MetadataRoute } from 'next'

import { SITE_URL } from '@/config/site'
import { createClient } from '@/lib/supabase/server'
import { buildSitemap } from '@/lib/seo/sitemap-builder'
import { loadSitemapInput } from '@/lib/seo/sitemap-data'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient()
  return buildSitemap(await loadSitemapInput(supabase, SITE_URL))
}
