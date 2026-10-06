import { Suspense, type ComponentType } from 'react'
import type { IconProps } from '@phosphor-icons/react'
import Link from '@/components/navigation/AppLink'
import { ArrowsLeftRightIcon } from '@phosphor-icons/react/dist/ssr/ArrowsLeftRight'
import { BroadcastIcon } from '@phosphor-icons/react/dist/ssr/Broadcast'
import { CalendarXIcon } from '@phosphor-icons/react/dist/ssr/CalendarX'
import { CaretRightIcon } from '@phosphor-icons/react/dist/ssr/CaretRight'
import { ChartLineUpIcon } from '@phosphor-icons/react/dist/ssr/ChartLineUp'
import { CoinsIcon } from '@phosphor-icons/react/dist/ssr/Coins'
import { DiamondIcon } from '@phosphor-icons/react/dist/ssr/Diamond'
import { GiftIcon } from '@phosphor-icons/react/dist/ssr/Gift'
import { HammerIcon } from '@phosphor-icons/react/dist/ssr/Hammer'
import { ListChecksIcon } from '@phosphor-icons/react/dist/ssr/ListChecks'
import { PackageIcon } from '@phosphor-icons/react/dist/ssr/Package'
import { ShieldCheckIcon } from '@phosphor-icons/react/dist/ssr/ShieldCheck'
import { SparkleIcon } from '@phosphor-icons/react/dist/ssr/Sparkle'
import { TicketIcon } from '@phosphor-icons/react/dist/ssr/Ticket'
import { TrophyIcon } from '@phosphor-icons/react/dist/ssr/Trophy'
import { JsonLd, breadcrumbList, faqPage, itemList } from '@/lib/seo/jsonld'
import { GameHeroBackdrop } from '@/components/marketplace/GameHeroBackdrop'
import { HubNav } from '@/components/content/HubNav'
import { HubFooter } from '@/components/content/HubFooter'
import { HubHero } from '@/components/content/HubHero'
import { HubFaqSection } from '@/components/content/HubFaqSection'
import { HubCtaBand } from '@/components/content/HubCtaBand'
import { BuyButtonFace } from '@/components/marketplace/BuyButton'
import { SimilarItemsRail } from '@/components/values/SimilarItemsRail'
import { ValueCallout } from '@/components/values/ValueCallout'
import { PriceStatPair, RarityLabel, ValueCard } from '@/components/values/ValueCard'
import { HUB_GROUND, VALUE_LABEL, VALUE_SURFACE, VALUE_SURFACE_LINK } from '@/components/values/styles'
import { HUB_COPY, getGameContentTheme, hasHubPage } from '@/lib/content/theme'
import { getHubNavData } from '@/lib/content/hubNav'
import { getGameCtaImage } from '@/lib/content/game-cta-art.server'
import { getValueItems, type ValueItem } from '@/lib/values/data'
import { codeMonthYear, formatCheckedDate, getFreeGuide, newestExpiredCode, type FreeGuide } from '@/lib/values/free-guide'
import { sharedWeaponBoxOdds, shopBoxes } from '@/lib/values/shop-boxes'
import { valueItemHasPage, valueListHub } from '@/lib/values/hub-config'
import { rarityMeta } from '@/lib/values/rarity'
import { hexRgb } from '@/lib/values/events-model'
import { cn } from '@/lib/utils'
import { WaySectionHead } from '../values/_generic/WaySectionHead'
import {
  NOTHING_HERE,
  NOTHING_ORDER,
  buyRow,
  chromaRailTitle,
  faq as freeFaq,
  freeNumbers,
  godlyGridHeading,
  godlyGridLead,
  lead,
  nothingHeading,
  pageTitle,
  realWaysHeading,
  seerCallout,
  usd,
  wayRows,
  type CopyCtx,
  type FreeNumbers,
  type WayIconKey,
  type WayRow,
} from './_freeItemsCopy'
import { FreeItemsSkeleton } from './_FreeItemsSkeleton'

/**
 * /[game]/free-items — the honest "how to get free Godlies and items" guide
 * (MM2 first). H1 = the search; the lead answers it (the real ways, the
 * honest odds, no codes). Then ONE surface in the How To Get style: 1 the
 * real ways (icon · title · what you get · how · the number), the Seer
 * callout; 2 what gives nothing; 3 skip the grind (buy). Then every free
 * Godly on the shared ValueCard with live prices, the Chroma rail, the FAQ
 * (= FAQPage schema), cross-links and the CTA band.
 *
 * Facts come from the researched seed at build time (lib/values/free-guide);
 * only prices and art are read live, through the tagged values reader, so the
 * values-revalidate route refreshes them with the rest of the hub. The body
 * streams behind an in-page Suspense whose skeleton mirrors it (no route
 * loading.tsx: it would flush a 200 before a page can 404).
 */

