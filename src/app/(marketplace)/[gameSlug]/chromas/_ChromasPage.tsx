import { Suspense, cache, type ComponentType } from 'react'
import type { IconProps } from '@phosphor-icons/react'
import Link from '@/components/navigation/AppLink'
import { ArrowsClockwiseIcon } from '@phosphor-icons/react/dist/ssr/ArrowsClockwise'
import { CaretRightIcon } from '@phosphor-icons/react/dist/ssr/CaretRight'
import { CoinsIcon } from '@phosphor-icons/react/dist/ssr/Coins'
import { EggIcon } from '@phosphor-icons/react/dist/ssr/Egg'
import { HourglassMediumIcon } from '@phosphor-icons/react/dist/ssr/HourglassMedium'
import { LightningIcon } from '@phosphor-icons/react/dist/ssr/Lightning'
import { PackageIcon } from '@phosphor-icons/react/dist/ssr/Package'
import { ShieldCheckIcon } from '@phosphor-icons/react/dist/ssr/ShieldCheck'
import { SwordIcon } from '@phosphor-icons/react/dist/ssr/Sword'
import { TrendDownIcon } from '@phosphor-icons/react/dist/ssr/TrendDown'
import { TrendUpIcon } from '@phosphor-icons/react/dist/ssr/TrendUp'
import { WarningCircleIcon } from '@phosphor-icons/react/dist/ssr/WarningCircle'
import { ChartBarIcon } from '@phosphor-icons/react/dist/ssr/ChartBar'
import { JsonLd, breadcrumbList, faqPage, itemList } from '@/lib/seo/jsonld'
import { GameHeroBackdrop } from '@/components/marketplace/GameHeroBackdrop'
import { HubNav } from '@/components/content/HubNav'
import { HubFooter } from '@/components/content/HubFooter'
import { HubHero } from '@/components/content/HubHero'
import { HubFaqSection } from '@/components/content/HubFaqSection'
import { HubCtaBand } from '@/components/content/HubCtaBand'
import { BuyButtonFace } from '@/components/marketplace/BuyButton'
import { ValueArt } from '@/components/values/ValueArt'
import { ValueCallout } from '@/components/values/ValueCallout'
import { ValuesEmptyState } from '@/components/values/ValuesEmptyState'
import { HUB_GROUND, VALUE_LABEL, VALUE_SURFACE, VALUE_SURFACE_LINK } from '@/components/values/styles'
import { HUB_COPY, getGameContentTheme, hasHubPage } from '@/lib/content/theme'
import { getHubNavData } from '@/lib/content/hubNav'
import { getGameCtaImage } from '@/lib/content/game-cta-art.server'
import { getValueItems, type ValueItem } from '@/lib/values/data'
import { getValueItemEventMap } from '@/lib/values/events'
import { shopBoxes, sharedWeaponBoxOdds } from '@/lib/values/shop-boxes'
import { valueItemHasPage, valueListHub } from '@/lib/values/hub-config'
import { rarityMeta } from '@/lib/values/rarity'
import { hexRgb } from '@/lib/values/events-model'
import {
  CHROMA_BAR,
  chromaStats,
  fmtMultiple,
  multipleBarPct,
  multipleExtremes,
  resolveChromaSource,
  shopChromaSources,
  sortChromas,
  unboxMaths,
  type ChromaEntry,
  type MultiplePair,
  type UnboxMaths,
} from '@/lib/values/chromas'
import { cn } from '@/lib/utils'
import { WaySectionHead } from '../values/_generic/WaySectionHead'
import { HubLeadSkeleton } from '../events/_EventsSkeleton'
import {
  biggestHeading,
  buyWay,
  faq as chromaFaq,
  gridHeading,
  gridLead,
  lead,
  pageTitle,
  pairLine,
  smallestHeading,
  unboxWay,
  vsCallout,
  vsLead,
  vsTitle,
  worthLead,
  worthTitle,
  type BoxBuy,
  type CopyCtx,
  type WorthStep,
} from './_chromasCopy'
import { ChromaGrid } from './_ChromaGrid'
import { ChromasSkeleton } from './_ChromasSkeleton'

