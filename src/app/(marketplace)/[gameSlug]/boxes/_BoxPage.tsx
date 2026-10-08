import { Suspense, type ComponentType } from 'react'
import type { IconProps } from '@phosphor-icons/react'
import Link from '@/components/navigation/AppLink'
import { CalendarBlankIcon } from '@phosphor-icons/react/dist/ssr/CalendarBlank'
import { CalendarStarIcon } from '@phosphor-icons/react/dist/ssr/CalendarStar'
import { CaretLeftIcon } from '@phosphor-icons/react/dist/ssr/CaretLeft'
import { CaretRightIcon } from '@phosphor-icons/react/dist/ssr/CaretRight'
import { CoinsIcon } from '@phosphor-icons/react/dist/ssr/Coins'
import { CurrencyDollarIcon } from '@phosphor-icons/react/dist/ssr/CurrencyDollar'
import { DiamondIcon } from '@phosphor-icons/react/dist/ssr/Diamond'
import { HourglassMediumIcon } from '@phosphor-icons/react/dist/ssr/HourglassMedium'
import { LightbulbIcon } from '@phosphor-icons/react/dist/ssr/Lightbulb'
import { LightningIcon } from '@phosphor-icons/react/dist/ssr/Lightning'
import { ShoppingCartIcon } from '@phosphor-icons/react/dist/ssr/ShoppingCart'
import { SparkleIcon } from '@phosphor-icons/react/dist/ssr/Sparkle'
import { StorefrontIcon } from '@phosphor-icons/react/dist/ssr/Storefront'
import { SwordIcon } from '@phosphor-icons/react/dist/ssr/Sword'
import { JsonLd, breadcrumbList, faqPage, itemList } from '@/lib/seo/jsonld'
import { GameHeroBackdrop } from '@/components/marketplace/GameHeroBackdrop'
import { HubNav } from '@/components/content/HubNav'
import { HubFooter } from '@/components/content/HubFooter'
import { HubFaqSection } from '@/components/content/HubFaqSection'
import { HubCtaBand } from '@/components/content/HubCtaBand'
import { BuyButtonFace } from '@/components/marketplace/BuyButton'
import { SimilarItemsRail } from '@/components/values/SimilarItemsRail'
import { ValueCallout } from '@/components/values/ValueCallout'
import { PriceStatPair, RarityLabel, ValueCard } from '@/components/values/ValueCard'
import { HUB_GROUND, VALUE_LABEL, VALUE_SURFACE, VALUE_SURFACE_LINK } from '@/components/values/styles'
import { HUB_COPY, getGameContentTheme, hasHubPage } from '@/lib/content/theme'
import { getHubNavData, HUB_NAV_CLEAR } from '@/lib/content/hubNav'
import { getGameCtaImage } from '@/lib/content/game-cta-art.server'
import { getValueItemListings } from '@/lib/value-listings/stock-server'
import { itemBuyHref } from '@/lib/value-listings/buy-state'
import { valueListHub } from '@/lib/values/hub-config'
import { rarityMeta } from '@/lib/values/rarity'
import { hexRgb } from '@/lib/values/events-model'
import { expectedDraws, fmtDraws } from '@/lib/values/box-odds'
import type { BoxItemView, BoxView, MmBox } from '@/lib/values/boxes'
import { cn } from '@/lib/utils'
import { WaySectionHead } from '../values/_generic/WaySectionHead'
import { WAY_STEP_COLS } from '../values/_generic/ValueItemHowToGet'
import {
  boxAnswer,
  boxFacts,
  boxFaq,
  boxH1,
  boxSubline,
  buyRow,
  chanceCell,
  eachItemCell,
  endedRow,
  evCallout,
  itemOddsLine,
  itemsHeading,
  oddsTableHeading,
  oddsTableNote,
  relatedTitle,
  retiredCallout,
  unboxRow,
  usd,
  type CopyCtx,
  type MathStep,
  type ShopOdds,
} from './_boxesCopy'
import { boxesCopyCtx, loadBoxes, shopOddsFor } from './_boxesData'
import { BoxPageSkeleton } from './_BoxesSkeleton'