const GREEN = '63,217,134'
const MONEY = '#54DDBE'

const WAY_ICON: Record<WayIconKey, ComponentType<IconProps>> = {
  coins: CoinsIcon,
  craft: HammerIcon,
  pass: TicketIcon,
  quests: ListChecksIcon,
  live: BroadcastIcon,
  gift: GiftIcon,
  trade: ArrowsLeftRightIcon,
  trophy: TrophyIcon,
  level: ChartLineUpIcon,
  calendar: CalendarXIcon,
}
const BUY_ICON = { seer: HammerIcon, box: PackageIcon, chroma: DiamondIcon } as const

export function freeCopyCtx(gameSlug: string): CopyCtx {
  const theme = getGameContentTheme(gameSlug)
  return { gameName: theme.name, shortName: valueListHub(gameSlug)?.shortName ?? theme.initials }
}

/** The computed figures for a game — null when it has no guide or no shared box odds. */
export function freePageNumbers(gameSlug: string): { guide: FreeGuide; n: FreeNumbers; realWays: number } | null {
  const guide = getFreeGuide(gameSlug)
  const odds = sharedWeaponBoxOdds(gameSlug)
  if (!guide || !odds) return null
  return { guide, n: freeNumbers(odds), realWays: guide.ways.filter((w) => !NOTHING_HERE.has(w.slug)).length }
}