/**
 * /[game]/chromas — the MM2 Chroma hub. H1 = the search ("MM2 Chroma
 * Values …"); the lead answers it with live numbers (how many are priced,
 * the most expensive, the average multiple over the normal version, the box
 * odds). Then 1 every Chroma on the shared ValueCard (price, normal price,
 * ×N with a bar, source; filters + sorts through SearchParamsBridge), 2 "Is a
 * Chroma worth it?" in the item page's How To Get two-way pattern (unbox
 * maths vs buy), 3 Chroma vs normal (biggest and smallest multiples), the FAQ
 * (= FAQPage schema), cross-links and the CTA band.
 *
 * Every number is computed (lib/values/chromas + ./_chromasCopy, unit-tested)
 * from the tagged values reads (catalogue + prices, events) and the
 * researched Shop box seed, so the values-revalidate route refreshes the page
 * with the rest of the hub. The lead and body stream behind in-page Suspense
 * boundaries whose skeletons mirror them (no route loading.tsx: it would
 * flush a 200 before a page can 404).
 */

const GREEN = '63,217,134'

export function chromaCopyCtx(gameSlug: string): CopyCtx {
  const theme = getGameContentTheme(gameSlug)
  return { gameName: theme.name, shortName: valueListHub(gameSlug)?.shortName ?? theme.initials }
}

/**
 * The static facts the page needs (box odds, coin rate). Null → the route
 * 404s: without them the unbox maths would have nothing true to say.
 */
export function chromaUnboxMaths(gameSlug: string): UnboxMaths | null {
  const odds = sharedWeaponBoxOdds(gameSlug)
  const earn = valueListHub(gameSlug)?.earnRate
  if (!odds || !earn) return null
  const egg = shopBoxes(gameSlug).find((b) => b.kind === 'egg')
  // The egg's split only holds when its Chroma line is the same 0.004%.
  const eggPets = egg && egg.odds.chroma === odds.chroma ? egg.chromas.length : 0
  return unboxMaths(odds.chroma, odds.godly, earn.perRound, eggPets)
}

interface ChromaData {
  entries: ChromaEntry[]
  /** Shop box names whose per-Chroma rate is unconfirmed (Mystery Box 2). */
  unconfirmedBoxes: string[]
  topGodly: { name: string; usd: number } | null
}

/** One request's join of catalogue + prices + events + Shop boxes (shared by lead, body and metadata). */
export const loadChromas = cache(async (gameSlug: string): Promise<ChromaData> => {
  const [items, events] = await Promise.all([getValueItems(gameSlug, { kinds: ['item'] }), getValueItemEventMap(gameSlug)])
  const byId = new Map(items.map((i) => [i.id, i]))
  const boxes = shopBoxes(gameSlug)
  const shop = shopChromaSources(boxes)
  const hrefOf = (i: ValueItem) =>
    valueItemHasPage(gameSlug, { rarity: i.rarity, priced: i.price?.cheapestUsd != null }) ? `/${gameSlug}/values/${i.slug}` : null

  const entries: ChromaEntry[] = items
    .filter((i) => i.rarity === 'Chroma')
    .map((i) => {
      const b = i.baseItemId ? byId.get(i.baseItemId) ?? null : null
      return {
        slug: i.slug,
        name: i.name,
        itemType: i.itemType,
        imageUrl: i.imageUrl,
        cheapestUsd: i.price?.cheapestUsd ?? null,
        marketUsd: i.price?.averageUsd ?? null,
        href: hrefOf(i),
        base: b ? { slug: b.slug, name: b.name, cheapestUsd: b.price?.cheapestUsd ?? null, href: hrefOf(b) } : null,
        source: resolveChromaSource(i.slug, i.origin, shop, events),
      }
    })

  const godlies = items.filter((i) => i.rarity === 'Godly' && i.price?.cheapestUsd != null)
  const topGodly = godlies.sort((a, b) => b.price!.cheapestUsd! - a.price!.cheapestUsd!)[0] ?? null
  const unconfirmedBoxes = [...new Set([...shop.values()].filter((s) => s.oddsUnconfirmed).map((s) => s.boxName))]

  return {
    entries: sortChromas(entries, 'price'),
    unconfirmedBoxes,
    topGodly: topGodly ? { name: topGodly.name, usd: topGodly.price!.cheapestUsd! } : null,
  }
})

