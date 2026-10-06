import { Suspense, type ComponentType } from 'react'
import type { IconProps } from '@phosphor-icons/react'
import Link from '@/components/navigation/AppLink'
import { CalendarBlankIcon } from '@phosphor-icons/react/dist/ssr/CalendarBlank'
import { CaretLeftIcon } from '@phosphor-icons/react/dist/ssr/CaretLeft'
import { CaretRightIcon } from '@phosphor-icons/react/dist/ssr/CaretRight'
import { ClockCounterClockwiseIcon } from '@phosphor-icons/react/dist/ssr/ClockCounterClockwise'
import { CoinsIcon } from '@phosphor-icons/react/dist/ssr/Coins'
import { CurrencyDollarIcon } from '@phosphor-icons/react/dist/ssr/CurrencyDollar'
import { GiftIcon } from '@phosphor-icons/react/dist/ssr/Gift'
import { HammerIcon } from '@phosphor-icons/react/dist/ssr/Hammer'
import { HourglassMediumIcon } from '@phosphor-icons/react/dist/ssr/HourglassMedium'
import { LightbulbIcon } from '@phosphor-icons/react/dist/ssr/Lightbulb'
import { LightningIcon } from '@phosphor-icons/react/dist/ssr/Lightning'
import { PackageIcon } from '@phosphor-icons/react/dist/ssr/Package'
import { ShoppingCartIcon } from '@phosphor-icons/react/dist/ssr/ShoppingCart'
import { StorefrontIcon } from '@phosphor-icons/react/dist/ssr/Storefront'
import { SwordIcon } from '@phosphor-icons/react/dist/ssr/Sword'
import { TicketIcon } from '@phosphor-icons/react/dist/ssr/Ticket'
import { TrophyIcon } from '@phosphor-icons/react/dist/ssr/Trophy'
import { JsonLd, breadcrumbList, faqPage, itemList } from '@/lib/seo/jsonld'
import { GameHeroBackdrop } from '@/components/marketplace/GameHeroBackdrop'
import { HubNav } from '@/components/content/HubNav'
import { HubFooter } from '@/components/content/HubFooter'
import { HubFaqSection } from '@/components/content/HubFaqSection'
import { HubCtaBand } from '@/components/content/HubCtaBand'
import { BuyButtonFace } from '@/components/marketplace/BuyButton'
import { HUB_COPY, getGameContentTheme } from '@/lib/content/theme'
import { getHubNavData, HUB_NAV_CLEAR } from '@/lib/content/hubNav'
import { getGameCtaImage } from '@/lib/content/game-cta-art.server'
import { SimilarItemsRail } from '@/components/values/SimilarItemsRail'
import { ValueCallout } from '@/components/values/ValueCallout'
import { PriceStatPair, RarityLabel, ValueCard } from '@/components/values/ValueCard'
import { HUB_GROUND, VALUE_LABEL, VALUE_SURFACE, VALUE_SURFACE_LINK } from '@/components/values/styles'
import { valueListHub } from '@/lib/values/hub-config'
import { rarityMeta, rarityRank } from '@/lib/values/rarity'
import { getValueEvent } from '@/lib/values/events'
import {
  CHANNEL_LABEL,
  EVENT_SEASONS,
  eventSetValue,
  formatEventUsd,
  groupByChannel,
  hexRgb,
  obtainChannel,
  previousSameSeason,
  seasonPattern,
  sortEventItems,
  type EventItemView,
  type EventView,
  type ObtainChannel,
} from '@/lib/values/events-model'
import { cn } from '@/lib/utils'
import { WaySectionHead } from '../values/_generic/WaySectionHead'
import { WAY_STEP_COLS } from '../values/_generic/ValueItemHowToGet'
import {
  buyRow,
  channelStepValue,
  eventAnswer,
  eventFacts,
  eventFaq,
  eventH1,
  eventLabel,
  expectRows,
  obtainableSentence,
  railTitle,
  setValueCallout,
  type CopyCtx,
} from './_eventsCopy'
import { EventSeasonTile } from './_EventSeasonTile'
import { EventPageSkeleton } from './_EventsSkeleton'
import { eventsCopyCtx } from './_EventsHubPage'

