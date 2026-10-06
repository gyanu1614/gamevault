import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { contentHubSlugsFor, hasHubPage } from '@/lib/content/theme'
import { getValueEvents } from '@/lib/values/events'
import { featuredEvent } from '@/lib/values/events-model'
import { socialTitle, DEFAULT_OG_IMAGES } from '@/lib/seo/title'
import EventsHubPage, { eventsCopyCtx } from './_EventsHubPage'
import { hubMetaDescription, hubTitle } from './_eventsCopy'

/**
 * /[game]/events — the events archive hub (values_events). Static (ISR):
 * the refresh is event-driven through the tagged reads (`values:<game>`,
 * `price:<game>`) the values-revalidate route revalidates; this window is
 * the 24 h safety net.
 */
export const revalidate = 86400
/** Closed set: the games whose theme publishes `events`. The body 404s the rest too. */
export const dynamicParams = false

export function generateStaticParams() {
  return contentHubSlugsFor('events').map((gameSlug) => ({ gameSlug }))
}

interface PageProps {
  params: Promise<{ gameSlug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { gameSlug } = await params
  if (!hasHubPage(gameSlug, 'events')) return { title: 'Events Not Found' }
  const ctx = eventsCopyCtx(gameSlug)
  const events = await getValueEvents(gameSlug)
  const title = hubTitle(ctx)
  const description = hubMetaDescription(ctx, events, featuredEvent(events))
  const path = `/${gameSlug}/events`
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { images: DEFAULT_OG_IMAGES, title: socialTitle(title), description, url: path, type: 'website' },
  }
}

export default async function EventsPage({ params }: PageProps) {
  const { gameSlug } = await params
  // dynamicParams=false is not enforced on Vercel: reject out-of-set slugs here.
  if (!hasHubPage(gameSlug, 'events')) notFound()
  return <EventsHubPage gameSlug={gameSlug} />
}