export default async function FreeItemsPage({ gameSlug }: { gameSlug: string }) {
  const theme = getGameContentTheme(gameSlug)
  const hubNav = await getHubNavData(gameSlug)
  const ctx = freeCopyCtx(gameSlug)
  const data = freePageNumbers(gameSlug)!
  const l = lead(ctx, data.n, data.realWays)
  const buyHref = hubNav.itemsHref ?? `/${gameSlug}`

  return (
    <main className={`relative min-h-screen ${HUB_GROUND}`}>
      <GameHeroBackdrop gameSlug={gameSlug} size="hub">
        <HubNav data={hubNav} />
        <JsonLd
          data={breadcrumbList([
            { name: 'Home', path: '/' },
            { name: theme.name, path: `/${gameSlug}` },
            { name: 'Free Items', path: `/${gameSlug}/free-items` },
          ])}
        />
        {/* Facts are static (build-time seed), so the H1 and the answer ship in the first flush. */}
        <section>
          <HubHero
            title={pageTitle(ctx)}
            lead={
              <>
                <strong className="font-semibold text-text-primary">{l.strong}</strong> {l.rest}
              </>
            }
          >
            <p className="mt-3 text-[13px] text-text-tertiary">
              Last checked <time dateTime={data.guide.checkedAt}>{formatCheckedDate(data.guide.checkedAt)}</time>
            </p>
          </HubHero>
        </section>

        <Suspense fallback={<FreeItemsSkeleton />}>
          <FreeItemsBody gameSlug={gameSlug} ctx={ctx} data={data} buyHref={buyHref} />
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

/** A catalogue item the page shows: art, live price, its value page when it has one. */
interface Shown {
  slug: string
  name: string
  rarity: string | null
  itemType: string | null
  imageUrl: string | null
  cheapestUsd: number | null
  marketUsd: number | null
  href: string | null
}

function shown(gameSlug: string, i: ValueItem): Shown {
  const cheapestUsd = i.price?.cheapestUsd ?? null
  return {
    slug: i.slug,
    name: i.name,
    rarity: i.rarity,
    itemType: i.itemType,
    imageUrl: i.imageUrl,
    cheapestUsd,
    marketUsd: i.price?.averageUsd ?? null,
    href: valueItemHasPage(gameSlug, { rarity: i.rarity, priced: cheapestUsd != null }) ? `/${gameSlug}/values/${i.slug}` : null,
  }
}

const cheapestOf = (xs: Shown[]) =>
  xs.filter((x) => x.cheapestUsd != null).sort((a, b) => a.cheapestUsd! - b.cheapestUsd!)[0] ?? null

async function FreeItemsBody({
  gameSlug,
  ctx,
  data,
  buyHref,
}: {
  gameSlug: string
  ctx: CopyCtx
  data: { guide: FreeGuide; n: FreeNumbers; realWays: number }
  buyHref: string
}) {
  const { guide, n, realWays } = data
  const [items, ctaBg] = await Promise.all([getValueItems(gameSlug, { kinds: ['item'] }), getGameCtaImage(gameSlug)])
  const bySlug = new Map(items.map((i) => [i.slug, shown(gameSlug, i)]))
  const get = (slug: string | null) => (slug ? bySlug.get(slug) ?? null : null)
  const priceOf = (slug: string) => get(slug)?.cheapestUsd ?? null

  // The free Godlies: Seer (crafted), every Shop box's Godly, the Common Egg's Fire pets.
  const boxes = shopBoxes(gameSlug)
  const sourceOf = new Map<string, string>()
  for (const b of boxes) for (const g of [...b.godlies, ...b.chromas]) if (g.slug) sourceOf.set(g.slug, b.name)
  const seer = get('seer')
  const weapons = boxes.filter((b) => b.kind === 'box').flatMap((b) => b.godlies.map((g) => get(g.slug))).filter((x): x is Shown => !!x)
  const pets = boxes.filter((b) => b.kind === 'egg').flatMap((b) => b.godlies.map((g) => get(g.slug))).filter((x): x is Shown => !!x)
  const byPrice = (a: Shown, b: Shown) => (b.cheapestUsd ?? -1) - (a.cheapestUsd ?? -1)
  const godlies = [...(seer ? [seer] : []), ...[...weapons].sort(byPrice), ...[...pets].sort(byPrice)]
  const chromas = [
    ...boxes.filter((b) => b.kind === 'box').flatMap((b) => b.chromas.map((c) => get(c.slug))),
    get('chroma-seer'),
  ]
    .filter((x): x is Shown => !!x && !!x.href)
    .sort(byPrice)

  const rows = wayRows(ctx, guide, n, priceOf)
  const real = rows.filter((r) => !NOTHING_HERE.has(r.slug))
  const nothing = NOTHING_ORDER.map((slug) => rows.find((r) => r.slug === slug)).filter((r): r is WayRow => !!r)
  const boxCheapest = cheapestOf(weapons)
  const chromaCheapest = cheapestOf(chromas)
  const buy = buyRow(ctx, n, {
    seer: seer?.cheapestUsd ?? null,
    box: boxCheapest ? { name: boxCheapest.name, usd: boxCheapest.cheapestUsd! } : null,
    chroma: chromaCheapest ? { name: chromaCheapest.name, usd: chromaCheapest.cheapestUsd! } : null,
  })
  const last = newestExpiredCode(guide)
  const lastWhen = last ? codeMonthYear(last.when) : null
  const qa = freeFaq(ctx, n, realWays, last && lastWhen ? { code: last.code, year: lastWhen } : null)
  const callout = seerCallout(n)
  const godlyRgb = hexRgb(rarityMeta(gameSlug, 'Godly').color)
  const linked = godlies.filter((g) => g.href)

  return (
    <>
      <JsonLd data={faqPage(qa)} />
      {linked.length > 0 && <JsonLd data={itemList(linked.map((g) => ({ name: g.name, path: g.href! })))} />}

      <div className="mx-auto w-full max-w-7xl space-y-12 px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        {/* ONE surface, three numbered sections (no card-in-card). */}
        <section aria-label={`Every way to get free ${ctx.shortName} items`} className={cn(VALUE_SURFACE, 'relative isolate overflow-hidden')}>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background: `radial-gradient(55% 40% at 100% 0%, rgba(${godlyRgb},0.14) 0%, rgba(${godlyRgb},0.04) 45%, transparent 75%), radial-gradient(40% 30% at 0% 100%, rgba(${GREEN},0.06) 0%, transparent 70%)`,
            }}
          />
          {seer?.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- catalogue art, served as-is
            <img
              src={seer.imageUrl}
              alt=""
              aria-hidden
              loading="lazy"
              decoding="async"
              className="pointer-events-none absolute -right-10 -top-12 -z-10 h-[300px] w-[300px] rotate-[-14deg] object-contain opacity-[0.07] blur-[1px] max-sm:hidden"
            />
          )}

          <div className="p-5 sm:p-8">
            <WaySectionHead n={1} title={realWaysHeading(ctx, real.length)} tone="neutral" as="h2" />
            <ol className="mt-6">
              {real.map((r, i) => (
                <WayRowItem key={r.slug} gameSlug={gameSlug} row={r} index={i + 1} get={get} first={i === 0} />
              ))}
            </ol>
            <ValueCallout tone="blue" icon={SparkleIcon} title={callout.title} className="mt-5">
              {callout.body}
            </ValueCallout>

            <div className="mt-7 border-t border-white/[0.07] pt-6">
              <WaySectionHead n={2} title={nothingHeading(ctx)} tone="neutral" muted as="h2" />
              <ul className="mt-6">
                {nothing.map((r, i) => (
                  <WayRowItem key={r.slug} gameSlug={gameSlug} row={r} get={get} first={i === 0} muted />
                ))}
              </ul>
            </div>

            {buy.steps.length > 0 && (
              <div className="mt-7 border-t border-white/[0.07] pt-6">
                <WaySectionHead n={3} title={buy.heading} tone="green" as="h2" />
                <div className="mt-6 flex flex-col gap-5 lg:flex-row lg:items-center lg:gap-8">
                  <ol className="grid min-w-0 flex-1 grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
                    {buy.steps.map((s) => {
                      const Icon = BUY_ICON[s.icon]
                      return (
                        <li key={s.icon} className="flex items-start gap-3">
                          <span
                            aria-hidden
                            className="grid h-9 w-9 shrink-0 place-items-center rounded-md"
                            style={{ background: `rgba(${GREEN},0.14)`, color: `rgb(${GREEN})` }}
                          >
                            <Icon size={18} weight="duotone" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-[14px] font-semibold leading-5 text-text-primary">{s.title}</p>
                            <p className="mt-0.5 text-[13px] leading-5 text-text-secondary">{s.value}</p>
                          </div>
                        </li>
                      )
                    })}
                  </ol>
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
                {buy.callout && (
                  <ValueCallout tone="blue" icon={ShieldCheckIcon} title={buy.callout.title} className="mt-5">
                    {buy.callout.body}
                  </ValueCallout>
                )}
              </div>
            )}
          </div>
        </section>

        {godlies.length > 0 && (
          <section aria-labelledby="free-godlies">
            <h2 id="free-godlies" className="text-heading font-bold tracking-tight text-text-primary">
              {godlyGridHeading(ctx, godlies.length)}
            </h2>
            <p className="mt-2 text-body-sm leading-6 text-text-secondary">{godlyGridLead(ctx, n)}</p>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
              {godlies.map((g) => (
                <GodlyCard
                  key={g.slug}
                  gameSlug={gameSlug}
                  item={g}
                  source={g.slug === 'seer' ? 'Crafted, No Luck' : sourceOf.get(g.slug) ?? null}
                  ctx={ctx}
                />
              ))}
            </div>
          </section>
        )}

        {chromas.length > 0 && (
          <SimilarItemsRail
            title={chromaRailTitle(n)}
            seeAllHref={hasHubPage(gameSlug, 'chromas') ? `/${gameSlug}/chromas` : `/${gameSlug}/values`}
            itemNoun="chromas"
            className="border-t border-white/[0.07] pt-10"
            items={chromas.map((c) => ({
              key: c.slug,
              href: c.href!,
              name: c.name,
              imageSrc: c.imageUrl,
              imageAlt: `${c.name} in ${ctx.gameName}`,
              price: c.cheapestUsd != null ? usd(c.cheapestUsd) : 'Price pending',
            }))}
          />
        )}

        <HubFaqSection
          title="Frequently Asked Questions"
          subtitle={`Free Godlies, spins and rewards in ${ctx.gameName}, answered honestly.`}
          items={qa}
        />

        <nav aria-label={`More ${ctx.gameName} guides`} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {hasHubPage(gameSlug, 'codes') && (
            <CrossLink href={`/${gameSlug}/codes`} label="Do Any Work?" title={`${ctx.shortName} Codes`} />
          )}
          {hasHubPage(gameSlug, 'events') && (
            <CrossLink href={`/${gameSlug}/events`} label="Free Event Items" title={`${ctx.shortName} Events`} />
          )}
          <CrossLink href={`/${gameSlug}/values`} label="What Your Items Are Worth" title={`${ctx.shortName} Value List`} />
        </nav>

        <HubCtaBand
          gameSlug={gameSlug}
          bgSrc={ctaBg}
          title={`Skip ${fmtSpins(n)} Spins: Buy ${ctx.shortName} Godlies`}
          body={HUB_COPY.safedrop}
          ctaLabel={buy.cta}
          ctaHref={buyHref}
        />
      </div>
    </>
  )
}