/**
 * /[game]/events/[eventSlug] — one event: H1 = the search ("MM2 Halloween
 * 2025 Event: Items, Values and How to Get Them"), then ONE overview surface
 * (answer-first paragraph · facts in a line · the set-value callout), the
 * items on the shared ValueCard, a how-to surface in the item page's style
 * (1 How Items Were Obtained · 2 Buy <Event> Items), the same-season rail,
 * the FAQ and the CTA band. An upcoming event shows only what is known:
 * "What to Expect" from past same-season events and last year's items.
 *
 * The route gates on the event's existence before rendering (a real 404);
 * the body streams behind a skeleton that mirrors it.
 */

const GREEN = '63,217,134'
const MONEY = '#54DDBE'

const CHANNEL_ICON: Record<ObtainChannel, ComponentType<IconProps>> = {
  pass: TicketIcon,
  box: PackageIcon,
  robux: CurrencyDollarIcon,
  shop: StorefrontIcon,
  craft: HammerIcon,
  leaderboard: TrophyIcon,
  tasks: GiftIcon,
  other: SwordIcon,
}
const BUY_ICON = { store: StorefrontIcon, cart: ShoppingCartIcon, bolt: LightningIcon } as const
const EXPECT_ICON = { start: CalendarBlankIcon, length: HourglassMediumIcon, currency: CoinsIcon, items: SwordIcon } as const
const FACT_ICONS: ComponentType<IconProps>[] = [CalendarBlankIcon, CoinsIcon, TicketIcon, SwordIcon]
const UPCOMING_FACT_ICONS: ComponentType<IconProps>[] = [CalendarBlankIcon, ClockCounterClockwiseIcon, SwordIcon, CoinsIcon]

