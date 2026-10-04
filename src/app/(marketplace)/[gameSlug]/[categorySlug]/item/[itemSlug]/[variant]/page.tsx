import type { Metadata } from 'next'
import { ItemRoutePage, itemRouteMetadata } from '../../_itemRoute'

// ISR (static-first rule); see ../page.tsx. Canonical = the item page.
export const revalidate = 86400
export const dynamicParams = true

export async function generateStaticParams() {
  return []
}

interface PageProps {
  params: Promise<{ gameSlug: string; categorySlug: string; itemSlug: string; variant: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return itemRouteMetadata(await params)
}

export default async function ItemVariantListingsPage({ params }: PageProps) {
  return <ItemRoutePage params={await params} />
}
