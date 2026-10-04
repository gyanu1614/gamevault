import type { Metadata } from 'next'
import { ItemRoutePage, itemRouteMetadata } from '../_itemRoute'

// ISR (static-first rule): rendered on first visit, cached, refreshed by the
// listing mutation tags (value-listings/stock-server) with this as the backstop.
// Literals here: Next can't read them through a re-export.
export const revalidate = 86400
export const dynamicParams = true

/** Not prerendered: the set is open and out of the sitemap for now. */
export async function generateStaticParams() {
  return []
}

interface PageProps {
  params: Promise<{ gameSlug: string; categorySlug: string; itemSlug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return itemRouteMetadata(await params)
}

export default async function ItemListingsPage({ params }: PageProps) {
  return <ItemRoutePage params={await params} />
}