/**
 * /[game]/boxes/[boxSlug] — one box: H1 = the search ("MM2 Knife Box 4:
 * Drop Rates and Every Item Inside"), then 1 the overview (answer · facts ·
 * the value-per-spin or no-longer-in-the-Shop callout), 2 the odds table by
 * rarity (chance, items, each item's chance), 3 every item on the shared
 * ValueCard (live price, rarity, per-item odds), 4 Spin or Buy in the item
 * page's How To Get pattern (the maths: value per spin, ~spins and the
 * 50%-by figure; then Buy <Godly> Instead), the related-box rail, the FAQ.
 *
 * Plain maths: no reel, no "chance to win". The route gates on the box seed
 * before rendering (a real 404); the body streams behind a skeleton that
 * mirrors it.
 */

const GREEN = '63,217,134'
const MONEY = '#54DDBE'

const FACT_ICONS_SHOP: ComponentType<IconProps>[] = [CoinsIcon, SparkleIcon, DiamondIcon, CurrencyDollarIcon]
const FACT_ICONS_RETIRED: ComponentType<IconProps>[] = [CoinsIcon, CalendarBlankIcon, SparkleIcon, SwordIcon]
const MATH_ICON: Record<MathStep['icon'], ComponentType<IconProps>> = {
  coins: CoinsIcon,
  value: CurrencyDollarIcon,
  godly: SparkleIcon,
  chroma: DiamondIcon,
}
const BUY_ICON = { store: StorefrontIcon, cart: ShoppingCartIcon, bolt: LightningIcon } as const

