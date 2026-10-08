import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { contentHubSlugsFor, hasHubPage } from '@/lib/content/theme'
import { socialTitle, DEFAULT_OG_IMAGES } from '@/lib/seo/title'
import BoxesHubPage from './_BoxesHubPage'
import { hubMetaDescription, hubMetaTitle } from './_boxesCopy'
import { boxesCopyCtx, loadBoxes, shopOddsFor } from './_boxesData'
import { seoMeta } from '@/lib/seo/fit'

/**
 * /[game]/boxes — MM2 Box Odds. Static (ISR): the box seed is build time and
 * the live prices refresh event-driven through the tagged values reads
 * (`values:<game>`, `price:<game>`) the values-revalidate route revalidates
 * after every pricing run; this window is the 24 h safety net.
 */
export const revalidate = 86400
/** Closed set: the games whose theme publishes `boxes`. The body 404s the rest too. */
export const dynamicParams = false

export function generateStaticParams() {
  return contentHubSlugsFor('boxes').map((gameSlug) => ({ gameSlug }))
}

interface PageProps {
  params: Promise<{ gameSlug: string }>
}

async function generateMetadataRaw({ params }: PageProps): Promise<Metadata> {
  const { gameSlug } = await params
  const o = hasHubPage(gameSlug, 'boxes') ? shopOddsFor(gameSlug) : null
  if (!o) return { title: 'Box Odds Not Found' }
  const ctx = boxesCopyCtx(gameSlug)
  const { views } = await loadBoxes(gameSlug)
  const shop = views.filter((v) => v.box.inShop).length
  const title = hubMetaTitle(ctx)
  const description = hubMetaDescription(ctx, o, shop, views.length - shop)
  const path = `/${gameSlug}/boxes`
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { images: DEFAULT_OG_IMAGES, title: socialTitle(title), description, url: path, type: 'website' },
  }
}

export default async function BoxesRoute({ params }: PageProps) {
  const { gameSlug } = await params
  // dynamicParams=false is not enforced on Vercel: reject out-of-set slugs here.
  if (!hasHubPage(gameSlug, 'boxes') || !shopOddsFor(gameSlug)) notFound()
  return <BoxesHubPage gameSlug={gameSlug} />
}

/** Search-length rules (title ≤ 60, description ≤ 155) — see src/lib/seo/fit.ts. */
export async function generateMetadata(
  ...args: Parameters<typeof generateMetadataRaw>
): Promise<Metadata> {
  return seoMeta(await generateMetadataRaw(...args))
}