const fmtSpins = (n: FreeNumbers) => n.godlySpins.toLocaleString('en-US')

function CrossLink({ href, label, title }: { href: string; label: string; title: string }) {
  return (
    <Link
      href={href}
      className={`${VALUE_SURFACE_LINK} group flex items-center justify-between gap-3 px-5 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring`}
    >
      <span>
        <span className={`block ${VALUE_LABEL}`}>{label}</span>
        <span className="block text-body-sm font-semibold text-text-primary">{title}</span>
      </span>
      <CaretRightIcon aria-hidden size={20} weight="bold" className="shrink-0 text-text-tertiary transition-transform group-hover:translate-x-0.5 group-hover:text-text-primary" />
    </Link>
  )
}

/** One way: icon tile · title + what you get + how · featured art · the number. Plain row, hairline between. */
function WayRowItem({
  gameSlug,
  row,
  index,
  get,
  first,
  muted = false,
}: {
  gameSlug: string
  row: WayRow
  /** Shown for the numbered (real) ways only. */
  index?: number
  get: (slug: string | null) => Shown | null
  first: boolean
  muted?: boolean
}) {
  const Icon = WAY_ICON[row.icon]
  const featured = row.featured.map((s) => get(s)).filter((x): x is Shown => !!x && !!x.imageUrl)
  return (
    <li
      className={cn(
        'grid grid-cols-[36px_1fr] gap-x-3.5 gap-y-3 py-4 sm:grid-cols-[36px_1fr_auto] sm:items-center sm:gap-x-5',
        !first && 'border-t border-white/[0.07]',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'grid h-9 w-9 place-items-center self-start rounded-md sm:self-center',
          muted ? 'bg-white/[0.04] text-text-tertiary' : 'bg-white/[0.07] text-text-primary',
        )}
      >
        <Icon size={18} weight="duotone" />
      </span>

      <div className="min-w-0">
        <h3 className={cn('text-[15px] font-semibold leading-6', muted ? 'text-text-secondary' : 'text-text-primary')}>
          {index != null && <span className="mr-1.5 tabular-nums text-text-tertiary">{index}.</span>}
          {row.title}
        </h3>
        <p className="mt-0.5 text-[14px] leading-6 text-text-secondary">
          <span className={muted ? '' : 'text-text-primary'}>{row.get}</span> {row.how}
        </p>
      </div>

      <div className="col-start-2 flex items-center gap-4 sm:col-start-auto sm:justify-end">
        {featured.length > 0 && (
          <div className="flex shrink-0 gap-2">
            {featured.map((f) => (
              <FeaturedArt key={f.slug} gameSlug={gameSlug} item={f} />
            ))}
          </div>
        )}
        <div className="min-w-0 sm:w-[176px] sm:text-right">
          <p className={cn('text-[17px] font-bold leading-6 tabular-nums', muted ? 'text-text-secondary' : 'text-text-primary')}>
            {row.metric.value}
          </p>
          <p className="text-[12px] leading-5 text-text-tertiary">{row.metric.label}</p>
        </div>
      </div>
    </li>
  )
}