/** The cheapest priced Shop box Chromas (weapon / pet) and the range of all of them. */
function boxBuy(entries: ChromaEntry[]): BoxBuy {
  const priced = entries.filter((e) => (e.source.kind === 'box' || e.source.kind === 'egg') && e.cheapestUsd != null)
  const cheapest = (kind: 'box' | 'egg') => {
    const e = priced.filter((x) => x.source.kind === kind).sort((a, b) => a.cheapestUsd! - b.cheapestUsd!)[0]
    return e ? { name: e.name, usd: e.cheapestUsd! } : null
  }
  const prices = priced.map((e) => e.cheapestUsd!)
  return {
    weapon: cheapest('box'),
    pet: cheapest('egg'),
    range: prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : null,
  }
}

export default async function ChromasPage({ gameSlug }: { gameSlug: string }) {
  const theme = getGameContentTheme(gameSlug)
  const hubNav = await getHubNavData(gameSlug)
  const ctx = chromaCopyCtx(gameSlug)
  const u = chromaUnboxMaths(gameSlug)!
  const buyHref = hubNav.itemsHref ?? `/${gameSlug}`

  return (
    <main className={`relative min-h-screen ${HUB_GROUND}`}>
      <GameHeroBackdrop gameSlug={gameSlug} size="hub">
        <HubNav data={hubNav} />
        <JsonLd
          data={breadcrumbList([
            { name: 'Home', path: '/' },
            { name: theme.name, path: `/${gameSlug}` },
            { name: 'Chromas', path: `/${gameSlug}/chromas` },
          ])}
        />
        {/* The H1 ships in the first flush; the answer-first lead (live
            prices) and the body stream behind skeletons that mirror them. */}
        <section>
          <HubHero
            title={pageTitle(ctx)}
            lead={
              <Suspense fallback={<HubLeadSkeleton />}>
                <Lead gameSlug={gameSlug} ctx={ctx} u={u} />
              </Suspense>
            }
          />
        </section>

        <Suspense fallback={<ChromasSkeleton />}>
          <ChromasBody gameSlug={gameSlug} ctx={ctx} u={u} buyHref={buyHref} />
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

async function Lead({ gameSlug, ctx, u }: { gameSlug: string; ctx: CopyCtx; u: UnboxMaths }) {
  const { entries } = await loadChromas(gameSlug)
  if (entries.length === 0) return null
  const l = lead(ctx, chromaStats(entries), u)
  return (
    <>
      <strong className="font-semibold text-text-primary">{l.strong}</strong> {l.rest}
    </>
  )
}

const WORTH_ICON: Record<WorthStep['icon'], ComponentType<IconProps>> = {
  coins: CoinsIcon,
  box: PackageIcon,
  spin: ArrowsClockwiseIcon,
  rounds: HourglassMediumIcon,
  weapon: SwordIcon,
  pet: EggIcon,
  delivery: LightningIcon,
}

const STEP_COLS: Record<number, string> = { 1: 'lg:grid-cols-1', 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4' }

async function ChromasBody({ gameSlug, ctx, u, buyHref }: { gameSlug: string; ctx: CopyCtx; u: UnboxMaths; buyHref: string }) {
  const [{ entries, unconfirmedBoxes, topGodly }, ctaBg] = await Promise.all([loadChromas(gameSlug), getGameCtaImage(gameSlug)])
  if (entries.length === 0) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
        <ValuesEmptyState
          title="Chroma values are temporarily unavailable"
          body={`The ${ctx.gameName} Chroma list could not be loaded. Please check again shortly.`}
        />
      </div>
    )
  }

  const hub = valueListHub(gameSlug)
  const s = chromaStats(entries)
  const b = boxBuy(entries)
  const unbox = unboxWay(u, unconfirmedBoxes)
  const buy = buyWay(ctx, u, b)
  const worth = worthLead(u, b)
  const vs = vsLead(s)
  const vsNote = vsCallout(s)
  const { biggest, smallest } = multipleExtremes(entries, 5)
  const priced = entries.filter((e) => e.cheapestUsd != null)
  const cheapest = [...priced].sort((a, c) => a.cheapestUsd! - c.cheapestUsd!)[0] ?? null
  const qa = chromaFaq(ctx, s, u, b, {
    byPrice: priced,
    topGodly,
    cheapestChroma: cheapest ? { name: cheapest.name, usd: cheapest.cheapestUsd! } : null,
  })
  const linked = entries.filter((e) => e.href)
  const maxMultiple = s.biggest?.multiple ?? 1
  const chromaRgb = hexRgb(rarityMeta(gameSlug, 'Chroma').color)
  // Section 2's art: the priciest Chroma you can still unbox from a Shop box.
  const art = entries.find((e) => e.source.kind === 'box' && e.imageUrl) ?? null

  return (
    <>
      <JsonLd data={faqPage(qa)} />
      {linked.length > 0 && <JsonLd data={itemList(linked.map((e) => ({ name: e.name, path: e.href! })))} />}

      <div className="mx-auto w-full max-w-7xl space-y-12 px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        {/* 1. Every Chroma */}
        <section aria-labelledby="every-chroma">
          <h2 id="every-chroma" className="text-heading font-bold tracking-tight text-text-primary">
            {gridHeading(ctx, s)}
          </h2>
          <p className="mt-2 text-body-sm leading-6 text-text-secondary">{gridLead()}</p>
          <div className="mt-6">
            <ChromaGrid entries={entries} maxMultiple={maxMultiple} typeLabels={hub?.itemTypeLabels ?? {}} gameName={ctx.gameName} />
          </div>
        </section>

        {/* 2. Is a Chroma worth it — ONE surface, two numbered ways (How To Get pattern). */}
        <section aria-labelledby="chroma-worth" className={cn(VALUE_SURFACE, 'relative isolate overflow-hidden')}>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background: `radial-gradient(60% 70% at 100% 0%, rgba(${chromaRgb},0.16) 0%, rgba(${chromaRgb},0.05) 45%, transparent 75%), radial-gradient(40% 50% at 0% 100%, rgba(${GREEN},0.05) 0%, transparent 70%)`,
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
              className="pointer-events-none absolute -right-10 -top-12 -z-10 h-[300px] w-[300px] rotate-[-14deg] object-contain opacity-[0.07] blur-[1px] max-sm:hidden"
            />
          )}

          <div className="p-5 sm:p-8">
            <div className="flex items-center gap-4">
              {art?.imageUrl && (
                <div
                  className="relative hidden h-[72px] w-[72px] shrink-0 place-items-center rounded-lg sm:grid"
                  style={{ background: `radial-gradient(closest-side, rgba(${chromaRgb},0.28), rgba(${chromaRgb},0.06) 70%, rgba(255,255,255,0.03))` }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- catalogue art, served as-is */}
                  <img src={art.imageUrl} alt={art.name} loading="lazy" decoding="async" className="h-[56px] w-[56px] object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,0.55)]" />
                </div>
              )}
              <h2 id="chroma-worth" className="min-w-0 text-heading font-bold tracking-tight text-text-primary">
                {worthTitle(ctx)}
              </h2>
            </div>
            <p className="mt-4 text-body leading-7 text-text-secondary">
              <strong className="font-semibold text-text-primary">{worth.strong}</strong> {worth.rest}
            </p>

            <div className="mt-7 border-t border-white/[0.07] pt-6">
              <WaySectionHead n={1} title={unbox.heading} tone="neutral" />
              <Steps steps={unbox.steps} tone="neutral" />
              {hasHubPage(gameSlug, 'boxes') && (
                <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] leading-5">
                  <span className="font-medium text-text-tertiary">Odds by Box:</span>
                  {shopBoxes(gameSlug).map((box) => (
                    <Link
                      key={box.slug}
                      href={`/${gameSlug}/boxes/${box.slug}`}
                      className="rounded-sm font-medium text-text-secondary underline decoration-white/20 underline-offset-2 transition-colors hover:text-text-primary hover:decoration-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                    >
                      {box.name}
                    </Link>
                  ))}
                </p>
              )}
              {unbox.tip && (
                <ValueCallout tone="yellow" icon={WarningCircleIcon} title={unbox.tip.title} className="mt-5">
                  {unbox.tip.body}
                </ValueCallout>
              )}
            </div>

            <div className="mt-7 border-t border-white/[0.07] pt-6">
              <WaySectionHead n={2} title={buy.heading} tone="green" />
              <div className="mt-6 flex flex-col gap-5 lg:flex-row lg:items-center lg:gap-8">
                <div className="min-w-0 flex-1">
                  <Steps steps={buy.steps} tone="green" flush />
                </div>
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
          </div>
        </section>

        {/* 3. Chroma vs normal */}
        {biggest.length > 0 && (
          <section aria-labelledby="chroma-vs-normal" className={cn(VALUE_SURFACE, 'relative isolate overflow-hidden')}>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-10"
              style={{ background: `radial-gradient(50% 60% at 0% 0%, rgba(${chromaRgb},0.10) 0%, transparent 70%)` }}
            />
            <div className="p-5 sm:p-8">
              <h2 id="chroma-vs-normal" className="text-heading font-bold tracking-tight text-text-primary">
                {vsTitle(ctx)}
              </h2>
              {vs && (
                <p className="mt-4 text-body leading-7 text-text-secondary">
                  <strong className="font-semibold text-text-primary">{vs.strong}</strong> {vs.rest}
                </p>
              )}
              <div className="mt-6 grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-2">
                <PairList heading={biggestHeading()} icon={TrendUpIcon} pairs={biggest} max={maxMultiple} gameSlug={gameSlug} />
                <PairList heading={smallestHeading()} icon={TrendDownIcon} pairs={smallest} max={maxMultiple} gameSlug={gameSlug} />
              </div>
              {vsNote && (
                <ValueCallout tone="blue" icon={ChartBarIcon} title={vsNote.title} className="mt-6">
                  {vsNote.body}
                </ValueCallout>
              )}
            </div>
          </section>
        )}

        <HubFaqSection
          title="Frequently Asked Questions"
          subtitle={`Chroma prices, odds and how to get one in ${ctx.gameName}, answered from the data.`}
          items={qa}
        />

        <nav aria-label={`More ${ctx.gameName} guides`} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <CrossLink href={`/${gameSlug}/values`} label="Every Item's Price" title={`${ctx.shortName} Value List`} />
          {hasHubPage(gameSlug, 'freeItems') && (
            <CrossLink href={`/${gameSlug}/free-items`} label="Every Real Free Way" title={`Free ${ctx.shortName} Items`} />
          )}
          {hasHubPage(gameSlug, 'events') && (
            <CrossLink href={`/${gameSlug}/events`} label="Where Event Chromas Came From" title={`${ctx.shortName} Events`} />
          )}
        </nav>

        <HubCtaBand
          gameSlug={gameSlug}
          bgSrc={ctaBg}
          title={b.range ? `Skip ${fmtSpins(u)} Spins: Chromas From ${usdShort(b.range.min)}` : `Buy ${ctx.shortName} Chromas`}
          body={HUB_COPY.safedrop}
          ctaLabel={buy.cta}
          ctaHref={buyHref}
        />
      </div>
    </>
  )
}

