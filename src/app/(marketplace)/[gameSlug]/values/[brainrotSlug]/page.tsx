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
  return `$${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
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

  const [mutations, relatedBrainrots] = await Promise.all([
    getMutations(brainrot.id),
    getRelatedBrainrots(brainrot),
  ])

  const displayPrice = formatMoney(brainrot.display_price_usd)
  const cheapestPrice = formatMoney(brainrot.cheapest_active_price_usd)
  const marketValue = formatMoney(brainrot.market_value_usd)
  const quickSale = formatMoney(brainrot.quick_sale_usd)
  const patientSale = formatMoney(brainrot.patient_sale_usd)
  const updatedLabel = formatDate(brainrot.price_updated_at)

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
                  {brainrot.confidence_label} confidence
                </span>
              </div>

              <h1 className="mt-4 text-[22px] font-black leading-tight tracking-tight text-text-primary sm:text-[28px] lg:text-[32px]">
                {brainrot.name} Value
              </h1>

              <p className="mt-2 max-w-2xl text-[13px] leading-6 text-text-secondary sm:text-sm">
                Current value, income, mutation multipliers, rarity, and marketplace availability for {brainrot.name} in Steal a Brainrot.
              </p>

              <div className="mt-7 rounded-2xl border border-border-subtle bg-bg-overlay p-5 sm:p-6">
                <p className="text-sm font-semibold text-text-tertiary">Current DropMarket price</p>
                {displayPrice ? (
                  <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
                    <p className="text-3xl font-extrabold text-text-primary">{displayPrice}</p>
                    <p className="pb-1 text-sm text-text-secondary">{brainrot.display_price_label}</p>
                  </div>
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
              DropMarket separates the cheapest current listing from the estimated market value. Live listing prices show what buyers can purchase now, while market value uses recent completed sales when enough verified data exists.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <ValueRow label="Cheapest active listing" value={cheapestPrice ?? 'No active listings'} />
              <ValueRow label="Estimated market value" value={marketValue ?? 'Insufficient data'} />
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
              <StatRow label="Confidence" value={brainrot.confidence_label} capitalize />
            </dl>
          </section>

          <section className="rounded-2xl border border-border-subtle bg-bg-overlay p-5">
            <div className="flex items-center gap-2 text-text-primary">
              <ShieldCheck className="h-5 w-5 text-lime-text" />
              <h2 className="font-bold">Pricing integrity</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-text-secondary">
              Test listings, cancelled orders, refunds, disputes, and unverified mappings are excluded from DropMarket value calculations.
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