/** A row's item: art on its rarity glow, linking to its value page (name + live price under). */
function FeaturedArt({ gameSlug, item }: { gameSlug: string; item: Shown }) {
  const rgb = hexRgb(rarityMeta(gameSlug, item.rarity).color)
  const body = (
    <>
      <span
        className="grid h-12 w-12 place-items-center rounded-md"
        style={{ background: `radial-gradient(closest-side, rgba(${rgb},0.30), rgba(${rgb},0.06) 70%, rgba(255,255,255,0.03))` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- catalogue art, served as-is */}
        <img src={item.imageUrl!} alt={item.name} loading="lazy" decoding="async" className="h-10 w-10 object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.55)]" />
      </span>
      <span className="mt-1 block max-w-[64px] truncate text-center text-[11px] font-medium leading-4 text-text-secondary group-hover:text-text-primary">
        {item.cheapestUsd != null ? usd(item.cheapestUsd) : item.name}
      </span>
    </>
  )
  return item.href ? (
    <Link
      href={item.href}
      title={`${item.name} value`}
      className="group flex flex-col items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
    >
      {body}
    </Link>
  ) : (
    <span className="flex flex-col items-center">{body}</span>
  )
}

/** One free Godly on the shared ValueCard: type · rarity → art + name → where it comes from → Cheapest / Market. */
function GodlyCard({ gameSlug, item, source, ctx }: { gameSlug: string; item: Shown; source: string | null; ctx: CopyCtx }) {
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
      imageAlt={`${item.name}${typeLabel ? ` ${typeLabel.toLowerCase()}` : ''}, a free Godly in ${ctx.shortName}`}
      name={item.name}
      sub={source ? <span className="text-text-tertiary">{source}</span> : undefined}
      footer={
        <PriceStatPair
          empty={priced ? null : 'No Price Yet'}
          stats={[
            { label: 'Cheapest', value: priced ? usd(item.cheapestUsd!) : null, color: MONEY },
            { label: 'Market', value: item.marketUsd != null ? usd(item.marketUsd) : null },
          ]}
        />
      }
    />
  )
}
