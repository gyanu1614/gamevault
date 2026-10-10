import { SITE_URL } from '@/config/site'
import { createAnonClient } from '@/lib/supabase/anon'
import { buildSitemapSections, sitemapSectionIds, type SitemapSection } from '@/lib/seo/sitemap-builder'
import { loadSitemapInput } from '@/lib/seo/sitemap-data'

import type { MetadataRoute } from 'next'

/**
 * The sitemap sections, read ONCE per minute per server instance: the index
 * and each section file are separate routes, and every one of them needs the
 * whole input (a URL's section is decided after the shared rules run). Reads go
 * through the anon client — the sitemap is static (ISR), never a cookie client.
 */
const TTL_MS = 60_000
let memo: { at: number; promise: Promise<Map<SitemapSection, MetadataRoute.Sitemap>> } | null = null

export function loadSitemapSections(): Promise<Map<SitemapSection, MetadataRoute.Sitemap>> {
  if (memo && Date.now() - memo.at < TTL_MS) return memo.promise
  const promise = loadSitemapInput(createAnonClient(), SITE_URL).then(buildSitemapSections)
  memo = { at: Date.now(), promise }
  // A failed read must not be served from the memo.
  promise.catch(() => {
    if (memo?.promise === promise) memo = null
  })
  return promise
}

/** Where a section's file is served (app/sitemaps/[file]/route.ts). */
export function sectionSitemapUrl(section: SitemapSection, siteUrl: string = SITE_URL): string {
  return `${siteUrl}/sitemaps/${section}.xml`
}

export { sitemapSectionIds }