export default async function EventPage({
  gameSlug,
  head,
}: {
  gameSlug: string
  /** The gate read's row: enough for the header before the body streams. */
  head: Pick<EventView, 'slug' | 'name' | 'season' | 'status' | 'year'>
}) {
  const theme = getGameContentTheme(gameSlug)
  const ctx = eventsCopyCtx(gameSlug)
  const hubNav = await getHubNavData(gameSlug)
  const season = EVENT_SEASONS[head.season]
  const path = `/${gameSlug}/events/${head.slug}`
  const upcoming = head.status === 'upcoming'

  return (
    <main className={`relative min-h-screen ${HUB_GROUND}`}>
      <JsonLd
        data={breadcrumbList([
          { name: 'Home', path: '/' },
          { name: theme.name, path: `/${gameSlug}` },
          { name: 'Events', path: `/${gameSlug}/events` },
          { name: head.name, path },
        ])}
      />

      <GameHeroBackdrop gameSlug={gameSlug} size="hub">
        <HubNav data={hubNav} />

        <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${HUB_NAV_CLEAR}`}>
          <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-1.5 text-caption text-text-tertiary">
            <Link href={`/${gameSlug}/events`} className="transition-colors hover:text-text-primary">
              Events
            </Link>
            <CaretRightIcon aria-hidden size={12} weight="bold" className="text-text-disabled" />
            <span>{season.label}</span>
            <CaretRightIcon aria-hidden size={12} weight="bold" className="text-text-disabled" />
            <span className="truncate text-text-primary">{head.name}</span>
          </nav>

          <div className="flex items-start gap-4">
            <EventSeasonTile season={head.season} size={52} className="mt-1 hidden sm:grid" />
            <div className="min-w-0">
              <h1 className="text-balance text-[30px] font-bold leading-[1.08] tracking-[-0.03em] text-text-primary sm:text-display">
                {eventH1(ctx, head)}
              </h1>
              <p className="mt-3 text-body leading-7 text-text-secondary">
                {upcoming
                  ? `Everything known so far about ${ctx.gameName}'s ${head.name} event.`
                  : `Every ${head.name} item in ${ctx.gameName}, what it sells for today, and how it was obtained.`}
              </p>
            </div>
          </div>
        </div>

        <Suspense fallback={<EventPageSkeleton />}>
          <EventBody gameSlug={gameSlug} slug={head.slug} ctx={ctx} buyHref={hubNav.itemsHref ?? `/${gameSlug}`} />
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

async function EventBody({
  gameSlug,
  slug,
  ctx,
  buyHref,
}: {
  gameSlug: string
  slug: string
  ctx: CopyCtx
  buyHref: string
}) {
  const [data, ctaBg] = await Promise.all([getValueEvent(gameSlug, slug), getGameCtaImage(gameSlug)])
  if (!data) return null
  const { event: e, all } = data
  const upcoming = e.status === 'upcoming'
  const past = previousSameSeason(all, e)
  const last = past[0] ?? null
  const pattern = upcoming ? seasonPattern(past.slice(0, 3)) : null
  const faq = eventFaq(ctx, e, last, pattern)
  const answer = eventAnswer(ctx, e, last)
  const facts = eventFacts(e, last)
  // Upcoming: last year's items stand in, clearly labelled.
  const shown = upcoming ? last : e
  const items = shown ? sortEventItems(shown.items, (r) => rarityRank(gameSlug, r)) : []
  const callout = shown ? setValueCallout(shown) : null
  const rgb = hexRgb(EVENT_SEASONS[e.season].color)
  const art = items.find((i) => i.imageUrl)?.imageUrl ?? null
  const paged = items.filter((i) => i.href)

  // Same-season rail (newest first, excluding this one); fall back to the newest
  // events. Only events with art: an upcoming event has none yet — it gets its
  // own link card below instead of a placeholder tile.
  const hasArt = (x: EventView) => x.items.some((i) => i.imageUrl)
  const sameSeason = all.filter((x) => x.slug !== e.slug && x.season === e.season && hasArt(x))
  const railEvents = (sameSeason.length ? sameSeason : all.filter((x) => x.slug !== e.slug && hasArt(x))).slice(0, 12)
  const nextSameSeason = upcoming ? null : all.find((x) => x.status === 'upcoming' && x.season === e.season) ?? null
  const howSection = <HowSection ctx={ctx} event={e} last={last} pattern={pattern} buyHref={buyHref} />

  return (
    <>
      <JsonLd data={faqPage(faq)} />
      {paged.length > 0 && <JsonLd data={itemList(paged.map((i) => ({ name: i.name, path: i.href! })))} />}

      <div className="mx-auto w-full max-w-7xl space-y-12 px-4 pb-10 pt-6 sm:px-6 lg:px-8">
        {/* 1 · Overview: answer · facts · set value — ONE surface. */}
        <section aria-label={`${eventLabel(ctx, e)} at a glance`} className={cn(VALUE_SURFACE, 'relative isolate overflow-hidden')}>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background: `radial-gradient(60% 80% at 100% 0%, rgba(${rgb},0.16) 0%, rgba(${rgb},0.05) 45%, transparent 75%), radial-gradient(40% 60% at 0% 100%, rgba(${rgb},0.06) 0%, transparent 70%)`,
            }}
          />
          {art && (
            // eslint-disable-next-line @next/next/no-img-element -- catalogue art, served as-is
            <img
              src={art}
              alt=""
              aria-hidden
              loading="lazy"
              decoding="async"
              className="pointer-events-none absolute -right-10 -top-12 -z-10 h-[300px] w-[300px] rotate-[-14deg] object-contain opacity-[0.07] blur-[1px] max-sm:hidden"
            />
          )}
          <div className="p-5 sm:p-8">
            <p className="text-body leading-7 text-text-secondary">
              <strong className="font-semibold text-text-primary">{answer.lead}</strong>
              {answer.body ? ` ${answer.body}` : ''}
            </p>

            <dl className={cn('mt-7 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-white/[0.07] pt-6', WAY_STEP_COLS[Math.min(facts.length, 5)])}>
              {facts.map((f, i) => {
                const Icon = (upcoming ? UPCOMING_FACT_ICONS : FACT_ICONS)[i] ?? SwordIcon
                return (
                  <div key={f.label} className="flex min-w-0 items-start gap-3">
                    <span
                      aria-hidden
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-md"
                      style={{ background: `rgba(${rgb},0.14)`, color: EVENT_SEASONS[e.season].color }}
                    >
                      <Icon size={18} weight="duotone" />
                    </span>
                    <div className="min-w-0">
                      <dt className={VALUE_LABEL}>{f.label}</dt>
                      <dd className="text-[15px] font-semibold leading-6 text-text-primary">{f.value}</dd>
                    </div>
                  </div>
                )
              })}
            </dl>

            {callout && shown && (
              <ValueCallout tone="blue" icon={CurrencyDollarIcon} title={upcoming ? `${shown.name} ${callout.title}` : callout.title} className="mt-6">
                {callout.body}
              </ValueCallout>
            )}
          </div>
        </section>

        {/* Upcoming: what to expect comes before last year's items. */}
        {upcoming && howSection}

        {/* 2 · Items */}
        {shown && items.length > 0 && (
          <section aria-labelledby="event-items">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="event-items" className="text-heading font-bold tracking-tight text-text-primary">
                {upcoming ? `Last Year's Items: ${shown.name}` : `${shown.name} Items and Values`}
              </h2>
              <span className="shrink-0 text-[13px] font-medium tabular-nums text-text-tertiary">
                {eventSetValue(shown.items).itemCount} Items
              </span>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
              {items.map((i, n) => (
                <EventItemCard key={`${i.slug ?? i.name}-${n}`} gameSlug={gameSlug} item={i} eventName={shown.name} ctx={ctx} />
              ))}
            </div>
          </section>
        )}

        {/* 3 · How items were obtained · Buy — one surface, two numbered rows. */}
        {!upcoming && howSection}

        {railEvents.length > 0 && (
          <SimilarItemsRail
            title={sameSeason.length ? railTitle(e) : `More ${ctx.shortName} Events`}
            seeAllHref={`/${gameSlug}/events`}
            itemNoun="events"
            className="border-t border-white/[0.07] pt-10"
            items={railEvents.map((x) => {
              const v = eventSetValue(x.items)
              const top = sortEventItems(x.items, (r) => rarityRank(gameSlug, r)).find((i) => i.imageUrl)
              return {
                key: x.slug,
                href: `/${gameSlug}/events/${x.slug}`,
                name: x.name,
                imageSrc: top?.imageUrl ?? null,
                imageAlt: `${ctx.shortName} ${x.name} event`,
                price:
                  x.status === 'upcoming'
                    ? 'Not Out Yet'
                    : v.totalUsd != null
                      ? `${formatEventUsd(v.totalUsd)} Set`
                      : `${v.itemCount} Items`,
              }
            })}
          />
        )}

        <HubFaqSection
          title="Frequently Asked Questions"
          subtitle={`Dates, items and values for ${eventLabel(ctx, e)}.`}
          items={faq}
        />

        <nav
          aria-label={`More ${ctx.gameName} events`}
          className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2', nextSameSeason && 'lg:grid-cols-3')}
        >
          <Link
            href={`/${gameSlug}/events`}
            className={`${VALUE_SURFACE_LINK} group flex items-center gap-3 px-5 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring`}
          >
            <CaretLeftIcon aria-hidden size={20} weight="bold" className="shrink-0 text-text-tertiary transition-transform group-hover:-translate-x-0.5 group-hover:text-text-primary" />
            <span>
              <span className={`block ${VALUE_LABEL}`}>Back to</span>
              <span className="block text-body-sm font-semibold text-text-primary">All {ctx.shortName} Events</span>
            </span>
          </Link>
          <Link
            href={`/${gameSlug}/values`}
            className={`${VALUE_SURFACE_LINK} group flex items-center justify-between gap-3 px-5 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring`}
          >
            <span>
              <span className={`block ${VALUE_LABEL}`}>Every Item</span>
              <span className="block text-body-sm font-semibold text-text-primary">{ctx.shortName} Value List</span>
            </span>
            <CaretRightIcon aria-hidden size={20} weight="bold" className="shrink-0 text-text-tertiary transition-transform group-hover:translate-x-0.5 group-hover:text-text-primary" />
          </Link>
          {nextSameSeason && (
            <Link
              href={`/${gameSlug}/events/${nextSameSeason.slug}`}
              className={`${VALUE_SURFACE_LINK} group flex items-center justify-between gap-3 px-5 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring sm:col-span-2 lg:col-span-1`}
            >
              <span>
                <span className={`block ${VALUE_LABEL}`}>Coming Next</span>
                <span className="block text-body-sm font-semibold text-text-primary">
                  {nextSameSeason.name}: What to Expect
                </span>
              </span>
              <CaretRightIcon aria-hidden size={20} weight="bold" className="shrink-0 text-text-tertiary transition-transform group-hover:translate-x-0.5 group-hover:text-text-primary" />
            </Link>
          )}
        </nav>

        <HubCtaBand
          gameSlug={gameSlug}
          bgSrc={ctaBg}
          {...ctaCopy(ctx, e, last)}
          body={HUB_COPY.safedrop}
          ctaHref={buyHref}
        />
      </div>
    </>
  )
}

