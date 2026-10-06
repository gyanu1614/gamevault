import { Suspense, type ComponentType } from 'react'
import type { IconProps } from '@phosphor-icons/react'
import Link from '@/components/navigation/AppLink'
import { CalendarStarIcon } from '@phosphor-icons/react/dist/ssr/CalendarStar'
import { CaretRightIcon } from '@phosphor-icons/react/dist/ssr/CaretRight'
import { CurrencyDollarIcon } from '@phosphor-icons/react/dist/ssr/CurrencyDollar'
import { DiamondIcon } from '@phosphor-icons/react/dist/ssr/Diamond'
import { LightbulbIcon } from '@phosphor-icons/react/dist/ssr/Lightbulb'
import { SparkleIcon } from '@phosphor-icons/react/dist/ssr/Sparkle'
import { SwordIcon } from '@phosphor-icons/react/dist/ssr/Sword'
import { JsonLd, breadcrumbList, faqPage, itemList } from '@/lib/seo/jsonld'
import { GameHeroBackdrop } from '@/components/marketplace/GameHeroBackdrop'
import { HubNav } from '@/components/content/HubNav'
import { HubFooter } from '@/components/content/HubFooter'
import { HubHero } from '@/components/content/HubHero'
import { HubFaqSection } from '@/components/content/HubFaqSection'
import { HubCtaBand } from '@/components/content/HubCtaBand'
import { ValueArt } from '@/components/values/ValueArt'
import { ValueCallout } from '@/components/values/ValueCallout'
import { HUB_GROUND, VALUE_LABEL, VALUE_SURFACE, VALUE_SURFACE_LINK } from '@/components/values/styles'
import { HUB_COPY, getGameContentTheme, hasHubPage } from '@/lib/content/theme'
import { getHubNavData } from '@/lib/content/hubNav'
import { getGameCtaImage } from '@/lib/content/game-cta-art.server'
import { rarityMeta } from '@/lib/values/rarity'
import { hexRgb } from '@/lib/values/events-model'
import { expectedDraws, fmtDraws, roundingNote } from '@/lib/values/box-odds'
import { bestCoinBox, type BoxView } from '@/lib/values/boxes'
import { cn } from '@/lib/utils'
import { WaySectionHead } from '../values/_generic/WaySectionHead'
import { HubLeadSkeleton } from '../events/_EventsSkeleton'
import {
  approxUsd,
  bestCallout,
  classicGroupLabel,
  dateRange,
  eggCallout,
  hubFaq,
  hubH1,
  hubLead,
  ladderSteps,
  mysteryBox2Callout,
  oddsHeading,
  oddsLead,
  priceLine,
  retiredHeading,
  retiredLead,
  roundingCallout,
  shopHeading,
  shopLead,
  usd,
  type CopyCtx,
  type ShopOdds,
} from './_boxesCopy'
import { boxesCopyCtx, loadBoxes, shopOddsFor } from './_boxesData'
import { BoxesHubSkeleton } from './_BoxesSkeleton'

/**
 * /[game]/boxes — MM2 Box Odds. H1 = the search ("MM2 Box Odds: Every Murder
 * Mystery 2 Box, Drop Rates and What's Inside"); the lead answers it with
 * the real odds (Godly 0.2%, Chroma 0.004%, ~500 / ~25,000 spins). Then
 * 1 the boxes in the Shop now (art, price, Godly + Chroma at live prices,
 * value per spin) with the best box's expected value, 2 how the odds work
 * (the tier ladder and the three honest notes), 3 every retired box grouped
 * by year with its event, the FAQ (= FAQPage) and an ItemList of all box pages.
 *
 * Plain maths only: no reel, no "chance to win". Every number is computed
 * (lib/values/box-odds + ./_boxesCopy, unit-tested) from the box seed and the
 * tagged values reads. The body streams behind an in-page Suspense whose
 * skeleton mirrors it (no route loading.tsx: it would flush a 200 before a
 * page can 404).
 */

const GREEN = '63,217,134'

