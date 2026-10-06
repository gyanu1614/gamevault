import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { contentHubSlugsFor, hasHubPage } from '@/lib/content/theme'
import { boxSlugs, getBox } from '@/lib/values/boxes'
import { socialTitle } from '@/lib/seo/title'
import BoxPage from '../_BoxPage'
import { boxMetaDescription, boxMetaTitle } from '../_boxesCopy'
import { boxesCopyCtx, loadBoxes, shopOddsFor } from '../_boxesData'

/**
 * /[game]/boxes/[boxSlug] — one box. Closed set: every box in the seed of
 * every game that publishes `boxes` is prerendered (MM2: 44), and anything
 * else is a real 404 (the body checks too — Vercel does not enforce
 * dynamicParams=false at runtime). ISR with event-driven refresh through the
 * tagged reads; the window is the 24 h safety net.
 */
export const revalidate = 86400
export const dynamicParams = false

export function generateStaticParams() {
  return contentHubSlugsFor('boxes').flatMap((gameSlug) => boxSlugs(gameSlug).map((boxSlug) => ({ gameSlug, boxSlug })))
}

interface PageProps {
  params: Promise<{ gameSlug: string; boxSlug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { gameSlug, boxSlug } = await params
  const box = hasHubPage(gameSlug, 'boxes') && shopOddsFor(gameSlug) ? getBox(gameSlug, boxSlug) : null
  if (!box) return { title: 'Box Not Found' }
  const ctx = boxesCopyCtx(gameSlug)
  const { views, eventNames } = await loadBoxes(gameSlug)
  const v = views.find((x) => x.box.slug === boxSlug)!
  const title = boxMetaTitle(ctx, box)
  const description = boxMetaDescription(ctx, v, box.eventSlug ? eventNames.get(box.eventSlug) ?? null : null)
  const path = `/${gameSlug}/boxes/${boxSlug}`
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title: socialTitle(title), description, url: path, type: 'article' },
  }
}

export default async function BoxRoute({ params }: PageProps) {
  const { gameSlug, boxSlug } = await params
  // Gate BEFORE anything streams or reads: an unknown box is a real 404.
  if (!hasHubPage(gameSlug, 'boxes') || !shopOddsFor(gameSlug)) notFound()
  const box = getBox(gameSlug, boxSlug)
  if (!box) notFound()
  return <BoxPage gameSlug={gameSlug} box={box} />
}