const fmtSpins = (u: UnboxMaths) => Math.round(u.spins).toLocaleString('en-US')
const usdShort = (n: number) => `$${n.toFixed(2)}`

/** Steps across one line on desktop (2-up on tablets, stacked on phones). */
function Steps({ steps, tone, flush = false }: { steps: WorthStep[]; tone: 'neutral' | 'green'; flush?: boolean }) {
  return (
    <ol className={cn('grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2', STEP_COLS[steps.length], !flush && 'mt-6')}>
      {steps.map((step, i) => {
        const Icon = WORTH_ICON[step.icon]
        return (
          <li key={step.title} className="flex items-start gap-3">
            <span
              aria-hidden
              className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-md', tone === 'neutral' && 'bg-white/[0.07] text-text-primary')}
              style={tone === 'green' ? { background: `rgba(${GREEN},0.14)`, color: `rgb(${GREEN})` } : undefined}
            >
              <Icon size={18} weight="duotone" />
            </span>
            <div className="min-w-0">
              <p className="text-[14px] font-semibold leading-5 text-text-primary">
                <span className="sr-only">Step {i + 1}: </span>
                {step.title}
              </p>
              <p className="mt-0.5 text-[13px] leading-5 text-text-secondary">{step.value}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/** One column of Section 3: a toned head, then plain rows split by hairlines. */
function PairList({
  heading,
  icon: Icon,
  pairs,
  max,
  gameSlug,
}: {
  heading: string
  icon: ComponentType<IconProps>
  pairs: MultiplePair[]
  max: number
  gameSlug: string
}) {
  const rgb = hexRgb(rarityMeta(gameSlug, 'Chroma').color)
  return (
    <div className="min-w-0">
      <h3 className="flex items-center gap-2.5 text-[16px] font-semibold text-text-primary">
        <span aria-hidden className="grid h-8 w-8 place-items-center rounded-md" style={{ background: `rgba(${rgb},0.14)`, color: `rgb(${rgb})` }}>
          <Icon size={17} weight="duotone" />
        </span>
        {heading}
      </h3>
      <ol className="mt-3">
        {pairs.map((p, i) => (
          <PairRow key={p.entry.slug} pair={p} max={max} rgb={rgb} first={i === 0} />
        ))}
      </ol>
    </div>
  )
}

function PairRow({ pair, max, rgb, first }: { pair: MultiplePair; max: number; rgb: string; first: boolean }) {
  const { entry, multiple } = pair
  const body = (
    <>
      <span
        className="grid h-11 w-11 shrink-0 place-items-center rounded-md"
        style={{ background: `radial-gradient(closest-side, rgba(${rgb},0.30), rgba(${rgb},0.06) 70%, rgba(255,255,255,0.03))` }}
      >
        <ValueArt src={entry.imageUrl} alt={entry.name} size={36} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold leading-5 text-text-primary group-hover:underline group-hover:underline-offset-2">
          {entry.name}
        </span>
        <span className="block truncate text-[12.5px] leading-5 tabular-nums text-text-secondary">{pairLine(pair)}</span>
      </span>
      <span className="flex w-[92px] shrink-0 flex-col items-end gap-1 sm:w-[120px]">
        <span className="text-[16px] font-bold leading-5 tabular-nums" style={{ color: `rgb(${rgb})` }}>
          {fmtMultiple(multiple)}
        </span>
        <span aria-hidden className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <span className="block h-full rounded-full" style={{ width: `${multipleBarPct(multiple, max)}%`, background: CHROMA_BAR }} />
        </span>
      </span>
    </>
  )
  const cls = cn('flex items-center gap-3 py-3', !first && 'border-t border-white/[0.07]')
  return (
    <li>
      {entry.href ? (
        <Link
          href={entry.href}
          title={`${entry.name} value`}
          className={cn(cls, 'group rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring')}
        >
          {body}
        </Link>
      ) : (
        <div className={cls}>{body}</div>
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