const TIER_ICON: Record<string, ComponentType<IconProps>> = { Godly: SparkleIcon, Chroma: DiamondIcon }

export default async function BoxesHubPage({ gameSlug }: { gameSlug: string }) {
  const theme = getGameContentTheme(gameSlug)
  const hubNav = await getHubNavData(gameSlug)
  const ctx = boxesCopyCtx(gameSlug)
  const o = shopOddsFor(gameSlug)!
  const buyHref = hubNav.itemsHref ?? `/${gameSlug}`

  return (
    <main className={`relative min-h-screen ${HUB_GROUND}`}>
      <GameHeroBackdrop gameSlug={gameSlug} size="hub">
        <HubNav data={hubNav} />
        <JsonLd
          data={breadcrumbList([
            { name: 'Home', path: '/' },
            { name: theme.name, path: `/${gameSlug}` },
            { name: 'Box Odds', path: `/${gameSlug}/boxes` },
          ])}
        />
        <section>
          <HubHero
            title={hubH1(ctx)}
            lead={
              <Suspense fallback={<HubLeadSkeleton />}>
                <Lead gameSlug={gameSlug} ctx={ctx} o={o} />
              </Suspense>
            }
          />
        </section>

        <Suspense fallback={<BoxesHubSkeleton />}>
          <BoxesBody gameSlug={gameSlug} ctx={ctx} o={o} buyHref={buyHref} />
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

async function Lead({ gameSlug, ctx, o }: { gameSlug: string; ctx: CopyCtx; o: ShopOdds }) {
  const { views } = await loadBoxes(gameSlug)
  const l = hubLead(ctx, o, views.filter((v) => !v.box.inShop).length)
  return (
    <>
      <strong className="font-semibold text-text-primary">{l.strong}</strong> {l.rest}
    </>
  )
}

async function BoxesBody({ gameSlug, ctx, o, buyHref }: { gameSlug: string; ctx: CopyCtx; o: ShopOdds; buyHref: string }) {
  const [{ views, eventNames }, ctaBg] = await Promise.all([loadBoxes(gameSlug), getGameCtaImage(gameSlug)])
  const shop = views.filter((v) => v.box.inShop)
  const retired = views.filter((v) => !v.box.inShop)
  const best = bestCoinBox(views)
  const standard = shop.find((v) => v.box.kind === 'box' && !v.box.splitUnconfirmed)?.box ?? null
  const mb2 = shop.find((v) => v.box.splitUnconfirmed)?.box ?? null
  const egg = shop.find((v) => v.box.kind === 'egg')?.box ?? null
  const notes = [standard ? roundingCallout(standard) : null, mb2 ? mysteryBox2Callout(mb2) : null, egg ? eggCallout(egg) : null].filter(
    (n): n is { title: string; body: string } => n !== null,
  )
  const qa = hubFaq(ctx, o, {
    best,
    shopCount: shop.length,
    retiredCount: retired.length,
    rounding: standard ? roundingNote(standard.tiers) : null,
    egg,
    spinPrice: standard?.prices ?? null,
  })
  const godlyRgb = hexRgb(rarityMeta(gameSlug, 'Godly').color)
  const art = best?.art ?? shop.find((v) => v.art)?.art ?? null

  // Retired: event boxes by year (newest first), then the classic boxes.
  const groups: { key: string; label: string; views: BoxView[] }[] = []
  for (const v of retired) {
    const key = v.box.year != null ? String(v.box.year) : 'classic'
    let g = groups.find((x) => x.key === key)
    if (!g) groups.push((g = { key, label: key === 'classic' ? classicGroupLabel() : key, views: [] }))
    g.views.push(v)
  }

  return (
    <>
      <JsonLd data={faqPage(qa)} />
      <JsonLd data={itemList(views.map((v) => ({ name: `${ctx.shortName} ${v.box.name}`, path: `/${gameSlug}/boxes/${v.box.slug}` })))} />

      <div className="mx-auto w-full max-w-7xl space-y-12 px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        {/* 1 · The Shop now — ONE surface, one row per box. */}
        <section aria-labelledby="shop-boxes" className={cn(VALUE_SURFACE, 'relative isolate overflow-hidden')}>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background: `radial-gradient(55% 30% at 100% 0%, rgba(${godlyRgb},0.14) 0%, rgba(${godlyRgb},0.04) 45%, transparent 75%), radial-gradient(40% 30% at 0% 100%, rgba(${GREEN},0.05) 0%, transparent 70%)`,
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
            <WaySectionHead id="shop-boxes" n={1} title={shopHeading(ctx)} tone="neutral" as="h2" />
            <p className="mt-4 text-body leading-7 text-text-secondary">{shopLead(o, standard?.prices ?? null)}</p>
            <div className="mt-6 hidden grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_112px_20px] gap-x-5 border-b border-white/[0.07] pb-2 lg:grid">
              <span className={VALUE_LABEL}>Box</span>
              <span className={VALUE_LABEL}>Godly</span>
              <span className={VALUE_LABEL}>Chroma</span>
              <span className={cn(VALUE_LABEL, 'text-right')}>Value Per Spin</span>
              <span />
            </div>
            <ol className="mt-1 lg:mt-0">
              {shop.map((v, i) => (
                <ShopRow key={v.box.slug} gameSlug={gameSlug} view={v} first={i === 0} best={v === best} />
              ))}
            </ol>
            {best?.ev && (
              <ValueCallout tone="blue" icon={CurrencyDollarIcon} title={bestCallout(ctx, best, shop.length).title} className="mt-5">
                {bestCallout(ctx, best, shop.length).body}
              </ValueCallout>
            )}
          </div>
        </section>

        {/* 2 · How the odds work — the tier ladder, then the honest notes. */}
        {standard && (
          <section aria-labelledby="how-odds-work" className={cn(VALUE_SURFACE, 'relative isolate overflow-hidden')}>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-10"
              style={{ background: `radial-gradient(50% 60% at 0% 0%, rgba(${godlyRgb},0.08) 0%, transparent 70%)` }}
            />
            <div className="p-5 sm:p-8">
              <WaySectionHead id="how-odds-work" n={2} title={oddsHeading(ctx)} tone="neutral" as="h2" />
              <p className="mt-4 text-body leading-7 text-text-secondary">
                <strong className="font-semibold text-text-primary">{oddsLead(ctx).strong}</strong> {oddsLead(ctx).rest}
              </p>
              <ol className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
                {ladderSteps(standard).map((s) => {
                  const rgb = hexRgb(rarityMeta(gameSlug, s.rarity).color)
                  const Icon = TIER_ICON[s.rarity] ?? SwordIcon
                  return (
                    <li key={s.rarity} className="flex items-start gap-3">
                      <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-md" style={{ background: `rgba(${rgb},0.14)`, color: `rgb(${rgb})` }}>
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
              {/* One callout per section (owner rule): the odds notes share a
                  single yellow box, one short line each. */}
              {notes.length > 0 && (
                <ValueCallout tone="yellow" icon={LightbulbIcon} title="Odds Notes" className="mt-5">
                  {notes.map((n) => (
                    <span key={n.title} className="block">
                      <span className="font-semibold">{n.title}</span>
                      {` · ${n.body}`}
                    </span>
                  ))}
                </ValueCallout>
              )}
            </div>
          </section>
        )}

        {/* 3 · Retired boxes — one surface, compact rows grouped by year. */}
        {groups.length > 0 && (
          <section aria-labelledby="retired-boxes" className={VALUE_SURFACE}>
            <div className="p-5 sm:p-8">
              <WaySectionHead id="retired-boxes" n={3} title={retiredHeading(ctx, retired.length)} tone="neutral" muted as="h2" />
              <p className="mt-4 text-body leading-7 text-text-secondary">{retiredLead()}</p>
              <div className="mt-6 gap-x-10 lg:columns-2">
                {groups.map((g) => (
                  <div key={g.key} className="mb-6 break-inside-avoid">
                    <h3 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-text-tertiary">{g.label}</h3>
                    <ol className="mt-1">
                      {g.views.map((v, i) => (
                        <RetiredRow
                          key={v.box.slug}
                          gameSlug={gameSlug}
                          view={v}
                          first={i === 0}
                          event={v.box.eventSlug && eventNames.has(v.box.eventSlug) ? { slug: v.box.eventSlug, name: eventNames.get(v.box.eventSlug)! } : null}
                        />
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <HubFaqSection
          title="Frequently Asked Questions"
          subtitle={`${ctx.gameName} box odds, prices and spins, answered from the game's own figures.`}
          items={qa}
        />

        <nav aria-label={`More ${ctx.gameName} guides`} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {hasHubPage(gameSlug, 'chromas') && (
            <CrossLink href={`/${gameSlug}/chromas`} label="Every Chroma vs Its Normal Version" title={`${ctx.shortName} Chroma Values`} />
          )}
          {hasHubPage(gameSlug, 'freeItems') && (
            <CrossLink href={`/${gameSlug}/free-items`} label="Every Real Free Way" title={`Free ${ctx.shortName} Items`} />
          )}
          {hasHubPage(gameSlug, 'events') && (
            <CrossLink href={`/${gameSlug}/events`} label="Where Event Boxes Came From" title={`${ctx.shortName} Events`} />
          )}
          <CrossLink href={`/${gameSlug}/values`} label="Every Item's Price" title={`${ctx.shortName} Value List`} />
        </nav>

        <HubCtaBand
          gameSlug={gameSlug}
          bgSrc={ctaBg}
          title={`Skip ~${fmtDraws(expectedDraws(o.godlyPct))} Spins: Buy ${ctx.shortName} Godlies`}
          body={HUB_COPY.safedrop}
          ctaLabel={`Buy ${ctx.shortName} Godlies`}
          ctaHref={buyHref}
        />
      </div>
    </>
  )
}

/** Art in a rarity-glow tile. */
function ArtTile({ src, alt, rgb, size }: { src: string | null; alt: string; rgb: string; size: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-md"
      style={{ width: size, height: size, background: `radial-gradient(closest-side, rgba(${rgb},0.30), rgba(${rgb},0.06) 70%, rgba(255,255,255,0.03))` }}
    >
      <ValueArt src={src} alt={alt} size={Math.round(size * 0.8)} />
    </span>
  )
}

/** "Gemstone · $0.57" (one cell of a Shop row). */
function ItemCell({ label, name, price, color }: { label: string; name: string | null; price: string; color: string }) {
  return (
    <span className="min-w-0">
      <span className={cn(VALUE_LABEL, 'block lg:hidden')}>{label}</span>
      <span className="block truncate text-[14px] font-medium leading-5" style={{ color }}>
        {name ?? '—'}
      </span>
      <span className="block text-[12.5px] leading-5 tabular-nums text-text-secondary">{price}</span>
    </span>
  )
}

/** One item's price, or "From $X" over a tier of several (Mystery Box 2, the Common Egg's pets). */
function tierPrice(v: BoxView, rarity: 'Godly' | 'Chroma'): string {
  const prices = v.items.filter((i) => i.rarity === rarity && i.cheapestUsd != null).map((i) => i.cheapestUsd!)
  const n = v.items.filter((i) => i.rarity === rarity).length
  if (prices.length === 0) return 'No Price Yet'
  return n > 1 ? `From ${usd(Math.min(...prices))}` : usd(prices[0])
}

function ShopRow({ gameSlug, view: v, first, best }: { gameSlug: string; view: BoxView; first: boolean; best: boolean }) {
  const godlyColor = rarityMeta(gameSlug, 'Godly').color
  const chromaColor = rarityMeta(gameSlug, 'Chroma').color
  const rgb = hexRgb(godlyColor)
  const egg = v.box.kind === 'egg'
  const godlyName = egg ? `${v.box.godlies.length} Fire Pets` : v.box.godlies.length > 1 ? v.box.godlies.map((g) => g.name).join(' + ') : v.godly?.name ?? null
  const chromaName = egg ? `${v.box.chromas.length} Chroma Fire Pets` : v.box.chromas.length > 1 ? `${v.box.chromas.length} Chromas` : v.chroma?.name ?? null
  return (
    <li>
      <Link
        href={`/${gameSlug}/boxes/${v.box.slug}`}
        className={cn(
          'group grid grid-cols-[minmax(0,1fr)_20px] items-center gap-x-4 gap-y-3 rounded-sm py-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring',
          'lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_112px_20px] lg:gap-x-5',
          !first && 'border-t border-white/[0.07]',
        )}
      >
        <div className="flex min-w-0 items-center gap-3.5">
          <ArtTile src={v.art} alt={`${v.box.name} ${egg ? 'Godly pet' : 'Godly'}`} rgb={rgb} size={52} />
          <div className="min-w-0">
            <h3 className="truncate text-[16px] font-semibold leading-6 text-text-primary group-hover:underline group-hover:underline-offset-2">
              {v.box.name}
            </h3>
            <span className="block truncate text-[12.5px] leading-5 tabular-nums text-text-secondary">{priceLine(v.box.prices)}</span>
          </div>
        </div>
        <CaretRightIcon
          aria-hidden
          size={18}
          weight="bold"
          className="col-start-2 row-start-1 text-text-tertiary transition-transform group-hover:translate-x-0.5 group-hover:text-text-primary lg:col-start-5"
        />
        <span className="col-span-2 grid grid-cols-3 gap-x-4 lg:contents">
          <ItemCell label="Godly" name={godlyName} price={tierPrice(v, 'Godly')} color={godlyColor} />
          <ItemCell label="Chroma" name={chromaName} price={tierPrice(v, 'Chroma')} color={chromaColor} />
          <span className="min-w-0 text-left lg:col-start-4 lg:row-start-1 lg:text-right">
            <span className={cn(VALUE_LABEL, 'block lg:hidden')}>Value Per Spin</span>
            <span className={cn('block text-[16px] font-bold leading-5 tabular-nums', best ? 'text-[#8BBDFB]' : 'text-text-primary')}>
              {v.ev ? approxUsd(v.ev.usd) : '—'}
            </span>
          </span>
        </span>
      </Link>
    </li>
  )
}

function RetiredRow({
  gameSlug,
  view: v,
  first,
  event,
}: {
  gameSlug: string
  view: BoxView
  first: boolean
  event: { slug: string; name: string } | null
}) {
  const rgb = hexRgb(rarityMeta(gameSlug, v.godly ? 'Godly' : 'Legendary').color)
  const when = dateRange(v.box.released, v.box.retired)
  const top = v.godly
  return (
    <li className={cn('flex items-center gap-3 py-2.5', !first && 'border-t border-white/[0.07]')}>
      <Link
        href={`/${gameSlug}/boxes/${v.box.slug}`}
        className="group flex min-w-0 flex-1 items-center gap-3 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      >
        <ArtTile src={v.art} alt={`${v.box.name} ${top ? top.name : 'items'}`} rgb={rgb} size={40} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold leading-5 text-text-primary group-hover:underline group-hover:underline-offset-2">
            {v.box.name}
          </span>
          <span className="block truncate text-[12.5px] leading-5 tabular-nums text-text-secondary">
            {top ? `${top.name}${top.cheapestUsd != null ? ` · ${usd(top.cheapestUsd)}` : ''}` : `${v.box.items.length} Items`}
            {when ? <span className="text-text-tertiary"> · {when}</span> : null}
          </span>
        </span>
      </Link>
      {event && (
        <Link
          href={`/${gameSlug}/events/${event.slug}`}
          title={`${event.name} event`}
          className="inline-flex shrink-0 items-center gap-1 rounded-sm text-[12.5px] font-medium text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          <CalendarStarIcon aria-hidden size={15} weight="duotone" className="text-text-tertiary" />
          <span className="max-sm:sr-only">{event.name}</span>
        </Link>
      )}
    </li>
  )
}

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
