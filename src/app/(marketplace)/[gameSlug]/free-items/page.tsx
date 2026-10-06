import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { contentHubSlugsFor, hasHubPage } from '@/lib/content/theme'
import { socialTitle } from '@/lib/seo/title'
import FreeItemsPage, { freeCopyCtx, freePageNumbers } from './_FreeItemsPage'
import { metaDescription, metaTitle } from './_freeItemsCopy'

/**
 * /[game]/free-items — the honest free-items guide (MM2). Static (ISR): the
 * facts are build-time (the researched seed), and the live prices refresh
 * through the tagged values reads the values-revalidate route revalidates;
 * this window is the 24 h safety net.
 */
export const revalidate = 86400
/** Closed set: the games whose theme publishes `freeItems`. The body 404s the rest too. */
export const dynamicParams = false

export function generateStaticParams() {
  return contentHubSlugsFor('freeItems').map((gameSlug) => ({ gameSlug }))
}

interface PageProps {
  params: Promise<{ gameSlug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { gameSlug } = await params
  const data = hasHubPage(gameSlug, 'freeItems') ? freePageNumbers(gameSlug) : null
  if (!data) return { title: 'Guide Not Found' }
  const ctx = freeCopyCtx(gameSlug)
  const title = metaTitle(ctx)
  const description = metaDescription(ctx, data.n, data.realWays)
  const path = `/${gameSlug}/free-items`
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title: socialTitle(title), description, url: path, type: 'article' },
  }
}

export default async function FreeItemsRoute({ params }: PageProps) {
  const { gameSlug } = await params
  // dynamicParams=false is not enforced on Vercel: reject out-of-set slugs here.
  if (!hasHubPage(gameSlug, 'freeItems') || !freePageNumbers(gameSlug)) notFound()
  return <FreeItemsPage gameSlug={gameSlug} />
}
