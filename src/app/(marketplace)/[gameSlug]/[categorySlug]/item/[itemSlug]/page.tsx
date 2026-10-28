import type { Metadata } from 'next'
import { ItemRoutePage, itemRouteMetadata } from '../_itemRoute'
import { seoMeta } from '@/lib/seo/fit'

// ISR (static-first rule): rendered on first visit, cached, refreshed by the
// listing mutation tags (value-listings/stock-server) with this as the backstop.
// Literals here: Next can't read them through a re-export.
export const revalidate = 86400
export const dynamicParams = true

/**
 * Not prerendered: the set is open (pets come and go with their offers). The
 * sitemap lists the pages that have offers; each renders on its first visit
 * into the ISR cache.
 */
export async function generateStaticParams() {
  return []
}

interface PageProps {
  params: Promise<{ gameSlug: string; categorySlug: string; itemSlug: string }>
}

async function generateMetadataRaw({ params }: PageProps): Promise<Metadata> {
  return itemRouteMetadata(await params)
}

export default async function ItemListingsPage({ params }: PageProps) {
  return <ItemRoutePage params={await params} />
}

/** Search-length rules (title ≤ 60, description ≤ 155) — see src/lib/seo/fit.ts. */
export async function generateMetadata(
  ...args: Parameters<typeof generateMetadataRaw>
): Promise<Metadata> {
  return seoMeta(await generateMetadataRaw(...args))
}
