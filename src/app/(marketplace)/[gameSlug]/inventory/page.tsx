import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { contentHubSlugsFor, hasHubPage } from '@/lib/content/theme'
import { socialTitle, DEFAULT_OG_IMAGES } from '@/lib/seo/title'
import InventoryPage, { inventoryCopyCtx, loadInventory } from './_InventoryPage'
import { metaDescription, metaTitle } from './_inventoryCopy'
import { seoMeta } from '@/lib/seo/fit'

/**
 * /[game]/inventory — the Inventory Worth tool (MM2). Static (ISR): the page
 * ships the priced catalogue once and the tool runs in the browser (the
 * player's list lives in `location.hash`, never on the server). The prices
 * refresh through the tagged values reads (`values:<game>`, `price:<game>`)
 * the values-revalidate route revalidates after every pricing run; this
 * window is the 24 h safety net.
 */
export const revalidate = 86400
/** Closed set: the games whose theme publishes `inventory`. The body 404s the rest too. */
export const dynamicParams = false

export function generateStaticParams() {
  return contentHubSlugsFor('inventory').map((gameSlug) => ({ gameSlug }))
}

interface PageProps {
  params: Promise<{ gameSlug: string }>
}

async function generateMetadataRaw({ params }: PageProps): Promise<Metadata> {
  const { gameSlug } = await params
  if (!hasHubPage(gameSlug, 'inventory')) return { title: 'Calculator Not Found' }
  const ctx = inventoryCopyCtx(gameSlug)
  const { stats } = await loadInventory(gameSlug)
  const title = metaTitle(ctx)
  const description = metaDescription(ctx, stats)
  const path = `/${gameSlug}/inventory`
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { images: DEFAULT_OG_IMAGES, title: socialTitle(title), description, url: path, type: 'website' },
  }
}

export default async function InventoryRoute({ params }: PageProps) {
  const { gameSlug } = await params
  // dynamicParams=false is not enforced on Vercel: reject out-of-set slugs here.
  if (!hasHubPage(gameSlug, 'inventory')) notFound()
  return <InventoryPage gameSlug={gameSlug} />
}

/** Search-length rules (title ≤ 60, description ≤ 155) — see src/lib/seo/fit.ts. */
export async function generateMetadata(
  ...args: Parameters<typeof generateMetadataRaw>
): Promise<Metadata> {
  return seoMeta(await generateMetadataRaw(...args))
}
