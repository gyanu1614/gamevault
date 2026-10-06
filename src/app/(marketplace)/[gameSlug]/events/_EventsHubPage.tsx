import { Suspense } from 'react'
import Link from '@/components/navigation/AppLink'
import { ArrowRightIcon } from '@phosphor-icons/react/dist/ssr/ArrowRight'
import { JsonLd, breadcrumbList, faqPage, itemList } from '@/lib/seo/jsonld'
import { GameHeroBackdrop } from '@/components/marketplace/GameHeroBackdrop'
import { HubNav } from '@/components/content/HubNav'
import { HubFooter } from '@/components/content/HubFooter'
import { HubHero } from '@/components/content/HubHero'
import { HubFaqSection } from '@/components/content/HubFaqSection'
import { HubCtaBand } from '@/components/content/HubCtaBand'
import { HUB_COPY, getGameContentTheme } from '@/lib/content/theme'
import { getHubNavData } from '@/lib/content/hubNav'
import { getGameCtaImage } from '@/lib/content/game-cta-art.server'
import { HUB_GROUND, VALUE_BTN_PRIMARY, VALUE_LABEL, VALUE_SURFACE } from '@/components/values/styles'
import { ValuesEmptyState } from '@/components/values/ValuesEmptyState'
import { valueListHub } from '@/lib/values/hub-config'
import { rarityMeta, rarityRank } from '@/lib/values/rarity'
import { getValueEvents } from '@/lib/values/events'
import {
  EVENT_SEASONS,
  eventSetValue,
  featuredEvent,
  formatEventRange,
  formatEventUsd,
  hexRgb,
  previousSameSeason,
  sortEventItems,
  type EventView,
} from '@/lib/values/events-model'
import { cn } from '@/lib/utils'
import { hubFaq, hubLead, hubTitle, upcomingDateLine, type CopyCtx } from './_eventsCopy'
import { EventsTimeline, type TimelineRow } from './_EventsTimeline'
import { EventSeasonTile } from './_EventSeasonTile'
import { EventsHubSkeleton, HubLeadSkeleton } from './_EventsSkeleton'

/**
 * /[game]/events — the events archive hub (MM2 first): H1 = the search
 * ("MM2 Events: Every Murder Mystery 2 Event and Its Items"), an answer-first
 * lead, the live / next event, then the year-grouped timeline with season
 * chips, the FAQ and the buy CTA.
 *
 * Static-first: everything is in the prerendered HTML; the season chips read
 * `?season=` after hydration (SearchParamsBridge). Data reads are tagged
 * (`values:<game>` + `price:<game>`), so the values-revalidate route refreshes
 * this page with the rest of the hub. The data streams behind an in-page
 * Suspense whose skeleton mirrors it (not a route loading.tsx: that flushes a
 * 200 before a page can 404).
 */

export function eventsCopyCtx(gameSlug: string): CopyCtx {
  const theme = getGameContentTheme(gameSlug)
  return { shortName: valueListHub(gameSlug)?.shortName ?? theme.initials, gameName: theme.name }
}

export default async function EventsHubPage({ gameSlug }: { gameSlug: string }) {
  const theme = getGameContentTheme(gameSlug)
  const hubNav = await getHubNavData(gameSlug)
  const ctx = eventsCopyCtx(gameSlug)
  const buyHref = hubNav.itemsHref ?? `/${gameSlug}`

  return (
    <main className={`relative min-h-screen ${HUB_GROUND}`}>
      <GameHeroBackdrop gameSlug={gameSlug} size="hub">
        <HubNav data={hubNav} />
        <JsonLd
          data={breadcrumbList([
            { name: 'Home', path: '/' },
            { name: theme.name, path: `/${gameSlug}` },
            { name: 'Events', path: `/${gameSlug}/events` },
          ])}
        />
        {/* The H1 ships in the first flush; the answer-first lead and the
            body stream behind skeletons that mirror them. */}
        <section>
          <HubHero
            title={hubTitle(ctx)}
            lead={
              <Suspense fallback={<HubLeadSkeleton />}>
                <HubLead gameSlug={gameSlug} ctx={ctx} />
              </Suspense>
            }
          />
        </section>
        <Suspense fallback={<EventsHubSkeleton />}>
          <HubBody gameSlug={gameSlug} ctx={ctx} buyHref={buyHref} />
        </Suspense>
      </GameHeroBackdrop>

      <HubFooter
        gameName={hubNav.current.name}
        gameSlug={hubNav.current.slug}
        tools={hubNav.tools}
        itemsHref={hubNav.itemsHref}
        accountsHref={hubNav.accountsHref}
      />
    </main>
  )
}

/** Hub row for one event (server → client timeline). */
function timelineRow(gameSlug: string, e: EventView): TimelineRow {
  const v = eventSetValue(e.items)
  // Art only: an unmatched item has no image, and a placeholder thumb is noise.
  const thumbs = sortEventItems(e.items, (r) => rarityRank(gameSlug, r))
    .filter((i) => i.imageUrl)
    .slice(0, 5)
    .map((i) => ({ name: i.name, imageUrl: i.imageUrl, color: rarityMeta(gameSlug, i.rarity).color }))
  return {
    slug: e.slug,
    href: `/${gameSlug}/events/${e.slug}`,
    name: e.name,
    season: e.season,
    year: e.year,
    status: e.status,
    dateLine:
      formatEventRange(e.startsOn, e.endsOn) ?? (e.status === 'upcoming' ? 'Date Not Announced' : 'Dates Not On Record'),
    itemCount: v.itemCount,
    setValueUsd: v.totalUsd,
    thumbs,
  }
}