/** The bottom band: specific to the event's items, generic when it has none. */
function ctaCopy(ctx: CopyCtx, e: EventView, last: EventView | null): { title: string; ctaLabel: string } {
  if (e.status === 'upcoming' && last && last.items.length > 0) {
    return { title: `Can't Wait? Buy ${last.name} Items`, ctaLabel: `Buy ${last.name} Items` }
  }
  if (e.items.length === 0) {
    return { title: `Looking for ${ctx.shortName} Event Items?`, ctaLabel: `Buy ${ctx.shortName} Event Items` }
  }
  return { title: `Missed ${e.name}? Buy Its Items`, ctaLabel: `Buy ${e.name} Items` }
}

/** One item on the shared ValueCard: type · rarity → art + name → how it came out → Cheapest / Market. */
function EventItemCard({
  gameSlug,
  item,
  eventName,
  ctx,
}: {
  gameSlug: string
  item: EventItemView
  eventName: string
  ctx: CopyCtx
}) {
  const hub = valueListHub(gameSlug)
  const rarity = item.rarity ? rarityMeta(gameSlug, item.rarity) : null
  const typeLabel = (item.itemType && hub?.itemTypeLabels[item.itemType]) || null
  const priced = item.cheapestUsd != null
  return (
    <ValueCard
      href={item.href}
      headerLeft={typeLabel ? <span className="truncate text-[11px] font-medium text-text-tertiary">{typeLabel}</span> : undefined}
      headerRight={rarity ? <RarityLabel label={rarity.label} color={rarity.color} /> : undefined}
      imageSrc={item.imageUrl}
      imageAlt={`${item.name}${typeLabel ? ` ${typeLabel.toLowerCase()}` : ''} from ${ctx.shortName} ${eventName}`}
      name={item.name}
      sub={<span className="text-text-tertiary">{CHANNEL_LABEL[obtainChannel(item.how)]}</span>}
      footer={
        <PriceStatPair
          empty={priced ? null : 'No Price Yet'}
          stats={[
            { label: 'Cheapest', value: priced ? formatEventUsd(item.cheapestUsd!) : null, color: MONEY },
            { label: 'Market', value: item.marketUsd != null ? formatEventUsd(item.marketUsd) : null },
          ]}
        />
      }
    />
  )
}

