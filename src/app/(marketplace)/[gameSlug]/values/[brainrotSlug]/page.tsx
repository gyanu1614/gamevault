import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, ExternalLink, ShieldCheck, TrendingUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { JsonLd, breadcrumbList, productAggregate } from '@/lib/seo/jsonld'
import MutationCalculator, { type MutationOption } from './MutationCalculator'

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
  const { data, error } = await (supabase as any)
    .from('sab_brainrot_mutation_calculator')
    .select(
      'mutation_slug,mutation_name,income_multiplier,mutation_availability,calculated_income_per_second,income_source,is_verified_variant',
    )
    .eq('brainrot_id', brainrotId)
    .order('income_multiplier', { ascending: true })

  if (error) {
    console.error('Unable to load Brainrot mutations:', error)
    return []
  }

  return ((data ?? []) as MutationRow[]).map((row) => ({
    slug: row.mutation_slug,
    name: row.mutation_name,
    multiplier: Number(row.income_multiplier),
    availability: row.mutation_availability,
    calculatedIncomePerSecond: asNumber(row.calculated_income_per_second),
    incomeSource: row.income_source,
    isVerifiedVariant: row.is_verified_variant,
  }))
}

async function getRelatedBrainrots(brainrot: BrainrotRow): Promise<BrainrotRow[]> {
  const supabase = await createClient()
  const { data } = await (supabase as any)
    .from('sab_brainrot_market_catalog')
    .select('id,name,slug,rarity,image_url,display_price_usd,display_price_label')
    .eq('rarity', brainrot.rarity)
    .neq('id', brainrot.id)
    .order('name', { ascending: true })
    .limit(4)

  return (data ?? []) as BrainrotRow[]
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

  const [mutations, relatedBrainrots, defaultTradePrice] = await Promise.all([
    getMutations(brainrot.id),
    getRelatedBrainrots(brainrot),
    getDefaultTradePrice(brainrot.id),
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
  const canonicalPath = `/steal-a-brainrot/values/${brainrot.slug}`

  return (
    <main className="min-h-screen pb-24">
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

      <section className="border-b border-border-subtle">
        <div className="mx-auto w-full max-w-7xl px-4 pb-7 pt-5 sm:px-6 sm:pb-8 sm:pt-6 lg:px-8">
          <nav className="mb-4 flex flex-wrap items-center gap-2 text-[12.5px] text-text-tertiary">
            <Link href="/steal-a-brainrot" className="transition-colors hover:text-text-primary">
              Steal a Brainrot
            </Link>
            <ArrowRight className="h-4 w-4" />
            <Link href="/steal-a-brainrot/values" className="transition-colors hover:text-text-primary">
              Values
            </Link>
            <ArrowRight className="h-4 w-4" />
            <span className="text-text-primary">{brainrot.name}</span>
          </nav>

          <div className="grid gap-8 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-center">
            <div className="aspect-square overflow-hidden rounded-3xl border border-border-subtle bg-bg-overlay p-5">
              {brainrot.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={brainrot.image_url}
                  alt={brainrot.image_alt || `${brainrot.name} Steal a Brainrot`}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-text-tertiary">No image available</div>
              )}
            </div>

            <div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-border-subtle bg-bg-overlay px-3 py-1 text-xs font-semibold text-text-secondary">
                  {brainrot.rarity}
                </span>
                <span className="rounded-full border border-border-subtle bg-bg-overlay px-3 py-1 text-xs font-semibold text-text-secondary">
                  {brainrot.obtainability}
                </span>
                <span className="rounded-full border border-border-subtle bg-bg-overlay px-3 py-1 text-xs font-semibold capitalize text-text-secondary">
                  {effectiveConfidenceLabel} confidence
                </span>
              </div>

              <h1 className="mt-4 text-[22px] font-black leading-tight tracking-tight text-text-primary sm:text-[28px] lg:text-[32px]">
                {brainrot.name} Value
              </h1>

              <p className="mt-2 max-w-2xl text-[13px] leading-6 text-text-secondary sm:text-sm">
                Current value, income, mutation multipliers, rarity, and marketplace availability for {brainrot.name} in Steal a Brainrot.
              </p>

              <div className="mt-7 rounded-2xl border border-border-subtle bg-bg-overlay p-5 sm:p-6">
                <p className="text-sm font-semibold text-text-tertiary">Current Market Price</p>
                {displayPrice ? (
                  <>
                    <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
                      <p className="text-3xl font-extrabold text-text-primary">{displayPrice}</p>
                      <p className="pb-1 text-sm text-text-secondary">
                        Estimated from current comparable listings
                      </p>
                    </div>

                    {hasPublicMarketPrice && (
                      <>
                        <p className="mt-3 text-sm text-text-tertiary">
                          {marketLow && marketHigh
                            ? `Typical market range ${marketLow}–${marketHigh}`
                            : 'Current comparable market estimate'}
                          {marketSampleSize > 0
                            ? ` · Based on ${marketSampleSize.toLocaleString()} current listings`
                            : ''}
                        </p>
                        {defaultTradePrice?.is_trade_ready !== true && (
                          <p className="mt-2 text-xs text-text-tertiary">
                            Display estimate only · Cash trade verdict requires stronger evidence
                          </p>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <p className="mt-2 text-xl font-bold text-text-primary">Not enough verified market data</p>
                )}

                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    href={marketplaceHref}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-lime-text px-5 py-2.5 text-sm font-bold text-black transition hover:opacity-90"
                  >
                    View {brainrot.name} listings
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/steal-a-brainrot/values"
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border-subtle px-5 py-2.5 text-sm font-semibold text-text-primary transition hover:border-white/20"
                  >
                    Browse all values
                  </Link>
                </div>

                {updatedLabel && (
                  <p className="mt-4 text-xs text-text-tertiary">Pricing snapshot updated {updatedLabel}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-7 sm:px-6 sm:py-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-8">
        <div className="space-y-6">
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <FactCard label="Rarity" value={brainrot.rarity} />
            <FactCard label="Base income" value={formatIncome(brainrot.base_income_per_second)} />
            <FactCard label="Obtainability" value={brainrot.obtainability} />
            <FactCard label="In-game cost" value={formatMoney(brainrot.ingame_cost) ?? 'Unknown'} />
          </section>

          <MutationCalculator
            brainrotName={brainrot.name}
            baseIncomePerSecond={asNumber(brainrot.base_income_per_second)}
            mutations={mutations}
          />

          <section className="rounded-2xl border border-border-subtle bg-bg-overlay p-5 sm:p-6">
            <h2 className="text-xl font-bold text-text-primary">{brainrot.name} market value</h2>
            <p className="mt-3 leading-7 text-text-secondary">
              Current Market Price is estimated from recent comparable marketplace listings and completed sales when available. Extreme prices, bundles, and unclear variants are excluded.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <ValueRow label="Cheapest active listing" value={cheapestPrice ?? 'No active listings'} />
              <ValueRow label="Current market price" value={marketValue ?? 'Insufficient data'} />
              <ValueRow label="Quick-sale estimate" value={quickSale ?? 'Insufficient data'} />
              <ValueRow label="Patient-sale estimate" value={patientSale ?? 'Insufficient data'} />
            </div>
          </section>

          <section className="rounded-2xl border border-border-subtle bg-bg-overlay p-5 sm:p-6">
            <h2 className="text-xl font-bold text-text-primary">About {brainrot.name}</h2>
            <p className="mt-3 leading-7 text-text-secondary">
              {brainrot.name} is a {brainrot.rarity} Brainrot with a base income of {formatIncome(brainrot.base_income_per_second)}. Its current obtainability status is {brainrot.obtainability}. Mutation income estimates use the verified base income and each mutation&apos;s multiplier unless a verified variant-specific override exists.
            </p>
            {brainrot.source_url && (
              <a
                href={brainrot.source_url}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-text-primary underline underline-offset-4"
              >
                View source information
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-border-subtle bg-bg-overlay p-5">
            <div className="flex items-center gap-2 text-text-primary">
              <TrendingUp className="h-5 w-5 text-lime-text" />
              <h2 className="font-bold">Market activity</h2>
            </div>
            <dl className="mt-5 space-y-4">
              <StatRow label="Active listings" value={brainrot.active_listing_count.toLocaleString()} />
              <StatRow label="Completed sales" value={brainrot.completed_sale_count.toLocaleString()} />
              <StatRow label="Unique sellers" value={brainrot.unique_seller_count.toLocaleString()} />
              <StatRow label="Confidence" value={effectiveConfidenceLabel} capitalize />
            </dl>
          </section>

          <section className="rounded-2xl border border-border-subtle bg-bg-overlay p-5">
            <div className="flex items-center gap-2 text-text-primary">
              <ShieldCheck className="h-5 w-5 text-lime-text" />
              <h2 className="font-bold">Pricing integrity</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-text-secondary">
              Extreme prices, bundles, account sales, unclear mutations, test listings, cancelled orders, refunds, disputes, and unverified mappings are excluded from market calculations.
            </p>
          </section>
        </aside>
      </div>

      {relatedBrainrots.length > 0 && (
        <section className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="border-t border-border-subtle pt-10">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-bold text-text-primary">Related {brainrot.rarity} Brainrots</h2>
              <Link href="/steal-a-brainrot/values" className="text-sm font-semibold text-text-secondary hover:text-text-primary">
                See all values
              </Link>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {relatedBrainrots.map((related) => (
                <Link
                  key={related.id}
                  href={`/steal-a-brainrot/values/${related.slug}`}
                  className="overflow-hidden rounded-2xl border border-border-subtle bg-bg-overlay transition hover:-translate-y-0.5 hover:border-white/20"
                >
                  <div className="aspect-square bg-black/20 p-3">
                    {related.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={related.image_url} alt={`${related.name} Steal a Brainrot`} className="h-full w-full object-contain" />
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-bold text-text-primary">{related.name}</p>
                    <p className="mt-1 text-xs text-text-tertiary">
                      {formatMoney(related.display_price_usd) ?? 'Market data pending'}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  )
}

function FactCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-bg-overlay p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">{label}</p>
      <p className="mt-2 break-words text-base font-bold text-text-primary">{value}</p>
    </div>
  )
}

function ValueRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-black/15 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">{label}</p>
      <p className="mt-2 font-bold text-text-primary">{value}</p>
    </div>
  )
}

function StatRow({ label, value, capitalize = false }: { label: string; value: string; capitalize?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border-subtle pb-4 last:border-0 last:pb-0">
      <dt className="text-sm text-text-secondary">{label}</dt>
      <dd className={`text-sm font-bold text-text-primary ${capitalize ? 'capitalize' : ''}`}>{value}</dd>
    </div>
  )
}
