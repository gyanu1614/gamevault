import type { Metadata } from 'next'
import Link from '@/components/navigation/AppLink'
import { notFound } from 'next/navigation'
import { CaretRightIcon } from '@phosphor-icons/react/dist/ssr/CaretRight'
import { ArrowSquareOutIcon } from '@phosphor-icons/react/dist/ssr/ArrowSquareOut'
import { ShieldCheckIcon } from '@phosphor-icons/react/dist/ssr/ShieldCheck'
import { TrendUpIcon } from '@phosphor-icons/react/dist/ssr/TrendUp'
import { ArrowLeftIcon } from '@phosphor-icons/react/dist/ssr/ArrowLeft'
import { ArrowRightIcon } from '@phosphor-icons/react/dist/ssr/ArrowRight'
import { createValueItemReadClient, createValueListReadClient } from '@/lib/values/read-client'
import { JsonLd, breadcrumbList, productAggregate, faqPage } from '@/lib/seo/jsonld'
import { HubFaqSection } from '@/components/content/HubFaqSection'
import { buildBrainrotFaq } from '@/lib/sab/faq'
import ItemHero, { type MutationOption } from './_ItemHero'
import { SimilarItemsRail } from '@/components/values/SimilarItemsRail'
import { StatRow } from '@/components/values/HubSection'
import { HUB_GROUND, VALUE_BTN_SECONDARY, VALUE_SURFACE } from '@/components/values/styles'
import { formatCash } from '@/lib/sab/format'
import { GameHeroBackdrop } from '@/components/marketplace/GameHeroBackdrop'
import { HubNav } from '@/components/content/HubNav'
import { HubFooter } from '@/components/content/HubFooter'
import { getHubNavData, HUB_NAV_CLEAR } from '@/lib/content/hubNav'
import { hasHubPage } from '@/lib/content/theme'
import AdoptMePetPage from './_AdoptMePetPage'
import { getAdoptMePet, getPublishablePetSlugs } from './_adoptMePetData'
import GenericValueItemPage from '../_generic/ValueItemPage'
import { isValueItemIndexable } from '@/lib/games/indexability'
import ValueListItemPage from '../_generic/ValueListItemPage'
import { VALUES_PIPELINE_GAMES } from '@/lib/value-listings/catalogs'
import { valueItemHasPage, valueListHub } from '@/lib/values/hub-config'
import { getValueItems } from '@/lib/values/data'
import { bindValueItemPriceTag, bindValuesTag } from '@/lib/values/revalidation'
import { getGameContentTheme } from '@/lib/content/theme'
import { socialTitle } from '@/lib/seo/title'
import { AvailableNow } from '@/components/value-listings/AvailableNow'
import { getValueItemBuyData } from '../../[categorySlug]/_valueItemOffers'

/**
 * The page SHELL is static content — an item's name, rarity, artwork, income
 * and copy change when the catalogue is edited, not on a price crawl. Only the
 * price block moves, and it moves on its own tag.
 *
 * So the time-based window is a long safety net (7 days), not the refresh
 * path. The refresh is event-driven:
 *   • prices  → `price:<game>:<item>`, revalidated by the crawl's publish step
 *               for the items whose prices actually moved
 *               (/api/internal/sab-market-revalidate)
 *   • content → `values:<game>`, revalidated by /api/internal/values-revalidate
 *
 * Before this, the 24 h window plus a whole-game tag on every one of 8 daily
 * crawls rebuilt all ~500 item pages whether or not anything changed — ~80% of
 * the monthly ISR budget (build audit 2026-09-22, §4).
 */
export const revalidate = 604800

/** The game the sab_* tables price — the tag game of every SAB read below. */
const SAB_GAME = 'steal-a-brainrot'

/*
 * Games served by the generic values_* pipeline: VALUES_PIPELINE_GAMES (shared
 * with the listing matcher). A value-LIST hub (valueListHub: Murder Mystery 2)
 * publishes pages only for its high-tier priced items (valueItemHasPage);
 * Steal an Egg publishes every item.
 */

/**
 * Prerender EVERY item page at build time (Step 7a). The set used to be
 * capped at 100 per game because building ~500 pages against the remote DB
 * intermittently tripped Next's 60 s per-page static-generation timeout; the
 * cap left the other ~360 pages to render on first visit after every deploy,
 * at ~12 deploys a day. `staticPageGenerationTimeout` in next.config.js is
 * raised instead. Unknown slugs still 404 through the gates below
 * (dynamicParams stays true: a slug published between deploys renders on
 * demand into the same cache).
 */