export default async function BoxPage({ gameSlug, box }: { gameSlug: string; box: MmBox }) {
  const theme = getGameContentTheme(gameSlug)
  const ctx = boxesCopyCtx(gameSlug)
  const hubNav = await getHubNavData(gameSlug)
  const o = shopOddsFor(gameSlug)!
  const path = `/${gameSlug}/boxes/${box.slug}`

  return (
    <main className={`relative min-h-screen ${HUB_GROUND}`}>
      <JsonLd
        data={breadcrumbList([
          { name: 'Home', path: '/' },
          { name: theme.name, path: `/${gameSlug}` },
          { name: 'Box Odds', path: `/${gameSlug}/boxes` },
          { name: box.name, path },
        ])}
      />

      <GameHeroBackdrop gameSlug={gameSlug} size="hub">
        <HubNav data={hubNav} />

        <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${HUB_NAV_CLEAR}`}>
          <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-1.5 text-caption text-text-tertiary">
            <Link href={`/${gameSlug}/boxes`} className="transition-colors hover:text-text-primary">
              Box Odds
            </Link>
            <CaretRightIcon aria-hidden size={12} weight="bold" className="text-text-disabled" />
            <span>{box.inShop ? 'In the Shop' : 'Retired'}</span>
            <CaretRightIcon aria-hidden size={12} weight="bold" className="text-text-disabled" />
            <span className="truncate text-text-primary">{box.name}</span>
          </nav>
          <h1 className="text-balance text-[30px] font-bold leading-[1.08] tracking-[-0.03em] text-text-primary sm:text-display">
            {boxH1(ctx, box)}
          </h1>
          <p className="mt-3 text-body leading-7 text-text-secondary">{boxSubline(ctx, box)}</p>
        </div>

        <Suspense fallback={<BoxPageSkeleton />}>
          <BoxBody gameSlug={gameSlug} slug={box.slug} ctx={ctx} o={o} itemsHref={hubNav.itemsHref ?? `/${gameSlug}`} />
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

/** The Godly's own listings page when DropMarket has it in stock, else the game's items page. */
async function buyTarget(gameSlug: string, slug: string | null | undefined, itemsHref: string): Promise<string> {
  if (!slug) return itemsHref
  const listings = await getValueItemListings(gameSlug, slug)
  if (!listings || !listings.rows.some((r) => r.value_item_slug === slug)) return itemsHref
  return itemBuyHref({ gameSlug, categorySlug: listings.pair.categorySlug, itemSlug: slug })
}

async function BoxBody({
  gameSlug,
  slug,
  ctx,
  o,
  itemsHref,
}: {
  gameSlug: string
  slug: string
  ctx: CopyCtx
  o: ShopOdds
  itemsHref: string
}) {
  const [{ views, eventNames }, ctaBg] = await Promise.all([loadBoxes(gameSlug), getGameCtaImage(gameSlug)])
  const v = views.find((x) => x.box.slug === slug)
  if (!v) return null
  const b = v.box
  const buy = buyRow(ctx, v)
  const buyHref = await buyTarget(gameSlug, v.cheapestGodly?.slug, itemsHref)
  const eventName = b.eventSlug ? eventNames.get(b.eventSlug) ?? null : null
  const eventHref = eventName ? `/${gameSlug}/events/${b.eventSlug}` : null
  const answer = boxAnswer(ctx, v, eventName)
  const facts = boxFacts(v, o.coinsPerRound)
  const overviewCallout = b.inShop ? evCallout(v) : retiredCallout(ctx, v, eventName)
  const note = oddsTableNote(b)
  const unbox = unboxRow(v, o.coinsPerRound)
  const ended = endedRow(ctx, v, eventName)
  const faq = boxFaq(ctx, v, eventName, o)
  const godlyRgb = hexRgb(rarityMeta(gameSlug, v.godly ? 'Godly' : 'Legendary').color)
  const paged = v.items.filter((i) => i.href)
  const hub = valueListHub(gameSlug)

  // Related: the other Shop boxes for a Shop box; for a retired one the same
  // season's boxes first (Halloween → Halloween), then the newest retired.
  const season = (x: MmBox) => x.slug.replace(/-box.*$/, '')
  const others = views.filter((x) => x.box.slug !== b.slug && x.art)
  const related = b.inShop
    ? others.filter((x) => x.box.inShop)
    : [...others.filter((x) => !x.box.inShop && season(x.box) === season(b)), ...others.filter((x) => !x.box.inShop && season(x.box) !== season(b))].slice(0, 12)

  return (
    <>
      <JsonLd data={faqPage(faq)} />
      {paged.length > 0 && <JsonLd data={itemList(paged.map((i) => ({ name: i.name, path: i.href! })))} />}

      <div className="mx-auto w-full max-w-7xl space-y-12 px-4 pb-10 pt-6 sm:px-6 lg:px-8">
        {/* 1 · Overview: answer · facts · one callout — ONE surface. */}
        <section aria-label={`${b.name} at a glance`} className={cn(VALUE_SURFACE, 'relative isolate overflow-hidden')}>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background: `radial-gradient(60% 80% at 100% 0%, rgba(${godlyRgb},0.16) 0%, rgba(${godlyRgb},0.05) 45%, transparent 75%), radial-gradient(40% 60% at 0% 100%, rgba(${godlyRgb},0.05) 0%, transparent 70%)`,
            }}
          />
          {v.art && (
            // eslint-disable-next-line @next/next/no-img-element -- catalogue art, served as-is
            <img
              src={v.art}
              alt={`${v.box.name} artwork`}
              aria-hidden
              loading="lazy"
              decoding="async"
              className="pointer-events-none absolute -right-10 -top-12 -z-10 h-[300px] w-[300px] rotate-[-14deg] object-contain opacity-[0.07] blur-[1px] max-sm:hidden"
            />
          )}
          <div className="p-5 sm:p-8">
            <div className="flex items-start gap-4">
              {v.art && (
                <div
                  className="relative hidden h-[72px] w-[72px] shrink-0 place-items-center rounded-lg sm:grid"
                  style={{ background: `radial-gradient(closest-side, rgba(${godlyRgb},0.28), rgba(${godlyRgb},0.06) 70%, rgba(255,255,255,0.03))` }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- catalogue art, served as-is */}
                  <img
                    src={v.art}
                    alt={v.godly ? `${v.godly.name}, the Godly in ${b.name}` : b.name}
                    loading="lazy"
                    decoding="async"
                    className="h-[56px] w-[56px] object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,0.55)]"
                  />
                </div>
              )}
              <p className="min-w-0 text-body leading-7 text-text-secondary">
                <strong className="font-semibold text-text-primary">{answer.strong}</strong> {answer.rest}
                {eventHref && (
                  <>
                    {' '}
                    <Link href={eventHref} className="font-medium text-text-primary underline decoration-white/30 underline-offset-2 hover:decoration-white">
                      See the {eventName} event
                    </Link>
                    .
                  </>
                )}
              </p>
            </div>

            <dl className={cn('mt-7 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-white/[0.07] pt-6', WAY_STEP_COLS[facts.length])}>
              {facts.map((f, i) => {
                const Icon = (b.inShop ? FACT_ICONS_SHOP : FACT_ICONS_RETIRED)[i] ?? SwordIcon
                return (
                  <div key={f.label} className="flex min-w-0 items-start gap-3">
                    <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-white/[0.07] text-text-primary">
                      <Icon size={18} weight="duotone" />
                    </span>
                    <div className="min-w-0">
                      <dt className={VALUE_LABEL}>{f.label}</dt>
                      <dd className="text-[15px] font-semibold leading-6 tabular-nums text-text-primary">{f.value}</dd>
                    </div>
                  </div>
                )
              })}
            </dl>

            {overviewCallout && (
              <ValueCallout
                tone={b.inShop ? 'blue' : 'yellow'}
                icon={b.inShop ? CurrencyDollarIcon : LightbulbIcon}
                title={overviewCallout.title}
                className="mt-6"
              >
                {overviewCallout.body}
              </ValueCallout>
            )}
          </div>
        </section>

        {/* 2 · The odds table by rarity. */}
        <section aria-labelledby="box-odds" className={VALUE_SURFACE}>
          <div className="p-5 sm:p-8">
            <h2 id="box-odds" className="text-heading font-bold tracking-tight text-text-primary">
              {oddsTableHeading(b)}
            </h2>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-white/[0.07]">
                    <th scope="col" className={cn(VALUE_LABEL, 'pb-2 pr-4 font-medium')}>Rarity</th>
                    <th scope="col" className={cn(VALUE_LABEL, 'pb-2 pr-4 font-medium')}>Chance</th>
                    <th scope="col" className={cn(VALUE_LABEL, 'pb-2 pr-4 font-medium')}>{b.kind === 'egg' ? 'Pets' : 'Items'} in the Tier</th>
                    <th scope="col" className={cn(VALUE_LABEL, 'pb-2 text-right font-medium')}>Each {b.kind === 'egg' ? 'Pet' : 'Item'}</th>
                  </tr>
                </thead>
                <tbody>
                  {[...b.tiers].reverse().map((t, i) => {
                    const meta = rarityMeta(gameSlug, t.rarity)
                    return (
                      <tr key={t.rarity} className={cn(i > 0 && 'border-t border-white/[0.07]')}>
                        <th scope="row" className="py-3 pr-4 align-top">
                          <span className="inline-flex items-center gap-2 text-[14px] font-semibold" style={{ color: meta.color }}>
                            <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: meta.color }} />
                            {meta.label}
                          </span>
                        </th>
                        <td className="py-3 pr-4 align-top text-[15px] font-bold tabular-nums text-text-primary">{chanceCell(t, b.oddsUsable)}</td>
                        <td className="py-3 pr-4 align-top text-[13.5px] leading-5 text-text-secondary">
                          <span className="font-semibold tabular-nums text-text-primary">{t.items.length}</span> · {t.items.map((x) => x.name).join(', ')}
                        </td>
                        <td className="py-3 text-right align-top text-[14px] font-semibold tabular-nums text-text-primary">{eachItemCell(t)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {note && (
              <ValueCallout tone="yellow" icon={LightbulbIcon} title={note.title} className="mt-5">
                {note.body}
              </ValueCallout>
            )}
          </div>
        </section>

        {/* 3 · Every item on the shared ValueCard. */}
        <section aria-labelledby="box-items">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="box-items" className="text-heading font-bold tracking-tight text-text-primary">
              {itemsHeading(b)}
            </h2>
            <span className="shrink-0 text-[13px] font-medium tabular-nums text-text-tertiary">{b.items.length} Items</span>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-6">
            {v.items.map((i, n) => (
              <BoxItemCard key={`${i.slug ?? i.name}-${n}`} gameSlug={gameSlug} item={i} box={b} ctx={ctx} typeLabel={hub?.itemTypeLabels[i.type] ?? null} />
            ))}
          </div>
        </section>

        {/* 4 · Spin or Buy — one surface, two numbered rows (How To Get pattern). */}
        {(unbox || ended || buy) && (
          <section aria-label={`Spin ${b.name} or buy its Godly`} className={cn(VALUE_SURFACE, 'relative isolate overflow-hidden')}>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-10"
              style={{ background: `radial-gradient(50% 60% at 0% 0%, rgba(${godlyRgb},0.10) 0%, transparent 70%), radial-gradient(40% 50% at 100% 100%, rgba(${GREEN},0.06) 0%, transparent 70%)` }}
            />
            <div className="p-5 sm:p-8">
              {unbox && (
                <>
                  <WaySectionHead n={1} title={unbox.heading} tone="neutral" as="h2" />
                  <Steps steps={unbox.steps.map((s) => ({ key: s.icon, icon: MATH_ICON[s.icon], title: s.title, value: s.value }))} />
                  {unbox.total && (
                    <ValueCallout tone="blue" icon={HourglassMediumIcon} title={unbox.total.title} className="mt-5">
                      {unbox.total.body}
                    </ValueCallout>
                  )}
                </>
              )}
              {ended && (
                <>
                  <WaySectionHead n={1} title={ended.heading} tone="neutral" muted as="h2" />
                  <p className="mt-6 text-body leading-7 text-text-secondary">{ended.body}</p>
                  {eventHref && (
                    <Link
                      href={eventHref}
                      className="group mt-3 inline-flex items-center gap-1.5 rounded-sm text-body-sm font-medium text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                    >
                      <CalendarStarIcon aria-hidden size={16} weight="duotone" className="text-text-tertiary group-hover:text-text-primary" />
                      Every {eventName} Item and Its Value
                      <CaretRightIcon aria-hidden size={12} weight="bold" className="text-text-tertiary transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  )}
                </>
              )}
              {buy && (
                <div className={unbox || ended ? 'mt-7 border-t border-white/[0.07] pt-6' : ''}>
                  <WaySectionHead n={unbox || ended ? 2 : 1} title={buy.heading} tone="green" as="h2" />
                  <div className="mt-6 flex flex-col gap-5 lg:flex-row lg:items-center lg:gap-8">
                    <Steps flush tint={GREEN} steps={buy.steps.map((s) => ({ key: s.icon, icon: BUY_ICON[s.icon], title: s.title, value: s.value }))} />
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
        )}

        {related.length > 0 && (
          <SimilarItemsRail
            title={relatedTitle(ctx, b)}
            seeAllHref={`/${gameSlug}/boxes`}
            itemNoun="boxes"
            className="border-t border-white/[0.07] pt-10"
            items={related.map((x) => ({
              key: x.box.slug,
              href: `/${gameSlug}/boxes/${x.box.slug}`,
              name: x.box.name,
              imageSrc: x.art,
              imageAlt: `${ctx.shortName} ${x.box.name}`,
              price: x.ev ? `≈ ${usd(x.ev.usd)} a Spin` : x.godly ? x.godly.name : `${x.box.items.length} Items`,
            }))}
          />
        )}

        <HubFaqSection title="Frequently Asked Questions" subtitle={`${b.name} odds, items and prices in ${ctx.gameName}.`} items={faq} />

        <nav aria-label={`More ${ctx.gameName} box guides`} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Link
            href={`/${gameSlug}/boxes`}
            className={`${VALUE_SURFACE_LINK} group flex items-center gap-3 px-5 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring`}
          >
            <CaretLeftIcon aria-hidden size={20} weight="bold" className="shrink-0 text-text-tertiary transition-transform group-hover:-translate-x-0.5 group-hover:text-text-primary" />
            <span>
              <span className={`block ${VALUE_LABEL}`}>Back to</span>
              <span className="block text-body-sm font-semibold text-text-primary">All {ctx.shortName} Box Odds</span>
            </span>
          </Link>
          {hasHubPage(gameSlug, 'chromas') && (
            <CrossLink href={`/${gameSlug}/chromas`} label="Every Chroma's Price" title={`${ctx.shortName} Chroma Values`} />
          )}
          <CrossLink href={`/${gameSlug}/values`} label="Every Item's Price" title={`${ctx.shortName} Value List`} />
        </nav>

        <HubCtaBand
          gameSlug={gameSlug}
          bgSrc={ctaBg}
          title={ctaTitle(v)}
          body={HUB_COPY.safedrop}
          ctaLabel={buy?.cta ?? `Buy ${ctx.shortName} Items`}
          ctaHref={buyHref}
        />
      </div>
    </>
  )
}

function ctaTitle(v: BoxView): string {
  const g = v.cheapestGodly
  if (!g) return `Get ${v.box.name} Items Without the Spins`
  const p = v.box.inShop ? v.box.tiers.find((t) => t.rarity === 'Godly')?.pct : null
  return p ? `Skip ~${fmtDraws(expectedDraws(p))} Spins: Buy ${g.name}` : `Missed ${v.box.name}? Buy ${g.name}`
}

/** One item: type · rarity → art + name → its chance in this box → Cheapest / Market. */
function BoxItemCard({
  gameSlug,
  item,
  box,
  ctx,
  typeLabel,
}: {
  gameSlug: string
  item: BoxItemView
  box: MmBox
  ctx: CopyCtx
  typeLabel: string | null
}) {
  const rarity = rarityMeta(gameSlug, item.rarity)
  const priced = item.cheapestUsd != null
  return (
    <ValueCard
      href={item.href}
      headerLeft={typeLabel ? <span className="truncate text-[11px] font-medium text-text-tertiary">{typeLabel}</span> : undefined}
      headerRight={<RarityLabel label={rarity.label} color={rarity.color} />}
      imageSrc={item.imageUrl}
      imageAlt={`${item.name}${typeLabel ? ` ${typeLabel.toLowerCase()}` : ''} from the ${ctx.shortName} ${box.name}`}
      name={item.name}
      sub={<span className="tabular-nums text-text-secondary">{itemOddsLine(item, box)}</span>}
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

/** Step tiles: icon in a tinted tile + title + one value line, one line on desktop. */
function Steps({
  steps,
  tint,
  flush = false,
}: {
  steps: { key: string; icon: ComponentType<IconProps>; title: string; value: string }[]
  tint?: string
  flush?: boolean
}) {
  return (
    <ol className={cn('grid min-w-0 flex-1 grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2', WAY_STEP_COLS[Math.min(steps.length, 5)], !flush && 'mt-6')}>
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
