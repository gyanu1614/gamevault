import type { Metadata } from 'next'
import { ItemRoutePage, itemRouteMetadata } from '../../_itemRoute'
import { seoMeta } from '@/lib/seo/fit'

// ISR (static-first rule); see ../page.tsx. Canonical = the item page.
export const revalidate = 86400
export const dynamicParams = true

export async function generateStaticParams() {
  return []
}

interface PageProps {
  params: Promise<{ gameSlug: string; categorySlug: string; itemSlug: string; variant: string }>
}

async function generateMetadataRaw({ params }: PageProps): Promise<Metadata> {
  return itemRouteMetadata(await params)
}

export default async function ItemVariantListingsPage({ params }: PageProps) {
  return <ItemRoutePage params={await params} />
}

/** Search-length rules (title ≤ 60, description ≤ 155) — see src/lib/seo/fit.ts. */
export async function generateMetadata(
  ...args: Parameters<typeof generateMetadataRaw>
): Promise<Metadata> {
  return seoMeta(await generateMetadataRaw(...args))
}