export async function generateStaticParams() {
  const supabase = createValueListReadClient(SAB_GAME)
  const [{ data: brainrots }, petSlugs] = await Promise.all([
    (supabase as any)
      .from('sab_brainrot_market_catalog')
      .select('slug')
      .order('market_value_usd', { ascending: false, nullsFirst: false }),
    getPublishablePetSlugs(),
  ])
  // Generic-pipeline games: prerender the PRICED items (the pages that can
  // rank). Steal an Egg's unpriced catalogue renders on demand into the same
  // ISR cache; a value-list hub's set is closed — EVERY item with a page
  // (valueItemHasPage: priced + high-tier) is built, and the body 404s the rest.
  const pipelineParams: Array<{ gameSlug: string; itemSlug: string }> = []
  for (const slug of VALUES_PIPELINE_GAMES) {
    if (!hasHubPage(slug, 'values')) continue
    const items = await getValueItems(slug)
    pipelineParams.push(
      ...items
        .filter((i) => i.price?.cheapestUsd != null)
        .filter((i) => valueItemHasPage(slug, { rarity: i.rarity, priced: true }))
        .map((i) => ({ gameSlug: slug, itemSlug: i.slug })),
    )
  }

  return [
    ...pipelineParams,
    ...(((brainrots ?? []) as { slug: string }[]).map((r) => ({
      gameSlug: 'steal-a-brainrot',
      itemSlug: r.slug,
    }))),
    ...petSlugs.map((slug) => ({ gameSlug: 'adopt-me', itemSlug: slug })),
  ]
}

interface PageProps {
  params: Promise<{
    gameSlug: string
    itemSlug: string
  }>
}

type BrainrotRow = {
  id: string
  name: string
  slug: string
  rarity: string
  obtainability: string
  base_income_per_second: number | string | null
  ingame_cost: number | string | null
  image_url: string | null
  image_alt: string
  source_url: string | null
  cheapest_active_price_usd: number | string | null
  market_value_usd: number | string | null
  quick_sale_usd: number | string | null
  patient_sale_usd: number | string | null
  active_listing_count: number
  completed_sale_count: number
  unique_seller_count: number
  confidence_label: string
  display_price_usd: number | string | null
  display_price_label: string
  display_price_source: string
  price_updated_at: string | null
}

type MutationRow = {
  mutation_slug: string
  mutation_name: string
  income_multiplier: number | string
  mutation_availability: string
  calculated_income_per_second: number | string | null
  income_source: string
  is_verified_variant: boolean
}

type TradePriceRow = {
  market_value_usd: number | string | null
  market_low_usd: number | string | null
  market_high_usd: number | string | null
  cheapest_usd: number | string | null
  average_usd: number | string | null
  confidence_label: string
  external_sample_size: number
  price_updated_at: string | null
  is_trade_ready: boolean
}

type MutationMarketPriceRow = {
  mutation_slug: string
  market_value_usd: number | string | null
  market_low_usd: number | string | null
  market_high_usd: number | string | null
  cheapest_usd: number | string | null
  average_usd: number | string | null
  confidence_label: string
  external_sample_size: number
  price_updated_at: string | null
  is_trade_ready: boolean
}

/** Measured market premium per mutation — see sab_mutation_price_multipliers. */
type MutationPriceMultiplierRow = {
  mutation_slug: string
  price_multiplier: number | string
}

function asNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function formatMoney(value: number | string | null | undefined): string | null {
  const amount = asNumber(value)
  if (amount == null) return null
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: amount < 10 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatIncome(value: number | string | null | undefined): string {
  const amount = asNumber(value)
  if (amount == null) return 'Unknown'

  return `${new Intl.NumberFormat('en-US', {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 1,
  }).format(amount)}/s`
}

/** In-game currency cost, compact — "$250B" not "$250,000,000,000". */
function formatIngameCost(value: number | string | null | undefined): string | null {
  const amount = asNumber(value)
  if (amount == null) return null
  return `$${new Intl.NumberFormat('en-US', {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 2,
  }).format(amount)}`
}

function formatDate(value: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

async function getBrainrot(slug: string): Promise<BrainrotRow | null> {
  const supabase = createValueItemReadClient(SAB_GAME, slug)
  const { data, error } = await (supabase as any)
    .from('sab_brainrot_market_catalog')
    // STATE-012 — explicit columns, exactly the BrainrotRow contract above.
    .select(
      'id,name,slug,rarity,obtainability,base_income_per_second,ingame_cost,image_url,image_alt,source_url,cheapest_active_price_usd,market_value_usd,quick_sale_usd,patient_sale_usd,active_listing_count,completed_sale_count,unique_seller_count,confidence_label,display_price_usd,display_price_label,display_price_source,price_updated_at',
    )
    .eq('slug', slug)
    .maybeSingle()

  if (error) {
    console.error('Unable to load Brainrot value page:', error)
    return null
  }

  return (data as BrainrotRow | null) ?? null
}

async function getDefaultTradePrice(
  itemSlug: string,
  brainrotId: string,
): Promise<TradePriceRow | null> {
  const supabase = createValueItemReadClient(SAB_GAME, itemSlug)
  const { data, error } = await (supabase as any)
    .from('sab_price_display')
    .select(
      'market_value_usd,market_low_usd,market_high_usd,cheapest_usd,average_usd,confidence_label,external_sample_size,price_updated_at,is_trade_ready',
    )
    .eq('brainrot_id', brainrotId)
    .eq('mutation_slug', 'default')
    .maybeSingle()

  if (error) {
    console.error('Unable to load default mutation market price:', error)
    return null
  }

  return (data as TradePriceRow | null) ?? null
}

async function getMutations(itemSlug: string, brainrotId: string): Promise<MutationOption[]> {
  const supabase = createValueItemReadClient(SAB_GAME, itemSlug)

  // Fetch mutation income data, per-mutation market prices, and the measured
  // mutation price premiums in parallel, then merge so each mutation carries
  // its real USD market value (not just income).
  const [calculatorResult, pricesResult, multiplierResult] = await Promise.all([
    (supabase as any)
      .from('sab_brainrot_mutation_calculator')
      .select(
        'mutation_slug,mutation_name,income_multiplier,mutation_availability,calculated_income_per_second,income_source,is_verified_variant',
      )
      .eq('brainrot_id', brainrotId)
      .order('income_multiplier', { ascending: true }),
    (supabase as any)
      .from('sab_price_display')
      .select(
        'mutation_slug,market_value_usd,market_low_usd,market_high_usd,cheapest_usd,average_usd,confidence_label,external_sample_size,price_updated_at,is_trade_ready',
      )
      .eq('brainrot_id', brainrotId),
    (supabase as any)
      .from('sab_mutation_price_multipliers')
      .select('mutation_slug,price_multiplier'),
  ])

  if (calculatorResult.error) {
    console.error('Unable to load Brainrot mutations:', calculatorResult.error)
    return []
  }

  if (pricesResult.error) {
    console.error('Unable to load Brainrot mutation prices:', pricesResult.error)
  }

  const priceBySlug = new Map<string, MutationMarketPriceRow>(
    ((pricesResult.data ?? []) as MutationMarketPriceRow[]).map((row) => [
      row.mutation_slug,
      row,
    ]),
  )

  const rows = (calculatorResult.data ?? []) as MutationRow[]

  /**
   * MEASURED price premium per mutation, not the income multiplier.
   *
   * This used to scale the default price by the mutation's INCOME multiplier,
   * which badly overstated high-tier mutations: measured across 1,155
   * well-sampled variant/default pairs, the market premium saturates around
   * 2.5-3.5x however high income scales (Rainbow is 10x income but ~3.0x
   * price). A Rainbow estimate was therefore roughly threefold too high.
   *
   * The table is refreshed daily by /api/cron/correct-prices. If it hasn't
   * been populated yet we fall back to the old income-multiplier behaviour
   * rather than showing nothing.
   */
  const priceMultiplierBySlug = new Map<string, number>(
    ((multiplierResult?.data ?? []) as MutationPriceMultiplierRow[]).map(
      (row) => [row.mutation_slug, Number(row.price_multiplier)],
    ),
  )

  // Anchor for the fallback estimate: the default mutation's real price and
  // multiplier. When a mutation has NO market listings, we scale the default
  // price by the measured premium so the page still shows a number (clearly
  // flagged as estimated) — anything beats a blank.
  const defaultRow = rows.find((r) => r.mutation_slug === 'default')
  const defaultPrice = asNumber(
    priceBySlug.get('default')?.market_value_usd ?? null,
  )
  const defaultMultiplier = Number(defaultRow?.income_multiplier) || 1

  return rows.map((row) => {
    const price = priceBySlug.get(row.mutation_slug)
    const realValue = asNumber(price?.market_value_usd ?? null)

    // Derive an estimate only when there's no real value, we have a default
    // anchor, and this isn't the default itself.
    let estimatedValue: number | null = null
    if (realValue == null && defaultPrice != null && row.mutation_slug !== 'default') {
      const ratio =
        priceMultiplierBySlug.get(row.mutation_slug) ??
        Number(row.income_multiplier) / defaultMultiplier
      if (Number.isFinite(ratio) && ratio > 0) {
        estimatedValue = Math.round(defaultPrice * ratio * 100) / 100
      }
    }

    return {
      slug: row.mutation_slug,
      name: row.mutation_name,
      multiplier: Number(row.income_multiplier),
      availability: row.mutation_availability,
      calculatedIncomePerSecond: asNumber(row.calculated_income_per_second),
      incomeSource: row.income_source,
      isVerifiedVariant: row.is_verified_variant,
      marketValueUsd: realValue ?? estimatedValue,
      marketLowUsd: asNumber(price?.market_low_usd ?? null),
      marketHighUsd: asNumber(price?.market_high_usd ?? null),
      cheapestUsd: asNumber(price?.cheapest_usd ?? null),
      averageUsd: asNumber(price?.average_usd ?? null),
      marketConfidenceLabel: price?.confidence_label ?? null,
      marketSampleSize: price?.external_sample_size ?? 0,
      marketUpdatedAt: price?.price_updated_at ?? null,
      isEstimated: realValue == null && estimatedValue != null,
    }
  })
}

// Daily price history per mutation, for the trend chart. Resilient: returns an
// empty map if the table isn't present yet (migration not applied) or on error,
// so the page renders fine before history exists — the chart shows a
// "collecting history" state in that case.
async function getPriceHistory(
  itemSlug: string,
  brainrotId: string,
): Promise<Record<string, { date: string; median: number }[]>> {
  const supabase = createValueItemReadClient(SAB_GAME, itemSlug)
  const { data, error } = await (supabase as any)
    .from('sab_price_history')
    .select('mutation_slug:mutation_id,history_date,median_usd,sab_mutations(slug)')
    .eq('brainrot_id', brainrotId)
    .order('history_date', { ascending: true })

  if (error || !data) return {}

  const bySlug: Record<string, { date: string; median: number }[]> = {}
  for (const row of data as any[]) {
    const slug = row.sab_mutations?.slug
    const median = asNumber(row.median_usd)
    if (!slug || median == null) continue
    ;(bySlug[slug] = bySlug[slug] ?? []).push({ date: row.history_date, median })
  }
  return bySlug
}

async function getRelatedBrainrots(brainrot: BrainrotRow): Promise<BrainrotRow[]> {
  // Read on this item's page → this item's tags, never the game list tag.
  const supabase = createValueItemReadClient(SAB_GAME, brainrot.slug)
  const { data } = await (supabase as any)
    .from('sab_brainrot_market_catalog')
    .select('id,name,slug,rarity,image_url,display_price_usd,display_price_label')
    .eq('rarity', brainrot.rarity)
    .neq('id', brainrot.id)
    .order('name', { ascending: true })
    .limit(24)

  const rows = (data ?? []) as BrainrotRow[]
  if (rows.length === 0) return rows

  // display_price_usd only reflects verified trade-ready prices (often null).
  // Pull the real default cash value from the public catalog so cards show a
  // price instead of "pending", matching what the item page displays.
  const { data: prices } = await (supabase as any)
    .from('sab_price_display')
    .select('brainrot_id,market_value_usd')
    .eq('mutation_slug', 'default')
    .in(
      'brainrot_id',
      rows.map((r) => r.id),
    )

  const priceById = new Map<string, number | string | null>(
    ((prices ?? []) as Array<{ brainrot_id: string; market_value_usd: number | string | null }>).map(
      (p) => [p.brainrot_id, p.market_value_usd],
    ),
  )

  return rows
    .map((r) => ({ ...r, display_price_usd: priceById.get(r.id) ?? r.display_price_usd }))
    .sort((a, b) => (asNumber(b.display_price_usd) ?? 0) - (asNumber(a.display_price_usd) ?? 0))
    // 20 sibling links (was 12): a denser related-items block is the strongest
    // internal-link-mesh lever competitors (Rolimons) use — every item page
    // feeds keyword-rich links to 20 others, spreading crawl + equity.
    .slice(0, 20)
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { gameSlug, itemSlug } = await params

  if (gameSlug === 'adopt-me') {
    const pet = await getAdoptMePet(itemSlug)
    if (!pet) return { title: 'Value Not Found' }
    const monthYear = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    // Title leads with the pet name + "value" (the head term) and carries the
    // real-money wedge; keeps DropMarket last.
    // Bare: the layout template adds " | DropMarket" (it used to be doubled).
    const title = `${pet.name} Value in Adopt Me (${monthYear}) — Cash & Trade Value`
    const description = `How much is a ${pet.name} worth in Adopt Me in real money? See the ${pet.name}'s cash value (USD) and community trade value — Normal, Fly Ride, Neon and Mega prices, updated ${monthYear} from real marketplace listings.`
    const canonical = `/adopt-me/values/${pet.slug}`
    // Page-specific keywords targeting the uncontested long-tail the brief
    // names — "worth in real money / USD / can you sell". Per-pet, not the dead
    // site-wide stuffed string.
    const keywords = [
      `${pet.name} value`,
      `${pet.name} value adopt me`,
      `${pet.name} worth`,
      `how much is a ${pet.name} worth`,
      `${pet.name} value in real money`,
      `${pet.name} usd value`,
      `${pet.name} fly ride value`,
      `${pet.name} neon value`,
      `${pet.name} mega neon value`,
      `sell ${pet.name} adopt me`,
      `adopt me ${pet.name} price`,
    ]
    return {
      title,
      description,
      keywords,
      alternates: { canonical },
      openGraph: {
        title: socialTitle(title),
        description,
        url: canonical,
        type: 'website',
        images: pet.imageUrl ? [pet.imageUrl] : [],
      },
    }
  }

  const listHub = hasHubPage(gameSlug, 'values') ? valueListHub(gameSlug) : null
  if (listHub) {
    const theme = getGameContentTheme(gameSlug)
    const item = (await getValueItems(gameSlug, { itemSlug })).find((i) => i.slug === itemSlug)
    const price = item?.price
    if (!item || !valueItemHasPage(gameSlug, { rarity: item.rarity, priced: price?.cheapestUsd != null })) {
      return { title: 'Value Not Found' }
    }
    const monthYear = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    const cheapest = price!.cheapestUsd!
    const title = `${item.name} Value in ${listHub.shortName} (${monthYear}) — Price in USD`
    const description = `How much is ${item.name} worth in ${theme.name}? It sells for about $${cheapest.toFixed(2)} from reputable sellers, across ${price!.sampleSize} live listings — real US dollars, updated daily, not value points.`
    const canonical = `/${gameSlug}/values/${item.slug}`
    return {
      title,
      description,
      keywords: [
        `${item.name} value`,
        `${item.name} ${listHub.shortName.toLowerCase()} value`,
        `${item.name} worth`,
        `how much is ${item.name} worth`,
        `${item.name} price usd`,
        `${listHub.shortName.toLowerCase()} ${item.name} real money`,
      ],
      alternates: { canonical },
      // The shared thin-content rule (the sitemap applies it too).
      ...(isValueItemIndexable({ priced: true, sampleSize: price!.sampleSize })
        ? {}
        : { robots: { index: false, follow: true } }),
      openGraph: {
        title: socialTitle(title),
        description,
        url: canonical,
        type: 'website',
        images: item.imageUrl ? [item.imageUrl] : [],
      },
    }
  }

  if (VALUES_PIPELINE_GAMES.has(gameSlug)) {
    const theme = getGameContentTheme(gameSlug)
    const item = (await getValueItems(gameSlug, { itemSlug })).find((i) => i.slug === itemSlug)
    if (!item) return { title: 'Value Not Found' }
    const price = item.price
    const priced = price?.cheapestUsd != null
    // The brief's rule: fewer than 3 live listings behind a value is not
    // enough to index. Every unpriced catalogue page (all pets) is noindex too
    // — it is useful to a reader who lands on it, but it is not a ranking page.
    const thin = !priced || (price?.sampleSize ?? 0) < 3
    const title = priced
      ? `${item.name} Value — ${theme.name}`
      : `${item.name} — ${theme.name} ${item.rarity ? `${item.rarity} ` : ''}Pet`
    return {
      title,
      description: priced
        ? `${item.name} sells for about $${price!.cheapestUsd!.toFixed(2)} in ${theme.name}, priced from ${price!.sampleSize} live marketplace listings.`
        : `${item.name} in ${theme.name}: rarity, area, income and the egg it hatches from. No market price — ${item.name} is not sold directly.`,
      alternates: { canonical: `/${gameSlug}/values/${item.slug}` },
      ...(thin ? { robots: { index: false, follow: true } } : {}),
    }
  }

  if (!hasHubPage(gameSlug, 'values')) return { title: 'Value Not Found' }

  const brainrot = await getBrainrot(itemSlug)
  if (!brainrot) return { title: 'Brainrot Not Found' }

  const title = `${brainrot.name} Value, Income & Mutations`
  const description = `${brainrot.name} value guide for Steal a Brainrot. See rarity, base income, mutation income, obtainability, and current DropMarket pricing.`
  const canonical = `/steal-a-brainrot/values/${brainrot.slug}`

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title: socialTitle(title),
      description,
      url: canonical,
      type: 'website',
      images: brainrot.image_url ? [brainrot.image_url] : [],
    },
  }
}

