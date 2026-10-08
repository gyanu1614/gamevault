import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { contentHubSlugsFor, hasHubPage } from '@/lib/content/theme'
import { chromaStats } from '@/lib/values/chromas'
import { socialTitle, DEFAULT_OG_IMAGES } from '@/lib/seo/title'
import ChromasPage, { chromaCopyCtx, chromaUnboxMaths, loadChromas } from './_ChromasPage'
import { metaDescription, metaTitle } from './_chromasCopy'
import { seoMeta } from '@/lib/seo/fit'

/**
 * /[game]/chromas — the Chroma hub (MM2). Static (ISR): the refresh is
 * event-driven through the tagged values reads (`values:<game>`,
 * `price:<game>`) the values-revalidate route revalidates after every pricing
 * run; this window is the 24 h safety net.
 */
export const revalidate = 86400
/** Closed set: the games whose theme publishes `chromas`. The body 404s the rest too. */
export const dynamicParams = false

export function generateStaticParams() {
  return contentHubSlugsFor('chromas').map((gameSlug) => ({ gameSlug }))
}

interface PageProps {
  params: Promise<{ gameSlug: string }>
}

async function generateMetadataRaw({ params }: PageProps): Promise<Metadata> {
  const { gameSlug } = await params
  const u = hasHubPage(gameSlug, 'chromas') ? chromaUnboxMaths(gameSlug) : null
  if (!u) return { title: 'Chromas Not Found' }
  const ctx = chromaCopyCtx(gameSlug)
  const { entries } = await loadChromas(gameSlug)
  const title = metaTitle(ctx)
  const description = metaDescription(ctx, chromaStats(entries), u)
  const path = `/${gameSlug}/chromas`
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { images: DEFAULT_OG_IMAGES, title: socialTitle(title), description, url: path, type: 'website' },
  }
}

export default async function ChromasRoute({ params }: PageProps) {
  const { gameSlug } = await params
  // dynamicParams=false is not enforced on Vercel: reject out-of-set slugs here.
  if (!hasHubPage(gameSlug, 'chromas') || !chromaUnboxMaths(gameSlug)) notFound()
  return <ChromasPage gameSlug={gameSlug} />
}

/** Search-length rules (title ≤ 60, description ≤ 155) — see src/lib/seo/fit.ts. */
export async function generateMetadata(
  ...args: Parameters<typeof generateMetadataRaw>
): Promise<Metadata> {
  return seoMeta(await generateMetadataRaw(...args))
}