/** The answer-first lead (same read as the body; the fetch is shared). */
async function HubLead({ gameSlug, ctx }: { gameSlug: string; ctx: CopyCtx }) {
  const events = await getValueEvents(gameSlug)
  return events.length ? hubLead(ctx, events, featuredEvent(events)) : null
}

async function HubBody({ gameSlug, ctx, buyHref }: { gameSlug: string; ctx: CopyCtx; buyHref: string }) {
  const events = await getValueEvents(gameSlug)
  if (events.length === 0) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
        <ValuesEmptyState
          title="Events are temporarily unavailable"
          body={`The ${ctx.gameName} events archive could not be loaded. Please check again shortly.`}
        />
      </div>
    )
  }

  const featured = featuredEvent(events)
  const lastSameSeason = featured ? previousSameSeason(events, featured)[0] ?? null : null
  const faq = hubFaq(ctx, events, featured)
  const rows = events.map((e) => timelineRow(gameSlug, e))
  const years = events.map((e) => e.year)
  const ctaBg = await getGameCtaImage(gameSlug)

  return (
    <>
      <JsonLd data={faqPage(faq)} />
      <JsonLd
        data={itemList(events.map((e) => ({ name: `${ctx.shortName} ${e.name} Event`, path: `/${gameSlug}/events/${e.slug}` })))}
      />

      <div className="mx-auto w-full max-w-7xl space-y-12 px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        {featured && <FeaturedEvent gameSlug={gameSlug} event={featured} lastSameSeason={lastSameSeason} />}

        <section aria-labelledby="events-timeline">
          <h2 id="events-timeline" className="text-heading font-bold tracking-tight text-text-primary">
            {ctx.shortName} Event Timeline ({Math.min(...years)}–{Math.max(...years)})
          </h2>
          <div className="mt-6">
            <EventsTimeline rows={rows} gameName={ctx.gameName} />
          </div>
        </section>

        <HubFaqSection
          title="Frequently Asked Questions"
          subtitle={`Dates, items and values for every ${ctx.shortName} event.`}
          items={faq}
        />

        <HubCtaBand
          gameSlug={gameSlug}
          bgSrc={ctaBg}
          title={`Missed an Event? Buy Its ${ctx.shortName} Items`}
          body={HUB_COPY.safedrop}
          ctaLabel={`Buy ${ctx.shortName} Event Items`}
          ctaHref={buyHref}
        />
      </div>
    </>
  )
}

/** The live or next event: one surface, season glow, the honest date line, one CTA. */
function FeaturedEvent({
  gameSlug,
  event,
  lastSameSeason,
}: {
  gameSlug: string
  event: EventView
  lastSameSeason: EventView | null
}) {
  const rgb = hexRgb(EVENT_SEASONS[event.season].color)
  const live = event.status === 'live'
  const basis = live ? event : lastSameSeason
  const v = basis ? eventSetValue(basis.items) : null
  const art = basis ? sortEventItems(basis.items, (r) => rarityRank(gameSlug, r)).find((i) => i.imageUrl) : null
  const dateLine = live
    ? formatEventRange(event.startsOn, event.endsOn) ?? `${event.year}`
    : upcomingDateLine(event, lastSameSeason)
  const href = `/${gameSlug}/events/${event.slug}`

  return (
    <section aria-labelledby="featured-event" className={cn(VALUE_SURFACE, 'relative isolate overflow-hidden')}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: `radial-gradient(55% 90% at 0% 0%, rgba(${rgb},0.20) 0%, rgba(${rgb},0.06) 45%, transparent 75%), radial-gradient(40% 70% at 100% 100%, rgba(${rgb},0.08) 0%, transparent 70%)`,
        }}
      />
      {art?.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- catalogue art, served as-is
        <img
          src={art.imageUrl}
          alt=""
          aria-hidden
          loading="lazy"
          decoding="async"
          className="pointer-events-none absolute -right-6 -top-10 -z-10 h-[220px] w-[220px] rotate-[-14deg] object-contain opacity-[0.08] blur-[1px] max-sm:hidden"
        />
      )}

      <div className="flex flex-col gap-5 p-5 sm:p-7 lg:flex-row lg:items-center lg:gap-8">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <EventSeasonTile season={event.season} size={56} />
          <div className="min-w-0">
            <h2 id="featured-event" className="text-[22px] font-bold leading-7 tracking-tight text-text-primary">
              {live ? 'Live Now' : 'Next Up'}: {event.name}
            </h2>
            <p className="mt-1 text-[14px] leading-6 text-text-secondary">{dateLine}</p>
          </div>
        </div>

        {basis && v && v.itemCount > 0 && (
          <dl className="flex gap-8">
            <div>
              <dt className={VALUE_LABEL}>{live ? 'Items' : `${basis.name} Items`}</dt>
              <dd className="text-[18px] font-semibold tabular-nums text-text-primary">{v.itemCount}</dd>
            </div>
            {v.totalUsd != null && (
              <div>
                <dt className={VALUE_LABEL}>{live ? 'Set Value' : `${basis.name} Set Value`}</dt>
                <dd className="text-[18px] font-semibold tabular-nums text-[#54DDBE]">{formatEventUsd(v.totalUsd)}</dd>
              </div>
            )}
          </dl>
        )}

        <Link href={href} className={cn(VALUE_BTN_PRIMARY, 'h-11 px-5 text-[14px]')}>
          {live ? `See ${event.name} Items` : `${event.name}: What to Expect`}
          <ArrowRightIcon aria-hidden size={16} weight="bold" />
        </Link>
      </div>
    </section>
  )
}
