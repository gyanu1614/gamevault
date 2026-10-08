import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { contentHubSlugsFor, hasHubPage } from '@/lib/content/theme'
import { getValueEvent, getValueEventHead, getValueEventSlugs } from '@/lib/values/events'
import { eventSetValue, isEventIndexable, previousSameSeason } from '@/lib/values/events-model'
import { socialTitle, DEFAULT_OG_IMAGES } from '@/lib/seo/title'
import EventPage from '../_EventPage'
import { eventsCopyCtx } from '../_EventsHubPage'
import { eventMetaDescription, eventMetaTitle } from '../_eventsCopy'
import { seoMeta } from '@/lib/seo/fit'

/**
 * /[game]/events/[eventSlug] — one event page. Closed set: every published
 * event of every game that publishes `events` is prerendered, and anything
 * else is a real 404 (the body checks too — Vercel does not enforce
 * dynamicParams=false at runtime). ISR with event-driven refresh through the
 * tagged reads; the window is the 24 h safety net.
 */
export const revalidate = 86400
export const dynamicParams = false

export async function generateStaticParams() {
  const out: { gameSlug: string; eventSlug: string }[] = []
  for (const gameSlug of contentHubSlugsFor('events')) {
    for (const eventSlug of await getValueEventSlugs(gameSlug)) out.push({ gameSlug, eventSlug })
  }
  return out
}

interface PageProps {
  params: Promise<{ gameSlug: string; eventSlug: string }>
}

async function generateMetadataRaw({ params }: PageProps): Promise<Metadata> {
  const { gameSlug, eventSlug } = await params
  if (!hasHubPage(gameSlug, 'events')) return { title: 'Event Not Found' }
  const data = await getValueEvent(gameSlug, eventSlug)
  if (!data) return { title: 'Event Not Found' }
  const { event, all } = data
  const ctx = eventsCopyCtx(gameSlug)
  const title = eventMetaTitle(ctx, event)
  const description = eventMetaDescription(ctx, event, previousSameSeason(all, event)[0] ?? null)
  const path = `/${gameSlug}/events/${eventSlug}`
  const indexable = isEventIndexable({ status: event.status, itemCount: eventSetValue(event.items).itemCount })
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { images: DEFAULT_OG_IMAGES, title: socialTitle(title), description, url: path, type: 'article' },
    ...(indexable ? {} : { robots: { index: false, follow: true } }),
  }
}

export default async function EventRoute({ params }: PageProps) {
  const { gameSlug, eventSlug } = await params
  if (!hasHubPage(gameSlug, 'events')) notFound()
  // Gate BEFORE anything streams: an unknown event is a real 404.
  const head = await getValueEventHead(gameSlug, eventSlug)
  if (!head) notFound()
  return <EventPage gameSlug={gameSlug} head={head} />
}

/** Search-length rules (title ≤ 60, description ≤ 155) — see src/lib/seo/fit.ts. */
export async function generateMetadata(
  ...args: Parameters<typeof generateMetadataRaw>
): Promise<Metadata> {
  return seoMeta(await generateMetadataRaw(...args))
}