export default async function BrainrotValuePage({ params }: PageProps) {
  const { gameSlug, itemSlug } = await params
  // Two tags, two lifetimes (see `revalidate` above):
  //   • `values:<game>`      — catalogue/content edits, whole game.
  //   • `price:<game>:<item>` — this item's prices, moved by a crawl only when
  //     the published numbers actually changed.
  // Both are bound before any branch so every variant of this page carries
  // them, and the prices below stay SERVER-rendered (they are in the HTML for
  // crawlers — the tags change when the page is rebuilt, not how).
  await Promise.all([
    bindValuesTag(gameSlug),
    bindValueItemPriceTag(gameSlug, itemSlug),
  ])

  // Adopt Me per-pet page — only publishable pets (has_page) render; anything
  // thin or unpriced 404s rather than shipping an empty page.
  if (gameSlug === 'adopt-me') {
    const pet = await getAdoptMePet(itemSlug)
    if (!pet) notFound()
    return <AdoptMePetPage pet={pet} />
  }

  if (VALUES_PIPELINE_GAMES.has(gameSlug)) {
    if (!hasHubPage(gameSlug, 'values')) notFound()
    if (valueListHub(gameSlug)) {
      // Gate BEFORE anything streams: only priced high-tier items have a
      // page, everything else is a real 404 (commons stay list rows).
      const items = await getValueItems(gameSlug, { itemSlug })
      const item = items.find((i) => i.slug === itemSlug)
      if (!item || !valueItemHasPage(gameSlug, { rarity: item.rarity, priced: item.price?.cheapestUsd != null })) {
        notFound()
      }
      return <ValueListItemPage gameSlug={gameSlug} item={item} items={items} />
    }
    return <GenericValueItemPage gameSlug={gameSlug} itemSlug={itemSlug} />
  }

  if (!hasHubPage(gameSlug, 'values')) notFound()

  const brainrot = await getBrainrot(itemSlug)
  if (!brainrot) notFound()

  const [mutations, relatedBrainrots, defaultTradePrice, priceHistory, hubNav] =
    await Promise.all([
      getMutations(brainrot.slug, brainrot.id),
      getRelatedBrainrots(brainrot),
      getDefaultTradePrice(brainrot.slug, brainrot.id),
      getPriceHistory(brainrot.slug, brainrot.id),
      getHubNavData(gameSlug),
    ])

  const hasPublicMarketPrice =
    defaultTradePrice != null &&
    asNumber(defaultTradePrice?.market_value_usd) != null

  const displayPrice = formatMoney(
    hasPublicMarketPrice
      ? defaultTradePrice?.market_value_usd
      : brainrot.display_price_usd,
  )
  // Reputable-seller pricing: the buyer-facing "Cheapest" + "Market price".
  // Market price = the reputable average when we have it, else the corrected
  // value. Cheapest = the reputable low, shown only when it undercuts the market
  // price (a single reputable seller makes them equal).
  const reputableAverage = asNumber(defaultTradePrice?.average_usd)
  const reputableCheapest = asNumber(defaultTradePrice?.cheapest_usd)
  const marketPriceUsd =
    reputableAverage ??
    (hasPublicMarketPrice
      ? asNumber(defaultTradePrice?.market_value_usd)
      : asNumber(brainrot.market_value_usd))
  const marketPrice = formatMoney(marketPriceUsd)
  const cheapestPrice =
    reputableCheapest != null &&
    marketPriceUsd != null &&
    reputableCheapest < marketPriceUsd - 0.005
      ? formatMoney(reputableCheapest)
      : null
  const marketValue = formatMoney(
    hasPublicMarketPrice
      ? defaultTradePrice?.market_value_usd
      : brainrot.market_value_usd,
  )
  const marketLow = formatMoney(defaultTradePrice?.market_low_usd)
  const marketHigh = formatMoney(defaultTradePrice?.market_high_usd)
  const marketSampleSize = defaultTradePrice?.external_sample_size ?? 0
  const effectiveConfidenceLabel = hasPublicMarketPrice
    ? defaultTradePrice?.confidence_label
    : brainrot.confidence_label
  const quickSale = formatMoney(brainrot.quick_sale_usd)
  const patientSale = formatMoney(brainrot.patient_sale_usd)
  const updatedLabel = formatDate(
    hasPublicMarketPrice
      ? defaultTradePrice?.price_updated_at
      : brainrot.price_updated_at,
  )

  // DropMarket's own live stock for this brainrot (Bundle 2): the hero button
  // and "Available Now" read it; cached per game, refreshed by listing changes.
  const buyData = await getValueItemBuyData('steal-a-brainrot', brainrot.slug)
  const buyCategorySlug = buyData?.categorySlug ?? 'buy-items'

  // Highest-value priced mutation (excluding default) for the FAQ copy.
  const topMutation = mutations
    .filter((m) => m.slug !== 'default' && asNumber(m.marketValueUsd) != null)
    .sort((a, b) => (asNumber(b.marketValueUsd) ?? 0) - (asNumber(a.marketValueUsd) ?? 0))[0]

  const faqItems = buildBrainrotFaq({
    name: brainrot.name,
    rarity: brainrot.rarity,
    obtainability: brainrot.obtainability,
    baseIncomePerSecond: brainrot.base_income_per_second,
    ingameCost: brainrot.ingame_cost,
    defaultPriceUsd: hasPublicMarketPrice
      ? (defaultTradePrice?.market_value_usd ?? null)
      : brainrot.market_value_usd,
    lowUsd: defaultTradePrice?.market_low_usd ?? null,
    highUsd: defaultTradePrice?.market_high_usd ?? null,
    topMutation: topMutation
      ? { name: topMutation.name, priceUsd: topMutation.marketValueUsd }
      : null,
    sampleSize: marketSampleSize,
  })
  const canonicalPath = `/steal-a-brainrot/values/${brainrot.slug}`

  return (
    <main className={`relative min-h-screen ${HUB_GROUND}`}>
      <GameHeroBackdrop gameSlug={gameSlug} size="tall">
      <JsonLd
        data={breadcrumbList([
          { name: 'Home', path: '/' },
          { name: 'Steal a Brainrot', path: '/steal-a-brainrot' },
          { name: 'Values', path: '/steal-a-brainrot/values' },
          { name: brainrot.name, path: canonicalPath },
        ])}
      />

      {brainrot.active_listing_count > 0 && brainrot.cheapest_active_price_usd != null && (
        <JsonLd
          data={productAggregate({
            name: `${brainrot.name} — Steal a Brainrot`,
            description: `Buy ${brainrot.name} from verified DropMarket sellers.`,
            brand: 'Steal a Brainrot',
            lowPrice: Number(brainrot.cheapest_active_price_usd),
            highPrice: Number(brainrot.patient_sale_usd ?? brainrot.cheapest_active_price_usd),
            offerCount: brainrot.active_listing_count,
            url: canonicalPath,
          })}
        />
      )}

      <HubNav data={hubNav} />

      {/* pt clears the fixed HubNav. */}
      <section className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${HUB_NAV_CLEAR}`}>
        <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1.5 text-[12.5px] text-text-secondary">
          <Link href="/steal-a-brainrot/values" className="transition-colors hover:text-text-primary">
            Values
          </Link>
          <CaretRightIcon aria-hidden size={13} weight="bold" className="text-text-disabled" />
          {/* Plain text: ?rarity= is robots-blocked and the hub ignores it, so
              the link spent crawl on a dead URL (Bundle 1 hand-off). */}
          <span>{brainrot.rarity}</span>
          <CaretRightIcon aria-hidden size={13} weight="bold" className="text-text-disabled" />
          <span className="font-medium text-text-primary">{brainrot.name}</span>
        </nav>

        <ItemHero
          brainrotName={brainrot.name}
          rarity={brainrot.rarity}
          obtainability={brainrot.obtainability}
          baseIncomePerSecond={asNumber(brainrot.base_income_per_second)}
          ingameCost={formatIngameCost(brainrot.ingame_cost)}
          imageUrl={brainrot.image_url}
          imageAlt={brainrot.image_alt}
          mutations={mutations}
          buy={{ itemSlug: brainrot.slug, categorySlug: buyCategorySlug, stock: buyData?.stock ?? null }}
          priceHistory={priceHistory}
          updatedAt={
            hasPublicMarketPrice
              ? (defaultTradePrice?.price_updated_at ?? null)
              : brainrot.price_updated_at
          }
        />
      </section>

      <AvailableNow
        gameSlug="steal-a-brainrot"
        gameName="Steal a Brainrot"
        categorySlug={buyCategorySlug}
        itemSlug={brainrot.slug}
        itemName={brainrot.name}
        offers={buyData?.offers ?? []}
        total={buyData?.stock?.total ?? 0}
        sellHref="/steal-a-brainrot/sell?src=sab-item-page"
      />

      <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-7 sm:px-6 sm:py-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-8">
        <div className="space-y-6">

          <section className={`${VALUE_SURFACE} p-5 sm:p-6`}>
            <h2 className="text-lg font-semibold text-text-primary">
              How much is {brainrot.name} worth?
            </h2>
            {/* Answer-first, dated, quotable lead sentence — the exact string an
                AI answer engine (ChatGPT/Perplexity) lifts as a citation. Kept
                as plain server-rendered text (AI crawlers run no JavaScript).
                See search-engines-ai-seo-research memo (Princeton GEO study:
                statistics + freshness are the top citation levers). */}
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              {marketValue ? (
                <>
                  The current value of <strong className="font-semibold text-text-primary">{brainrot.name}</strong>{' '}
                  in Steal a Brainrot is <strong className="font-semibold text-text-primary">{marketValue}</strong>
                  {updatedLabel ? <> as of {updatedLabel}</> : null}, based on live DropMarket
                  marketplace data. It is a {brainrot.rarity} Brainrot with a base income of{' '}
                  {formatIncome(brainrot.base_income_per_second)}.
                </>
              ) : (
                <>
                  {brainrot.name} is a {brainrot.rarity} Brainrot in Steal a Brainrot with a base income
                  of {formatIncome(brainrot.base_income_per_second)}. Live pricing is still being
                  collected — check back as DropMarket gathers more marketplace data.
                </>
              )}
            </p>
            <p className="mt-2 text-xs leading-5 text-text-tertiary">
              Estimated from recent comparable marketplace listings by reputable sellers when available. Extreme prices, bundles, and unclear variants are excluded.
            </p>

            <dl className="mt-5">
              <StatRow label="Cheapest Active Listing" value={cheapestPrice ?? 'No active listings'} />
              <StatRow label="Current Market Price" value={marketValue ?? 'Insufficient data'} />
              <StatRow label="Quick-Sale Estimate" value={quickSale ?? 'Insufficient data'} />
              <StatRow label="Patient-Sale Estimate" value={patientSale ?? 'Insufficient data'} />
            </dl>
          </section>

          <section className={`${VALUE_SURFACE} p-5 sm:p-6`}>
            <h2 className="text-lg font-semibold text-text-primary">About {brainrot.name}</h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              {brainrot.name} is a {brainrot.rarity} Brainrot with a base income of {formatIncome(brainrot.base_income_per_second)}. Its current obtainability status is {brainrot.obtainability}. Mutation income estimates use the verified base income and each mutation&apos;s multiplier unless a verified variant-specific override exists.
            </p>
            {brainrot.source_url && (
              <a
                href={brainrot.source_url}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                View Source Information
                <ArrowSquareOutIcon aria-hidden size={16} weight="bold" />
              </a>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className={`${VALUE_SURFACE} p-5`}>
            <div className="flex items-center gap-2">
              <TrendUpIcon aria-hidden size={18} weight="bold" className="text-text-tertiary" />
              <h2 className="text-sm font-semibold text-text-primary">Market activity</h2>
            </div>
            <dl className="mt-4">
              <StatRow label="Active Listings" value={(brainrot.active_listing_count ?? 0).toLocaleString()} />
              <StatRow label="Completed Sales" value={(brainrot.completed_sale_count ?? 0).toLocaleString()} />
              <StatRow label="Unique Sellers" value={(brainrot.unique_seller_count ?? 0).toLocaleString()} />
              <StatRow label="Confidence" value={<span className="capitalize">{effectiveConfidenceLabel}</span>} />
            </dl>
          </section>

          <section className={`${VALUE_SURFACE} p-5`}>
            <div className="flex items-center gap-2">
              <ShieldCheckIcon aria-hidden size={18} weight="bold" className="text-text-tertiary" />
              <h2 className="text-sm font-semibold text-text-primary">Pricing integrity</h2>
            </div>
            <p className="mt-2.5 text-[13px] leading-6 text-text-secondary">
              Extreme prices, bundles, account sales, unclear mutations, test listings, cancelled orders, refunds, disputes, and unverified mappings are excluded from market calculations.
            </p>
          </section>
        </aside>
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SimilarItemsRail
          title={`Similar ${brainrot.rarity} Brainrots`}
          seeAllHref="/steal-a-brainrot/values"
          itemNoun="brainrots"
          className="border-t border-white/[0.07] pt-10"
          items={relatedBrainrots.map((r) => ({
            key: r.id,
            href: `/steal-a-brainrot/values/${r.slug}`,
            name: r.name,
            imageSrc: r.image_url,
            imageAlt: `${r.name} Steal a Brainrot`,
            price: formatCash(r.display_price_usd) ?? 'Price pending',
          }))}
        />

        {/* Curated FAQ — unique per brainrot (SEO) + FAQPage structured data. */}
        <HubFaqSection title={`${brainrot.name} — questions`} items={faqItems} />
      </div>
      <JsonLd data={faqPage(faqItems)} />

      {/* Cross-links — back to the list + how values are calculated (E-E-A-T:
          every cited value links to its methodology, parity with Adopt Me). */}
      <div className="mx-auto w-full max-w-7xl px-4 pb-4 pt-10 sm:px-6 lg:px-8">
        <div className="flex flex-wrap gap-3">
          <Link href="/steal-a-brainrot/values" className={VALUE_BTN_SECONDARY}>
            <ArrowLeftIcon aria-hidden size={15} weight="bold" />
            All Steal a Brainrot Values
          </Link>
          <Link href="/steal-a-brainrot/values/methodology" className={VALUE_BTN_SECONDARY}>
            How We Value Items
            <ArrowRightIcon aria-hidden size={15} weight="bold" />
          </Link>
        </div>
      </div>
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