/** Step tile list: icon in a tinted tile + title + one value line, one line on desktop. */
function Steps({
  steps,
  tint,
}: {
  steps: { key: string; icon: ComponentType<IconProps>; title: string; value: string }[]
  /** "r,g,b" for a coloured tile; neutral when omitted. */
  tint?: string
}) {
  return (
    <ol className={cn('grid min-w-0 flex-1 grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2', WAY_STEP_COLS[Math.min(steps.length, 5)] ?? 'lg:grid-cols-3')}>
      {steps.map((s, i) => (
        <li key={s.key} className="flex items-start gap-3">
          <span
            aria-hidden
            className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-md', tint ? '' : 'bg-white/[0.07] text-text-primary')}
            style={tint ? { background: `rgba(${tint},0.14)`, color: `rgb(${tint})` } : undefined}
          >
            <s.icon size={18} weight="duotone" />
          </span>
          <div className="min-w-0">
            <p className="text-[14px] font-semibold leading-5 text-text-primary">
              <span className="sr-only">Step {i + 1}: </span>
              {s.title}
            </p>
            <p className="mt-0.5 text-[13px] leading-5 text-text-secondary">{s.value}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}

function HowSection({
  ctx,
  event: e,
  last,
  pattern,
  buyHref,
}: {
  ctx: CopyCtx
  event: EventView
  last: EventView | null
  pattern: ReturnType<typeof seasonPattern> | null
  buyHref: string
}) {
  const upcoming = e.status === 'upcoming'
  // No items (e.g. a Roblox tie-in with no MM2 rewards): the answer says so; no section.
  if (!upcoming && e.items.length === 0) return null
  const buyFor = upcoming ? last : e
  const buy = buyFor && buyFor.items.length > 0 ? buyRow(ctx, buyFor) : null

  let row1: React.ReactNode = null
  if (upcoming) {
    const rows = expectRows(pattern)
    if (rows.length > 0 && pattern) {
      row1 = (
        <>
          <WaySectionHead n={1} title={`What to Expect from ${ctx.shortName} ${e.name}`} tone="neutral" />
          <p className="mt-6 text-body leading-7 text-text-secondary">
            <strong className="font-semibold text-text-primary">Going by the last {pattern.basis.length} {EVENT_SEASONS[e.season].label} events</strong>{' '}
            ({pattern.basis.join(', ')}) — not an announcement.
          </p>
          <div className="mt-6">
            <Steps steps={rows.map((r) => ({ key: r.key, icon: EXPECT_ICON[r.key], title: r.title, value: r.value }))} />
          </div>
          <ValueCallout tone="yellow" icon={LightbulbIcon} title="Not Announced Yet" className="mt-5">
            this page updates when {ctx.shortName} announces {e.name}, with its real dates and items
          </ValueCallout>
        </>
      )
    }
  } else {
    const groups = groupByChannel(e.items)
    row1 = (
      <>
        <WaySectionHead n={1} title={`How ${e.name} Items Were Obtained`} tone="neutral" />
        {e.howItemsWereObtained && (
          <p className="mt-6 text-body leading-7 text-text-secondary">{e.howItemsWereObtained}</p>
        )}
        {groups.length > 0 && (
          <div className="mt-6">
            <Steps
              steps={groups.map((g) => ({
                key: g.channel,
                icon: CHANNEL_ICON[g.channel],
                title: g.label,
                value: channelStepValue(g.items),
              }))}
            />
          </div>
        )}
        <ValueCallout tone="yellow" icon={LightbulbIcon} title="Good To Know" className="mt-5">
          {obtainableSentence(ctx, e)}
        </ValueCallout>
      </>
    )
  }

  if (!row1 && !buy) return null
  const rgb = hexRgb(EVENT_SEASONS[e.season].color)

  return (
    <section
      aria-label={upcoming ? `What to expect from ${e.name}` : `How to get ${e.name} items`}
      className={cn(VALUE_SURFACE, 'relative isolate overflow-hidden')}
    >
      {/* The season's glow from the top corner — decorative. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: `radial-gradient(50% 60% at 0% 0%, rgba(${rgb},0.10) 0%, transparent 70%)` }}
      />
      <div className="p-5 sm:p-8">
        {row1}
        {buy && (
          <div className={row1 ? 'mt-7 border-t border-white/[0.07] pt-6' : ''}>
            <WaySectionHead n={row1 ? 2 : 1} title={buy.heading} tone="green" />
            <div className="mt-6 flex flex-col gap-5 lg:flex-row lg:items-center lg:gap-8">
              <Steps
                tint={GREEN}
                steps={buy.steps.map((s) => ({ key: s.icon, icon: BUY_ICON[s.icon], title: s.title, value: s.value }))}
              />
              <Link
                href={buyHref}
                prefetch={false}
                className="group inline-flex shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                <BuyButtonFace size="md" className="w-full lg:w-auto">
                  <span className="truncate">{buy.cta}</span>
                </BuyButtonFace>
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
