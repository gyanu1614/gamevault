import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronRight, ExternalLink, ShieldCheck, TrendingUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { JsonLd, breadcrumbList, productAggregate, faqPage } from '@/lib/seo/jsonld'
import { FaqCards } from '@/components/marketplace/FaqCards'
import { buildBrainrotFaq } from '@/lib/sab/faq'
import ItemHero, { type MutationOption } from './_ItemHero'
import { SimilarBrainrots } from './_SimilarBrainrots'
import { ValuesHeader } from '../_ValuesHeader'
import { SabHeroBackdrop } from '../_SabHeroBackdrop'
import { SabSubNav } from '../_SabSubNav'
import { cn } from '@/lib/utils'
import { sabCard } from '@/lib/sab/theme'

export const revalidate = 3600

interface PageProps {
  params: Promise<{
    gameSlug: string
    brainrotSlug: string
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
  confidence_label: string
  external_sample_size: number
  price_updated_at: string | null
  is_trade_ready: boolean
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
  const supabase = await createClient()
  const { data, error } = await (supabase as any)
    .from('sab_brainrot_market_catalog')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (error) {
    console.error('Unable to load Brainrot value page:', error)
    return null
  }

  return (data as BrainrotRow | null) ?? null
}

async function getDefaultTradePrice(
  brainrotId: string,
): Promise<TradePriceRow | null> {
  const supabase = await createClient()
  const { data, error } = await (supabase as any)
    .from('sab_public_price_catalog')
    .select(
      'market_value_usd,market_low_usd,market_high_usd,confidence_label,external_sample_size,price_updated_at,is_trade_ready',
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

async function getMutations(brainrotId: string): Promise<MutationOption[]> {
  const supabase = await createClient()

  // Fetch mutation income data and per-mutation market prices in parallel, then
  // merge so each mutation carries its real USD market value (not just income).
  const [calculatorResult, pricesResult] = await Promise.all([
    (supabase as any)
      .from('sab_brainrot_mutation_calculator')
      .select(
        'mutation_slug,mutation_name,income_multiplier,mutation_availability,calculated_income_per_second,income_source,is_verified_variant',
      )
      .eq('brainrot_id', brainrotId)
      .order('income_multiplier', { ascending: true }),
    (supabase as any)
      .from('sab_public_price_catalog')
      .select(
        'mutation_slug,market_value_usd,market_low_usd,market_high_usd,confidence_label,external_sample_size,price_updated_at,is_trade_ready',
      )
      .eq('brainrot_id', brainrotId),
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

  // Anchor for the fallback estimate: the default mutation's real price and
  // multiplier. When a mutation has NO market listings, we scale the default
  // price by the mutation's income multiplier so the page still shows a
  // number (clearly flagged as estimated) — anything beats a blank.
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
      const ratio = Number(row.income_multiplier) / defaultMultiplier
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
  brainrotId: string,
): Promise<Record<string, { date: string; median: number }[]>> {
  const supabase = await createClient()
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
  const supabase = await createClient()
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
    .from('sab_public_price_catalog')
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
    .slice(0, 12)
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { gameSlug, brainrotSlug } = await params
  if (gameSlug !== 'steal-a-brainrot') return { title: 'Value Not Found' }

  const brainrot = await getBrainrot(brainrotSlug)
  if (!brainrot) return { title: 'Brainrot Not Found' }

  const title = `${brainrot.name} Value, Income & Mutations`
  const description = `${brainrot.name} value guide for Steal a Brainrot. See rarity, base income, mutation income, obtainability, and current DropMarket pricing.`
  const canonical = `/steal-a-brainrot/values/${brainrot.slug}`

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'website',
      images: brainrot.image_url ? [brainrot.image_url] : [],
    },
  }
}

export default async function BrainrotValuePage({ params }: PageProps) {
  const { gameSlug, brainrotSlug } = await params
  if (gameSlug !== 'steal-a-brainrot') notFound()

  const brainrot = await getBrainrot(brainrotSlug)
  if (!brainrot) notFound()

  const [mutations, relatedBrainrots, defaultTradePrice, priceHistory] = await Promise.all([
    getMutations(brainrot.id),
    getRelatedBrainrots(brainrot),
    getDefaultTradePrice(brainrot.id),
    getPriceHistory(brainrot.id),
  ])

  const hasPublicMarketPrice =
    defaultTradePrice != null &&
    asNumber(defaultTradePrice?.market_value_usd) != null

  const displayPrice = formatMoney(
    hasPublicMarketPrice
      ? defaultTradePrice?.market_value_usd
      : brainrot.display_price_usd,
  )
  const cheapestPrice = formatMoney(brainrot.cheapest_active_price_usd)
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

  const marketplaceHref = `/steal-a-brainrot/buy-items?search=${encodeURIComponent(brainrot.name)}`

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
    <main className="relative min-h-screen bg-[#0C0F0E] pb-24">
      <SabHeroBackdrop height={560}>
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

      <ValuesHeader gameName="Steal a Brainrot" buyHref={marketplaceHref} />
      <SabSubNav />

      <section className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-[12.5px] text-[#6D7A72]">
          <Link href="/steal-a-brainrot/values" className="transition-colors hover:text-[#F1F3F1]">
            Brainrot
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link
            href={`/steal-a-brainrot/values?rarity=${encodeURIComponent(brainrot.rarity)}`}
            className="transition-colors hover:text-[#F1F3F1]"
          >
            {brainrot.rarity}
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-[#E6EAE7]">{brainrot.name}</span>
        </nav>

        <ItemHero
          brainrotName={brainrot.name}
          rarity={brainrot.rarity}
          obtainability={brainrot.obtainability}
          baseIncomePerSecond={asNumber(brainrot.base_income_per_second)}
          ingameCost={formatMoney(brainrot.ingame_cost)}
          imageUrl={brainrot.image_url}
          imageAlt={brainrot.image_alt}
          mutations={mutations}
          listingsHref={marketplaceHref}
          priceHistory={priceHistory}
          updatedAt={
            hasPublicMarketPrice
              ? (defaultTradePrice?.price_updated_at ?? null)
              : brainrot.price_updated_at
          }
        />
      </section>

      <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-7 sm:px-6 sm:py-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-8">
        <div className="space-y-6">

          <section className={cn(sabCard, 'p-5 sm:p-6')}>
            <h2 className="text-lg font-semibold text-[#F1F3F1]">{brainrot.name} market value</h2>
            <p className="mt-2 text-sm leading-6 text-[#9BA8A0]">
              Estimated from recent comparable marketplace listings and completed sales when available. Extreme prices, bundles, and unclear variants are excluded.
            </p>

            <dl className="mt-5 divide-y divide-white/[0.07] border-y border-white/[0.07]">
              <BodyRow label="Cheapest active listing" value={cheapestPrice ?? 'No active listings'} />
              <BodyRow label="Current market price" value={marketValue ?? 'Insufficient data'} />
              <BodyRow label="Quick-sale estimate" value={quickSale ?? 'Insufficient data'} />
              <BodyRow label="Patient-sale estimate" value={patientSale ?? 'Insufficient data'} />
            </dl>
          </section>

          <section className={cn(sabCard, 'p-5 sm:p-6')}>
            <h2 className="text-lg font-semibold text-[#F1F3F1]">About {brainrot.name}</h2>
            <p className="mt-2 text-sm leading-6 text-[#9BA8A0]">
              {brainrot.name} is a {brainrot.rarity} Brainrot with a base income of {formatIncome(brainrot.base_income_per_second)}. Its current obtainability status is {brainrot.obtainability}. Mutation income estimates use the verified base income and each mutation&apos;s multiplier unless a verified variant-specific override exists.
            </p>
            {brainrot.source_url && (
              <a
                href={brainrot.source_url}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#4FB477] underline-offset-4 hover:underline"
              >
                View source information
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className={cn(sabCard, 'p-5')}>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-[18px] w-[18px] text-[#4FB477]" />
              <h2 className="text-sm font-semibold text-[#F1F3F1]">Market activity</h2>
            </div>
            <dl className="mt-4 divide-y divide-white/[0.07] border-y border-white/[0.07]">
              <BodyRow label="Active listings" value={brainrot.active_listing_count.toLocaleString()} />
              <BodyRow label="Completed sales" value={brainrot.completed_sale_count.toLocaleString()} />
              <BodyRow label="Unique sellers" value={brainrot.unique_seller_count.toLocaleString()} />
              <BodyRow label="Confidence" value={effectiveConfidenceLabel} capitalize />
            </dl>
          </section>

          <section className={cn(sabCard, 'p-5')}>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-[18px] w-[18px] text-[#4FB477]" />
              <h2 className="text-sm font-semibold text-[#F1F3F1]">Pricing integrity</h2>
            </div>
            <p className="mt-2.5 text-[13px] leading-6 text-[#9BA8A0]">
              Extreme prices, bundles, account sales, unclear mutations, test listings, cancelled orders, refunds, disputes, and unverified mappings are excluded from market calculations.
            </p>
          </section>
        </aside>
      </div>

      <SimilarBrainrots
        rarity={brainrot.rarity}
        items={relatedBrainrots.map((r) => ({
          id: r.id,
          name: r.name,
          slug: r.slug,
          rarity: r.rarity,
          imageUrl: r.image_url,
          priceUsd: r.display_price_usd,
        }))}
      />

      {/* Curated FAQ — unique per brainrot (SEO) + FAQPage structured data. */}
      <section className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="border-t border-white/[0.07] pt-10">
          <h2 className="text-lg font-semibold text-[#F1F3F1]">{brainrot.name} — questions</h2>
          <FaqCards items={faqItems} defaultOpen={0} className="mt-5" />
        </div>
      </section>
      <JsonLd data={faqPage(faqItems)} />
      </SabHeroBackdrop>
    </main>
  )
}

// Shared label:value row for the body sections — grey dividers, tabular-nums,
// matching the hero's StatRow so every SAB surface reads the same.
function BodyRow({
  label,
  value,
  capitalize = false,
}: {
  label: string
  value: string
  capitalize?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 text-sm">
      <dt className="text-[#9BA8A0]">{label}</dt>
      <dd className={`font-medium tabular-nums text-[#F1F3F1] ${capitalize ? 'capitalize' : ''}`}>
        {value}
      </dd>
    </div>
  )
}
