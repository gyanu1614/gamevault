import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { contentHubSlugsFor, hasHubPage } from '@/lib/content/theme'
import { getFreeGuide } from '@/lib/values/free-guide'
import { socialTitle, DEFAULT_OG_IMAGES } from '@/lib/seo/title'
import CodesPage, { codesCopyCtx } from './_CodesPage'
import { codesFacts, metaDescription, metaTitle } from './_codesCopy'

/**
 * /[game]/codes — every code and whether any works (MM2). Static (ISR): the
 * facts are build-time (the researched seed; the weekly watch job flags when
 * it needs a re-check), the merch items' prices refresh through the tagged
 * values reads; this window is the 24 h safety net.
 */
export const revalidate = 86400
/** Closed set: the games whose theme publishes `codes`. The body 404s the rest too. */
export const dynamicParams = false

export function generateStaticParams() {
  return contentHubSlugsFor('codes').map((gameSlug) => ({ gameSlug }))
}

interface PageProps {
  params: Promise<{ gameSlug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { gameSlug } = await params
  const guide = hasHubPage(gameSlug, 'codes') ? getFreeGuide(gameSlug) : null
  if (!guide) return { title: 'Codes Not Found' }
  const ctx = codesCopyCtx(gameSlug)
  const f = codesFacts(guide)
  const title = metaTitle(ctx, f)
  const description = metaDescription(ctx, f)
  const path = `/${gameSlug}/codes`
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { images: DEFAULT_OG_IMAGES, title: socialTitle(title), description, url: path, type: 'article' },
  }
}

export default async function CodesRoute({ params }: PageProps) {
  const { gameSlug } = await params
  // dynamicParams=false is not enforced on Vercel: reject out-of-set slugs here.
  if (!hasHubPage(gameSlug, 'codes') || !getFreeGuide(gameSlug)) notFound()
  return <CodesPage gameSlug={gameSlug} />
}
